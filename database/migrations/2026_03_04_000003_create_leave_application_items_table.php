<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('leave_application_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('leave_application_id')->constrained('leave_applications')->onDelete('cascade');
            $table->foreignId('leave_type_id')->constrained('leave_types')->onDelete('cascade');
            $table->foreignId('leave_policy_id')->nullable()->constrained('leave_policies')->onDelete('set null');
            $table->decimal('days', 8, 2)->default(1);
            $table->timestamps();
        });

        // Migrate existing leave_applications into items
        \Illuminate\Support\Facades\DB::statement('
            INSERT INTO leave_application_items (leave_application_id, leave_type_id, leave_policy_id, days, created_at, updated_at)
            SELECT id, leave_type_id, leave_policy_id, total_days, created_at, updated_at
            FROM leave_applications
            WHERE leave_type_id IS NOT NULL
        ');
    }

    public function down(): void
    {
        Schema::dropIfExists('leave_application_items');
    }
};
