<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Make leave_type_id and leave_policy_id nullable so that a leave_application
 * can act as a container for mixed leave items (stored in leave_application_items).
 * Also make leave_policy_id nullable on leave_balances for unlimited types.
 */
return new class extends Migration
{
    public function up(): void
    {
        // leave_applications: make leave_type_id and leave_policy_id nullable
        Schema::table('leave_applications', function (Blueprint $table) {
            $table->foreignId('leave_type_id')->nullable()->change();
            $table->foreignId('leave_policy_id')->nullable()->change();
        });

        // leave_balances: make leave_policy_id nullable (for types without a policy)
        Schema::table('leave_balances', function (Blueprint $table) {
            $table->foreignId('leave_policy_id')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('leave_applications', function (Blueprint $table) {
            $table->foreignId('leave_type_id')->nullable(false)->change();
            $table->foreignId('leave_policy_id')->nullable(false)->change();
        });

        Schema::table('leave_balances', function (Blueprint $table) {
            $table->foreignId('leave_policy_id')->nullable(false)->change();
        });
    }
};
