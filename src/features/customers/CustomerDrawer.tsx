import React, { useState, useEffect, useCallback } from 'react';
import { Drawer } from '../../components/ui/Drawer';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatVND, formatPhone, formatDateTime } from '../../lib/formatters';
import { api, ApiClientError } from '../../lib/api-client';
import type { CustomerDetail } from '../../types/parties';
import { PaymentModal } from '../payments/PaymentModal';
import { User, Phone, MapPin, Receipt, CreditCard, ShieldAlert, RefreshCw } from 'lucide-react';

interface CustomerDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  customerId: string | null;
  onEdit: () => void;
}

export const CustomerDrawer: React.FC<CustomerDrawerProps> = ({
  isOpen,
  onClose,
  customerId,
  onEdit,
}) => {
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'info' | 'sales' | 'payments' | 'warranties'>('info');
  const [historyPage, setHistoryPage] = useState(1);
  const historyPageSize = 8;
  const [collectingPayment, setCollectingPayment] = useState<{
    referenceId: string;
    referenceNumber: string;
    partyName: string;
    outstandingDebt: number;
  } | null>(null);

  const fetchDetail = useCallback(async () => {
    if (!customerId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.get<CustomerDetail>(`/customers/${customerId}`);
      setCustomer(data);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError('Không thể tải chi tiết khách hàng');
      }
      setCustomer(null);
    } finally {
      setIsLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    if (isOpen && customerId) {
      fetchDetail();
      setActiveTab('info');
    }
  }, [isOpen, customerId, fetchDetail]);

  useEffect(() => setHistoryPage(1), [activeTab, customerId]);

  const historyPagination = (total: number) => {
    const pages = Math.max(1, Math.ceil(total / historyPageSize));
    const page = Math.min(Math.max(1, historyPage), pages);
    return (
      <div className="compact-pagination" aria-label="Phân trang lịch sử khách hàng">
        <span>{total} giao dịch · Trang {page} / {pages}</span>
        <div>
          <Button type="button" variant="secondary" size="sm" disabled={page <= 1} onClick={() => setHistoryPage((p) => p - 1)}>Trước</Button>
          <Button type="button" variant="secondary" size="sm" disabled={page >= pages} onClick={() => setHistoryPage((p) => p + 1)}>Sau</Button>
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={customer?.name || 'Chi tiết khách hàng'}
      subtitle={customer?.phone ? formatPhone(customer.phone) : 'Hồ sơ đối tác khách hàng'}
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
          <div>Đang tải hồ sơ khách hàng...</div>
        </div>
      ) : error ? (
        <div role="alert" style={{ padding: '12px', background: '#fee2e2', color: '#b91c1c', borderRadius: 6 }}>
          {error}
        </div>
      ) : !customer ? (
        <div style={{ color: '#64748b', textAlign: 'center', padding: '24px' }}>
          Không tìm thấy hồ sơ khách hàng
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Debt Summary Banner */}
          <div
            style={{
              padding: '12px 16px',
              backgroundColor: (customer.debt || 0) > 0 ? '#fef2f2' : '#f0fdf4',
              border: `1px solid ${(customer.debt || 0) > 0 ? '#fecaca' : '#bbf7d0'}`,
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>
                Công nợ hiện tại
              </div>
              <div
                style={{
                  fontSize: '18px',
                  fontWeight: 700,
                  color: (customer.debt || 0) > 0 ? '#dc2626' : '#15803d',
                }}
              >
                {formatVND(customer.debt)}
              </div>
            </div>
            {(customer.debt || 0) > 0 ? (
              <Badge variant="debt">Đang có nợ phải thu</Badge>
            ) : (
              <Badge variant="available">Không có nợ</Badge>
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
              className={`tab-btn ${activeTab === 'sales' ? 'active' : ''}`}
              onClick={() => setActiveTab('sales')}
            >
              Lịch sử mua ({customer.sales?.length || 0})
            </button>
            <button
              type="button"
              className={`tab-btn ${activeTab === 'payments' ? 'active' : ''}`}
              onClick={() => setActiveTab('payments')}
            >
              Thanh toán ({customer.payments?.length || 0})
            </button>
            <button
              type="button"
              className={`tab-btn ${activeTab === 'warranties' ? 'active' : ''}`}
              onClick={() => setActiveTab('warranties')}
            >
              Bảo hành ({customer.warranties?.length || 0})
            </button>
          </div>

          {/* Tab Content: Info */}
          {activeTab === 'info' && (
            <div className="drawer-section">
              <div className="drawer-info-grid">
                <span className="drawer-info-label">Họ và tên:</span>
                <span className="drawer-info-value" style={{ fontWeight: 600 }}>{customer.name}</span>

                <span className="drawer-info-label">Số điện thoại:</span>
                <span className="drawer-info-value">{formatPhone(customer.phone)}</span>

                <span className="drawer-info-label">Địa chỉ:</span>
                <span className="drawer-info-value">{customer.address || '—'}</span>

                <span className="drawer-info-label">Ghi chú:</span>
                <span className="drawer-info-value">{customer.note || 'Không có ghi chú'}</span>
              </div>
            </div>
          )}

          {/* Tab Content: Sales History */}
          {activeTab === 'sales' && (
            <div className="drawer-section">
              {(!customer.sales || customer.sales.length === 0) ? (
                <EmptyState
                  icon={<Receipt size={24} />}
                  title="Chưa có đơn hàng nào"
                  description="Khách hàng chưa có lịch sử mua hàng được ghi nhận trong hệ thống."
                />
              ) : (
                <>
                <table className="table-misa popup-table">
                  <thead>
                    <tr>
                      <th>Số hóa đơn</th>
                      <th>Ngày bán</th>
                      <th className="col-num">Tổng tiền</th>
                      <th className="col-num">Còn nợ</th>
                      <th style={{ textAlign: 'center', width: 90 }}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customer.sales.slice((historyPage - 1) * historyPageSize, historyPage * historyPageSize).map((sale) => (
                      <tr key={sale.id}>
                        <td data-label="Số hóa đơn" className="col-sku">{sale.number}</td>
                        <td data-label="Ngày bán" style={{ fontSize: '11px' }}>{formatDateTime(sale.created_at)}</td>
                        <td data-label="Tổng tiền" className="col-money">{formatVND(sale.total)}</td>
                        <td data-label="Còn nợ" className="col-money" style={{ color: sale.debt > 0 ? '#dc2626' : '#15803d' }}>
                          {formatVND(sale.debt)}
                        </td>
                        <td data-label="Thao tác" style={{ textAlign: 'center' }}>
                          {sale.debt > 0 && (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              style={{ fontSize: '11px', padding: '2px 6px', color: '#0d9488' }}
                              onClick={() => {
                                setCollectingPayment({
                                  referenceId: sale.id,
                                  referenceNumber: sale.number,
                                  partyName: customer.name,
                                  outstandingDebt: sale.debt,
                                });
                              }}
                            >
                              Thu nợ
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {historyPagination(customer.sales.length)}
                </>
              )}
            </div>
          )}

          {/* Tab Content: Payments */}
          {activeTab === 'payments' && (
            <div className="drawer-section">
              {(!customer.payments || customer.payments.length === 0) ? (
                <EmptyState
                  icon={<CreditCard size={24} />}
                  title="Chưa có phiếu thanh toán"
                  description="Khách hàng chưa phát sinh giao dịch thu tiền thanh toán nợ."
                />
              ) : (
                <>
                <table className="table-misa popup-table">
                  <thead>
                    <tr>
                      <th>Thời gian</th>
                      <th>Hình thức</th>
                      <th className="col-num">Số tiền</th>
                      <th>Ghi chú</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customer.payments.slice((historyPage - 1) * historyPageSize, historyPage * historyPageSize).map((pmt) => (
                      <tr key={pmt.id}>
                        <td data-label="Thời gian" style={{ fontSize: '11px' }}>{formatDateTime(pmt.created_at)}</td>
                        <td data-label="Hình thức">
                          <Badge variant="default">
                            {pmt.method === 'cash' ? 'Tiền mặt' : 'Chuyển khoản'}
                          </Badge>
                        </td>
                        <td data-label="Số tiền" className="col-money" style={{ color: '#0d9488' }}>
                          {formatVND(pmt.amount)}
                        </td>
                        <td data-label="Ghi chú" style={{ fontSize: '11px' }}>{pmt.note || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {historyPagination(customer.payments.length)}
                </>
              )}
            </div>
          )}

          {/* Tab Content: Warranties */}
          {activeTab === 'warranties' && (
            <div className="drawer-section">
              {(!customer.warranties || customer.warranties.length === 0) ? (
                <EmptyState
                  icon={<ShieldAlert size={24} />}
                  title="Chưa có hồ sơ bảo hành"
                  description="Khách hàng chưa có lượt tiếp nhận bảo hành máy nào."
                />
              ) : (
                <>
                <table className="table-misa popup-table">
                  <thead>
                    <tr>
                      <th>IMEI máy</th>
                      <th>Trạng thái</th>
                      <th>Vấn đề tiếp nhận</th>
                      <th>Ngày gửi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customer.warranties.slice((historyPage - 1) * historyPageSize, historyPage * historyPageSize).map((w) => (
                      <tr key={w.id}>
                        <td data-label="IMEI máy" className="col-sku">{w.imei || w.device_id}</td>
                        <td data-label="Trạng thái">
                          <Badge variant="quarantine">{w.status}</Badge>
                        </td>
                        <td data-label="Vấn đề tiếp nhận" style={{ fontSize: '12px' }}>{w.issue}</td>
                        <td data-label="Ngày gửi" style={{ fontSize: '11px' }}>{formatDateTime(w.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {historyPagination(customer.warranties.length)}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {collectingPayment && (
        <PaymentModal
          isOpen={!!collectingPayment}
          onClose={() => setCollectingPayment(null)}
          partyType="customer"
          referenceId={collectingPayment.referenceId}
          referenceNumber={collectingPayment.referenceNumber}
          partyName={collectingPayment.partyName}
          outstandingDebt={collectingPayment.outstandingDebt}
          onSuccess={() => {
            fetchDetail();
          }}
        />
      )}
    </Drawer>
  );
};
