import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Drawer } from '../../components/ui/Drawer';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { api } from '../../lib/api-client';
import { formatVND, formatDateTime } from '../../lib/formatters';
import type { PurchaseDetail } from '../../types/inventory';
import { Truck, Receipt, Calendar, CreditCard, Smartphone, Package, Printer, AlertCircle } from 'lucide-react';

interface PurchaseDrawerProps {
  purchaseId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenPayment?: (purchase: PurchaseDetail) => void;
}

export const PurchaseDrawer: React.FC<PurchaseDrawerProps> = ({
  purchaseId,
  isOpen,
  onClose,
  onOpenPayment,
}) => {
  const { data: purchase, isLoading, isError } = useQuery<PurchaseDetail>({
    queryKey: ['purchases', purchaseId],
    queryFn: () => api.get<PurchaseDetail>(`/purchases/${purchaseId}`),
    enabled: isOpen && !!purchaseId,
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={purchase ? `Chi tiết phiếu nhập ${purchase.number}` : 'Chi tiết phiếu nhập'}
      subtitle={purchase ? formatDateTime(purchase.created_at) : undefined}
      maxWidth="720px"
      footer={
        purchase && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <Button type="button" variant="secondary" size="sm" onClick={handlePrint}>
              <Printer size={14} style={{ marginRight: 6 }} /> In phiếu
            </Button>
            <div style={{ display: 'flex', gap: 10 }}>
              {purchase.debt > 0 && onOpenPayment && (
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => onOpenPayment(purchase)}
                >
                  <CreditCard size={14} style={{ marginRight: 6 }} /> Trả nợ NCC ({formatVND(purchase.debt)})
                </Button>
              )}
              <Button type="button" variant="secondary" size="sm" onClick={onClose}>
                Đóng
              </Button>
            </div>
          </div>
        )
      }
    >
      {isLoading && (
        <div style={{ padding: '30px', textAlign: 'center', color: 'var(--slate-500)' }}>
          Đang tải thông tin chi tiết phiếu nhập...
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
          <span>Không tìm thấy thông tin phiếu nhập hoặc đã xảy ra lỗi.</span>
        </div>
      )}

      {purchase && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Thông tin đầu phiếu */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 12,
              padding: '12px 14px',
              backgroundColor: 'var(--slate-50)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--slate-200)',
            }}
          >
            <div>
              <div style={{ fontSize: '11.5px', color: 'var(--slate-500)', marginBottom: 2 }}>Nhà cung cấp</div>
              <div style={{ fontWeight: 600, fontSize: '13.5px', color: 'var(--slate-800)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Truck size={15} color="var(--teal-700)" />
                {purchase.supplier_name}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '11.5px', color: 'var(--slate-500)', marginBottom: 2 }}>Trạng thái</div>
              <div>
                <Badge variant="available">Đã nhập kho</Badge>
              </div>
            </div>

            <div>
              <div style={{ fontSize: '11.5px', color: 'var(--slate-500)', marginBottom: 2 }}>Thời gian lập</div>
              <div style={{ fontSize: '13px', color: 'var(--slate-700)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Calendar size={14} color="var(--slate-400)" />
                {formatDateTime(purchase.created_at)}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '11.5px', color: 'var(--slate-500)', marginBottom: 2 }}>Ghi chú</div>
              <div style={{ fontSize: '13px', color: 'var(--slate-700)' }}>
                {purchase.note || '—'}
              </div>
            </div>
          </div>

          {/* Bảng chi tiết mặt hàng */}
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--slate-800)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Package size={15} color="var(--teal-700)" /> Danh sách mặt hàng ({purchase.lines.length} dòng)
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {purchase.lines.map((line, idx) => (
                <div
                  key={line.id}
                  style={{
                    border: '1px solid var(--slate-200)',
                    borderRadius: 'var(--radius-sm)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      padding: '8px 12px',
                      backgroundColor: 'var(--slate-100)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '12.5px',
                    }}
                  >
                    <div>
                      <span style={{ fontWeight: 600, color: 'var(--slate-800)' }}>
                        #{idx + 1}. [{line.sku}] {line.product_name}
                      </span>
                      <span style={{ marginLeft: 8 }}>
                        <Badge variant={line.kind === 'PHONE' ? 'phone' : 'accessory'}>
                          {line.kind === 'PHONE' ? 'Điện thoại' : 'Phụ kiện'}
                        </Badge>
                      </span>
                    </div>
                    <div style={{ fontWeight: 600, color: 'var(--teal-800)' }}>
                      {formatVND(line.cost)}
                    </div>
                  </div>

                  <div style={{ padding: '8px 12px', fontSize: '12px', color: 'var(--slate-600)', display: 'flex', gap: 20 }}>
                    <div>SL: <strong>{line.quantity}</strong></div>
                    <div>Đơn giá nhập: <strong>{formatVND(line.unit_cost)}</strong></div>
                    <div>CP phân bổ: <strong>{formatVND(line.extra_cost)}</strong></div>
                    <div>Tổng giá vốn: <strong>{formatVND(line.cost)}</strong></div>
                  </div>

                  {/* Thiết bị điện thoại kèm theo */}
                  {line.kind === 'PHONE' && line.devices && line.devices.length > 0 && (
                    <div style={{ borderTop: '1px solid var(--slate-200)', padding: '8px 12px', backgroundColor: '#ffffff' }}>
                      <div style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--slate-700)', marginBottom: 6 }}>
                        Danh sách máy ({line.devices.length}):
                      </div>
                      <table style={{ width: '100%', fontSize: '11.5px', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ color: 'var(--slate-500)', borderBottom: '1px solid var(--slate-200)' }}>
                            <th style={{ textAlign: 'left', padding: '4px 0' }}>IMEI</th>
                            <th style={{ textAlign: 'center', padding: '4px 0' }}>Tình trạng</th>
                            <th style={{ textAlign: 'center', padding: '4px 0' }}>Pin</th>
                            <th style={{ textAlign: 'left', padding: '4px 0' }}>Ngoại hình / Lỗi</th>
                            <th style={{ textAlign: 'right', padding: '4px 0' }}>Giá vốn</th>
                            <th style={{ textAlign: 'right', padding: '4px 0' }}>Giá bán NY</th>
                          </tr>
                        </thead>
                        <tbody>
                          {line.devices.map((dev) => (
                            <tr key={dev.id} style={{ borderBottom: '1px dashed var(--slate-100)' }}>
                              <td style={{ padding: '4px 0', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{dev.imei}</td>
                              <td style={{ padding: '4px 0', textAlign: 'center' }}>
                                <Badge variant={dev.condition === 'NEW' ? 'new' : 'used'}>
                                  {dev.condition === 'NEW' ? 'Mới' : 'Cũ'}
                                </Badge>
                              </td>
                              <td style={{ padding: '4px 0', textAlign: 'center' }}>{dev.battery !== null ? `${dev.battery}%` : '—'}</td>
                              <td style={{ padding: '4px 0', color: 'var(--slate-600)' }}>
                                {[dev.cosmetic, dev.defects].filter(Boolean).join(' - ') || '—'}
                              </td>
                              <td style={{ padding: '4px 0', textAlign: 'right', fontWeight: 500 }}>{formatVND(dev.cost)}</td>
                              <td style={{ padding: '4px 0', textAlign: 'right', color: 'var(--teal-700)' }}>{formatVND(dev.sale_price)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Lô phụ kiện FIFO */}
                  {line.kind === 'ACCESSORY' && line.lots && line.lots.length > 0 && (
                    <div style={{ borderTop: '1px solid var(--slate-200)', padding: '6px 12px', backgroundColor: '#ffffff', fontSize: '11.5px' }}>
                      <span style={{ color: 'var(--slate-500)' }}>Lô FIFO: </span>
                      {line.lots.map((lot, lIdx) => (
                        <span key={lot.id} style={{ marginRight: 12 }}>
                          Lô {lIdx + 1}: SL {lot.quantity} (còn tồn: {lot.remaining_quantity}) - Đơn giá: {formatVND(lot.unit_cost)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Lịch sử thanh toán */}
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--slate-800)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <CreditCard size={15} color="var(--teal-700)" /> Lịch sử thanh toán
            </div>

            {purchase.payments.length === 0 ? (
              <div style={{ fontSize: '12px', color: 'var(--slate-500)', fontStyle: 'italic', padding: '6px 0' }}>
                Chưa có ghi nhận thanh toán nào (Ghi nợ 100%).
              </div>
            ) : (
              <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ color: 'var(--slate-500)', borderBottom: '1px solid var(--slate-200)' }}>
                    <th style={{ textAlign: 'left', padding: '6px 0' }}>Thời gian</th>
                    <th style={{ textAlign: 'left', padding: '6px 0' }}>Phương thức</th>
                    <th style={{ textAlign: 'right', padding: '6px 0' }}>Số tiền</th>
                    <th style={{ textAlign: 'left', padding: '6px 0', paddingLeft: 10 }}>Ghi chú</th>
                  </tr>
                </thead>
                <tbody>
                  {purchase.payments.map((p) => (
                    <tr key={p.id} style={{ borderBottom: '1px solid var(--slate-100)' }}>
                      <td style={{ padding: '6px 0', color: 'var(--slate-600)' }}>{formatDateTime(p.created_at)}</td>
                      <td style={{ padding: '6px 0' }}>
                        <Badge variant="default">
                          {p.method === 'cash' ? 'Tiền mặt' : 'Chuyển khoản'}
                        </Badge>
                      </td>
                      <td style={{ padding: '6px 0', textAlign: 'right', fontWeight: 600, color: 'var(--success-700)' }}>
                        {formatVND(p.amount)}
                      </td>
                      <td style={{ padding: '6px 0', paddingLeft: 10, color: 'var(--slate-500)' }}>
                        {p.note || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Tổng kết tài chính */}
          <div
            style={{
              padding: '14px 16px',
              backgroundColor: 'var(--slate-50)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--slate-200)',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              fontSize: '13px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--slate-600)' }}>Tổng tiền hàng:</span>
              <span>{formatVND(purchase.total - purchase.extra_cost)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--slate-600)' }}>Chi phí mua hàng:</span>
              <span>{formatVND(purchase.extra_cost)}</span>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontWeight: 700,
                fontSize: '14px',
                borderTop: '1px dashed var(--slate-300)',
                paddingTop: 8,
              }}
            >
              <span>Tổng phiếu nhập:</span>
              <span style={{ color: 'var(--teal-800)' }}>{formatVND(purchase.total)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--success-700)', fontWeight: 600 }}>
              <span>Đã thanh toán:</span>
              <span>{formatVND(purchase.paid)}</span>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                color: purchase.debt > 0 ? 'var(--danger-700)' : 'var(--slate-700)',
                fontWeight: 700,
              }}
            >
              <span>Còn nợ nhà cung cấp:</span>
              <span>{formatVND(purchase.debt)}</span>
            </div>
          </div>
        </div>
      )}
    </Drawer>
  );
};
