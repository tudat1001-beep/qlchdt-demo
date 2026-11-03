import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Edit2, Eye, RefreshCw, Users } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatVND, formatPhone } from '../../lib/formatters';
import { api, ApiClientError } from '../../lib/api-client';
import { CustomerModal } from './CustomerModal';
import { CustomerDrawer } from './CustomerDrawer';
import type { Customer } from '../../types/parties';

export const CustomersPage: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearchQuery(searchQuery), 250);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  // Modals & Drawers
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    setPage(1);
  }, [debouncedSearchQuery]);

  const fetchCustomers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (debouncedSearchQuery.trim()) {
        params.set('q', debouncedSearchQuery.trim());
      }
      const qs = params.toString() ? `?${params.toString()}` : '';
      const response = await api.get<{ items: Customer[] }>(`/customers${qs}`);
      setCustomers(response.items || []);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError('Không thể tải danh sách khách hàng');
      }
      setCustomers([]);
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearchQuery]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const handleCreate = () => {
    setEditingCustomer(null);
    setIsModalOpen(true);
  };

  const handleEdit = (c: Customer, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingCustomer(c);
    setIsModalOpen(true);
  };

  const handleOpenDetail = (id: string) => {
    setSelectedCustomerId(id);
  };

  return (
    <>
      <div className="toolbar-card">
        <div className="toolbar-group">
          <div className="search-input-wrapper">
            <Search size={15} />
            <input
              type="search"
              className="search-input"
              placeholder="Tìm theo họ tên, số điện thoại..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Tìm kiếm khách hàng"
            />
          </div>
        </div>

        <div className="toolbar-group">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={fetchCustomers}
            isLoading={isLoading}
            icon={<RefreshCw size={14} />}
            aria-label="Làm mới danh sách"
          >
            Làm mới
          </Button>

          <Button
            type="button"
            variant="primary"
            onClick={handleCreate}
            icon={<Plus size={16} />}
          >
            Thêm khách hàng
          </Button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          style={{
            padding: '10px 14px',
            background: '#fee2e2',
            border: '1px solid #fca5a5',
            borderRadius: '6px',
            color: '#b91c1c',
            fontSize: '13px',
          }}
        >
          {error}
        </div>
      )}

      {/* MISA Compact Desktop Table */}
      <div className="table-card">
        {isLoading && customers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '36px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#64748b' }}>
              <RefreshCw size={16} className="spinner" style={{ animation: 'spin 1s linear infinite' }} />
              <span>Đang tải danh sách khách hàng...</span>
            </div>
          </div>
        ) : customers.length === 0 ? (
          <EmptyState
            icon={<Users size={28} />}
            title="Chưa có khách hàng nào"
            description="Danh sách khách hàng hiện đang trống. Hãy thêm hồ sơ khách hàng mới để quản lý công nợ và giao dịch."
            actionLabel="Thêm khách hàng mới"
            onAction={handleCreate}
          />
        ) : (
          <div className="table-responsive-wrapper customers-table-wrapper">
            <table className="table-misa" aria-label="Bảng danh sách khách hàng">
              <thead>
                <tr>
                  <th style={{ width: '220px' }}>Họ và tên</th>
                  <th style={{ width: '140px' }}>Số điện thoại</th>
                  <th>Địa chỉ</th>
                  <th style={{ width: '150px' }} className="col-num">Công nợ hiện tại</th>
                  <th>Ghi chú</th>
                  <th style={{ width: '140px' }} className="col-center">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {customers.slice((page - 1) * pageSize, page * pageSize).map((c) => (
                  <tr
                    key={c.id}
                    className="row-clickable"
                    onClick={() => handleOpenDetail(c.id)}
                    title="Nhấn để xem chi tiết lịch sử khách hàng"
                  >
                    <td data-label="Họ và tên">
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{c.name}</div>
                    </td>
                    <td data-label="Số điện thoại">{formatPhone(c.phone)}</td>
                    <td data-label="Địa chỉ" style={{ color: '#475569' }}>{c.address || '—'}</td>
                    <td data-label="Công nợ" className="col-money">
                      <span style={{ color: (c.debt || 0) > 0 ? '#dc2626' : '#15803d' }}>
                        {formatVND(c.debt)}
                      </span>
                    </td>
                    <td data-label="Ghi chú" style={{ fontSize: '12px', color: '#64748b' }}>{c.note || '—'}</td>
                    <td data-label="Thao tác" className="col-center" onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'inline-flex', gap: 4 }}>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => handleOpenDetail(c.id)}
                          title="Xem chi tiết"
                          aria-label={`Xem chi tiết khách hàng ${c.name}`}
                        >
                          <Eye size={13} />
                          <span>Chi tiết</span>
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={(e) => handleEdit(c, e)}
                          title="Sửa thông tin"
                          aria-label={`Sửa khách hàng ${c.name}`}
                        >
                          <Edit2 size={13} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="table-footer-pagination" aria-label="Phân trang khách hàng">
          <span>
            Tổng cộng: <strong>{customers.length}</strong> khách hàng · Trang {Math.min(page, Math.max(1, Math.ceil(customers.length / pageSize)))} / {Math.max(1, Math.ceil(customers.length / pageSize))}
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Trước
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={page >= Math.max(1, Math.ceil(customers.length / pageSize))}
              onClick={() => setPage((p) => p + 1)}
            >
              Sau
            </Button>
          </div>
        </div>
      </div>

      <CustomerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        customerToEdit={editingCustomer}
        onSuccess={fetchCustomers}
      />

      <CustomerDrawer
        isOpen={!!selectedCustomerId}
        onClose={() => setSelectedCustomerId(null)}
        customerId={selectedCustomerId}
        onEdit={() => {
          const current = customers.find((c) => c.id === selectedCustomerId);
          if (current) {
            handleEdit(current);
          }
        }}
      />
    </>
  );
};
