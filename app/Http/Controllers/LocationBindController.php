<?php

namespace App\Http\Controllers;

use App\Models\LocationBind;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class LocationBindController extends Controller
{
    public function store(Request $request)
    {
        if (Auth::user()->can('create-location-bind')) {
            $validated = $request->validate([
                'name' => 'required|string|max:255',
                'latitude' => 'required|numeric|between:-90,90',
                'longitude' => 'required|numeric|between:-180,180',
                'radius_meters' => 'nullable|integer|min:50|max:5000',
            ]);

            LocationBind::create([
                'name' => $validated['name'],
                'latitude' => $validated['latitude'],
                'longitude' => $validated['longitude'],
                'radius_meters' => $validated['radius_meters'] ?? 100,
                'created_by' => Auth::id(),
            ]);

            return redirect()->back()->with('success', __('Location Added Successfully.'));
        }

        return redirect()->back()->with('error', __('Permission Denied.'));
    }

    public function update(Request $request, LocationBind $locationBind)
    {
        if (Auth::user()->can('edit-location-bind')) {
            $validated = $request->validate([
                'name' => 'required|string|max:255',
                'latitude' => 'required|numeric|between:-90,90',
                'longitude' => 'required|numeric|between:-180,180',
                'radius_meters' => 'nullable|integer|min:50|max:5000',
            ]);

            $locationBind->update([
                'name' => $validated['name'],
                'latitude' => $validated['latitude'],
                'longitude' => $validated['longitude'],
                'radius_meters' => $validated['radius_meters'] ?? 100,
            ]);

            return redirect()->back()->with('success', __('Location Updated Successfully.'));
        }

        return redirect()->back()->with('error', __('Permission Denied.'));
    }

    public function destroy(LocationBind $locationBind)
    {
        if (Auth::user()->can('delete-location-bind')) {
            $locationBind->delete();

            return redirect()->back()->with('success', __('Location Deleted Successfully.'));
        }

        return redirect()->back()->with('error', __('Permission Denied.'));
    }
}
