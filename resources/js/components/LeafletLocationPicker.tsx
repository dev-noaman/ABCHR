import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useRef } from 'react';

// Fix default marker icon paths broken by bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface LeafletLocationPickerProps {
    latitude: number | string;
    longitude: number | string;
    radius?: number;
    onLocationChange?: (lat: number, lng: number) => void;
    readOnly?: boolean;
    height?: string;
}

export default function LeafletLocationPicker({
    latitude,
    longitude,
    radius = 100,
    onLocationChange,
    readOnly = false,
    height = '300px',
}: LeafletLocationPickerProps) {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<L.Map | null>(null);
    const markerRef = useRef<L.Marker | null>(null);
    const circleRef = useRef<L.Circle | null>(null);

    const lat = parseFloat(String(latitude)) || 25.2854;
    const lng = parseFloat(String(longitude)) || 51.531;

    useEffect(() => {
        if (!mapContainerRef.current || mapRef.current) return;

        const map = L.map(mapContainerRef.current).setView([lat, lng], 15);
        mapRef.current = map;

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19,
        }).addTo(map);

        const marker = L.marker([lat, lng], { draggable: !readOnly }).addTo(map);
        markerRef.current = marker;

        const circle = L.circle([lat, lng], {
            radius: radius,
            color: '#3b82f6',
            fillColor: '#3b82f6',
            fillOpacity: 0.15,
        }).addTo(map);
        circleRef.current = circle;

        if (!readOnly) {
            marker.on('dragend', () => {
                const pos = marker.getLatLng();
                circle.setLatLng(pos);
                onLocationChange?.(pos.lat, pos.lng);
            });

            map.on('click', (e: L.LeafletMouseEvent) => {
                marker.setLatLng(e.latlng);
                circle.setLatLng(e.latlng);
                onLocationChange?.(e.latlng.lat, e.latlng.lng);
            });
        }

        return () => {
            map.remove();
            mapRef.current = null;
            markerRef.current = null;
            circleRef.current = null;
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Sync position when lat/lng props change externally
    useEffect(() => {
        if (!mapRef.current || !markerRef.current || !circleRef.current) return;
        const newLatLng = L.latLng(lat, lng);
        markerRef.current.setLatLng(newLatLng);
        circleRef.current.setLatLng(newLatLng);
        mapRef.current.setView(newLatLng, mapRef.current.getZoom());
    }, [lat, lng]);

    // Sync radius when prop changes
    useEffect(() => {
        circleRef.current?.setRadius(radius);
    }, [radius]);

    return <div ref={mapContainerRef} style={{ height, width: '100%', borderRadius: '0.5rem', zIndex: 0 }} />;
}
