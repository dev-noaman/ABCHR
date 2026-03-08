// pages/hr/leave-balances/index.tsx
import { useState } from 'react';
import { PageTemplate } from '@/components/page-template';
import { usePage, router } from '@inertiajs/react';
import { Plus } from 'lucide-react';
import { hasPermission } from '@/utils/authorization';
import { CrudTable } from '@/components/CrudTable';
import { CrudFormModal } from '@/components/CrudFormModal';
import { CrudDeleteModal } from '@/components/CrudDeleteModal';
import { toast } from '@/components/custom-toast';
import { useTranslation } from 'react-i18next';
import { Pagination } from '@/components/ui/pagination';
import { SearchAndFilterBar } from '@/components/ui/search-and-filter-bar';

export default function LeaveBalances() {
  const { t } = useTranslation();
  const { auth, leaveBalances, employees, leaveTypes, years, filters: pageFilters = {} } = usePage().props as any;
  const permissions = auth?.permissions || [];

  // State
  const [searchTerm, setSearchTerm] = useState(pageFilters.search || '');
  const [selectedEmployee, setSelectedEmployee] = useState(pageFilters.employee_id || 'all');
  const [selectedLeaveType, setSelectedLeaveType] = useState(pageFilters.leave_type_id || 'all');
  const [selectedYear, setSelectedYear] = useState(pageFilters.year || 'all');
  const [showFilters, setShowFilters] = useState(false);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [currentItem, setCurrentItem] = useState<any>(null);
  const [formMode, setFormMode] = useState<'create' | 'edit' | 'view'>('create');

  const hasActiveFilters = () =>
    searchTerm !== '' || selectedEmployee !== 'all' || selectedLeaveType !== 'all' || selectedYear !== 'all';

  const activeFilterCount = () =>
    (searchTerm ? 1 : 0) +
    (selectedEmployee !== 'all' ? 1 : 0) +
    (selectedLeaveType !== 'all' ? 1 : 0) +
    (selectedYear !== 'all' ? 1 : 0);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    applyFilters();
  };

  const applyFilters = () => {
    router.get(route('hr.leave-balances.index'), {
      page: 1,
      search: searchTerm || undefined,
      employee_id: selectedEmployee !== 'all' ? selectedEmployee : undefined,
      leave_type_id: selectedLeaveType !== 'all' ? selectedLeaveType : undefined,
      year: selectedYear !== 'all' ? selectedYear : undefined,
      per_page: pageFilters.per_page
    }, { preserveState: true, preserveScroll: true });
  };

  const handleSort = (field: string) => {
    const direction = pageFilters.sort_field === field && pageFilters.sort_direction === 'asc' ? 'desc' : 'asc';

    router.get(route('hr.leave-balances.index'), {
      sort_field: field,
      sort_direction: direction,
      page: 1,
      search: searchTerm || undefined,
      employee_id: selectedEmployee !== 'all' ? selectedEmployee : undefined,
      leave_type_id: selectedLeaveType !== 'all' ? selectedLeaveType : undefined,
      year: selectedYear !== 'all' ? selectedYear : undefined,
      per_page: pageFilters.per_page
    }, { preserveState: true, preserveScroll: true });
  };

  const handleAction = (action: string, item: any) => {
    setCurrentItem(item);

    switch (action) {
      case 'view':
        setFormMode('view');
        setIsFormModalOpen(true);
        break;
      case 'edit':
        setFormMode('edit');
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
    setIsFormModalOpen(true);
  };

  const handleFormSubmit = (formData: any) => {
    if (formMode === 'create') {
      toast.loading(t('Creating leave balance...'));

      router.post(route('hr.leave-balances.store'), formData, {
        onSuccess: (page) => {
          setIsFormModalOpen(false);
          toast.dismiss();
          if (page.props.flash.success) {
            toast.success(t(page.props.flash.success));
          } else if (page.props.flash.error) {
            toast.error(t(page.props.flash.error));
          }
        },
        onError: (errors) => {
          toast.dismiss();
          if (typeof errors === 'string') {
            toast.error(errors);
          } else {
            toast.error(`Failed to create leave balance: ${Object.values(errors).join(', ')}`);
          }
        }
      });
    } else if (formMode === 'edit') {
      toast.loading(t('Updating leave balance...'));

      router.put(route('hr.leave-balances.update', currentItem.id), formData, {
        onSuccess: (page) => {
          setIsFormModalOpen(false);
          toast.dismiss();
          if (page.props.flash.success) {
            toast.success(t(page.props.flash.success));
          } else if (page.props.flash.error) {
            toast.error(t(page.props.flash.error));
          }
        },
        onError: (errors) => {
          toast.dismiss();
          if (typeof errors === 'string') {
            toast.error(errors);
          } else {
            toast.error(`Failed to update leave balance: ${Object.values(errors).join(', ')}`);
          }
        }
      });
    }
  };

  const handleDeleteConfirm = () => {
    toast.loading(t('Deleting leave balance...'));

    router.delete(route('hr.leave-balances.destroy', currentItem.id), {
      onSuccess: (page) => {
        setIsDeleteModalOpen(false);
        toast.dismiss();
        if (page.props.flash.success) {
          toast.success(t(page.props.flash.success));
        } else if (page.props.flash.error) {
          toast.error(t(page.props.flash.error));
        }
      },
      onError: (errors) => {
        toast.dismiss();
        if (typeof errors === 'string') {
          toast.error(errors);
        } else {
          toast.error(`Failed to delete leave balance: ${Object.values(errors).join(', ')}`);
        }
      }
    });
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedEmployee('all');
    setSelectedLeaveType('all');
    setSelectedYear('all');
    setShowFilters(false);

    router.get(route('hr.leave-balances.index'), {
      page: 1,
      per_page: pageFilters.per_page
    }, { preserveState: true, preserveScroll: true });
  };

  // Page actions
  const pageActions = [];

  if (hasPermission(permissions, 'create-leave-balances')) {
    pageActions.push({
      label: t('Add Leave Balance'),
      icon: <Plus className="h-4 w-4 mr-2" />,
      variant: 'default',
      onClick: () => handleAddNew()
    });
  }

  const breadcrumbs = [
    { title: t('Dashboard'), href: route('dashboard') },
    { title: t('Leave Management'), href: route('hr.leave-balances.index') },
    { title: t('Leave Balances') }
  ];

  // Table columns
  const columns = [
    {
      key: 'employee',
      label: t('Employee'),
      render: (_value: any, row: any) => row.employee?.name || '-'
    },
    {
      key: 'leave_type',
      label: t('Leave Type'),
      render: (_value: any, row: any) => (
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: row.leave_type?.color }}
          />
          <span>{row.leave_type?.name || '-'}</span>
        </div>
      )
    },
    {
      key: 'year',
      label: t('Period'),
      sortable: true,
      render: (value: number, row: any) => {
        if (row.month) {
          const monthName = new Date(value, row.month - 1, 1).toLocaleString('default', { month: 'short' });
          return <span className="font-mono">{monthName} {value}</span>;
        }
        return <span className="font-mono">{value}</span>;
      }
    },
    {
      key: 'allocated_days',
      label: t('Allocated'),
      render: (value: number) => (
        <span className="font-mono text-blue-600">{value}</span>
      )
    },
    {
      key: 'prior_used_days',
      label: t('Prior Used'),
      render: (value: number) => (
        <span className="font-mono text-orange-600">{value}</span>
      )
    },
    {
      key: 'used_days',
      label: t('Used'),
      render: (value: number) => (
        <span className="font-mono text-red-600">{value}</span>
      )
    },
    {
      key: 'remaining_days',
      label: t('Remaining'),
      render: (value: number) => (
        <span className={`font-mono ${value > 0 ? 'text-green-600' : 'text-gray-500'}`}>
          {value}
        </span>
      )
    }
  ];

  // Table actions
  const actions = [
    {
      label: t('View'),
      icon: 'Eye',
      action: 'view',
      className: 'text-blue-500',
      requiredPermission: 'view-leave-balances'
    },
    {
      label: t('Edit'),
      icon: 'Edit',
      action: 'edit',
      className: 'text-amber-500',
      requiredPermission: 'edit-leave-balances'
    },
    {
      label: t('Delete'),
      icon: 'Trash2',
      action: 'delete',
      className: 'text-red-500',
      requiredPermission: 'delete-leave-balances'
    }
  ];

  // Filter / form options
  const employeeOptions = [
    { value: 'all', label: t('All Employees') },
    ...(employees || []).map((emp: any) => ({
      value: emp.id.toString(),
      label: emp.name
    }))
  ];

  const leaveTypeOptions = [
    { value: 'all', label: t('All Leave Types') },
    ...(leaveTypes || []).map((type: any) => ({
      value: type.id.toString(),
      label: type.name
    }))
  ];

  const yearOptions = [
    { value: 'all', label: t('All Years') },
    ...(years || []).map((year: number) => ({
      value: year.toString(),
      label: year.toString()
    }))
  ];

  return (
    <PageTemplate
      title={t("Leave Balances")}
      url="/hr/leave-balances"
      actions={pageActions}
      breadcrumbs={breadcrumbs}
      noPadding
    >
      {/* Search and filters */}
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow mb-4 p-4">
        <SearchAndFilterBar
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          onSearch={handleSearch}
          filters={[
            {
              name: 'employee_id',
              label: t('Employee'),
              type: 'select',
              value: selectedEmployee,
              onChange: setSelectedEmployee,
              options: employeeOptions
            },
            {
              name: 'leave_type_id',
              label: t('Leave Type'),
              type: 'select',
              value: selectedLeaveType,
              onChange: setSelectedLeaveType,
              options: leaveTypeOptions
            },
            {
              name: 'year',
              label: t('Year'),
              type: 'select',
              value: selectedYear,
              onChange: setSelectedYear,
              options: yearOptions
            }
          ]}
          showFilters={showFilters}
          setShowFilters={setShowFilters}
          hasActiveFilters={hasActiveFilters}
          activeFilterCount={activeFilterCount}
          onResetFilters={handleResetFilters}
          onApplyFilters={applyFilters}
          currentPerPage={pageFilters.per_page?.toString() || "10"}
          onPerPageChange={(value) => {
            router.get(route('hr.leave-balances.index'), {
              page: 1,
              per_page: parseInt(value),
              search: searchTerm || undefined,
              employee_id: selectedEmployee !== 'all' ? selectedEmployee : undefined,
              leave_type_id: selectedLeaveType !== 'all' ? selectedLeaveType : undefined,
              year: selectedYear !== 'all' ? selectedYear : undefined
            }, { preserveState: true, preserveScroll: true });
          }}
        />
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow overflow-hidden">
        <CrudTable
          columns={columns}
          actions={actions}
          data={leaveBalances?.data || []}
          from={leaveBalances?.from || 1}
          onAction={handleAction}
          sortField={pageFilters.sort_field}
          sortDirection={pageFilters.sort_direction}
          onSort={handleSort}
          permissions={permissions}
          entityPermissions={{
            view: 'view-leave-balances',
            create: 'create-leave-balances',
            edit: 'edit-leave-balances',
            delete: 'delete-leave-balances'
          }}
        />

        <Pagination
          from={leaveBalances?.from || 0}
          to={leaveBalances?.to || 0}
          total={leaveBalances?.total || 0}
          links={leaveBalances?.links}
          entityName={t("leave balances")}
          onPageChange={(url) => router.get(url)}
        />
      </div>

      {/* Create / Edit / View Modal */}
      <CrudFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        onSubmit={handleFormSubmit}
        formConfig={{
          fields: [
            {
              name: 'employee_id',
              label: t('Employee'),
              type: 'select',
              required: true,
              options: employees ? employees.map((emp: any) => ({
                value: emp.id.toString(),
                label: emp.name
              })) : []
            },
            {
              name: 'leave_type_id',
              label: t('Leave Type'),
              type: 'select',
              required: true,
              options: leaveTypes ? leaveTypes.map((type: any) => ({
                value: type.id.toString(),
                label: type.name
              })) : []
            },
            {
              name: 'year',
              label: t('Year'),
              type: 'number',
              required: true,
              min: 2020,
              max: 2030,
              defaultValue: new Date().getFullYear()
            },
            {
              name: 'allocated_days',
              label: t('Allocated Days'),
              type: 'number',
              required: true,
              min: 0,
              step: 0.5
            },
            {
              name: 'prior_used_days',
              label: t('Prior Used Days'),
              type: 'number',
              min: 0,
              step: 0.5,
              defaultValue: 0,
              helpText: t('Days used before this system. Leave 0 for new staff.')
            }
          ],
          modalSize: 'lg'
        }}
        initialData={currentItem}
        title={
          formMode === 'create'
            ? t('Add New Leave Balance')
            : formMode === 'edit'
              ? t('Edit Leave Balance')
              : t('View Leave Balance')
        }
        mode={formMode}
      />

      {/* Delete Modal */}
      <CrudDeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteConfirm}
        itemName={`${currentItem?.employee?.name} - ${currentItem?.leave_type?.name} (${currentItem?.year})` || ''}
        entityName="leave balance"
      />
    </PageTemplate>
  );
}
