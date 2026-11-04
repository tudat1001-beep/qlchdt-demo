import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { useToast } from '../../context/ToastContext';
import { api, ApiClientError } from '../../lib/api-client';
import { formatVND } from '../../lib/formatters';
import type { PaymentInputPayload } from '../../types/sales';
import { AlertCircle } from 'lucide-react';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  partyType: 'customer' | 'supplier';
  referenceId: string;
  referenceNumber: string;
  partyName: string;
  outstandingDebt: number;
  onSuccess?: () => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  partyType,
  referenceId,
  referenceNumber,
  partyName,
  outstandingDebt,
  onSuccess,
}) => {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const isCustomer = partyType === 'customer';
  const title = isCustomer ? 'Thu tiền nợ khách hàng' : 'Chi trả nợ nhà cung cấp';

  const [method, setMethod] = useState<'cash' | 'bank'>('cash');
  const [amount, setAmount] = useState<number>(outstandingDebt || 0);
  const [note, setNote] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (payload: PaymentInputPayload) => api.post('/payments', payload),
    onSuccess: () => {
      showToast(isCustomer ? 'Thu nợ thành công' : 'Thanh toán nợ NCC thành công', 'success');
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['cash'] });
      if (onSuccess) onSuccess();
      onClose();
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
          ? err.message
          : 'Không thể ghi nhận thanh toán';
      setErrorMsg(msg);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (amount <= 0) {
      setErrorMsg('Số tiền thanh toán phải lớn hơn 0');
      return;
    }

    if (amount > outstandingDebt) {
      setErrorMsg(`Số tiền không được vượt quá dư nợ còn lại (${formatVND(outstandingDebt)})`);
      return;
    }

    mutation.mutate({
      party_type: partyType,
      reference_id: referenceId,
      method,
      amount,
      note: note.trim() || undefined,
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={mutation.isPending ? () => {} : onClose}
      title={title}
      maxWidth="480px"
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, width: '100%' }}>
          <Button type="button" variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Hủy bỏ
          </Button>
          <Button
            type="submit"
            form="payment-form"
            variant="primary"
            isLoading={mutation.isPending}
            disabled={mutation.isPending}
          >
            {isCustomer ? 'Xác nhận thu nợ' : 'Xác nhận trả nợ'}
          </Button>
        </div>
      }
    >
      <form id="payment-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {errorMsg && (
          <div
            style={{
              padding: '10px 14px',
              backgroundColor: 'var(--danger-50)',
              border: '1px solid var(--danger-600)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--danger-700)',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <AlertCircle size={16} />
            <span>{errorMsg}</span>
          </div>
        )}

        <div
          style={{
            padding: '12px 14px',
            backgroundColor: 'var(--slate-50)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--slate-200)',
            fontSize: '13px',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--slate-600)' }}>Chứng từ tham chiếu:</span>
            <span style={{ fontWeight: 600 }}>{referenceNumber}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--slate-600)' }}>Đối tác ({isCustomer ? 'Khách hàng' : 'Nhà cung cấp'}):</span>
            <span style={{ fontWeight: 600 }}>{partyName}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed var(--slate-200)', paddingTop: 6 }}>
            <span style={{ color: 'var(--slate-600)' }}>Dư nợ hiện tại:</span>
            <span style={{ fontWeight: 700, color: 'var(--danger-700)' }}>{formatVND(outstandingDebt)}</span>
          </div>
        </div>

        <Select
          label="Phương thức thanh toán"
          value={method}
          onChange={(e) => setMethod(e.target.value as 'cash' | 'bank')}
          options={[
            { value: 'cash', label: 'Tiền mặt (Sổ quỹ tiền mặt)' },
            { value: 'bank', label: 'Chuyển khoản (Tài khoản ngân hàng)' },
          ]}
          required
          disabled={mutation.isPending}
        />

        <div>
          <Input
            label="Số tiền thanh toán (VND) (*)"
            formatThousands
            type="number"
            min={1}
            max={outstandingDebt}
            value={amount === 0 ? '' : amount}
            onChange={(e) => setAmount(Math.min(outstandingDebt, Math.max(0, parseInt(e.target.value || '0', 10))))}
            required
            disabled={mutation.isPending}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
            <button
              type="button"
              onClick={() => setAmount(outstandingDebt)}
              className="btn btn-ghost btn-sm"
              style={{ fontSize: '11.5px', color: 'var(--teal-700)', padding: '2px 6px' }}
            >
              Thanh toán toàn bộ ({formatVND(outstandingDebt)})
            </button>
          </div>
        </div>

        <Input
          label="Ghi chú chứng từ thu/chi"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Ví dụ: Khách chuyển khoản trả nợ đơn hàng..."
          disabled={mutation.isPending}
        />
      </form>
    </Modal>
  );
};
