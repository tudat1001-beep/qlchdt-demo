import React, { useState, useEffect, useCallback } from 'react';
import { Drawer } from '../../components/ui/Drawer';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatVND, formatPhone, formatDateTime } from '../../lib/formatters';
import { api, ApiClientError } from '../../lib/api-client';
import type { SupplierDetail } from '../../types/parties';
import { Truck, Phone, MapPin, FileSpreadsheet, CreditCard, RefreshCw } from 'lucide-react';

interface SupplierDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  supplierId: string | null;
  onEdit: () => void;
}

export const SupplierDrawer: React.FC<SupplierDrawerProps> = ({
  isOpen,
  onClose,
  supplierId,
  onEdit,
}) => {
  const [supplier, setSupplier] = useState<SupplierDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'info' | 'purchases' | 'payments'>('info');

  const fetchDetail = useCallback(async () => {
    if (!supplierId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.get<SupplierDetail>(`/suppliers/${supplierId}`);
      setSupplier(data);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError('Không thể tải chi tiết nhà cung cấp');
      }
      setSupplier(null);
    } finally {
      setIsLoading(false);
    }
  }, [supplierId]);

  useEffect(() => {
    if (isOpen && supplierId) {
      fetchDetail();
      setActiveTab('info');
    }
  }, [isOpen, supplierId, fetchDetail]);

  if (!isOpen) return null;

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={supplier?.name || 'Chi tiết nhà cung cấp'}
      subtitle={supplier?.phone ? formatPhone(supplier.phone) : 'Hồ sơ nhà cung cấp thiết bị'}
      maxWidth="560px"
      footer={
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="secondary" onClick={onClose}>
            Đóng
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              onClose();
              onEdit();
            }}
          >
            Sửa thông tin
          </Button>
        </div>
      }
    >
      {isLoading ? (
        <div style={{ padding: '36px', textAlign: 'center', color: '#64748b' }}>
          <RefreshCw size={20} className="spinner" style={{ animation: 'spin 1s linear infinite', marginBottom: 8 }} />
          <div>Đang tải hồ sơ nhà cung cấp...</div>
        </div>
      ) : error ? (
        <div role="alert" style={{ padding: '12px', background: '#fee2e2', color: '#b91c1c', borderRadius: 6 }}>
          {error}
        </div>
      ) : !supplier ? (
        <div style={{ color: '#64748b', textAlign: 'center', padding: '24px' }}>
          Không tìm thấy hồ sơ nhà cung cấp
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Debt Payable Banner */}
          <div
            style={{
              padding: '12px 16px',
              backgroundColor: (supplier.debt || 0) > 0 ? '#fffbeb' : '#f0fdf4',
              border: `1px solid ${(supplier.debt || 0) > 0 ? '#fde68a' : '#bbf7d0'}`,
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>
                Dư nợ phải trả NCC
              </div>
              <div
                style={{
                  fontSize: '18px',
                  fontWeight: 700,
                  color: (supplier.debt || 0) > 0 ? '#b45309' : '#15803d',
                }}
              >
                {formatVND(supplier.debt)}
              </div>
            </div>
            {(supplier.debt || 0) > 0 ? (
              <Badge variant="used">Còn nợ nhà cung cấp</Badge>
            ) : (
              <Badge variant="available">Đã thanh toán đủ</Badge>
            )}
          </div>

          {/* Sub Navigation Tabs */}
          <div className="tabs-container" role="tablist">
            <button
              type="button"
              className={`tab-btn ${activeTab === 'info' ? 'active' : ''}`}
              onClick={() => setActiveTab('info')}
            >
              Thông tin
            </button>
            <button
              type="button"
              className={`tab-btn ${activeTab === 'purchases' ? 'active' : ''}`}
              onClick={() => setActiveTab('purchases')}
            >
              Phiếu nhập hàng ({supplier.purchases?.length || 0})
            </button>
            <button
              type="button"
              className={`tab-btn ${activeTab === 'payments' ? 'active' : ''}`}
              onClick={() => setActiveTab('payments')}
            >
              Chi trả tiền ({supplier.payments?.length || 0})
            </button>
          </div>

          {/* Tab Content: Info */}
          {activeTab === 'info' && (
            <div className="drawer-section">
              <div className="drawer-info-grid">
                <span className="drawer-info-label">Tên nhà cung cấp:</span>
                <span className="drawer-info-value" style={{ fontWeight: 600 }}>{supplier.name}</span>

                <span className="drawer-info-label">Điện thoại liên hệ:</span>
                <span className="drawer-info-value">{formatPhone(supplier.phone)}</span>

                <span className="drawer-info-label">Địa chỉ kho/văn phòng:</span>
                <span className="drawer-info-value">{supplier.address || '—'}</span>

                <span className="drawer-info-label">Ghi chú & Chính sách:</span>
                <span className="drawer-info-value">{supplier.note || 'Không có ghi chú'}</span>
              </div>
            </div>
          )}

          {/* Tab Content: Purchases */}
          {activeTab === 'purchases' && (
            <div className="drawer-section">
              {(!supplier.purchases || supplier.purchases.length === 0) ? (
                <EmptyState
                  icon={<FileSpreadsheet size={24} />}
                  title="Chưa có phiếu nhập nào"
                  description="Nhà cung cấp chưa có đơn nhập hàng nào được lập trong hệ thống."
                />
              ) : (
                <table className="table-misa">
                  <thead>
                    <tr>
                      <th>Số phiếu</th>
                      <th>Ngày nhập</th>
                      <th className="col-num">Tổng tiền</th>
                      <th className="col-num">Đã trả</th>
                      <th className="col-num">Còn nợ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {supplier.purchases.map((po) => (
                      <tr key={po.id}>
                        <td className="col-sku">{po.number}</td>
                        <td style={{ fontSize: '11px' }}>{formatDateTime(po.created_at)}</td>
                        <td className="col-money">{formatVND(po.total)}</td>
                        <td className="col-money" style={{ color: '#15803d' }}>{formatVND(po.paid)}</td>
                        <td className="col-money" style={{ color: po.debt > 0 ? '#b45309' : '#15803d' }}>
                          {formatVND(po.debt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Tab Content: Payments */}
          {activeTab === 'payments' && (
            <div className="drawer-section">
              {(!supplier.payments || supplier.payments.length === 0) ? (
                <EmptyState
                  icon={<CreditCard size={24} />}
                  title="Chưa có phiếu chi trả nợ"
                  description="Chưa có lịch sử thanh toán tiền hàng phát sinh cho nhà cung cấp này."
                />
              ) : (
                <table className="table-misa">
                  <thead>
                    <tr>
                      <th>Thời gian</th>
                      <th>Hình thức</th>
                      <th className="col-num">Số tiền chi</th>
                      <th>Ghi chú</th>
                    </tr>
                  </thead>
                  <tbody>
                    {supplier.payments.map((pmt) => (
                      <tr key={pmt.id}>
                        <td style={{ fontSize: '11px' }}>{formatDateTime(pmt.created_at)}</td>
                        <td>
                          <Badge variant="default">
                            {pmt.method === 'cash' ? 'Tiền mặt' : 'Chuyển khoản'}
                          </Badge>
                        </td>
                        <td className="col-money" style={{ color: '#0d9488' }}>
                          {formatVND(pmt.amount)}
                        </td>
                        <td style={{ fontSize: '11px' }}>{pmt.note || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
};
