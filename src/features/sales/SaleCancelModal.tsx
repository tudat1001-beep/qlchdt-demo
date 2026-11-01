import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { api, ApiClientError } from '../../lib/api-client';
import { formatVND } from '../../lib/formatters';
import type { SaleDetail, CancelSalePayload } from '../../types/sales';
import { AlertTriangle, AlertCircle, Loader2 } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

interface SaleCancelModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: SaleDetail;
  onSuccess: () => void;
}

export const SaleCancelModal: React.FC<SaleCancelModalProps> = ({
  isOpen,
  onClose,
  sale,
  onSuccess,
}) => {
  const { showSuccess } = useToast();
  const [disposition, setDisposition] = useState<'available' | 'quarantine'>('available');
  const [method, setMethod] = useState<'cash' | 'bank'>('cash');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      setErrorMessage('Vui lòng nhập lý do hủy phiếu bán');
      return;
    }

    const payload: CancelSalePayload = {
      reason: trimmedReason,
      disposition,
      method,
    };

    setIsSubmitting(true);
    try {
      await api.post(`/sales/${sale.id}/cancel`, payload);
      showSuccess('Hủy phiếu bán thành công');
      setReason('');
      setErrorMessage(null);
      onSuccess();
      onClose();
    } catch (err: unknown) {
      // PRESERVE user input upon failure
      if (err instanceof ApiClientError) {
        setErrorMessage(err.message || 'Lỗi hủy phiếu bán từ máy chủ');
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
      title={`Xác nhận hủy phiếu bán ${sale.number}`}
      maxWidth="550px"
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, width: '100%' }}>
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Đóng
          </Button>
          <Button
            type="submit"
            form="sale-cancel-form"
            variant="danger"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={14} className="spinner" style={{ marginRight: 6, animation: 'spin 1s linear infinite' }} />
                Đang hủy...
              </>
            ) : (
              'Xác nhận hủy phiếu bán'
            )}
          </Button>
        </div>
      }
    >
      <form id="sale-cancel-form" noValidate onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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

        <div
          style={{
            padding: '12px 14px',
            backgroundColor: 'var(--warning-50)',
            border: '1px solid var(--warning-100)',
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            gap: 10,
            color: 'var(--warning-700)',
            fontSize: '12.5px',
          }}
        >
          <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <strong>Cảnh báo hủy hóa đơn:</strong> Thao tác này sẽ hủy toàn bộ các mặt hàng còn lại trong đơn bán, chuyển trạng thái đơn sang Đã hủy (cancelled), hoàn trả số tiền đã thanh toán hoặc giảm trừ công nợ theo đúng tính toán từ máy chủ.
          </div>
        </div>

        <div style={{ fontSize: '13px', color: 'var(--slate-700)' }}>
          <div>Mã hóa đơn: <strong>{sale.number}</strong></div>
          <div>Khách hàng: <strong>{sale.customer_name || 'Khách lẻ'}</strong></div>
          <div>Tổng giá trị ban đầu: <strong>{formatVND(sale.total)}</strong></div>
          <div>Đã thu khách: <strong>{formatVND(sale.paid)}</strong></div>
          <div>Công nợ hiện tại: <strong>{formatVND(sale.debt)}</strong></div>
        </div>

        <div>
          <label htmlFor="sale-cancel-disposition" style={{ display: 'block', fontWeight: 600, fontSize: '12.5px', marginBottom: 4, color: 'var(--slate-700)' }}>
            Xử lý hàng thu hồi về kho:
          </label>
          <select
            id="sale-cancel-disposition"
            className="select"
            value={disposition}
            onChange={(e) => setDisposition(e.target.value as 'available' | 'quarantine')}
            disabled={isSubmitting}
            style={{ width: '100%' }}
          >
            <option value="available">Nhập lại kho bán khả dụng (available)</option>
            <option value="quarantine">Cách ly kiểm tra lỗi (quarantine)</option>
          </select>
        </div>

        <div>
          <label htmlFor="sale-cancel-method" style={{ display: 'block', fontWeight: 600, fontSize: '12.5px', marginBottom: 4, color: 'var(--slate-700)' }}>
            Phương thức hoàn tiền cho khách (nếu có):
          </label>
          <select
            id="sale-cancel-method"
            className="select"
            value={method}
            onChange={(e) => setMethod(e.target.value as 'cash' | 'bank')}
            disabled={isSubmitting}
            style={{ width: '100%' }}
          >
            <option value="cash">Tiền mặt (cash)</option>
            <option value="bank">Chuyển khoản (bank)</option>
          </select>
        </div>

        <div>
          <label htmlFor="sale-cancel-reason" style={{ display: 'block', fontWeight: 600, fontSize: '12.5px', marginBottom: 4, color: 'var(--slate-700)' }}>
            Lý do hủy đơn: <span style={{ color: 'var(--danger-600)' }}>*</span>
          </label>
          <textarea
            id="sale-cancel-reason"
            className="input"
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Nhập lý do hủy hóa đơn bán..."
            required
            disabled={isSubmitting}
            style={{ width: '100%', resize: 'vertical' }}
          />
        </div>
      </form>
    </Modal>
  );
};
