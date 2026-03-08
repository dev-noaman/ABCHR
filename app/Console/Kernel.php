<?php

namespace App\Console;

use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Console\Kernel as ConsoleKernel;

class Kernel extends ConsoleKernel
{
    /**
     * Define the application's command schedule.
     */
    protected function schedule(Schedule $schedule): void
    {
        // Run daily: allocates yearly balances on Jan 1, monthly on 1st of month.
        $schedule->command('leave:allocate-balances')
            ->dailyAt('00:05')
            ->when(function () {
                $today = now();
                // Run on the 1st of every month (covers monthly types every month
                // and yearly types on Jan 1).
                return $today->day === 1;
            })
            ->withoutOverlapping()
            ->runInBackground();
    }

    /**
     * Register the commands for the application.
     */
    protected function commands(): void
    {
        $this->load(__DIR__.'/Commands');

        require base_path('routes/console.php');
    }
}
