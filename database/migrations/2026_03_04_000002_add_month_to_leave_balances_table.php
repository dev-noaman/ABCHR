<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('leave_balances', function (Blueprint $table) {
            if (! Schema::hasColumn('leave_balances', 'month')) {
                $table->unsignedTinyInteger('month')->nullable()->after('year')
                    ->comment('Null = yearly balance; 1-12 = monthly balance for tardy/early_leave');
            }
        });

        $oldIndexExists = collect(DB::select("SHOW INDEX FROM leave_balances WHERE Key_name = 'leave_balances_employee_id_leave_type_id_year_unique'"))->isNotEmpty();
        $newIndexExists = collect(DB::select("SHOW INDEX FROM leave_balances WHERE Key_name = 'leave_balances_unique'"))->isNotEmpty();

        // Add the new unique index FIRST so FKs can use it. MySQL uses the unique index
        // to satisfy foreign keys on (employee_id, leave_type_id); we must have the new
        // index in place before dropping the old one.
        if (! $newIndexExists) {
            Schema::table('leave_balances', function (Blueprint $table) {
                $table->unique(['employee_id', 'leave_type_id', 'year', 'month'], 'leave_balances_unique');
            });
        }

        if ($oldIndexExists) {
            Schema::table('leave_balances', function (Blueprint $table) {
                $table->dropUnique('leave_balances_employee_id_leave_type_id_year_unique');
            });
        }
    }

    public function down(): void
    {
        $newIndexExists = collect(DB::select("SHOW INDEX FROM leave_balances WHERE Key_name = 'leave_balances_unique'"))->isNotEmpty();
        if ($newIndexExists) {
            Schema::table('leave_balances', function (Blueprint $table) {
                $table->dropUnique('leave_balances_unique');
            });
        }

        if (Schema::hasColumn('leave_balances', 'month')) {
            Schema::table('leave_balances', function (Blueprint $table) {
                $table->dropColumn('month');
            });
        }

        $oldIndexExists = collect(DB::select("SHOW INDEX FROM leave_balances WHERE Key_name = 'leave_balances_employee_id_leave_type_id_year_unique'"))->isNotEmpty();
        if (! $oldIndexExists) {
            Schema::table('leave_balances', function (Blueprint $table) {
                $table->unique(['employee_id', 'leave_type_id', 'year']);
            });
        }
    }
};
