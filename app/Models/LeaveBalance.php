<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class LeaveBalance extends BaseModel
{
    use HasFactory;

    protected $fillable = [
        'employee_id',
        'leave_type_id',
        'leave_policy_id',
        'year',
        'month',
        'allocated_days',
        'prior_used_days',
        'used_days',
        'remaining_days',
        'carried_forward',
        'manual_adjustment',
        'adjustment_reason',
        'created_by',
    ];

    protected $casts = [
        'allocated_days'    => 'decimal:2',
        'prior_used_days'   => 'decimal:2',
        'used_days'         => 'decimal:2',
        'remaining_days'    => 'decimal:2',
        'carried_forward'   => 'decimal:2',
        'manual_adjustment' => 'decimal:2',
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

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Recalculate and persist remaining_days.
     * Formula: allocated - prior_used - used (no carry forward, no manual adjustment).
     */
    public function calculateRemainingDays(): float
    {
        $this->remaining_days = (float) $this->allocated_days
            - (float) $this->prior_used_days
            - (float) $this->used_days;

        return $this->remaining_days;
    }
}
