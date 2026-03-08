<?php

namespace Database\Seeders;

use App\Models\LeavePolicy;
use App\Models\LeaveType;
use App\Models\User;
use Illuminate\Database\Seeder;

class LeavePolicySeeder extends Seeder
{
    public function run(): void
    {
        $companies = User::where('type', 'company')->get();

        if ($companies->isEmpty()) {
            $this->command->warn('No company users found. Please run DefaultCompanySeeder first.');
            return;
        }

        /**
         * Policies keyed by slug.
         * Annual Leave uses max_days_per_year = 30 here; at allocation time the
         * leave:allocate-balances command applies the 21/30 tenure rule.
         * Unpaid / Sick: no policy — balance not tracked, no accrual needed.
         */
        $policies = [
            'annual' => [
                'name'                    => 'Annual Leave Policy',
                'description'             => 'Yearly leave — 21 days (<5 years service) or 30 days (≥5 years). Pay from Basic Salary.',
                'accrual_type'            => 'yearly',
                'accrual_rate'            => 30.00,
                'carry_forward_limit'     => 5,
                'min_days_per_application' => 1,
                'max_days_per_application' => 30,
                'requires_approval'       => true,
                'status'                  => 'active',
            ],
            'casual' => [
                'name'                    => 'Casual Leave Policy',
                'description'             => '3 paid casual leave days per month.',
                'accrual_type'            => 'monthly',
                'accrual_rate'            => 3.00,
                'carry_forward_limit'     => 0,
                'min_days_per_application' => 1,
                'max_days_per_application' => 3,
                'requires_approval'       => true,
                'status'                  => 'active',
            ],
            'tardy' => [
                'name'                    => 'Tardy Policy',
                'description'             => '3 paid occurrences of being 6–15 minutes late per month.',
                'accrual_type'            => 'monthly',
                'accrual_rate'            => 3.00,
                'carry_forward_limit'     => 0,
                'min_days_per_application' => 1,
                'max_days_per_application' => 1,
                'requires_approval'       => false,
                'status'                  => 'active',
            ],
            'early_leave' => [
                'name'                    => 'Early Leave Policy',
                'description'             => '2 paid early-leave occurrences (1–2 hours) per month.',
                'accrual_type'            => 'monthly',
                'accrual_rate'            => 2.00,
                'carry_forward_limit'     => 0,
                'min_days_per_application' => 1,
                'max_days_per_application' => 1,
                'requires_approval'       => false,
                'status'                  => 'active',
            ],
            'maternity' => [
                'name'                    => 'Maternity Leave Policy',
                'description'             => 'Paid maternity leave — up to 365 days. Employee leaves 1 hour early each approved day.',
                'accrual_type'            => 'yearly',
                'accrual_rate'            => 365.00,
                'carry_forward_limit'     => 0,
                'min_days_per_application' => 1,
                'max_days_per_application' => 365,
                'requires_approval'       => true,
                'status'                  => 'active',
            ],
        ];

        foreach ($companies as $company) {
            foreach ($policies as $slug => $policyData) {
                $leaveType = LeaveType::where('created_by', $company->id)
                    ->where('slug', $slug)
                    ->first();

                if (! $leaveType) {
                    $this->command->warn("Leave type [{$slug}] not found for company [{$company->name}]. Run LeaveTypeSeeder first.");
                    continue;
                }

                $existing = LeavePolicy::where('leave_type_id', $leaveType->id)
                    ->where('created_by', $company->id)
                    ->first();

                $payload = array_merge($policyData, [
                    'leave_type_id' => $leaveType->id,
                    'created_by'    => $company->id,
                ]);

                if ($existing) {
                    $existing->update($payload);
                } else {
                    LeavePolicy::create($payload);
                }
            }
        }

        $this->command->info('GGM LeavePolicySeeder completed successfully.');
    }
}
