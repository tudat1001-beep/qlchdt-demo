import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { api, ApiClientError } from '../../lib/api-client';
import { formatVND } from '../../lib/formatters';
import type { PurchaseDetail, PurchaseReturnInputPayload } from '../../types/inventory';
import { AlertCircle, RotateCcw, Loader2, Smartphone, Package } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

interface PurchaseReturnModalProps {
  isOpen: boolean;
  onClose: () => void;
  purchase: PurchaseDetail;
  onSuccess: () => void;
}

export const PurchaseReturnModal: React.FC<PurchaseReturnModalProps> = ({
  isOpen,
  onClose,
  purchase,
  onSuccess,
}) => {
  const { showSuccess } = useToast();

  // For phone lines: map lineId -> Set of selected device_ids
  const [selectedDevicesByLine, setSelectedDevicesByLine] = useState<Record<string, string[]>>({});
  // For accessory lines: map lineId -> quantity
  const [accessoryQuantitiesByLine, setAccessoryQuantitiesByLine] = useState<Record<string, number>>({});
  const [method, setMethod] = useState<'cash' | 'bank'>('cash');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
    }
  }, [isOpen]);

  const handleToggleDevice = (lineId: string, deviceId: string) => {
    setSelectedDevicesByLine((prev) => {
      const current = prev[lineId] || [];
      if (current.includes(deviceId)) {
        return { ...prev, [lineId]: current.filter((id) => id !== deviceId) };
      } else {
        return { ...prev, [lineId]: [...current, deviceId] };
      }
    });
  };

  const handleAccessoryQuantityChange = (lineId: string, max: number, val: number) => {
    const clamped = Math.max(0, Math.min(max, isNaN(val) ? 0 : val));
    setAccessoryQuantitiesByLine((prev) => ({
      ...prev,
      [lineId]: clamped,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      setErrorMessage('Vui lòng nhập lý do trả hàng cho nhà cung cấp');
      return;
    }

    const linesPayload: { purchase_line_id: string; quantity: number; device_ids?: string[] }[] = [];

    for (const line of purchase.lines) {
      if (line.kind === 'PHONE') {
        const deviceIds = selectedDevicesByLine[line.id] || [];
        if (deviceIds.length > 0) {
          linesPayload.push({
            purchase_line_id: line.id,
            quantity: deviceIds.length,
            device_ids: deviceIds,
          });
        }
      } else {
        const qty = accessoryQuantitiesByLine[line.id] || 0;
        if (qty > 0) {
          linesPayload.push({
            purchase_line_id: line.id,
            quantity: qty,
          });
        }
      }
    }

    if (linesPayload.length === 0) {
      setErrorMessage('Vui lòng chọn ít nhất một máy điện thoại hoặc số lượng phụ kiện cần trả NCC');
      return;
    }

    const payload: PurchaseReturnInputPayload = {
      purchase_id: purchase.id,
      reason: trimmedReason,
      method,
      lines: linesPayload,
    };

    setIsSubmitting(true);
    try {
      await api.post('/purchase-returns', payload);
      showSuccess('Tạo phiếu trả hàng NCC thành công');
      setSelectedDevicesByLine({});
      setAccessoryQuantitiesByLine({});
      setReason('');
      setErrorMessage(null);
      onSuccess();
      onClose();
    } catch (err: unknown) {
      // PRESERVE user input upon failure
      if (err instanceof ApiClientError) {
        setErrorMessage(err.message || 'Lỗi trả hàng nhà cung cấp từ máy chủ');
      } else if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Đã xảy ra lỗi không xác định');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Trả hàng cho nhà cung cấp: ${purchase.supplier_name}`}
      maxWidth="760px"
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, width: '100%' }}>
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Hủy bỏ
          </Button>
          <Button
            type="submit"
            form="purchase-return-form"
            variant="primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={14} className="spinner" style={{ marginRight: 6, animation: 'spin 1s linear infinite' }} />
                Đang xử lý...
              </>
            ) : (
              <>
                <RotateCcw size={14} style={{ marginRight: 6 }} /> Xác nhận trả hàng NCC
              </>
            )}
          </Button>
        </div>
      }
    >
      <form id="purchase-return-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {errorMessage && (
          <div
            className="alert alert-danger"
            style={{
              padding: '10px 14px',
              backgroundColor: 'var(--danger-50)',
              color: 'var(--danger-700)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--danger-100)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: '13px',
            }}
          >
            <AlertCircle size={16} />
            <span>{errorMessage}</span>
          </div>
        )}

        <div style={{ fontSize: '12.5px', color: 'var(--slate-600)', backgroundColor: 'var(--slate-50)', padding: '10px 12px', borderRadius: 'var(--radius-sm)' }}>
          <div>Đơn nhập: <strong>{purchase.number}</strong> | NCC: <strong>{purchase.supplier_name}</strong> | Nợ hiện tại: <strong>{formatVND(purchase.debt)}</strong></div>
          <div style={{ marginTop: 2, fontSize: '12px', color: 'var(--slate-500)' }}>
            * Hàng trả NCC sẽ ưu tiên giảm trừ công nợ phải trả trước. Phần còn lại (nếu có) sẽ được hoàn tiền theo hình thức đã chọn, bảo đảm không vượt quá số tiền đã thực trả NCC.
          </div>
        </div>

        {/* Danh sách các dòng hàng nhập */}
        <div>
          <label style={{ fontWeight: 600, fontSize: '13px', color: 'var(--slate-800)', display: 'block', marginBottom: 8 }}>
            Chọn thiết bị và mặt hàng cần trả lại nhà cung cấp:
          </label>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {purchase.lines.map((line, idx) => {
              const isPhone = line.kind === 'PHONE';
              // Available devices for phone line
              const availableDevices = (line.devices || []).filter((d) => d.status === 'available');
              const selectedDeviceIds = selectedDevicesByLine[line.id] || [];

              // Available remaining quantity for accessory line
              const availableAccessoryQty = (line.lots || []).reduce(
                (sum, lot) => sum + (lot.remaining_quantity || 0),
                0
              );
              const accessoryQty = accessoryQuantitiesByLine[line.id] || 0;

              return (
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {isPhone ? <Smartphone size={14} color="var(--teal-700)" /> : <Package size={14} color="var(--teal-700)" />}
                      <span style={{ fontWeight: 600, color: 'var(--slate-800)' }}>
                        #{idx + 1}. [{line.sku}] {line.product_name}
                      </span>
                      <Badge variant={isPhone ? 'phone' : 'accessory'}>
                        {isPhone ? 'Điện thoại' : 'Phụ kiện'}
                      </Badge>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--slate-600)' }}>
                      Giá vốn nhập: <strong>{formatVND(line.unit_cost)}</strong>
                    </div>
                  </div>

                  <div style={{ padding: '10px 12px', backgroundColor: '#ffffff' }}>
                    {isPhone ? (
                      <div>
                        {availableDevices.length === 0 ? (
                          <div style={{ fontSize: '12px', color: 'var(--slate-400)', fontStyle: 'italic' }}>
                            Không có máy nào thuộc dòng này ở trạng thái khả dụng trong kho (đã bán hoặc đã trả).
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <div style={{ fontSize: '11.5px', color: 'var(--slate-500)', marginBottom: 2 }}>
                              Chọn máy khả dụng để trả ({selectedDeviceIds.length}/{availableDevices.length} máy đã chọn):
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
                              {line.devices?.map((dev) => {
                                const isAvailable = dev.status === 'available';
                                const isChecked = selectedDeviceIds.includes(dev.id);

                                return (
                                  <label
                                    key={dev.id}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 8,
                                      padding: '6px 10px',
                                      border: `1px solid ${isChecked ? 'var(--teal-600)' : 'var(--slate-200)'}`,
                                      borderRadius: 'var(--radius-sm)',
                                      backgroundColor: isChecked ? '#f0fdfa' : isAvailable ? '#ffffff' : 'var(--slate-50)',
                                      cursor: isAvailable ? 'pointer' : 'not-allowed',
                                      opacity: isAvailable ? 1 : 0.6,
                                    }}
                                  >
                                    <input
                                      type="checkbox"
                                      disabled={!isAvailable || isSubmitting}
                                      checked={isChecked}
                                      onChange={() => handleToggleDevice(line.id, dev.id)}
                                    />
                                    <div style={{ fontSize: '11.5px' }}>
                                      <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{dev.imei}</div>
                                      <div style={{ color: 'var(--slate-500)', fontSize: '11px' }}>
                                        {dev.condition === 'NEW' ? 'Mới' : 'Cũ'} • {isAvailable ? 'Trong kho' : dev.status === 'sold' ? 'Đã bán' : dev.status}
                                      </div>
                                    </div>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                        <div style={{ fontSize: '12px', color: 'var(--slate-600)' }}>
                          Tồn khả dụng trong kho: <strong>{availableAccessoryQty}</strong> cái (trên tổng {line.quantity} cái nhập ban đầu)
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <label htmlFor={`acc-qty-${line.id}`} style={{ fontSize: '12px', fontWeight: 600, color: 'var(--slate-700)' }}>
                            Số lượng trả NCC:
                          </label>
                          <input
                            id={`acc-qty-${line.id}`}
                            type="number"
                            min={0}
                            max={availableAccessoryQty}
                            step={1}
                            value={accessoryQty}
                            onChange={(e) => handleAccessoryQuantityChange(line.id, availableAccessoryQty, parseInt(e.target.value, 10))}
                            className="input"
                            style={{ width: '80px', textAlign: 'center', padding: '4px 6px' }}
                            disabled={availableAccessoryQty === 0 || isSubmitting}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Thiết lập hoàn tiền & Lý do */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
          <div>
            <label htmlFor="purchase-return-method" style={{ display: 'block', fontWeight: 600, fontSize: '12.5px', marginBottom: 4, color: 'var(--slate-700)' }}>
              Phương thức nhận hoàn tiền từ NCC (khi vượt nợ):
            </label>
            <select
              id="purchase-return-method"
              className="select"
              value={method}
              onChange={(e) => setMethod(e.target.value as 'cash' | 'bank')}
              disabled={isSubmitting}
              style={{ width: '100%' }}
            >
              <option value="cash">Tiền mặt (cash)</option>
              <option value="bank">Chuyển khoản ngân hàng (bank)</option>
            </select>
          </div>

          <div>
            <label htmlFor="purchase-return-reason" style={{ display: 'block', fontWeight: 600, fontSize: '12.5px', marginBottom: 4, color: 'var(--slate-700)' }}>
              Lý do trả hàng NCC: <span style={{ color: 'var(--danger-600)' }}>*</span>
            </label>
            <textarea
              id="purchase-return-reason"
              className="input"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Nhập lý do trả lại hàng cho nhà cung cấp..."
              required
              disabled={isSubmitting}
              style={{ width: '100%', resize: 'vertical' }}
            />
          </div>
        </div>
      </form>
    </Modal>
  );
};
