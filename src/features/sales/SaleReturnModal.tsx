import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { api, ApiClientError } from '../../lib/api-client';
import { formatVND } from '../../lib/formatters';
import type { SaleDetail, ReturnInputPayload } from '../../types/sales';
import { AlertCircle, RotateCcw, Loader2 } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

interface SaleReturnModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: SaleDetail;
  onSuccess: () => void;
}

export const SaleReturnModal: React.FC<SaleReturnModalProps> = ({
  isOpen,
  onClose,
  sale,
  onSuccess,
}) => {
  const { showSuccess } = useToast();
  // Map of sale_line_id -> quantity to return
  const [returnQuantities, setReturnQuantities] = useState<Record<string, number>>({});
  const [linePage, setLinePage] = useState(1);
  const linePageSize = 8;
  const [disposition, setDisposition] = useState<'available' | 'quarantine'>('available');
  const [method, setMethod] = useState<'cash' | 'bank'>('cash');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Initialize return quantities when modal opens
  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      setLinePage(1);
      // Keep existing inputs if preserving after error, but if empty initialize
      setReturnQuantities((prev) => {
        if (Object.keys(prev).length > 0) return prev;
        const initial: Record<string, number> = {};
        sale.lines.forEach((line) => {
          const remaining = line.quantity - (line.returned_quantity || 0);
          initial[line.id] = 0;
        });
        return initial;
      });
    }
  }, [isOpen, sale]);

  const handleQuantityChange = (lineId: string, max: number, val: number) => {
    const clamped = Math.max(0, Math.min(max, isNaN(val) ? 0 : val));
    setReturnQuantities((prev) => ({
      ...prev,
      [lineId]: clamped,
    }));
  };

  const handleSelectAll = () => {
    const allRemaining: Record<string, number> = {};
    sale.lines.forEach((line) => {
      const remaining = line.quantity - (line.returned_quantity || 0);
      allRemaining[line.id] = remaining;
    });
    setReturnQuantities(allRemaining);
  };

  const handleResetSelections = () => {
    const reset: Record<string, number> = {};
    sale.lines.forEach((line) => {
      reset[line.id] = 0;
    });
    setReturnQuantities(reset);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      setErrorMessage('Vui lòng nhập lý do trả hàng');
      return;
    }

    const linesToReturn = Object.entries(returnQuantities)
      .filter(([_, qty]) => qty > 0)
      .map(([sale_line_id, quantity]) => ({ sale_line_id, quantity }));

    if (linesToReturn.length === 0) {
      setErrorMessage('Vui lòng chọn ít nhất một sản phẩm và số lượng cần trả (> 0)');
      return;
    }

    const payload: ReturnInputPayload = {
      sale_id: sale.id,
      reason: trimmedReason,
      disposition,
      method,
      lines: linesToReturn,
    };

    setIsSubmitting(true);
    try {
      await api.post('/returns', payload);
      showSuccess('Tạo phiếu trả hàng thành công');
      // Reset form state on successful response
      setReturnQuantities({});
      setReason('');
      setErrorMessage(null);
      onSuccess();
      onClose();
    } catch (err: unknown) {
      // PRESERVE user input upon failure
      if (err instanceof ApiClientError) {
        setErrorMessage(err.message || 'Lỗi xử lý trả hàng từ máy chủ');
      } else if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Đã xảy ra lỗi không xác định');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const returnableLines = sale.lines.filter(
    (line) => line.quantity - (line.returned_quantity || 0) > 0
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Trả hàng cho hóa đơn ${sale.number}`}
      maxWidth="720px"
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, width: '100%' }}>
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Hủy bỏ
          </Button>
          <Button
            type="submit"
            form="sale-return-form"
            variant="primary"
            disabled={isSubmitting || returnableLines.length === 0}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={14} className="spinner" style={{ marginRight: 6, animation: 'spin 1s linear infinite' }} />
                Đang xử lý...
              </>
            ) : (
              <>
                <RotateCcw size={14} style={{ marginRight: 6 }} /> Xác nhận trả hàng
              </>
            )}
          </Button>
        </div>
      }
    >
      <form id="sale-return-form" noValidate onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
          <div>Khách hàng: <strong>{sale.customer_name || 'Khách lẻ'}</strong> | Tổng hóa đơn gốc: <strong>{formatVND(sale.total)}</strong></div>
          <div style={{ marginTop: 2, fontSize: '12px', color: 'var(--slate-500)' }}>
            * Giá trị hoàn tiền và giảm trừ nợ được máy chủ tính toán chính xác theo nguyên tắc tài chính của hóa đơn gốc.
          </div>
        </div>

        {/* Bảng chọn dòng sản phẩm cần trả */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <label style={{ fontWeight: 600, fontSize: '13px', color: 'var(--slate-800)' }}>
              Chọn sản phẩm và số lượng trả lại:
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={handleSelectAll}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--teal-700)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                Chọn tất cả
              </button>
              <span style={{ color: 'var(--slate-300)' }}>|</span>
              <button
                type="button"
                onClick={handleResetSelections}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--slate-500)',
                  fontSize: '12px',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                Xóa chọn
              </button>
            </div>
          </div>

          {returnableLines.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--slate-500)', backgroundColor: 'var(--slate-50)', borderRadius: 'var(--radius-sm)' }}>
              Tất cả các sản phẩm trong phiếu bán này đã được trả hết.
            </div>
          ) : (
            <div style={{ border: '1px solid var(--slate-200)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
              <table className="popup-table" style={{ width: '100%', fontSize: '12.5px', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--slate-100)', borderBottom: '1px solid var(--slate-200)' }}>
                    <th style={{ padding: '8px 10px', textAlign: 'left' }}>Sản phẩm / IMEI</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center', width: 70 }}>Đã mua</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center', width: 70 }}>Đã trả</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center', width: 80 }}>Còn lại</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center', width: 110 }}>SL trả</th>
                  </tr>
                </thead>
                <tbody>
                  {sale.lines.slice((linePage - 1) * linePageSize, linePage * linePageSize).map((line) => {
                    const remaining = line.quantity - (line.returned_quantity || 0);
                    const qty = returnQuantities[line.id] || 0;
                    const isFullyReturned = remaining <= 0;

                    return (
                      <tr
                        key={line.id}
                        style={{
                          borderBottom: '1px solid var(--slate-100)',
                          backgroundColor: isFullyReturned ? 'var(--slate-50)' : qty > 0 ? '#f0fdfa' : '#ffffff',
                          opacity: isFullyReturned ? 0.6 : 1,
                        }}
                      >
                        <td data-label="Sản phẩm / IMEI" style={{ padding: '8px 10px' }}>
                          <div style={{ fontWeight: 600 }}>{line.product_name}</div>
                          {line.imei && (
                            <div style={{ fontSize: '11px', color: 'var(--slate-500)', fontFamily: 'var(--font-mono)' }}>
                              IMEI: {line.imei}
                            </div>
                          )}
                        </td>
                        <td data-label="Đã mua" style={{ padding: '8px 10px', textAlign: 'center' }}>{line.quantity}</td>
                        <td data-label="Đã trả" style={{ padding: '8px 10px', textAlign: 'center', color: 'var(--slate-500)' }}>
                          {line.returned_quantity || 0}
                        </td>
                        <td data-label="Còn lại" style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 600, color: remaining > 0 ? 'var(--slate-800)' : 'var(--slate-400)' }}>
                          {remaining}
                        </td>
                        <td data-label="SL trả" style={{ padding: '8px 10px', textAlign: 'center' }}>
                          {isFullyReturned ? (
                            <span style={{ fontSize: '11px', color: 'var(--slate-400)' }}>Đã trả hết</span>
                          ) : (
                            <Input
                              bare
                              formatThousands
                              type="number"
                              min={0}
                              max={remaining}
                              step={1}
                              value={qty}
                              onChange={(e) => handleQuantityChange(line.id, remaining, parseInt(e.target.value, 10))}
                              className="input"
                              style={{ width: '70px', textAlign: 'center', padding: '4px 6px' }}
                              disabled={isSubmitting}
                            />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {sale.lines.length > 0 && (() => {
                const totalPages = Math.max(1, Math.ceil(sale.lines.length / linePageSize));
                const page = Math.min(Math.max(1, linePage), totalPages);
                return (
                  <div className="compact-pagination" aria-label="Phân trang mặt hàng cần trả">
                    <span>{sale.lines.length} mặt hàng · Trang {page} / {totalPages}</span>
                    <div>
                      <Button type="button" variant="secondary" size="sm" disabled={page <= 1} onClick={() => setLinePage((p) => p - 1)}>Trước</Button>
                      <Button type="button" variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setLinePage((p) => p + 1)}>Sau</Button>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        {/* Thiết lập xử lý kho và hoàn tiền */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <label htmlFor="sale-return-disposition" style={{ display: 'block', fontWeight: 600, fontSize: '12.5px', marginBottom: 4, color: 'var(--slate-700)' }}>
              Xử lý hàng trả về kho:
            </label>
            <select
              id="sale-return-disposition"
              className="select"
              value={disposition}
              onChange={(e) => setDisposition(e.target.value as 'available' | 'quarantine')}
              disabled={isSubmitting}
              style={{ width: '100%' }}
            >
              <option value="available">Nhập lại kho khả dụng (available)</option>
              <option value="quarantine">Cách ly kiểm tra (quarantine)</option>
            </select>
          </div>

          <div>
            <label htmlFor="sale-return-method" style={{ display: 'block', fontWeight: 600, fontSize: '12.5px', marginBottom: 4, color: 'var(--slate-700)' }}>
              Hình thức hoàn tiền (nếu có):
            </label>
            <select
              id="sale-return-method"
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
        </div>

        {/* Lý do trả hàng */}
        <div>
          <label htmlFor="sale-return-reason" style={{ display: 'block', fontWeight: 600, fontSize: '12.5px', marginBottom: 4, color: 'var(--slate-700)' }}>
            Lý do trả hàng: <span style={{ color: 'var(--danger-600)' }}>*</span>
          </label>
          <textarea
            id="sale-return-reason"
            className="input"
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Nhập lý do khách trả hàng..."
            required
            disabled={isSubmitting}
            style={{ width: '100%', resize: 'vertical' }}
          />
        </div>
      </form>
    </Modal>
  );
};
