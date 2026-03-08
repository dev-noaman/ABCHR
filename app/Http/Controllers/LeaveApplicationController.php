<?php

namespace App\Http\Controllers;

use App\Models\Employee;
use App\Models\LeaveApplication;
use App\Models\LeaveApplicationItem;
use App\Models\LeaveBalance;
use App\Models\LeavePolicy;
use App\Models\LeaveType;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Carbon\Carbon;

class LeaveApplicationController extends Controller
{
    public function index(Request $request)
    {
        if (Auth::user()->can('manage-leave-applications')) {
            $query = LeaveApplication::with([
                'employee', 'leaveType', 'leavePolicy',
                'items.leaveType', 'approver', 'creator',
            ])->where(function ($q) {
                if (Auth::user()->can('manage-any-leave-applications')) {
                    $q->whereIn('created_by', getCompanyAndUsersId());
                } elseif (Auth::user()->can('manage-own-leave-applications')) {
                    $q->where('created_by', Auth::id())
                        ->orWhere('employee_id', Auth::id())
                        ->orWhere('approved_by', Auth::id());
                } else {
                    $q->whereRaw('1 = 0');
                }
            });

            if ($request->filled('search')) {
                $search = $request->search;
                $query->where(function ($q) use ($search) {
                    $q->where('reason', 'like', "%{$search}%")
                        ->orWhereHas('employee', fn ($sq) => $sq->where('name', 'like', "%{$search}%"))
                        ->orWhereHas('leaveType', fn ($sq) => $sq->where('name', 'like', "%{$search}%"));
                });
            }

            if ($request->filled('employee_id') && $request->employee_id !== 'all') {
                $query->where('employee_id', $request->employee_id);
            }

            if ($request->filled('leave_type_id') && $request->leave_type_id !== 'all') {
                $query->where(function ($q) use ($request) {
                    $q->where('leave_type_id', $request->leave_type_id)
                        ->orWhereHas('items', fn ($sq) => $sq->where('leave_type_id', $request->leave_type_id));
                });
            }

            if ($request->filled('status') && $request->status !== 'all') {
                $query->where('status', $request->status);
            }

            if ($request->filled('sort_field')) {
                $query->orderBy($request->sort_field, $request->sort_direction ?? 'asc');
            } else {
                $query->orderBy('id', 'desc');
            }

            $leaveApplications = $query->paginate($request->per_page ?? 10);

            $leaveTypes = LeaveType::whereIn('created_by', getCompanyAndUsersId())
                ->where('status', 'active')
                ->get(['id', 'name', 'color', 'slug', 'single_day_only', 'requires_attachment', 'gender_restriction']);

            return Inertia::render('hr/leave-applications/index', [
                'leaveApplications' => $leaveApplications,
                'employees'         => $this->getFilteredEmployees(),
                'leaveTypes'        => $leaveTypes,
                'filters'           => $request->all([
                    'search', 'employee_id', 'leave_type_id', 'status',
                    'sort_field', 'sort_direction', 'per_page',
                ]),
            ]);
        }

        return redirect()->back()->with('error', __('Permission Denied.'));
    }

    private function getFilteredEmployees(): array|\Illuminate\Support\Collection
    {
        $employeeQuery = Employee::whereIn('created_by', getCompanyAndUsersId());

        if (Auth::user()->can('manage-own-leave-applications') && ! Auth::user()->can('manage-any-leave-applications')) {
            $employeeQuery->where(function ($q) {
                $q->where('created_by', Auth::id())->orWhere('user_id', Auth::id());
            });
        }

        return User::emp()
            ->with('employee')
            ->whereIn('created_by', getCompanyAndUsersId())
            ->where('status', 'active')
            ->whereIn('id', $employeeQuery->pluck('user_id'))
            ->select('id', 'name')
            ->get()
            ->map(fn ($user) => [
                'id'          => $user->id,
                'name'        => $user->name,
                'employee_id' => $user->employee->employee_id ?? '',
                'gender'      => $user->employee->gender ?? null,
            ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'employee_id'  => 'required|exists:users,id',
            'start_date'   => 'required|date|after_or_equal:today',
            'end_date'     => 'required|date|after_or_equal:start_date',
            'reason'       => 'required|string',
            'attachment'   => 'nullable|string',
            // Mixed leave items: array of { leave_type_id, days }
            'items'        => 'required|array|min:1',
            'items.*.leave_type_id' => 'required|exists:leave_types,id',
            'items.*.days'          => 'required|numeric|min:0.5',
        ]);

        $validated['created_by'] = creatorId();

        $startDate = Carbon::parse($validated['start_date']);
        $endDate   = Carbon::parse($validated['end_date']);
        $totalDays = $startDate->diffInDays($endDate) + 1;

        // Build item models
        $itemPayloads = collect($validated['items'])->map(function ($item) {
            $leaveType = LeaveType::findOrFail($item['leave_type_id']);
            $policy    = LeavePolicy::where('leave_type_id', $leaveType->id)
                ->whereIn('created_by', getCompanyAndUsersId())
                ->where('status', 'active')
                ->first();
            return [
                'leaveType' => $leaveType,
                'policy'    => $policy,
                'days'      => (float) $item['days'],
            ];
        });

        // Per-item validations
        $employee = User::with('employee')->find($validated['employee_id']);

        foreach ($itemPayloads as $item) {
            $leaveType = $item['leaveType'];

            // single_day_only check
            if ($leaveType->single_day_only && $totalDays > 1) {
                return redirect()->back()->with(
                    'error',
                    __(':type requires start and end date to be the same day.', ['type' => $leaveType->name])
                );
            }

            // Gender restriction
            if ($leaveType->gender_restriction !== 'all') {
                $gender = optional($employee->employee)->gender;
                if ($gender !== $leaveType->gender_restriction) {
                    return redirect()->back()->with(
                        'error',
                        __(':type is only available for :gender employees.', [
                            'type'   => $leaveType->name,
                            'gender' => $leaveType->gender_restriction,
                        ])
                    );
                }
            }

            // Attachment required (Sick Leave)
            if ($leaveType->requires_attachment && empty($validated['attachment'])) {
                return redirect()->back()->with(
                    'error',
                    __('A Sick Leave Certificate attachment is required for :type.', ['type' => $leaveType->name])
                );
            }

            // Policy required for non no-balance types
            if ($leaveType->tracksBalance() && ! $item['policy']) {
                return redirect()->back()->with(
                    'error',
                    __('No active leave policy found for :type.', ['type' => $leaveType->name])
                );
            }

            // Balance check
            if ($leaveType->tracksBalance()) {
                $balanceError = $this->checkBalance($validated['employee_id'], $leaveType, $item['days']);
                if ($balanceError) {
                    return redirect()->back()->with('error', $balanceError);
                }
            }
        }

        // Use the first item's policy as the top-level leave_policy_id (backward compat)
        $primaryItem   = $itemPayloads->first();
        $primaryPolicy = $primaryItem['policy'];

        // Determine overall status: pending if any item requires approval
        $requiresApproval = $itemPayloads->contains(fn ($i) => $i['policy'] && $i['policy']->requires_approval);
        $status           = $requiresApproval ? 'pending' : 'approved';

        DB::transaction(function () use ($validated, $totalDays, $itemPayloads, $primaryItem, $primaryPolicy, $status) {
            $leaveApplication = LeaveApplication::create([
                'employee_id'    => $validated['employee_id'],
                'leave_type_id'  => $primaryItem['leaveType']->id,
                'leave_policy_id' => $primaryPolicy ? $primaryPolicy->id : null,
                'start_date'     => $validated['start_date'],
                'end_date'       => $validated['end_date'],
                'total_days'     => $totalDays,
                'reason'         => $validated['reason'],
                'attachment'     => $validated['attachment'] ?? null,
                'status'         => $status,
                'created_by'     => $validated['created_by'],
            ]);

            foreach ($itemPayloads as $item) {
                LeaveApplicationItem::create([
                    'leave_application_id' => $leaveApplication->id,
                    'leave_type_id'        => $item['leaveType']->id,
                    'leave_policy_id'      => $item['policy'] ? $item['policy']->id : null,
                    'days'                 => $item['days'],
                ]);
            }

            if ($status === 'approved') {
                $leaveApplication->createAttendanceRecords();
            }
        });

        return redirect()->back()->with('success', __('Leave application created successfully.'));
    }

    public function update(Request $request, $leaveApplicationId)
    {
        $leaveApplication = LeaveApplication::where('id', $leaveApplicationId)
            ->whereIn('created_by', getCompanyAndUsersId())
            ->first();

        if (! $leaveApplication) {
            return redirect()->back()->with('error', __('Leave application Not Found.'));
        }

        try {
            $validated = $request->validate([
                'employee_id'  => 'required|exists:users,id',
                'start_date'   => 'required|date',
                'end_date'     => 'required|date|after_or_equal:start_date',
                'reason'       => 'required|string',
                'attachment'   => 'nullable|string',
                'items'        => 'required|array|min:1',
                'items.*.leave_type_id' => 'required|exists:leave_types,id',
                'items.*.days'          => 'required|numeric|min:0.5',
            ]);

            $startDate = Carbon::parse($validated['start_date']);
            $endDate   = Carbon::parse($validated['end_date']);
            $totalDays = $startDate->diffInDays($endDate) + 1;

            $itemPayloads = collect($validated['items'])->map(function ($item) {
                $leaveType = LeaveType::findOrFail($item['leave_type_id']);
                $policy    = LeavePolicy::where('leave_type_id', $leaveType->id)
                    ->whereIn('created_by', getCompanyAndUsersId())
                    ->where('status', 'active')
                    ->first();
                return [
                    'leaveType' => $leaveType,
                    'policy'    => $policy,
                    'days'      => (float) $item['days'],
                ];
            });

            $primaryItem   = $itemPayloads->first();
            $primaryPolicy = $primaryItem['policy'];

            DB::transaction(function () use ($leaveApplication, $validated, $totalDays, $itemPayloads, $primaryItem, $primaryPolicy) {
                $leaveApplication->update([
                    'employee_id'     => $validated['employee_id'],
                    'leave_type_id'   => $primaryItem['leaveType']->id,
                    'leave_policy_id' => $primaryPolicy ? $primaryPolicy->id : null,
                    'start_date'      => $validated['start_date'],
                    'end_date'        => $validated['end_date'],
                    'total_days'      => $totalDays,
                    'reason'          => $validated['reason'],
                    'attachment'      => $validated['attachment'] ?? $leaveApplication->attachment,
                ]);

                $leaveApplication->items()->delete();
                foreach ($itemPayloads as $item) {
                    LeaveApplicationItem::create([
                        'leave_application_id' => $leaveApplication->id,
                        'leave_type_id'        => $item['leaveType']->id,
                        'leave_policy_id'      => $item['policy'] ? $item['policy']->id : null,
                        'days'                 => $item['days'],
                    ]);
                }
            });

            return redirect()->back()->with('success', __('Leave application updated successfully'));
        } catch (\Exception $e) {
            return redirect()->back()->with('error', $e->getMessage() ?: __('Failed to update leave application'));
        }
    }

    public function destroy($leaveApplicationId)
    {
        $leaveApplication = LeaveApplication::where('id', $leaveApplicationId)
            ->whereIn('created_by', getCompanyAndUsersId())
            ->first();

        if (! $leaveApplication) {
            return redirect()->back()->with('error', __('Leave application Not Found.'));
        }

        try {
            $leaveApplication->delete();
            return redirect()->back()->with('success', __('Leave application deleted successfully'));
        } catch (\Exception $e) {
            return redirect()->back()->with('error', $e->getMessage() ?: __('Failed to delete leave application'));
        }
    }

    public function updateStatus(Request $request, $leaveApplicationId)
    {
        $validated = $request->validate([
            'status'           => 'required|in:approved,rejected',
            'manager_comments' => 'nullable|string',
        ]);

        $leaveApplication = LeaveApplication::with(['items.leaveType'])->where('id', $leaveApplicationId)
            ->whereIn('created_by', getCompanyAndUsersId())
            ->first();

        if (! $leaveApplication) {
            return redirect()->back()->with('error', __('Leave application Not Found.'));
        }

        try {
            if ($validated['status'] === 'approved') {
                // Double-check balances before final approval
                $items = $leaveApplication->items()->with('leaveType')->get();

                if ($items->isNotEmpty()) {
                    foreach ($items as $item) {
                        if ($item->leaveType && $item->leaveType->tracksBalance()) {
                            $insufficiency = $this->checkBalance(
                                $leaveApplication->employee_id,
                                $item->leaveType,
                                (float) $item->days
                            );
                            if ($insufficiency) {
                                return redirect()->back()->with('error', $insufficiency);
                            }
                        }
                    }
                } else {
                    // Legacy single-type
                    $leaveType = $leaveApplication->leaveType;
                    if ($leaveType && $leaveType->tracksBalance()) {
                        $insufficiency = $this->checkBalance(
                            $leaveApplication->employee_id,
                            $leaveType,
                            (float) $leaveApplication->total_days
                        );
                        if ($insufficiency) {
                            return redirect()->back()->with('error', $insufficiency);
                        }
                    }
                }
            }

            $leaveApplication->update([
                'status'           => $validated['status'],
                'manager_comments' => $validated['manager_comments'],
                'approved_by'      => Auth::id(),
                'approved_at'      => now(),
            ]);

            if ($validated['status'] === 'approved') {
                $leaveApplication->createAttendanceRecords();
            }

            return redirect()->back()->with('success', __('Leave application status updated successfully'));
        } catch (\Exception $e) {
            return redirect()->back()->with('error', $e->getMessage() ?: __('Failed to update leave application status'));
        }
    }

    /**
     * Check if an employee has sufficient balance for a leave type.
     * Returns an error message string if insufficient, null if OK.
     */
    private function checkBalance(
        int $employeeId,
        LeaveType $leaveType,
        float $days
    ): ?string {
        $year  = now()->year;
        $month = now()->month;

        $query = LeaveBalance::where('employee_id', $employeeId)
            ->where('leave_type_id', $leaveType->id)
            ->where('year', $year);

        if ($leaveType->isMonthly()) {
            $query->where('month', $month);
        } else {
            $query->whereNull('month');
        }

        $balance = $query->first();

        if (! $balance) {
            return __('No leave balance found for :type. Please contact HR.', ['type' => $leaveType->name]);
        }

        if ((float) $balance->remaining_days < $days) {
            return __('Insufficient balance for :type. Available: :available, Requested: :requested.', [
                'type'      => $leaveType->name,
                'available' => (float) $balance->remaining_days,
                'requested' => $days,
            ]);
        }

        return null;
    }
}
