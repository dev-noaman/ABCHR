<?php

namespace Database\Seeders;

use App\Models\LeaveType;
use App\Models\User;
use Illuminate\Database\Seeder;

class LeaveTypeSeeder extends Seeder
{
    public function run(): void
    {
        $companies = User::where('type', 'company')->get();

        if ($companies->isEmpty()) {
            $this->command->warn('No company users found. Please run DefaultCompanySeeder first.');
            return;
        }

        /**
         * GGM Leave Types specification.
         *
         * allowance_period: 'year' | 'month' | null (unlimited/no-balance)
         * allowance_value : numeric cap; null = unlimited
         * single_day_only : true  = start_date must equal end_date
         * requires_attachment: true = file upload required on submit
         * gender_restriction: 'all' | 'female' | 'male'
         */
        $leaveTypes = [
            [
                'name'                => 'Annual Leave',
                'slug'                => 'annual',
                'description'         => 'Yearly vacation leave — 21 days (<5y service) or 30 days (≥5y service). Pay calculated from Basic Salary.',
                'max_days_per_year'   => 30,
                'is_paid'             => true,
                'color'               => '#10b77f',
                'status'              => 'active',
                'allowance'           => '21/30 days*',
                'allowance_period'    => 'year',
                'allowance_value'     => 30,
                'single_day_only'     => false,
                'requires_attachment' => false,
                'gender_restriction'  => 'all',
            ],
            [
                'name'                => 'Casual Leave',
                'slug'                => 'casual',
                'description'         => 'Casual paid leave — 3 days per month.',
                'max_days_per_year'   => 36,
                'is_paid'             => true,
                'color'               => '#3B82F6',
                'status'              => 'active',
                'allowance'           => '3/month',
                'allowance_period'    => 'month',
                'allowance_value'     => 3,
                'single_day_only'     => false,
                'requires_attachment' => false,
                'gender_restriction'  => 'all',
            ],
            [
                'name'                => 'Sick Leave',
                'slug'                => 'sick',
                'description'         => 'Paid sick leave — unlimited. A Sick Leave Certificate is required.',
                'max_days_per_year'   => 0,
                'is_paid'             => true,
                'color'               => '#EF4444',
                'status'              => 'active',
                'allowance'           => 'Unlimited',
                'allowance_period'    => null,
                'allowance_value'     => null,
                'single_day_only'     => false,
                'requires_attachment' => true,
                'gender_restriction'  => 'all',
            ],
            [
                'name'                => 'Unpaid Leave',
                'slug'                => 'unpaid',
                'description'         => 'Unpaid leave — unlimited. Days are deducted from salary.',
                'max_days_per_year'   => 0,
                'is_paid'             => false,
                'color'               => '#6B7280',
                'status'              => 'active',
                'allowance'           => 'Unlimited',
                'allowance_period'    => null,
                'allowance_value'     => null,
                'single_day_only'     => false,
                'requires_attachment' => false,
                'gender_restriction'  => 'all',
            ],
            [
                'name'                => 'Tardy',
                'slug'                => 'tardy',
                'description'         => 'Paid — 6 to 15 minutes late. Max 3 occurrences per month.',
                'max_days_per_year'   => 0,
                'is_paid'             => true,
                'color'               => '#F59E0B',
                'status'              => 'active',
                'allowance'           => '3/month',
                'allowance_period'    => 'month',
                'allowance_value'     => 3,
                'single_day_only'     => true,
                'requires_attachment' => false,
                'gender_restriction'  => 'all',
            ],
            [
                'name'                => 'Early Leave',
                'slug'                => 'early_leave',
                'description'         => 'Paid — leave 1–2 hours early on the same day. Max 2 occurrences per month.',
                'max_days_per_year'   => 0,
                'is_paid'             => true,
                'color'               => '#8B5CF6',
                'status'              => 'active',
                'allowance'           => '2/month',
                'allowance_period'    => 'month',
                'allowance_value'     => 2,
                'single_day_only'     => true,
                'requires_attachment' => false,
                'gender_restriction'  => 'all',
            ],
            [
                'name'                => 'Maternity Leave',
                'slug'                => 'maternity',
                'description'         => 'Paid — female employees may leave 1 hour before normal checkout daily. Up to 365 days in a year.',
                'max_days_per_year'   => 365,
                'is_paid'             => true,
                'color'               => '#EC4899',
                'status'              => 'active',
                'allowance'           => '365 days',
                'allowance_period'    => 'year',
                'allowance_value'     => 365,
                'single_day_only'     => false,
                'requires_attachment' => false,
                'gender_restriction'  => 'female',
            ],
        ];

        foreach ($companies as $company) {
            foreach ($leaveTypes as $typeData) {
                $existing = LeaveType::where('created_by', $company->id)
                    ->where('slug', $typeData['slug'])
                    ->first();

                if ($existing) {
                    $existing->update($typeData);
                    continue;
                }

                // Also check by name in case slug was not yet present
                $existingByName = LeaveType::where('created_by', $company->id)
                    ->where('name', $typeData['name'])
                    ->first();

                if ($existingByName) {
                    $existingByName->update($typeData);
                    continue;
                }

                LeaveType::create(array_merge($typeData, ['created_by' => $company->id]));
            }
        }

        $this->command->info('GGM LeaveType seeder completed successfully.');
    }
}
