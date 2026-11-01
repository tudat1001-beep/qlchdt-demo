import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, ApiClientError } from '../../lib/api-client';
import { formatVND } from '../../lib/formatters';
import { useToast } from '../../context/ToastContext';
import { useNetwork } from '../../context/NetworkContext';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { DollarSign, ArrowDownRight, ArrowUpRight, AlertCircle, WifiOff } from 'lucide-react';
import type { CashEntry } from '../../types/cash-reports';

interface CashEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const CashEntryModal: React.FC<CashEntryModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const { isOnline } = useNetwork();

  const [direction, setDirection] = useState<'out' | 'in'>('out'); // Default to Chi tiền
  const [method, setMethod] = useState<'cash' | 'bank'>('cash');
  const [amountStr, setAmountStr] = useState('');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Direction determines the strict server category:
  // out -> 'expense' (Chi phí hoạt động)
  // in -> 'other_income' (Thu nhập khác)
  const category = direction === 'out' ? 'expense' : 'other_income';

  const numericAmount = parseInt(amountStr.replace(/\D/g, ''), 10) || 0;

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '');
    setAmountStr(raw);
    if (validationError) setValidationError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Strict Offline Guard: never queue or pretend success
    if (!isOnline) {
      setValidationError('Giao dịch bị từ chối: Hệ thống đang ngoại tuyến.');
      showError('Giao dịch bị từ chối: Không thể ghi nhận nghiệp vụ tài chính khi ngoại tuyến.');
      return;
    }

    // 2. Validate Amount
    if (numericAmount <= 0) {
      setValidationError('Số tiền phải lớn hơn 0 ₫');
      return;
    }

    if (numericAmount > Number.MAX_SAFE_INTEGER) {
      setValidationError('Số tiền vượt quá giới hạn an toàn cho phép');
      return;
    }

    setIsSubmitting(true);
    setValidationError(null);

    try {
      await api.post<CashEntry>('/cash', {
        direction,
        method,
        amount: numericAmount,
        category,
        note: note.trim() || undefined,
      });

      showSuccess(
        direction === 'out'
          ? `Đã ghi nhận phiếu chi ${formatVND(numericAmount)} thành công`
          : `Đã ghi nhận phiếu thu ${formatVND(numericAmount)} thành công`
      );

      // Invalidate relevant queries
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['cash'] }),
        queryClient.invalidateQueries({ queryKey: ['reports'] }),
      ]);

      // Reset form
      setAmountStr('');
      setNote('');
      setDirection('out');
      setMethod('cash');

      if (onSuccess) onSuccess();
      onClose();
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setValidationError(err.message);
        showError(err.message);
      } else {
        const fallbackMsg = 'Không thể ghi nhận giao dịch sổ quỹ do lỗi kết nối';
        setValidationError(fallbackMsg);
        showError(fallbackMsg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Lập phiếu thu / chi sổ quỹ"
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Hủy bỏ
          </Button>
          <Button
            type="submit"
            form="cash-entry-form"
            variant="primary"
            isLoading={isSubmitting}
            disabled={isSubmitting}
          >
            {direction === 'out' ? 'Lưu phiếu chi' : 'Lưu phiếu thu'}
          </Button>
        </div>
      }
    >
      <form id="cash-entry-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Offline Warning Banner */}
        {!isOnline && (
          <div
            style={{
              padding: '10px 14px',
              backgroundColor: 'var(--amber-50, #fffbeb)',
              border: '1px solid var(--amber-300, #fcd34d)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--amber-900, #78350f)',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <WifiOff size={16} color="var(--amber-600, #d97706)" style={{ flexShrink: 0 }} />
            <span>
              Hệ thống đang <strong>ngoại tuyến</strong>. Thao tác ghi nhận thu/chi bị từ chối để tránh sai lệch số dư quỹ.
            </span>
          </div>
        )}

        {/* Direction Selection */}
        <div>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--slate-700)', marginBottom: 8 }}>
            Loại nghiệp vụ <span style={{ color: 'var(--rose-500)' }}>*</span>
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <button
              type="button"
              className={`btn ${direction === 'out' ? 'btn-primary' : 'btn-secondary'}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '10px 12px',
                borderColor: direction === 'out' ? 'var(--rose-600, #e11d48)' : undefined,
                backgroundColor: direction === 'out' ? 'var(--rose-600, #e11d48)' : undefined,
                color: direction === 'out' ? '#ffffff' : undefined,
              }}
              onClick={() => setDirection('out')}
            >
              <ArrowDownRight size={16} />
              <span>Phiếu chi (Chi phí)</span>
            </button>

            <button
              type="button"
              className={`btn ${direction === 'in' ? 'btn-primary' : 'btn-secondary'}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '10px 12px',
                borderColor: direction === 'in' ? 'var(--emerald-600, #059669)' : undefined,
                backgroundColor: direction === 'in' ? 'var(--emerald-600, #059669)' : undefined,
                color: direction === 'in' ? '#ffffff' : undefined,
              }}
              onClick={() => setDirection('in')}
            >
              <ArrowUpRight size={16} />
              <span>Phiếu thu (Thu khác)</span>
            </button>
          </div>
        </div>

        {/* Method Selection */}
        <div>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--slate-700)', marginBottom: 8 }}>
            Hình thức giao dịch <span style={{ color: 'var(--rose-500)' }}>*</span>
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <button
              type="button"
              className={`btn ${method === 'cash' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '8px 12px' }}
              onClick={() => setMethod('cash')}
            >
              Tiền mặt tại quỹ
            </button>
            <button
              type="button"
              className={`btn ${method === 'bank' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '8px 12px' }}
              onClick={() => setMethod('bank')}
            >
              Chuyển khoản ngân hàng
            </button>
          </div>
        </div>

        {/* Amount Input */}
        <div>
          <Input
            id="cash-amount"
            label="Số tiền (VND)"
            required
            type="text"
            inputMode="numeric"
            placeholder="0"
            value={numericAmount > 0 ? numericAmount.toLocaleString('vi-VN') : amountStr}
            onChange={handleAmountChange}
            error={validationError || undefined}
            helperText={numericAmount > 0 ? `Bằng chữ / Quy đổi: ${formatVND(numericAmount)}` : 'Nhập số tiền nguyên dương VND'}
          />
        </div>

        {/* Note */}
        <div>
          <label htmlFor="cash-note" style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--slate-700)', marginBottom: 6 }}>
            Lý do / Diễn giải nội dung
          </label>
          <textarea
            id="cash-note"
            className="input"
            rows={3}
            placeholder={
              direction === 'out'
                ? 'Ví dụ: Chi tiền điện nước sinh hoạt, mua văn phòng phẩm, tiếp khách...'
                : 'Ví dụ: Thu thanh lý bao bì carton, thu bồi thường linh kiện...'
            }
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={4000}
            style={{ width: '100%', resize: 'vertical' }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: '11px', color: 'var(--slate-500)', marginTop: 4 }}>
            {note.length}/4000 ký tự
          </div>
        </div>
      </form>
    </Modal>
  );
};
