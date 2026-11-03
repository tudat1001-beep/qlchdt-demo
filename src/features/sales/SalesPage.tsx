import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api-client';
import { formatVND, formatDateTime } from '../../lib/formatters';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { SaleDrawer } from './SaleDrawer';
import { PaymentModal } from '../payments/PaymentModal';
import type { Sale, SaleDetail } from '../../types/sales';
import { Search, Eye, RefreshCw, CreditCard, Receipt } from 'lucide-react';

export const SalesPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Payment modal state
  const [paymentData, setPaymentData] = useState<{
    referenceId: string;
    referenceNumber: string;
    partyName: string;
    outstandingDebt: number;
  } | null>(null);

  // Queries
  const {
    data: salesData,
    isLoading,
    refetch,
  } = useQuery<{ items: Sale[] }>({
    queryKey: ['sales'],
    queryFn: () => api.get<{ items: Sale[] }>('/sales'),
  });

  const sales = salesData?.items || [];

  const filteredSales = useMemo(() => {
    if (!searchQuery.trim()) return sales;
    const q = searchQuery.toLowerCase().trim();
    return sales.filter(
      (s) =>
        s.number.toLowerCase().includes(q) ||
        (s.customer_name && s.customer_name.toLowerCase().includes(q)) ||
        (s.note && s.note.toLowerCase().includes(q))
    );
  }, [sales, searchQuery]);

  const handleOpenDetail = (id: string) => {
    setSelectedSaleId(id);
    setIsDrawerOpen(true);
  };

  const handleOpenPayment = (sale: Sale | SaleDetail) => {
    setPaymentData({
      referenceId: sale.id,
      referenceNumber: sale.number,
      partyName: sale.customer_name || 'Khách lẻ',
      outstandingDebt: sale.debt,
    });
  };

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Phiếu bán hàng & Công nợ</h1>
          <p className="page-subtitle">
            Danh sách hóa đơn bán hàng, theo dõi doanh thu, công nợ phải thu và in hóa đơn
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Button type="button" variant="secondary" onClick={() => refetch()} title="Làm mới">
            <RefreshCw size={15} style={{ marginRight: 6 }} /> Làm mới
          </Button>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="page-filter-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ position: 'relative', width: 340 }}>
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--slate-400)',
            }}
          />
          <input
            type="text"
            className="input"
            style={{ paddingLeft: 34 }}
            placeholder="Tìm theo số hóa đơn, khách hàng, ghi chú..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Table of Sales */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--slate-500)' }}>
            Đang tải danh sách hóa đơn bán hàng...
          </div>
        ) : filteredSales.length === 0 ? (
          <EmptyState
            icon={<Receipt size={28} />}
            title="Chưa có hóa đơn bán hàng nào"
            description={searchQuery ? 'Không tìm thấy hóa đơn phù hợp từ khóa' : 'Hãy thực hiện bán hàng tại màn hình POS để tạo hóa đơn đầu tiên.'}
          />
        ) : (
          <div className="table-responsive-wrapper sales-table">
          <table className="table-misa">
            <thead>
              <tr>
                <th style={{ width: 110 }}>Mã hóa đơn</th>
                <th style={{ width: 150 }}>Thời gian</th>
                <th>Khách hàng</th>
                <th style={{ textAlign: 'right', width: 120 }}>Tiền hàng</th>
                <th style={{ textAlign: 'right', width: 110 }}>Chiết khấu</th>
                <th style={{ textAlign: 'right', width: 130 }}>Tổng cộng</th>
                <th style={{ textAlign: 'right', width: 130 }}>Đã thu</th>
                <th style={{ textAlign: 'right', width: 130 }}>Còn nợ</th>
                <th style={{ textAlign: 'center', width: 110 }}>Trạng thái</th>
                <th style={{ textAlign: 'center', width: 140 }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredSales.map((s) => (
                <tr key={s.id}>
                  <td data-label="Mã hóa đơn" style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                    <button
                      type="button"
                      onClick={() => handleOpenDetail(s.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--teal-700)',
                        cursor: 'pointer',
                        fontWeight: 600,
                        padding: 0,
                      }}
                    >
                      {s.number}
                    </button>
                  </td>
                  <td data-label="Thời gian" style={{ color: 'var(--slate-600)' }}>{formatDateTime(s.created_at)}</td>
                  <td data-label="Khách hàng" style={{ fontWeight: 500 }}>
                    {s.customer_name || <span style={{ color: 'var(--slate-400)', fontStyle: 'italic' }}>Khách lẻ</span>}
                  </td>
                  <td data-label="Tiền hàng" style={{ textAlign: 'right', color: 'var(--slate-700)' }}>{formatVND(s.subtotal)}</td>
                  <td data-label="Chiết khấu" style={{ textAlign: 'right', color: s.discount > 0 ? 'var(--danger-600)' : 'var(--slate-400)' }}>
                    {s.discount > 0 ? `-${formatVND(s.discount)}` : '—'}
                  </td>
                  <td data-label="Tổng cộng" style={{ textAlign: 'right', fontWeight: 600, color: 'var(--slate-900)' }}>{formatVND(s.total)}</td>
                  <td data-label="Đã thu" style={{ textAlign: 'right', color: 'var(--success-700)', fontWeight: 500 }}>{formatVND(s.paid)}</td>
                  <td data-label="Còn nợ" style={{ textAlign: 'right', fontWeight: 600, color: s.debt > 0 ? 'var(--danger-700)' : 'var(--slate-500)' }}>
                    {formatVND(s.debt)}
                  </td>
                  <td data-label="Trạng thái" style={{ textAlign: 'center' }}>
                    {s.status === 'posted' || s.status === 'completed' ? (
                      <Badge variant="available">Hoàn thành</Badge>
                    ) : s.status === 'partially_returned' ? (
                      <Badge variant="partially_returned">Trả một phần</Badge>
                    ) : s.status === 'returned' ? (
                      <Badge variant="returned">Đã trả hết</Badge>
                    ) : s.status === 'cancelled' ? (
                      <Badge variant="cancelled">Đã hủy</Badge>
                    ) : (
                      <Badge variant="default">{s.status}</Badge>
                    )}
                  </td>
                  <td data-label="Thao tác" style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 6 }}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenDetail(s.id)}
                        title="Xem và In hóa đơn"
                      >
                        <Eye size={14} />
                      </Button>
                      {s.debt > 0 && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleOpenPayment(s)}
                          title="Thu tiền nợ từ khách"
                          style={{ color: 'var(--teal-700)', padding: '2px 8px', fontSize: '11.5px' }}
                        >
                          <CreditCard size={12} style={{ marginRight: 3 }} /> Thu nợ
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {/* Sale Detail & Invoice Drawer */}
      <SaleDrawer
        saleId={selectedSaleId}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onOpenPayment={(s) => handleOpenPayment(s)}
      />

      {/* Debt Collection Modal */}
      {paymentData && (
        <PaymentModal
          isOpen={!!paymentData}
          onClose={() => setPaymentData(null)}
          partyType="customer"
          referenceId={paymentData.referenceId}
          referenceNumber={paymentData.referenceNumber}
          partyName={paymentData.partyName}
          outstandingDebt={paymentData.outstandingDebt}
          onSuccess={() => {
            refetch();
          }}
        />
      )}
    </div>
  );
};
