<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Carbon\Carbon;

class LeaveApplication extends BaseModel
{
    use HasFactory;

    protected $fillable = [
        'employee_id',
        'leave_type_id',
        'leave_policy_id',
        'start_date',
        'end_date',
        'total_days',
        'reason',
        'attachment',
        'status',
        'manager_comments',
        'approved_by',
        'approved_at',
        'created_by',
    ];

    protected $casts = [
        'start_date'  => 'date',
        'end_date'    => 'date',
        'approved_at' => 'datetime',
    ];

    public function employee()
    {
        return $this->belongsTo(User::class, 'employee_id');
    }

    public function leaveType()
    {
        return $this->belongsTo(LeaveType::class);
    }

    public function leavePolicy()
    {
        return $this->belongsTo(LeavePolicy::class);
    }

    public function approver()
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function items()
    {
        return $this->hasMany(LeaveApplicationItem::class);
    }

    /**
     * Create attendance records and update leave balances when leave is approved.
     * Handles both mixed (items) and legacy (single leave_type_id) requests.
     */
    public function createAttendanceRecords(): void
    {
        if ($this->status !== 'approved') {
            return;
        }

        $startDate = $this->start_date;
        $endDate   = $this->end_date;

        // Primary leave type name for attendance notes (use first item if available)
        $items = $this->items()->with('leaveType')->get();
        $leaveTypeName = $items->isNotEmpty()
            ? $items->map(fn ($i) => $i->leaveType->name)->implode(' / ')
            : optional($this->leaveType)->name ?? 'Leave';

        for ($date = $startDate->copy(); $date->lte($endDate); $date->addDay()) {
            if ($date->isWeekend()) {
                continue;
            }

            $existingRecord = \App\Models\AttendanceRecord::where('employee_id', $this->employee_id)
                ->where('date', $date->format('Y-m-d'))
                ->first();

            if (! $existingRecord) {
                \App\Models\AttendanceRecord::create([
                    'employee_id' => $this->employee_id,
                    'date'        => $date->format('Y-m-d'),
                    'status'      => 'on_leave',
                    'is_absent'   => false,
                    'total_hours' => 0,
                    'notes'       => 'Leave: ' . $leaveTypeName,
                    'created_by'  => $this->created_by,
                ]);
            } else {
                $existingRecord->update([
                    'status' => 'on_leave',
                    'notes'  => 'Leave: ' . $leaveTypeName,
                ]);
            }
        }

        $this->updateLeaveBalance();
    }

    /**
     * Deduct used days from leave balances for all items.
     * Uses the correct formula including carried_forward and manual_adjustment.
     * Skips leave types that do not track balance (sick, unpaid).
     */
    public function updateLeaveBalance(): void
    {
        $items = $this->items()->with('leaveType')->get();

        if ($items->isEmpty()) {
            // Legacy single-type application
            $leaveType = $this->leaveType;
            if ($leaveType && $leaveType->tracksBalance()) {
                $this->deductBalance($this->leave_type_id, $this->leave_policy_id, $this->total_days);
            }
            return;
        }

        foreach ($items as $item) {
            $leaveType = $item->leaveType;
            if (! $leaveType || ! $leaveType->tracksBalance()) {
                continue;
            }
            $this->deductBalance($item->leave_type_id, $item->leave_policy_id, (float) $item->days);
        }
    }

    /**
     * Deduct days from a specific leave type balance, using the correct formula.
     */
    private function deductBalance(int $leaveTypeId, ?int $leavePolicyId, float $days): void
    {
        $currentYear  = now()->year;
        $currentMonth = now()->month;

        $leaveType = LeaveType::find($leaveTypeId);
        $isMonthly = $leaveType && $leaveType->isMonthly();

        $query = LeaveBalance::where('employee_id', $this->employee_id)
            ->where('leave_type_id', $leaveTypeId)
            ->where('year', $currentYear);

        if ($isMonthly) {
            $query->where('month', $currentMonth);
        } else {
            $query->whereNull('month');
        }

        $leaveBalance = $query->first();

        if (! $leaveBalance) {
            $leavePolicy = $leavePolicyId ? LeavePolicy::find($leavePolicyId) : null;
            $allocated   = $leavePolicy ? ($leavePolicy->accrual_rate ?? 0) : 0;

            $leaveBalance = LeaveBalance::create([
                'employee_id'       => $this->employee_id,
                'leave_type_id'     => $leaveTypeId,
                'leave_policy_id'   => $leavePolicyId,
                'year'              => $currentYear,
                'month'             => $isMonthly ? $currentMonth : null,
                'allocated_days'    => $allocated,
                'prior_used_days'   => 0,
                'used_days'         => 0,
                'remaining_days'    => $allocated,
                'carried_forward'   => 0,
                'manual_adjustment' => 0,
                'created_by'        => $this->created_by,
            ]);
        }

        $leaveBalance->used_days = (float) $leaveBalance->used_days + $days;
        $leaveBalance->calculateRemainingDays();
        $leaveBalance->save();
    }
}
