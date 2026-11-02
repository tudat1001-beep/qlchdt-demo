import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Drawer } from '../../components/ui/Drawer';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { api } from '../../lib/api-client';
import { formatVND, formatDateTime } from '../../lib/formatters';
import type { PurchaseDetail } from '../../types/inventory';
import { Truck, Receipt, Calendar, CreditCard, Smartphone, Package, Printer, AlertCircle, RotateCcw } from 'lucide-react';
import { PurchaseReturnModal } from './PurchaseReturnModal';

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
  const queryClient = useQueryClient();
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [devicePages, setDevicePages] = useState<Record<string, number>>({});
  const [paymentPage, setPaymentPage] = useState(1);
  const paymentPageSize = 8;

  useEffect(() => setPaymentPage(1), [purchaseId, isOpen]);

  const { data: purchase, isLoading, isError, refetch } = useQuery<PurchaseDetail>({
    queryKey: ['purchases', purchaseId],
    queryFn: () => api.get<PurchaseDetail>(`/purchases/${purchaseId}`),
    enabled: isOpen && !!purchaseId,
  });

  const handlePrint = () => {
    window.print();
  };

  const handleReturnSuccess = () => {
    refetch();
    queryClient.invalidateQueries({ queryKey: ['purchases'] });
    queryClient.invalidateQueries({ queryKey: ['devices'] });
  };

  return (
    <>
      <Drawer
        isOpen={isOpen}
        onClose={onClose}
        title={purchase ? `Chi tiết phiếu nhập ${purchase.number}` : 'Chi tiết phiếu nhập'}
        subtitle={purchase ? formatDateTime(purchase.created_at) : undefined}
        maxWidth="780px"
        footer={
          purchase && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: 8 }}>
              <Button type="button" variant="secondary" size="sm" onClick={handlePrint} className="no-print">
                <Printer size={14} style={{ marginRight: 6 }} /> In phiếu
              </Button>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsReturnModalOpen(true)}
                  className="no-print"
                  style={{ color: 'var(--teal-700)' }}
                >
                  <RotateCcw size={14} style={{ marginRight: 6 }} /> Trả hàng cho NCC
                </Button>

                {purchase.debt > 0 && onOpenPayment && (
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={() => onOpenPayment(purchase)}
                    className="no-print"
                  >
                    <CreditCard size={14} style={{ marginRight: 6 }} /> Trả nợ NCC ({formatVND(purchase.debt)})
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

                    <div style={{ padding: '8px 12px', fontSize: '12px', color: 'var(--slate-600)', display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                      <div>SL nhập: <strong>{line.quantity}</strong></div>
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
                        <table className="purchase-device-table" style={{ width: '100%', fontSize: '11.5px', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ color: 'var(--slate-500)', borderBottom: '1px solid var(--slate-200)' }}>
                              <th style={{ textAlign: 'left', padding: '4px 0' }}>IMEI</th>
                              <th style={{ textAlign: 'center', padding: '4px 0' }}>Tình trạng</th>
                              <th style={{ textAlign: 'center', padding: '4px 0' }}>Trạng thái kho</th>
                              <th style={{ textAlign: 'center', padding: '4px 0' }}>Pin</th>
                              <th style={{ textAlign: 'left', padding: '4px 0' }}>Ngoại hình / Lỗi</th>
                              <th style={{ textAlign: 'right', padding: '4px 0' }}>Giá vốn</th>
                            </tr>
                          </thead>
                          <tbody>
                            {line.devices.slice(((devicePages[line.id] || 1) - 1) * 8, (devicePages[line.id] || 1) * 8).map((dev) => (
                              <tr key={dev.id} style={{ borderBottom: '1px dashed var(--slate-100)' }}>
                                <td data-label="IMEI" style={{ padding: '4px 0', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{dev.imei}</td>
                                <td data-label="Tình trạng" style={{ padding: '4px 0', textAlign: 'center' }}>
                                  <Badge variant={dev.condition === 'NEW' ? 'new' : 'used'}>
                                    {dev.condition === 'NEW' ? 'Mới' : 'Cũ'}
                                  </Badge>
                                </td>
                                <td data-label="Trạng thái kho" style={{ padding: '4px 0', textAlign: 'center' }}>
                                  <Badge variant={dev.status === 'available' ? 'available' : dev.status === 'returned_supplier' ? 'debt' : dev.status === 'quarantine' ? 'quarantine' : 'sold'}>
                                    {dev.status === 'available' ? 'Khả dụng' : dev.status === 'returned_supplier' ? 'Đã trả NCC' : dev.status === 'quarantine' ? 'Cách ly' : 'Đã bán'}
                                  </Badge>
                                </td>
                                <td data-label="Pin" style={{ padding: '4px 0', textAlign: 'center' }}>{dev.battery !== null ? `${dev.battery}%` : '—'}</td>
                                <td data-label="Ngoại hình / lỗi" style={{ padding: '4px 0', color: 'var(--slate-600)' }}>
                                  {[dev.cosmetic, dev.defects].filter(Boolean).join(' - ') || '—'}
                                </td>
                                <td data-label="Giá vốn" style={{ padding: '4px 0', textAlign: 'right', fontWeight: 500 }}>{formatVND(dev.cost)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {line.devices.length > 8 && (() => {
                          const page = devicePages[line.id] || 1;
                          const pages = Math.ceil(line.devices.length / 8);
                          return (
                            <div className="compact-pagination" aria-label="Phân trang thiết bị trong phiếu nhập">
                              <span>{line.devices.length} máy · Trang {page} / {pages}</span>
                              <div>
                                <Button type="button" variant="secondary" size="sm" disabled={page === 1} onClick={() => setDevicePages((current) => ({ ...current, [line.id]: page - 1 }))}>Trước</Button>
                                <Button type="button" variant="secondary" size="sm" disabled={page === pages} onClick={() => setDevicePages((current) => ({ ...current, [line.id]: page + 1 }))}>Sau</Button>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {/* Lô phụ kiện FIFO */}
                    {line.kind === 'ACCESSORY' && line.lots && line.lots.length > 0 && (
                      <div style={{ borderTop: '1px solid var(--slate-200)', padding: '6px 12px', backgroundColor: '#ffffff', fontSize: '11.5px' }}>
                        <span style={{ color: 'var(--slate-500)' }}>Lô FIFO: </span>
                        {line.lots.map((lot, lIdx) => (
                          <span key={lot.id} style={{ marginRight: 12 }}>
                            Lô {lIdx + 1}: SL {lot.quantity} (còn tồn: <strong>{lot.remaining_quantity}</strong>) - Đơn giá: {formatVND(lot.unit_cost)}
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
                <>
                <table className="popup-table" style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ color: 'var(--slate-500)', borderBottom: '1px solid var(--slate-200)' }}>
                      <th style={{ textAlign: 'left', padding: '6px 0' }}>Thời gian</th>
                      <th style={{ textAlign: 'left', padding: '6px 0' }}>Phương thức</th>
                      <th style={{ textAlign: 'right', padding: '6px 0' }}>Số tiền</th>
                      <th style={{ textAlign: 'left', padding: '6px 0', paddingLeft: 10 }}>Ghi chú</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchase.payments.slice((paymentPage - 1) * paymentPageSize, paymentPage * paymentPageSize).map((p) => (
                      <tr key={p.id} style={{ borderBottom: '1px solid var(--slate-100)' }}>
                        <td data-label="Thời gian" style={{ padding: '6px 0', color: 'var(--slate-600)' }}>{formatDateTime(p.created_at)}</td>
                        <td data-label="Phương thức" style={{ padding: '6px 0' }}>
                          <Badge variant="default">
                            {p.method === 'cash' ? 'Tiền mặt' : 'Chuyển khoản'}
                          </Badge>
                        </td>
                        <td data-label="Số tiền" style={{ padding: '6px 0', textAlign: 'right', fontWeight: 600, color: 'var(--success-700)' }}>
                          {formatVND(p.amount)}
                        </td>
                        <td data-label="Ghi chú" style={{ padding: '6px 0', paddingLeft: 10, color: 'var(--slate-500)' }}>
                          {p.note || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {purchase.payments.length > paymentPageSize && (
                  <div className="compact-pagination" aria-label="Phân trang lịch sử thanh toán">
                    <span>{purchase.payments.length} giao dịch · Trang {paymentPage} / {Math.ceil(purchase.payments.length / paymentPageSize)}</span>
                    <div>
                      <Button type="button" variant="secondary" size="sm" disabled={paymentPage <= 1} onClick={() => setPaymentPage((page) => page - 1)}>Trước</Button>
                      <Button type="button" variant="secondary" size="sm" disabled={paymentPage >= Math.ceil(purchase.payments.length / paymentPageSize)} onClick={() => setPaymentPage((page) => page + 1)}>Sau</Button>
                    </div>
                  </div>
                )}
                </>
              )}
            </div>

            {/* Lịch sử trả hàng cho nhà cung cấp (nếu có) */}
            {purchase.returns && purchase.returns.length > 0 && (
              <div style={{ borderTop: '1px solid var(--slate-200)', paddingTop: 12 }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--slate-800)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <RotateCcw size={15} color="var(--teal-700)" /> Lịch sử trả hàng cho NCC ({purchase.returns.length} lần)
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {purchase.returns.map((ret, rIdx) => (
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
                            Phiếu trả NCC #{rIdx + 1}
                          </span>
                          <Badge variant="debt">Trả NCC</Badge>
                        </div>
                        <span style={{ color: 'var(--slate-500)', fontSize: '11px' }}>
                          {formatDateTime(ret.created_at)}
                        </span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 6, color: 'var(--slate-600)', marginTop: 4 }}>
                        <div>Lý do: <strong>{ret.reason}</strong></div>
                        <div>Hoàn tiền qua: <strong>{ret.method === 'cash' ? 'Tiền mặt' : 'Chuyển khoản'}</strong></div>
                        <div>Tổng trả: <strong>{formatVND(ret.total)}</strong></div>
                        <div>Giảm trừ nợ: <strong>{formatVND(ret.debt_reduction)}</strong></div>
                        <div>NCC hoàn tiền: <strong style={{ color: 'var(--success-700)' }}>{formatVND(ret.refund)}</strong></div>
                      </div>

                      {ret.lines && ret.lines.length > 0 && (
                        <div style={{ marginTop: 6, borderTop: '1px dashed var(--slate-200)', paddingTop: 4, fontSize: '11.5px', color: 'var(--slate-600)' }}>
                          <span>Chi tiết trả: </span>
                          {ret.lines.map((rl, rlIdx) => {
                            const originalLine = purchase.lines.find((l) => l.id === rl.purchase_line_id);
                            const name = originalLine?.product_name || `Dòng #${rl.position + 1}`;
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

            {/* Tổng kết tài chính - Server Derived */}
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
                <span style={{ color: 'var(--slate-600)' }}>Tổng tiền hàng gốc:</span>
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
                  fontWeight: 600,
                  fontSize: '13.5px',
                  borderTop: '1px dashed var(--slate-300)',
                  paddingTop: 8,
                }}
              >
                <span>Tổng giá trị phiếu nhập ban đầu:</span>
                <span>{formatVND(purchase.total)}</span>
              </div>

              {(purchase.returned_total || 0) > 0 && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--danger-700)' }}>
                    <span>Giá trị hàng đã trả lại NCC:</span>
                    <span>-{formatVND(purchase.returned_total || 0)}</span>
                  </div>
                  {purchase.net_total !== undefined && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: 'var(--teal-900)' }}>
                      <span>Giá trị nhập ròng thực tế:</span>
                      <span>{formatVND(purchase.net_total)}</span>
                    </div>
                  )}
                </>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--success-700)', fontWeight: 600 }}>
                <span>Đã thanh toán cho NCC:</span>
                <span>{formatVND(purchase.paid)}</span>
              </div>

              {(purchase.refunded || 0) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--success-700)' }}>
                  <span>NCC đã hoàn lại tiền:</span>
                  <span>-{formatVND(purchase.refunded || 0)}</span>
                </div>
              )}

              {purchase.paid_net !== undefined && (purchase.refunded || 0) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--slate-700)', fontWeight: 600 }}>
                  <span>Thanh toán ròng thực tế:</span>
                  <span>{formatVND(purchase.paid_net)}</span>
                </div>
              )}

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  color: purchase.debt > 0 ? 'var(--danger-700)' : 'var(--slate-700)',
                  fontWeight: 700,
                  fontSize: '14px',
                  borderTop: '1px dashed var(--slate-300)',
                  paddingTop: 8,
                }}
              >
                <span>Còn nợ nhà cung cấp:</span>
                <span>{formatVND(purchase.debt)}</span>
              </div>
            </div>
          </div>
        )}
      </Drawer>

      {purchase && (
        <PurchaseReturnModal
          isOpen={isReturnModalOpen}
          onClose={() => setIsReturnModalOpen(false)}
          purchase={purchase}
          onSuccess={handleReturnSuccess}
        />
      )}
    </>
  );
};
