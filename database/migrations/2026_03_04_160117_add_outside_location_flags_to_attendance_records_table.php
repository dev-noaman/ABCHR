<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('attendance_records', function (Blueprint $table) {
            $table->boolean('clock_in_outside_location')->default(false)->after('clock_in_longitude');
            $table->boolean('clock_out_outside_location')->default(false)->after('clock_out_longitude');
        });
    }

    public function down(): void
    {
        Schema::table('attendance_records', function (Blueprint $table) {
            $table->dropColumn(['clock_in_outside_location', 'clock_out_outside_location']);
        });
    }
};
