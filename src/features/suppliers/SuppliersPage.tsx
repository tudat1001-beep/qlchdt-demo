import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Edit2, Eye, RefreshCw, Truck } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatVND, formatPhone } from '../../lib/formatters';
import { api, ApiClientError } from '../../lib/api-client';
import { SupplierModal } from './SupplierModal';
import { SupplierDrawer } from './SupplierDrawer';
import type { Supplier } from '../../types/parties';

export const SuppliersPage: React.FC = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Modals & Drawers
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);

  const fetchSuppliers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (searchQuery.trim()) {
        params.set('q', searchQuery.trim());
      }
      const qs = params.toString() ? `?${params.toString()}` : '';
      const response = await api.get<{ items: Supplier[] }>(`/suppliers${qs}`);
      setSuppliers(response.items || []);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError('Không thể tải danh sách nhà cung cấp');
      }
      setSuppliers([]);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  const handleCreate = () => {
    setEditingSupplier(null);
    setIsModalOpen(true);
  };

  const handleEdit = (s: Supplier, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingSupplier(s);
    setIsModalOpen(true);
  };

  const handleOpenDetail = (id: string) => {
    setSelectedSupplierId(id);
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
              placeholder="Tìm theo tên nhà cung cấp, SĐT..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Tìm kiếm nhà cung cấp"
            />
          </div>
        </div>

        <div className="toolbar-group">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={fetchSuppliers}
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
            Thêm nhà cung cấp
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
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '36px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#64748b' }}>
              <RefreshCw size={16} className="spinner" style={{ animation: 'spin 1s linear infinite' }} />
              <span>Đang tải danh sách nhà cung cấp...</span>
            </div>
          </div>
        ) : suppliers.length === 0 ? (
          <EmptyState
            icon={<Truck size={28} />}
            title="Chưa có nhà cung cấp nào"
            description="Danh sách đối tác cung ứng hiện đang trống. Thêm nhà cung cấp để theo dõi phiếu nhập hàng và công nợ phải trả."
            actionLabel="Thêm nhà cung cấp mới"
            onAction={handleCreate}
          />
        ) : (
          <div className="table-responsive-wrapper">
            <table className="table-misa" aria-label="Bảng danh sách nhà cung cấp">
              <thead>
                <tr>
                  <th style={{ width: '240px' }}>Tên nhà cung cấp / đại lý</th>
                  <th style={{ width: '140px' }}>Số điện thoại</th>
                  <th>Địa chỉ kho / giao dịch</th>
                  <th style={{ width: '160px' }} className="col-num">Nợ phải trả NCC</th>
                  <th>Ghi chú & chính sách</th>
                  <th style={{ width: '140px' }} className="col-center">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((s) => (
                  <tr
                    key={s.id}
                    className="row-clickable"
                    onClick={() => handleOpenDetail(s.id)}
                    title="Nhấn để xem chi tiết nhà cung cấp"
                  >
                    <td>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{s.name}</div>
                    </td>
                    <td>{formatPhone(s.phone)}</td>
                    <td style={{ color: '#475569' }}>{s.address || '—'}</td>
                    <td className="col-money">
                      <span style={{ color: (s.debt || 0) > 0 ? '#b45309' : '#15803d' }}>
                        {formatVND(s.debt)}
                      </span>
                    </td>
                    <td style={{ fontSize: '12px', color: '#64748b' }}>{s.note || '—'}</td>
                    <td className="col-center" onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'inline-flex', gap: 4 }}>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => handleOpenDetail(s.id)}
                          title="Xem chi tiết"
                          aria-label={`Xem chi tiết nhà cung cấp ${s.name}`}
                        >
                          <Eye size={13} />
                          <span>Chi tiết</span>
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={(e) => handleEdit(s, e)}
                          title="Sửa thông tin"
                          aria-label={`Sửa nhà cung cấp ${s.name}`}
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

        <div className="table-footer-pagination">
          <span>
            Tổng cộng: <strong>{suppliers.length}</strong> nhà cung cấp
          </span>
          <span style={{ fontSize: '11.5px', color: '#64748b' }}>
            Sổ theo dõi nhà cung cấp
          </span>
        </div>
      </div>

      <SupplierModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        supplierToEdit={editingSupplier}
        onSuccess={fetchSuppliers}
      />

      <SupplierDrawer
        isOpen={!!selectedSupplierId}
        onClose={() => setSelectedSupplierId(null)}
        supplierId={selectedSupplierId}
        onEdit={() => {
          const current = suppliers.find((s) => s.id === selectedSupplierId);
          if (current) {
            handleEdit(current);
          }
        }}
      />
    </>
  );
};
