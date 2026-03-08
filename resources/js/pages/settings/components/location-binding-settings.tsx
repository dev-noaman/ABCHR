import { lazy, Suspense, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus } from 'lucide-react';
import { CrudDeleteModal } from '@/components/CrudDeleteModal';
import { CrudTable } from '@/components/CrudTable';
import { SettingsSection } from '@/components/settings-section';
import { toast } from '@/components/custom-toast';
import { router, usePage } from '@inertiajs/react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const LeafletLocationPicker = lazy(() => import('@/components/LeafletLocationPicker'));

interface LocationBind {
    id: number;
    name: string;
    latitude: number;
    longitude: number;
    radius_meters: number;
    created_at: string;
}

const emptyForm = {
    name: '',
    latitude: '25.2854',
    longitude: '51.5310',
    radius_meters: '100',
};

export default function LocationBindingSettings() {
    const { t } = useTranslation();
    const { locationBinds = [], auth = {} } = usePage().props as any;
    const permissions: string[] = auth?.permissions || [];

    const [searchTerm, setSearchTerm] = useState('');
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [currentItem, setCurrentItem] = useState<LocationBind | null>(null);
    const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
    const [formData, setFormData] = useState(emptyForm);

    const handleAction = (action: string, item: LocationBind) => {
        setCurrentItem(item);
        switch (action) {
            case 'edit':
                setFormMode('edit');
                setFormData({
                    name: item.name,
                    latitude: String(item.latitude),
                    longitude: String(item.longitude),
                    radius_meters: String(item.radius_meters),
                });
                setIsFormModalOpen(true);
                break;
            case 'delete':
                setIsDeleteModalOpen(true);
                break;
        }
    };

    const handleAddNew = () => {
        setCurrentItem(null);
        setFormMode('create');
        setFormData(emptyForm);
        setIsFormModalOpen(true);
    };

    const handleFormSubmit = () => {
        const data = {
            name: formData.name,
            latitude: formData.latitude,
            longitude: formData.longitude,
            radius_meters: formData.radius_meters || '100',
        };

        if (formMode === 'create') {
            router.post(route('location-binds.store'), data, {
                onSuccess: (page) => {
                    setIsFormModalOpen(false);
                    const flash = (page.props as any).flash;
                    if (flash?.success) toast.success(t(flash.success));
                    else if (flash?.error) toast.error(t(flash.error));
                },
                onError: (errors) => {
                    toast.error(t('Failed to add location: {{errors}}', { errors: Object.values(errors).join(', ') }));
                },
            });
        } else if (formMode === 'edit' && currentItem) {
            router.put(route('location-binds.update', currentItem.id), data, {
                onSuccess: (page) => {
                    setIsFormModalOpen(false);
                    const flash = (page.props as any).flash;
                    if (flash?.success) toast.success(t(flash.success));
                    else if (flash?.error) toast.error(t(flash.error));
                },
                onError: (errors) => {
                    toast.error(t('Failed to update location: {{errors}}', { errors: Object.values(errors).join(', ') }));
                },
            });
        }
    };

    const handleDeleteConfirm = () => {
        if (!currentItem) return;
        router.delete(route('location-binds.destroy', currentItem.id), {
            onSuccess: (page) => {
                setIsDeleteModalOpen(false);
                const flash = (page.props as any).flash;
                if (flash?.success) toast.success(t(flash.success));
                else if (flash?.error) toast.error(t(flash.error));
            },
            onError: (errors) => {
                toast.error(t('Failed to delete location: {{errors}}', { errors: Object.values(errors).join(', ') }));
            },
        });
    };

    const handleMapLocationChange = (lat: number, lng: number) => {
        setFormData((prev) => ({
            ...prev,
            latitude: String(lat.toFixed(7)),
            longitude: String(lng.toFixed(7)),
        }));
    };

    return (
        <SettingsSection
            title={t('Location Binding Settings')}
            description={t('Manage allowed locations for clock in/out. Staff must be within the set radius to clock in or out.')}
            action={
                <Button
                    onClick={handleAddNew}
                    disabled={!permissions.includes('create-location-bind')}
                    size="sm"
                >
                    <Plus className="h-4 w-4 mr-2" />
                    {t('Add Location')}
                </Button>
            }
        >
            <Card>
                <CardContent className="p-0">
                    <div className="max-h-96 overflow-y-auto">
                        <CrudTable
                            columns={[
                                { key: 'name', label: t('Name'), sortable: true },
                                {
                                    key: 'latitude',
                                    label: t('Latitude'),
                                    render: (value) => <span className="font-mono text-sm">{value}</span>,
                                },
                                {
                                    key: 'longitude',
                                    label: t('Longitude'),
                                    render: (value) => <span className="font-mono text-sm">{value}</span>,
                                },
                                {
                                    key: 'radius_meters',
                                    label: t('Radius (m)'),
                                    render: (value) => <span className="font-mono text-sm">{value}m</span>,
                                },
                            ]}
                            actions={[
                                {
                                    label: t('Edit'),
                                    icon: 'Edit',
                                    action: 'edit',
                                    className: 'text-amber-500',
                                    requiredPermission: 'edit-location-bind',
                                },
                                {
                                    label: t('Delete'),
                                    icon: 'Trash2',
                                    action: 'delete',
                                    className: 'text-red-500',
                                    requiredPermission: 'delete-location-bind',
                                },
                            ]}
                            data={locationBinds || []}
                            from={1}
                            onAction={handleAction}
                            permissions={permissions}
                            entityPermissions={{
                                edit: 'edit-location-bind',
                                delete: 'delete-location-bind',
                            }}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Add / Edit Modal */}
            <Dialog open={isFormModalOpen} onOpenChange={setIsFormModalOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>
                            {formMode === 'create' ? t('Add Location') : t('Edit Location')}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        {/* Name */}
                        <div className="space-y-1">
                            <Label htmlFor="loc-name">{t('Name')} *</Label>
                            <Input
                                id="loc-name"
                                value={formData.name}
                                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                                placeholder={t('e.g. Main Office')}
                            />
                        </div>

                        {/* Lat/Lng row */}
                        <div className="grid grid-cols-3 gap-3">
                            <div className="space-y-1">
                                <Label htmlFor="loc-lat">{t('Latitude')} *</Label>
                                <Input
                                    id="loc-lat"
                                    type="number"
                                    step="any"
                                    value={formData.latitude}
                                    onChange={(e) => setFormData((p) => ({ ...p, latitude: e.target.value }))}
                                    placeholder="25.2854"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="loc-lng">{t('Longitude')} *</Label>
                                <Input
                                    id="loc-lng"
                                    type="number"
                                    step="any"
                                    value={formData.longitude}
                                    onChange={(e) => setFormData((p) => ({ ...p, longitude: e.target.value }))}
                                    placeholder="51.5310"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="loc-radius">{t('Radius (m)')}</Label>
                                <Input
                                    id="loc-radius"
                                    type="number"
                                    min={50}
                                    max={5000}
                                    value={formData.radius_meters}
                                    onChange={(e) => setFormData((p) => ({ ...p, radius_meters: e.target.value }))}
                                    placeholder="100"
                                />
                            </div>
                        </div>

                        {/* Map */}
                        <div className="space-y-1">
                            <Label>{t('Pick Location on Map')}</Label>
                            <p className="text-xs text-muted-foreground mb-1">
                                {t('Click on the map or drag the marker to set the location. The blue circle shows the allowed radius.')}
                            </p>
                            <Suspense fallback={<div className="h-64 bg-muted rounded-lg flex items-center justify-center text-sm text-muted-foreground">{t('Loading map...')}</div>}>
                                <LeafletLocationPicker
                                    latitude={formData.latitude}
                                    longitude={formData.longitude}
                                    radius={parseInt(formData.radius_meters) || 100}
                                    onLocationChange={handleMapLocationChange}
                                    height="280px"
                                />
                            </Suspense>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsFormModalOpen(false)}>
                            {t('Cancel')}
                        </Button>
                        <Button onClick={handleFormSubmit} disabled={!formData.name || !formData.latitude || !formData.longitude}>
                            {formMode === 'create' ? t('Add Location') : t('Save Changes')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Modal */}
            <CrudDeleteModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={handleDeleteConfirm}
                itemName={currentItem?.name || ''}
                entityName="location"
            />
        </SettingsSection>
    );
}
