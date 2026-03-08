<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class LeaveType extends BaseModel
{
    use HasFactory;

    protected $fillable = [
        'name',
        'slug',
        'description',
        'max_days_per_year',
        'is_paid',
        'color',
        'status',
        'allowance',
        'allowance_period',
        'allowance_value',
        'single_day_only',
        'requires_attachment',
        'gender_restriction',
        'created_by',
    ];

    protected $casts = [
        'is_paid'             => 'boolean',
        'single_day_only'     => 'boolean',
        'requires_attachment' => 'boolean',
    ];

    /** Leave types that do not use balance (unlimited / no tracking) */
    public const NO_BALANCE_SLUGS = ['sick', 'unpaid'];

    /** Check whether this leave type tracks a balance */
    public function tracksBalance(): bool
    {
        return ! in_array($this->slug, self::NO_BALANCE_SLUGS, true);
    }

    /** Whether this type uses monthly balances (tardy / early_leave) */
    public function isMonthly(): bool
    {
        return $this->allowance_period === 'month';
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
