<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('leave_types', function (Blueprint $table) {
            $table->string('slug', 50)->nullable()->after('name');
            $table->string('allowance', 50)->nullable()->after('slug');
            $table->enum('allowance_period', ['year', 'month'])->nullable()->after('allowance');
            $table->integer('allowance_value')->nullable()->after('allowance_period');
            $table->boolean('single_day_only')->default(false)->after('allowance_value');
            $table->boolean('requires_attachment')->default(false)->after('single_day_only');
            $table->enum('gender_restriction', ['all', 'male', 'female'])->default('all')->after('requires_attachment');
        });
    }

    public function down(): void
    {
        Schema::table('leave_types', function (Blueprint $table) {
            $table->dropColumn([
                'slug',
                'allowance',
                'allowance_period',
                'allowance_value',
                'single_day_only',
                'requires_attachment',
                'gender_restriction',
            ]);
        });
    }
};
