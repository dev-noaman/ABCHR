// pages/hr/leave-applications/index.tsx
import { useState, useEffect, useCallback } from 'react';
import { PageTemplate } from '@/components/page-template';
import { usePage, router } from '@inertiajs/react';
import { Plus, CheckCircle, XCircle, Trash2 } from 'lucide-react';
import MediaPicker from '@/components/MediaPicker';
import { hasPermission } from '@/utils/authorization';
import { CrudTable } from '@/components/CrudTable';
import { CrudDeleteModal } from '@/components/CrudDeleteModal';
import { toast } from '@/components/custom-toast';
import { useTranslation } from 'react-i18next';
import { Pagination } from '@/components/ui/pagination';
import { SearchAndFilterBar } from '@/components/ui/search-and-filter-bar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

interface LeaveItem {
  leave_type_id: string;
  days: number;
}

interface LeaveType {
  id: number;
  name: string;
  color: string;
  slug: string;
  single_day_only: boolean;
  requires_attachment: boolean;
  gender_restriction: 'all' | 'male' | 'female';
}

interface Employee {
  id: number;
  name: string;
  employee_id?: string;
  gender?: string;
}

interface ApplicationForm {
  employee_id: string;
  start_date: string;
  end_date: string;
  reason: string;
  attachment: string;
  items: LeaveItem[];
}

export default function LeaveApplications() {
  const { t } = useTranslation();
  const { auth, leaveApplications, employees, leaveTypes, filters: pageFilters = {} } = usePage().props as any;
  const permissions = auth?.permissions || [];

  // Filter state
  const [searchTerm, setSearchTerm] = useState(pageFilters.search || '');
  const [selectedEmployee, setSelectedEmployee] = useState(pageFilters.employee_id || 'all');
  const [selectedLeaveType, setSelectedLeaveType] = useState(pageFilters.leave_type_id || 'all');
  const [selectedStatus, setSelectedStatus] = useState(pageFilters.status || 'all');
  const [showFilters, setShowFilters] = useState(false);

  // Modal state
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [currentItem, setCurrentItem] = useState<any>(null);
  const [formMode, setFormMode] = useState<'create' | 'edit' | 'view'>('create');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Application form state
  const emptyForm: ApplicationForm = {
    employee_id: '',
    start_date: '',
    end_date: '',
    reason: '',
    attachment: '',
    items: [{ leave_type_id: '', days: 1 }],
  };
  const [form, setForm] = useState<ApplicationForm>(emptyForm);

  const hasActiveFilters = () =>
    searchTerm !== '' || selectedEmployee !== 'all' || selectedLeaveType !== 'all' || selectedStatus !== 'all';

  const activeFilterCount = () =>
    (searchTerm ? 1 : 0) +
    (selectedEmployee !== 'all' ? 1 : 0) +
    (selectedLeaveType !== 'all' ? 1 : 0) +
    (selectedStatus !== 'all' ? 1 : 0);

  const applyFilters = () => {
    router.get(route('hr.leave-applications.index'), {
      page: 1,
      search: searchTerm || undefined,
      employee_id: selectedEmployee !== 'all' ? selectedEmployee : undefined,
      leave_type_id: selectedLeaveType !== 'all' ? selectedLeaveType : undefined,
      status: selectedStatus !== 'all' ? selectedStatus : undefined,
      per_page: pageFilters.per_page,
    }, { preserveState: true, preserveScroll: true });
  };

  const handleSort = (field: string) => {
    const direction = pageFilters.sort_field === field && pageFilters.sort_direction === 'asc' ? 'desc' : 'asc';
    router.get(route('hr.leave-applications.index'), {
      sort_field: field, sort_direction: direction, page: 1,
      search: searchTerm || undefined,
      employee_id: selectedEmployee !== 'all' ? selectedEmployee : undefined,
      leave_type_id: selectedLeaveType !== 'all' ? selectedLeaveType : undefined,
      status: selectedStatus !== 'all' ? selectedStatus : undefined,
      per_page: pageFilters.per_page,
    }, { preserveState: true, preserveScroll: true });
  };

  const openCreate = () => {
    setCurrentItem(null);
    setForm(emptyForm);
    setFormMode('create');
    setIsFormModalOpen(true);
  };

  const openEdit = (item: any) => {
    setCurrentItem(item);
    // Build items from leave_application_items or fallback
    const items: LeaveItem[] = item.items && item.items.length > 0
      ? item.items.map((i: any) => ({ leave_type_id: String(i.leave_type_id), days: Number(i.days) }))
      : [{ leave_type_id: String(item.leave_type_id || ''), days: Number(item.total_days || 1) }];

    setForm({
      employee_id: String(item.employee_id || ''),
      start_date: item.start_date ? window.appSettings?.formatDateTimeSimple(item.start_date, false) : '',
      end_date: item.end_date ? window.appSettings?.formatDateTimeSimple(item.end_date, false) : '',
      reason: item.reason || '',
      attachment: item.attachment || '',
      items,
    });
    setFormMode('edit');
    setIsFormModalOpen(true);
  };

  const openView = (item: any) => {
    setCurrentItem(item);
    setFormMode('view');
    setIsFormModalOpen(true);
  };

  const handleAction = (action: string, item: any) => {
    switch (action) {
      case 'view': openView(item); break;
      case 'edit': openEdit(item); break;
      case 'delete': setCurrentItem(item); setIsDeleteModalOpen(true); break;
      case 'approve': handleStatusUpdate(item, 'approved'); break;
      case 'reject': handleStatusUpdate(item, 'rejected'); break;
    }
  };

  // Get employee gender for filtering leave types
  const getSelectedEmployeeGender = useCallback(() => {
    if (!form.employee_id) return null;
    const emp = (employees || []).find((e: Employee) => String(e.id) === form.employee_id);
    return emp?.gender || null;
  }, [form.employee_id, employees]);

  // Filter leave types by employee gender
  const getEligibleLeaveTypes = useCallback(() => {
    const gender = getSelectedEmployeeGender();
    return (leaveTypes || []).filter((lt: LeaveType) => {
      if (lt.gender_restriction === 'all') return true;
      if (!gender) return lt.gender_restriction === 'all';
      return lt.gender_restriction === gender;
    });
  }, [leaveTypes, getSelectedEmployeeGender]);

  // Whether any selected leave type requires attachment
  const requiresAttachment = useCallback(() => {
    return form.items.some(item => {
      const lt = (leaveTypes || []).find((t: LeaveType) => String(t.id) === item.leave_type_id);
      return lt?.requires_attachment;
    });
  }, [form.items, leaveTypes]);

  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { leave_type_id: '', days: 1 }] }));

  const removeItem = (index: number) => setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== index) }));

  const updateItem = (index: number, field: keyof LeaveItem, value: string | number) => {
    // #region agent log
    if (field === 'leave_type_id') fetch('http://127.0.0.1:7776/ingest/96cd568f-7106-4fd0-8577-52c5e165e2e8',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b2a26f'},body:JSON.stringify({sessionId:'b2a26f',location:'leave-applications:updateItem',message:'updateItem leave_type_id',data:{index,value,valueType:typeof value},hypothesisId:'C',timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    setForm(f => {
      const items = [...f.items];
      items[index] = { ...items[index], [field]: value };

      // If the leave type is single_day_only, force end_date = start_date
      if (field === 'leave_type_id') {
        const lt = (leaveTypes || []).find((t: LeaveType) => String(t.id) === value);
        if (lt?.single_day_only && f.start_date) {
          return { ...f, end_date: f.start_date, items };
        }
      }
      return { ...f, items };
    });
  };

  // When start_date changes, sync end_date for single-day types
  const handleStartDateChange = (date: string) => {
    setForm(f => {
      const hasSingleDayType = f.items.some(item => {
        const lt = (leaveTypes || []).find((t: LeaveType) => String(t.id) === item.leave_type_id);
        return lt?.single_day_only;
      });
      return { ...f, start_date: date, end_date: hasSingleDayType ? date : f.end_date };
    });
  };

  const handleFormSubmit = () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    const payload = { ...form };
    const action = formMode === 'create'
      ? () => router.post(route('hr.leave-applications.store'), payload, { onFinish: () => setIsSubmitting(false), onSuccess: onSuccess, onError: onError })
      : () => router.put(route('hr.leave-applications.update', currentItem.id), payload, { onFinish: () => setIsSubmitting(false), onSuccess: onSuccess, onError: onError });

    toast.loading(formMode === 'create' ? t('Creating leave application...') : t('Updating leave application...'));
    action();
  };

  const onSuccess = (page: any) => {
    setIsFormModalOpen(false);
    toast.dismiss();
    if (page.props.flash?.success) toast.success(t(page.props.flash.success));
    else if (page.props.flash?.error) toast.error(t(page.props.flash.error));
  };

  const onError = (errors: any) => {
    toast.dismiss();
    if (typeof errors === 'string') toast.error(errors);
    else toast.error(Object.values(errors).join(', '));
  };

  const handleDeleteConfirm = () => {
    toast.loading(t('Deleting leave application...'));
    router.delete(route('hr.leave-applications.destroy', currentItem.id), {
      onSuccess: (page) => {
        setIsDeleteModalOpen(false);
        toast.dismiss();
        if (page.props.flash?.success) toast.success(t(page.props.flash.success));
        else if (page.props.flash?.error) toast.error(t(page.props.flash.error));
      },
      onError,
    });
  };

  const handleStatusUpdate = (application: any, status: string) => {
    toast.loading(`${status === 'approved' ? t('Approving') : t('Rejecting')} leave application...`);
    router.put(route('hr.leave-applications.update-status', application.id), { status, manager_comments: '' }, {
      onSuccess: (page) => {
        toast.dismiss();
        if (page.props.flash?.success) toast.success(t(page.props.flash.success));
        else if (page.props.flash?.error) toast.error(t(page.props.flash.error));
      },
      onError,
    });
  };

  const handleResetFilters = () => {
    setSearchTerm(''); setSelectedEmployee('all'); setSelectedLeaveType('all'); setSelectedStatus('all');
    setShowFilters(false);
    router.get(route('hr.leave-applications.index'), { page: 1, per_page: pageFilters.per_page }, { preserveState: true, preserveScroll: true });
  };

  const pageActions: any[] = [];
  if (hasPermission(permissions, 'create-leave-applications')) {
    pageActions.push({
      label: t('Add Leave Application'),
      icon: <Plus className="h-4 w-4 mr-2" />,
      variant: 'default',
      onClick: openCreate,
    });
  }

  const breadcrumbs = [
    { title: t('Dashboard'), href: route('dashboard') },
    { title: t('Leave Management'), href: route('hr.leave-applications.index') },
    { title: t('Leave Applications') },
  ];

  const columns = [
    {
      key: 'employee',
      label: t('Employee'),
      render: (_: any, row: any) => row.employee?.name || '-',
    },
    {
      key: 'leave_type',
      label: t('Leave Type(s)'),
      render: (_: any, row: any) => {
        // Use items if available, otherwise fallback to leave_type
        const items = row.items && row.items.length > 0 ? row.items : null;
        if (items) {
          return (
            <div className="flex flex-wrap gap-1">
              {items.map((item: any, idx: number) => (
                <span key={idx} className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium bg-gray-100 dark:bg-gray-800">
                  <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: item.leave_type?.color }} />
                  {item.leave_type?.name} ({item.days}d)
                </span>
              ))}
            </div>
          );
        }
        return (
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: row.leave_type?.color }} />
            <span>{row.leave_type?.name || '-'}</span>
          </div>
        );
      },
    },
    {
      key: 'start_date', label: t('Start Date'), sortable: true,
      render: (value: string) => window.appSettings?.formatDateTimeSimple(value, false) || new Date(value).toLocaleDateString(),
    },
    {
      key: 'end_date', label: t('End Date'), sortable: true,
      render: (value: string) => window.appSettings?.formatDateTimeSimple(value, false) || new Date(value).toLocaleDateString(),
    },
    {
      key: 'total_days', label: t('Days'),
      render: (value: number) => <span className="font-mono">{value}</span>,
    },
    {
      key: 'status', label: t('Status'),
      render: (value: string) => {
        const statusColors: Record<string, string> = {
          pending: 'bg-yellow-50 text-yellow-700 ring-yellow-600/20',
          approved: 'bg-green-50 text-green-700 ring-green-600/20',
          rejected: 'bg-red-50 text-red-700 ring-red-600/20',
        };
        return (
          <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${statusColors[value] || ''}`}>
            {value.charAt(0).toUpperCase() + value.slice(1)}
          </span>
        );
      },
    },
    {
      key: 'created_at', label: t('Applied On'), sortable: true,
      render: (value: string) => window.appSettings?.formatDateTimeSimple(value, false) || new Date(value).toLocaleDateString(),
    },
  ];

  const actions = [
    { label: t('View'), icon: 'Eye', action: 'view', className: 'text-blue-500', requiredPermission: 'view-leave-applications' },
    { label: t('Edit'), icon: 'Edit', action: 'edit', className: 'text-amber-500', requiredPermission: 'edit-leave-applications', condition: (item: any) => item.status === 'pending' },
    { label: t('Approve'), icon: 'CheckCircle', action: 'approve', className: 'text-green-500', requiredPermission: 'approve-leave-applications', condition: (item: any) => item.status === 'pending' },
    { label: t('Reject'), icon: 'XCircle', action: 'reject', className: 'text-red-500', requiredPermission: 'reject-leave-applications', condition: (item: any) => item.status === 'pending' },
    { label: t('Delete'), icon: 'Trash2', action: 'delete', className: 'text-red-500', requiredPermission: 'delete-leave-applications' },
  ];

  const employeeOptions = [
    { value: 'all', label: t('All Employees'), disabled: true },
    ...(employees || []).map((emp: Employee) => ({ value: emp.id.toString(), label: emp.name })),
  ];

  const leaveTypeOptions = [
    { value: 'all', label: t('All Leave Types'), disabled: true },
    ...(leaveTypes || []).map((type: LeaveType) => ({ value: type.id.toString(), label: type.name })),
  ];

  const statusOptions = [
    { value: 'all', label: t('All Statuses'), disabled: true },
    { value: 'pending', label: t('Pending') },
    { value: 'approved', label: t('Approved') },
    { value: 'rejected', label: t('Rejected') },
  ];

  const eligibleLeaveTypes = getEligibleLeaveTypes();
  const attachmentRequired = requiresAttachment();
  // #region agent log
  if (isFormModalOpen && (formMode === 'create' || formMode === 'edit')) {
    fetch('http://127.0.0.1:7776/ingest/96cd568f-7106-4fd0-8577-52c5e165e2e8',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b2a26f'},body:JSON.stringify({sessionId:'b2a26f',location:'leave-applications:375',message:'eligibleLeaveTypes in form modal',data:{count:eligibleLeaveTypes.length,employeeId:form.employee_id,firstNames:eligibleLeaveTypes.slice(0,3).map((lt:LeaveType)=>lt.name)},hypothesisId:'A',timestamp:Date.now()})}).catch(()=>{});
  }
  // #endregion

  const isReadOnly = formMode === 'view';

  return (
    <PageTemplate
      title={t('Leave Applications')}
      url="/hr/leave-applications"
      actions={pageActions}
      breadcrumbs={breadcrumbs}
      noPadding
    >
      {/* Search and filters */}
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow mb-4 p-4">
        <SearchAndFilterBar
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          onSearch={(e) => { e.preventDefault(); applyFilters(); }}
          filters={[
            { name: 'employee_id', label: t('Employee'), type: 'select', value: selectedEmployee, onChange: setSelectedEmployee, options: employeeOptions, searchable: true },
            { name: 'leave_type_id', label: t('Leave Type'), type: 'select', value: selectedLeaveType, onChange: setSelectedLeaveType, options: leaveTypeOptions, searchable: true },
            { name: 'status', label: t('Status'), type: 'select', value: selectedStatus, onChange: setSelectedStatus, options: statusOptions },
          ]}
          showFilters={showFilters}
          setShowFilters={setShowFilters}
          hasActiveFilters={hasActiveFilters}
          activeFilterCount={activeFilterCount}
          onResetFilters={handleResetFilters}
          onApplyFilters={applyFilters}
          currentPerPage={pageFilters.per_page?.toString() || '10'}
          onPerPageChange={(value) => {
            router.get(route('hr.leave-applications.index'), { page: 1, per_page: parseInt(value), search: searchTerm || undefined, employee_id: selectedEmployee !== 'all' ? selectedEmployee : undefined, leave_type_id: selectedLeaveType !== 'all' ? selectedLeaveType : undefined, status: selectedStatus !== 'all' ? selectedStatus : undefined }, { preserveState: true, preserveScroll: true });
          }}
        />
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow overflow-hidden">
        <CrudTable
          columns={columns}
          actions={actions}
          data={leaveApplications?.data || []}
          from={leaveApplications?.from || 1}
          onAction={handleAction}
          sortField={pageFilters.sort_field}
          sortDirection={pageFilters.sort_direction}
          onSort={handleSort}
          permissions={permissions}
          entityPermissions={{ view: 'view-leave-applications', create: 'create-leave-applications', edit: 'edit-leave-applications', delete: 'delete-leave-applications' }}
        />
        <Pagination
          from={leaveApplications?.from || 0}
          to={leaveApplications?.to || 0}
          total={leaveApplications?.total || 0}
          links={leaveApplications?.links}
          entityName={t('leave applications')}
          onPageChange={(url) => router.get(url)}
        />
      </div>

      {/* Leave Application Form Modal */}
      <Dialog open={isFormModalOpen} onOpenChange={(open) => { if (!open) setIsFormModalOpen(false); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {formMode === 'create' ? t('Add New Leave Application') : formMode === 'edit' ? t('Edit Leave Application') : t('View Leave Application')}
            </DialogTitle>
          </DialogHeader>

          {formMode === 'view' && currentItem ? (
            // Read-only view
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><Label className="text-xs text-gray-500">{t('Employee')}</Label><p className="font-medium">{currentItem.employee?.name}</p></div>
                <div><Label className="text-xs text-gray-500">{t('Status')}</Label><p className="font-medium capitalize">{currentItem.status}</p></div>
                <div><Label className="text-xs text-gray-500">{t('Start Date')}</Label><p>{window.appSettings?.formatDateTimeSimple(currentItem.start_date, false)}</p></div>
                <div><Label className="text-xs text-gray-500">{t('End Date')}</Label><p>{window.appSettings?.formatDateTimeSimple(currentItem.end_date, false)}</p></div>
                <div><Label className="text-xs text-gray-500">{t('Total Days')}</Label><p className="font-mono">{currentItem.total_days}</p></div>
              </div>
              <div>
                <Label className="text-xs text-gray-500">{t('Leave Types')}</Label>
                <div className="mt-1 space-y-1">
                  {(currentItem.items && currentItem.items.length > 0 ? currentItem.items : [{ leave_type: currentItem.leave_type, days: currentItem.total_days }]).map((item: any, idx: number) => (
                    <div key={idx} className="flex items-center gap-2 text-sm">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.leave_type?.color }} />
                      <span>{item.leave_type?.name}</span>
                      <span className="text-gray-500">— {item.days} {t('day(s)')}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div><Label className="text-xs text-gray-500">{t('Reason')}</Label><p className="text-sm">{currentItem.reason}</p></div>
              {currentItem.attachment && <div><Label className="text-xs text-gray-500">{t('Attachment')}</Label><a href={currentItem.attachment} target="_blank" rel="noreferrer" className="text-blue-600 underline text-sm">View</a></div>}
              {currentItem.manager_comments && <div><Label className="text-xs text-gray-500">{t('Manager Comments')}</Label><p className="text-sm">{currentItem.manager_comments}</p></div>}
            </div>
          ) : (
            // Create / Edit form
            <div className="space-y-4">
              {/* Employee */}
              <div>
                <Label htmlFor="employee_id">{t('Employee')} <span className="text-red-500">*</span></Label>
                <Select value={form.employee_id} onValueChange={(v) => setForm(f => ({ ...f, employee_id: v, items: [{ leave_type_id: '', days: 1 }] }))}>
                  <SelectTrigger id="employee_id"><SelectValue placeholder={t('Select employee...')} /></SelectTrigger>
                  <SelectContent>
                    {(employees || []).map((emp: Employee) => (
                      <SelectItem key={emp.id} value={String(emp.id)}>{emp.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Date range */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="start_date">{t('Start Date')} <span className="text-red-500">*</span></Label>
                  <Input id="start_date" type="date" value={form.start_date} onChange={(e) => handleStartDateChange(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="end_date">{t('End Date')} <span className="text-red-500">*</span></Label>
                  <Input id="end_date" type="date" value={form.end_date} min={form.start_date}
                    onChange={(e) => setForm(f => ({ ...f, end_date: e.target.value }))} />
                </div>
              </div>

              {/* Leave items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>{t('Leave Types & Days')} <span className="text-red-500">*</span></Label>
                  <Button type="button" variant="outline" size="sm" onClick={addItem}>
                    <Plus className="h-3 w-3 mr-1" /> {t('Add Type')}
                  </Button>
                </div>
                <div className="space-y-2">
                  {form.items.map((item, index) => {
                    const selectedLt = (leaveTypes || []).find((t: LeaveType) => String(t.id) === item.leave_type_id);
                    return (
                      <div key={index} className="flex items-center gap-2 p-2 border rounded-md">
                        <div className="flex-1">
                          <Select value={item.leave_type_id} onValueChange={(v) => updateItem(index, 'leave_type_id', v)} onOpenChange={(open)=>{/* #region agent log */fetch('http://127.0.0.1:7776/ingest/96cd568f-7106-4fd0-8577-52c5e165e2e8',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b2a26f'},body:JSON.stringify({sessionId:'b2a26f',location:'leave-applications:Select',message:'leave type Select openChange',data:{open,index},hypothesisId:'B',timestamp:Date.now()})}).catch(()=>{});/* #endregion */}}>
                            <SelectTrigger>
                              <SelectValue placeholder={t('Select leave type...')} />
                            </SelectTrigger>
                            <SelectContent>
                              {eligibleLeaveTypes.map((lt: LeaveType) => (
                                <SelectItem key={lt.id} value={String(lt.id)}>
                                  <span className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: lt.color }} />
                                    {lt.name}
                                    {lt.single_day_only && <span className="text-xs text-gray-400 ml-1">(single day)</span>}
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="w-24">
                          <Input
                            type="number"
                            min={0.5}
                            step={0.5}
                            value={item.days}
                            onChange={(e) => updateItem(index, 'days', parseFloat(e.target.value) || 1)}
                            placeholder={t('Days')}
                          />
                        </div>
                        {form.items.length > 1 && (
                          <Button type="button" variant="ghost" size="sm" onClick={() => removeItem(index)} className="text-red-500 px-2">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
                {!form.employee_id && (
                  <p className="text-xs text-gray-400 mt-1">{t('Select an employee to see eligible leave types.')}</p>
                )}
              </div>

              {/* Reason */}
              <div>
                <Label htmlFor="reason">{t('Reason')} <span className="text-red-500">*</span></Label>
                <Textarea id="reason" value={form.reason} onChange={(e) => setForm(f => ({ ...f, reason: e.target.value }))} rows={3} />
              </div>

              {/* Attachment */}
              <div>
                <Label htmlFor="attachment">
                  {t('Attachment')}
                  {attachmentRequired && <span className="text-red-500 ml-1">*</span>}
                  {attachmentRequired && <span className="text-xs text-orange-600 ml-2">({t('Sick Leave Certificate required')})</span>}
                </Label>
                <MediaPicker
                  value={form.attachment}
                  onChange={(url: string) => setForm(f => ({ ...f, attachment: url }))}
                  placeholder={t('Select attachment file...')}
                />
                <p className="text-xs text-gray-400 mt-1">{t('Upload PDF, DOC, DOCX, JPG, JPEG, PNG files')}</p>
              </div>
            </div>
          )}

          {formMode !== 'view' && (
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsFormModalOpen(false)}>{t('Cancel')}</Button>
              <Button onClick={handleFormSubmit} disabled={isSubmitting}>
                {isSubmitting ? t('Saving...') : formMode === 'create' ? t('Create Application') : t('Update Application')}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Modal */}
      <CrudDeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteConfirm}
        itemName={`${currentItem?.employee?.name} - ${currentItem?.leave_type?.name}` || ''}
        entityName="leave application"
      />
    </PageTemplate>
  );
}
