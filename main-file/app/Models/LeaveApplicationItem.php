<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class LeaveApplicationItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'leave_application_id',
        'leave_type_id',
        'leave_policy_id',
        'days',
    ];

    protected $casts = [
        'days' => 'decimal:2',
    ];

    public function leaveApplication()
    {
        return $this->belongsTo(LeaveApplication::class);
    }

    public function leaveType()
    {
        return $this->belongsTo(LeaveType::class);
    }

    public function leavePolicy()
    {
        return $this->belongsTo(LeavePolicy::class);
    }
}
