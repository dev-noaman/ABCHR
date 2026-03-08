<?php

namespace App\Console\Commands;

use App\Models\Employee;
use App\Models\LeaveBalance;
use App\Models\LeavePolicy;
use App\Models\LeaveType;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class AllocateLeaveBalancesCommand extends Command
{
    protected $signature   = 'leave:allocate-balances
                                {--year= : Year to allocate (defaults to current year)}
                                {--month= : Month to allocate monthly types (defaults to current month)}
                                {--force : Re-create balances even if they already exist}';

    protected $description = 'Automatically allocate / refill leave balances for all active employees.
                             Runs yearly types on Jan 1 and monthly types on the 1st of each month.';

    public function handle(): int
    {
        $year  = (int) ($this->option('year')  ?: now()->year);
        $month = (int) ($this->option('month') ?: now()->month);
        $force = (bool) $this->option('force');

        $this->info("Allocating leave balances — year={$year}, month={$month}");

        $leaveTypes = LeaveType::where('status', 'active')->get();

        $employees = User::emp()
            ->where('status', 'active')
            ->with('employee')
            ->get();

        $yearlyTypes  = $leaveTypes->where('allowance_period', 'year');
        $monthlyTypes = $leaveTypes->where('allowance_period', 'month');

        $yearlyCount  = 0;
        $monthlyCount = 0;

        // Yearly allocation
        foreach ($employees as $user) {
            foreach ($yearlyTypes as $leaveType) {
                if (! $this->employeeEligible($user, $leaveType)) {
                    continue;
                }

                $exists = LeaveBalance::where('employee_id', $user->id)
                    ->where('leave_type_id', $leaveType->id)
                    ->where('year', $year)
                    ->whereNull('month')
                    ->exists();

                if ($exists && ! $force) {
                    continue;
                }

                $allocated = $this->getAllocatedDays($user, $leaveType, $year);
                $policy    = $this->getPolicy($leaveType, $user);

                if ($exists && $force) {
                    LeaveBalance::where('employee_id', $user->id)
                        ->where('leave_type_id', $leaveType->id)
                        ->where('year', $year)
                        ->whereNull('month')
                        ->update([
                            'allocated_days' => $allocated,
                            'remaining_days' => DB::raw("({$allocated} - prior_used_days) - used_days"),
                        ]);
                } else {
                    LeaveBalance::create([
                        'employee_id'       => $user->id,
                        'leave_type_id'     => $leaveType->id,
                        'leave_policy_id'   => $policy ? $policy->id : null,
                        'year'              => $year,
                        'month'             => null,
                        'allocated_days'    => $allocated,
                        'prior_used_days'   => 0,
                        'used_days'         => 0,
                        'remaining_days'    => $allocated,
                        'carried_forward'   => 0,
                        'manual_adjustment' => 0,
                        'created_by'        => $user->created_by,
                    ]);
                }

                $yearlyCount++;
            }
        }

        // Monthly allocation
        foreach ($employees as $user) {
            foreach ($monthlyTypes as $leaveType) {
                if (! $this->employeeEligible($user, $leaveType)) {
                    continue;
                }

                $exists = LeaveBalance::where('employee_id', $user->id)
                    ->where('leave_type_id', $leaveType->id)
                    ->where('year', $year)
                    ->where('month', $month)
                    ->exists();

                if ($exists && ! $force) {
                    continue;
                }

                $allocated = (float) ($leaveType->allowance_value ?? 0);
                $policy    = $this->getPolicy($leaveType, $user);

                if ($exists && $force) {
                    LeaveBalance::where('employee_id', $user->id)
                        ->where('leave_type_id', $leaveType->id)
                        ->where('year', $year)
                        ->where('month', $month)
                        ->update([
                            'allocated_days' => $allocated,
                            'remaining_days' => DB::raw("({$allocated} - prior_used_days) - used_days"),
                        ]);
                } else {
                    LeaveBalance::create([
                        'employee_id'       => $user->id,
                        'leave_type_id'     => $leaveType->id,
                        'leave_policy_id'   => $policy ? $policy->id : null,
                        'year'              => $year,
                        'month'             => $month,
                        'allocated_days'    => $allocated,
                        'prior_used_days'   => 0,
                        'used_days'         => 0,
                        'remaining_days'    => $allocated,
                        'carried_forward'   => 0,
                        'manual_adjustment' => 0,
                        'created_by'        => $user->created_by,
                    ]);
                }

                $monthlyCount++;
            }
        }

        $this->info("Yearly allocations created: {$yearlyCount}");
        $this->info("Monthly allocations created: {$monthlyCount}");

        return self::SUCCESS;
    }

    /**
     * Check if employee is eligible for this leave type (e.g. gender restriction).
     */
    private function employeeEligible(User $user, LeaveType $leaveType): bool
    {
        if ($leaveType->gender_restriction === 'all') {
            return true;
        }

        $gender = optional($user->employee)->gender;

        return $gender === $leaveType->gender_restriction;
    }

    /**
     * Calculate allocated days for yearly leave types, applying tenure rule for Annual Leave.
     */
    private function getAllocatedDays(User $user, LeaveType $leaveType, int $year): float
    {
        if ($leaveType->slug === 'annual') {
            $joinDate = optional($user->employee)->date_of_joining;

            if ($joinDate) {
                $yearsOfService = Carbon::parse($joinDate)->diffInYears(Carbon::create($year, 1, 1));
                return $yearsOfService >= 5 ? 30.0 : 21.0;
            }

            // Fallback: <5 years assumed for new employees
            return 21.0;
        }

        return (float) ($leaveType->allowance_value ?? 0);
    }

    /**
     * Find the active leave policy for this leave type and company.
     */
    private function getPolicy(LeaveType $leaveType, User $user): ?LeavePolicy
    {
        return LeavePolicy::where('leave_type_id', $leaveType->id)
            ->where('status', 'active')
            ->whereIn('created_by', function ($q) use ($user) {
                $q->select('id')
                    ->from('users')
                    ->where('id', $user->created_by)
                    ->orWhere('created_by', $user->created_by);
            })
            ->first();
    }
}
