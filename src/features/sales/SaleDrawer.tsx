import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Drawer } from '../../components/ui/Drawer';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { api } from '../../lib/api-client';
import { formatVND, formatDateTime } from '../../lib/formatters';
import type { SaleDetail } from '../../types/sales';
import { Printer, CreditCard, Receipt, Calendar, User, Smartphone, AlertCircle, RotateCcw, Ban } from 'lucide-react';
import { SaleReturnModal } from './SaleReturnModal';
import { SaleCancelModal } from './SaleCancelModal';

interface SaleDrawerProps {
  saleId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenPayment?: (sale: SaleDetail) => void;
}

export const SaleDrawer: React.FC<SaleDrawerProps> = ({
  saleId,
  isOpen,
  onClose,
  onOpenPayment,
}) => {
  const queryClient = useQueryClient();
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);

  const { data: sale, isLoading, isError, refetch } = useQuery<SaleDetail>({
    queryKey: ['sales', saleId],
    queryFn: () => api.get<SaleDetail>(`/sales/${saleId}`),
    enabled: isOpen && !!saleId,
  });

  const handlePrint = () => {
    window.print();
  };

  const handleReturnSuccess = () => {
    refetch();
    queryClient.invalidateQueries({ queryKey: ['sales'] });
  };

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'posted':
      case 'completed':
        return <Badge variant="available">Hoàn thành</Badge>;
      case 'partially_returned':
        return <Badge variant="partially_returned">Trả một phần</Badge>;
      case 'returned':
        return <Badge variant="returned">Đã trả hết</Badge>;
      case 'cancelled':
        return <Badge variant="cancelled">Đã hủy</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  const canReturnOrCancel = sale && sale.status !== 'returned' && sale.status !== 'cancelled';

  return (
    <>
      <Drawer
        isOpen={isOpen}
        onClose={onClose}
        title={sale ? `Hóa đơn bán hàng ${sale.number}` : 'Hóa đơn bán hàng'}
        subtitle={sale ? formatDateTime(sale.created_at) : undefined}
        maxWidth="820px"
        footer={
          sale && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button type="button" variant="secondary" size="sm" onClick={handlePrint} className="no-print">
                  <Printer size={14} style={{ marginRight: 6 }} /> In hóa đơn / Lưu PDF
                </Button>
              </div>

              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {canReturnOrCancel && (
                  <>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setIsReturnModalOpen(true)}
                      className="no-print"
                      style={{ color: 'var(--teal-700)' }}
                    >
                      <RotateCcw size={14} style={{ marginRight: 6 }} /> Trả hàng
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      onClick={() => setIsCancelModalOpen(true)}
                      className="no-print"
                    >
                      <Ban size={14} style={{ marginRight: 6 }} /> Hủy phiếu bán
                    </Button>
                  </>
                )}

                {sale.debt > 0 && onOpenPayment && (
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={() => onOpenPayment(sale)}
                    className="no-print"
                  >
                    <CreditCard size={14} style={{ marginRight: 6 }} /> Thu nợ khách ({formatVND(sale.debt)})
                  </Button>
                )}
                <Button type="button" variant="secondary" size="sm" onClick={onClose} className="no-print">
                  Đóng
                </Button>
              </div>
            </div>
          )
        }
      >
        {isLoading && (
          <div style={{ padding: '30px', textAlign: 'center', color: 'var(--slate-500)' }}>
            Đang tải chi tiết hóa đơn bán hàng...
          </div>
        )}

        {isError && (
          <div
            style={{
              padding: '16px',
              backgroundColor: 'var(--danger-50)',
              color: 'var(--danger-700)',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <AlertCircle size={16} />
            <span>Không tìm thấy thông tin phiếu bán hoặc đã xảy ra lỗi.</span>
          </div>
        )}

        {sale && (
          <div className="printable-invoice" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Header phiếu in Việt Nam */}
            <div
              style={{
                textAlign: 'center',
                borderBottom: '2px solid var(--slate-800)',
                paddingBottom: 12,
              }}
            >
              <div style={{ fontSize: '15px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--slate-900)' }}>
                CỬA HÀNG ĐIỆN THOẠI & PHỤ KIỆN QLCHDT
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--slate-600)', marginTop: 2 }}>
                Địa chỉ: 123 Đường Điện Biên Phủ, TP. Hồ Chí Minh • Hotline: 0901 234 567
              </div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--teal-900)', marginTop: 8 }}>
                HÓA ĐƠN BÁN HÀNG
              </div>
              <div style={{ fontSize: '12px', color: 'var(--slate-600)', fontFamily: 'var(--font-mono)' }}>
                Mã hóa đơn: <strong>{sale.number}</strong> | Ngày bán: {formatDateTime(sale.created_at)}
              </div>
            </div>

            {/* Thông tin khách hàng & bán lẻ */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 10,
                fontSize: '12.5px',
                padding: '8px 12px',
                backgroundColor: 'var(--slate-50)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--slate-200)',
              }}
            >
              <div>
                <span style={{ color: 'var(--slate-500)' }}>Khách hàng: </span>
                <strong style={{ color: 'var(--slate-800)' }}>
                  {sale.customer_name || 'Khách lẻ (Không lưu hồ sơ)'}
                </strong>
              </div>
              <div>
                <span style={{ color: 'var(--slate-500)' }}>Trạng thái: </span>
                {renderStatusBadge(sale.status)}
              </div>
              <div>
                <span style={{ color: 'var(--slate-500)' }}>Ghi chú: </span>
                <span>{sale.note || '—'}</span>
              </div>
              <div>
                <span style={{ color: 'var(--slate-500)' }}>Thu ngân: </span>
                <span>Quản lý hệ thống</span>
              </div>
            </div>

            {/* Bảng chi tiết mặt hàng */}
            <div style={{ overflowX: 'auto' }}>
              <table
                style={{
                  width: '100%',
                  fontSize: '12px',
                  borderCollapse: 'collapse',
                  marginTop: 4,
                  minWidth: '550px',
                }}
              >
                <thead>
                  <tr style={{ backgroundColor: 'var(--slate-100)', borderBottom: '1px solid var(--slate-300)' }}>
                    <th style={{ padding: '6px 8px', textAlign: 'center', width: 32 }}>STT</th>
                    <th style={{ padding: '6px 8px', textAlign: 'left' }}>Tên mặt hàng / IMEI</th>
                    <th style={{ padding: '6px 8px', textAlign: 'center', width: 50 }}>ĐVT</th>
                    <th style={{ padding: '6px 8px', textAlign: 'center', width: 55 }}>SL mua</th>
                    <th style={{ padding: '6px 8px', textAlign: 'center', width: 55 }}>Đã trả</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right', width: 95 }}>Đơn giá</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right', width: 85 }}>Chiết khấu</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right', width: 105 }}>Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {sale.lines.map((line, idx) => (
                    <tr key={line.id} style={{ borderBottom: '1px dashed var(--slate-200)' }}>
                      <td style={{ padding: '6px 8px', textAlign: 'center' }}>{idx + 1}</td>
                      <td style={{ padding: '6px 8px' }}>
                        <div style={{ fontWeight: 600 }}>{line.product_name}</div>
                        {line.imei && (
                          <div style={{ fontSize: '11px', color: 'var(--slate-600)', fontFamily: 'var(--font-mono)' }}>
                            IMEI: {line.imei}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '6px 8px', textAlign: 'center', color: 'var(--slate-500)' }}>
                        {line.kind === 'PHONE' ? 'Máy' : 'Cái'}
                      </td>
                      <td style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 600 }}>
                        {line.quantity}
                      </td>
                      <td style={{ padding: '6px 8px', textAlign: 'center', color: line.returned_quantity > 0 ? 'var(--danger-600)' : 'var(--slate-400)', fontWeight: line.returned_quantity > 0 ? 600 : 400 }}>
                        {line.returned_quantity || 0}
                      </td>
                      <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                        {formatVND(line.unit_price)}
                      </td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--slate-500)' }}>
                        {line.discount > 0 ? formatVND(line.discount) : '—'}
                      </td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, color: 'var(--slate-900)' }}>
                        {formatVND(line.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Tổng kết tiền - Chuẩn tài chính máy chủ tính toán */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 5,
                padding: '10px 14px',
                backgroundColor: 'var(--slate-50)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--slate-200)',
                fontSize: '13px',
                marginTop: 4,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--slate-600)' }}>
                <span>Tổng tiền hàng ban đầu:</span>
                <span>{formatVND(sale.subtotal)}</span>
              </div>
              {sale.discount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--danger-700)' }}>
                  <span>Chiết khấu đơn:</span>
                  <span>-{formatVND(sale.discount)}</span>
                </div>
              )}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontWeight: 600,
                  color: 'var(--slate-900)',
                  borderTop: '1px dashed var(--slate-300)',
                  paddingTop: 4,
                }}
              >
                <span>Tổng giá trị hóa đơn gốc:</span>
                <span>{formatVND(sale.total)}</span>
              </div>

              {/* Phần thông tin trả hàng nếu có (server-derived) */}
              {(sale.returned_total || 0) > 0 && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--danger-700)' }}>
                    <span>Giá trị hàng đã trả lại:</span>
                    <span>-{formatVND(sale.returned_total || 0)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: 'var(--teal-900)' }}>
                    <span>Doanh thu ròng thực tế:</span>
                    <span>{formatVND(sale.net_total ?? (sale.total - (sale.returned_total || 0)))}</span>
                  </div>
                </>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--success-700)', fontWeight: 600 }}>
                <span>Khách đã thanh toán:</span>
                <span>{formatVND(sale.paid)}</span>
              </div>

              {(sale.refunded || 0) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--danger-600)' }}>
                  <span>Đã hoàn tiền cho khách:</span>
                  <span>-{formatVND(sale.refunded || 0)}</span>
                </div>
              )}

              {(sale.refunded || 0) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--slate-700)', fontWeight: 600 }}>
                  <span>Thu ròng thực nhận:</span>
                  <span>{formatVND(sale.paid_net ?? (sale.paid - (sale.refunded || 0)))}</span>
                </div>
              )}

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontWeight: 700,
                  fontSize: '14px',
                  color: sale.debt > 0 ? 'var(--danger-700)' : 'var(--slate-700)',
                  borderTop: '1px dashed var(--slate-300)',
                  paddingTop: 5,
                  marginTop: 2,
                }}
              >
                <span>Còn nợ chưa thanh toán:</span>
                <span>{formatVND(sale.debt)}</span>
              </div>
            </div>

            {/* Lịch sử phương thức thanh toán */}
            {sale.payments.length > 0 && (
              <div style={{ fontSize: '11.5px', color: 'var(--slate-600)', padding: '0 4px' }}>
                <span style={{ fontWeight: 600 }}>Phương thức thanh toán: </span>
                {sale.payments.map((p, pIdx) => (
                  <span key={p.id} style={{ marginRight: 12 }}>
                    {pIdx + 1}. {p.method === 'cash' ? 'Tiền mặt' : 'Chuyển khoản'}: {formatVND(p.amount)} ({formatDateTime(p.created_at)})
                  </span>
                ))}
              </div>
            )}

            {/* Lịch sử trả hàng & Hủy phiếu bán (nếu có) */}
            {sale.returns && sale.returns.length > 0 && (
              <div className="no-print" style={{ borderTop: '1px solid var(--slate-200)', paddingTop: 12, marginTop: 4 }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--slate-800)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <RotateCcw size={15} color="var(--teal-700)" /> Lịch sử trả hàng & Hủy phiếu ({sale.returns.length} lần)
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {sale.returns.map((ret, rIdx) => (
                    <div
                      key={ret.id}
                      style={{
                        padding: '10px 12px',
                        backgroundColor: '#f8fafc',
                        border: '1px solid var(--slate-200)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '12px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontWeight: 600, color: 'var(--slate-800)' }}>
                            #{rIdx + 1}. {ret.kind === 'cancel' ? 'Hủy phiếu bán' : 'Trả hàng'}
                          </span>
                          <Badge variant={ret.kind === 'cancel' ? 'cancelled' : 'partially_returned'}>
                            {ret.kind === 'cancel' ? 'Hủy phiếu' : 'Trả hàng'}
                          </Badge>
                        </div>
                        <span style={{ color: 'var(--slate-500)', fontSize: '11px' }}>
                          {formatDateTime(ret.created_at)}
                        </span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 6, color: 'var(--slate-600)', marginTop: 4 }}>
                        <div>Lý do: <strong>{ret.reason}</strong></div>
                        <div>Kho hàng: <strong>{ret.disposition === 'available' ? 'Nhập lại kho' : 'Cách ly'}</strong></div>
                        <div>Hoàn tiền qua: <strong>{ret.method === 'cash' ? 'Tiền mặt' : 'Chuyển khoản'}</strong></div>
                        <div>Tổng trả: <strong>{formatVND(ret.total)}</strong></div>
                        <div>Giảm trừ nợ: <strong>{formatVND(ret.debt_reduction)}</strong></div>
                        <div>Đã hoàn tiền: <strong style={{ color: 'var(--danger-700)' }}>{formatVND(ret.refund)}</strong></div>
                      </div>

                      {ret.lines && ret.lines.length > 0 && (
                        <div style={{ marginTop: 6, borderTop: '1px dashed var(--slate-200)', paddingTop: 4, fontSize: '11.5px', color: 'var(--slate-600)' }}>
                          <span>Mặt hàng trả: </span>
                          {ret.lines.map((rl, rlIdx) => {
                            const originalLine = sale.lines.find((l) => l.id === rl.sale_line_id);
                            const name = originalLine?.product_name || `Mặt hàng #${rl.position + 1}`;
                            return (
                              <span key={rl.id} style={{ marginRight: 8 }}>
                                {name} (SL: {rl.quantity}, giá trị: {formatVND(rl.value)}){rlIdx < ret.lines.length - 1 ? ';' : ''}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Chữ ký hai bên */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                marginTop: 18,
                textAlign: 'center',
                fontSize: '12px',
              }}
            >
              <div>
                <div style={{ fontWeight: 700, color: 'var(--slate-800)' }}>KHÁCH HÀNG</div>
                <div style={{ fontStyle: 'italic', color: 'var(--slate-500)', fontSize: '11px', marginBottom: 50 }}>
                  (Ký, ghi rõ họ tên)
                </div>
                <div style={{ fontWeight: 600 }}>{sale.customer_name || 'Khách hàng'}</div>
              </div>

              <div>
                <div style={{ fontWeight: 700, color: 'var(--slate-800)' }}>NGƯỜI BÁN HÀNG</div>
                <div style={{ fontStyle: 'italic', color: 'var(--slate-500)', fontSize: '11px', marginBottom: 50 }}>
                  (Ký, ghi rõ họ tên)
                </div>
                <div style={{ fontWeight: 600 }}>Quản lý cửa hàng</div>
              </div>
            </div>

            <div style={{ textAlign: 'center', fontSize: '11px', color: 'var(--slate-400)', marginTop: 12 }}>
              Cảm ơn quý khách đã tin tưởng và ủng hộ cửa hàng!
            </div>
          </div>
        )}
      </Drawer>

      {sale && (
        <>
          <SaleReturnModal
            isOpen={isReturnModalOpen}
            onClose={() => setIsReturnModalOpen(false)}
            sale={sale}
            onSuccess={handleReturnSuccess}
          />
          <SaleCancelModal
            isOpen={isCancelModalOpen}
            onClose={() => setIsCancelModalOpen(false)}
            sale={sale}
            onSuccess={handleReturnSuccess}
          />
        </>
      )}
    </>
  );
};
