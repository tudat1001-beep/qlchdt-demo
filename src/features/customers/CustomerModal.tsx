import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../context/ToastContext';
import { api, ApiClientError } from '../../lib/api-client';
import type { Customer, CreatePartyInput, UpdatePartyInput } from '../../types/parties';

interface CustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerToEdit?: Customer | null;
  onSuccess: () => void;
}

export const CustomerModal: React.FC<CustomerModalProps> = ({
  isOpen,
  onClose,
  customerToEdit,
  onSuccess,
}) => {
  const { showSuccess, showError } = useToast();
  const isEditing = !!customerToEdit;

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (customerToEdit) {
        setName(customerToEdit.name || '');
        setPhone(customerToEdit.phone || '');
        setAddress(customerToEdit.address || '');
        setNote(customerToEdit.note || '');
      } else {
        setName('');
        setPhone('');
        setAddress('');
        setNote('');
      }
      setErrors({});
    }
  }, [isOpen, customerToEdit]);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!name.trim()) {
      errs.name = 'Tên khách hàng không được để trống';
    }
    if (phone.trim() && !/^[0-9+\s().-]{8,20}$/.test(phone.trim())) {
      errs.phone = 'Số điện thoại không hợp lệ';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const payload: CreatePartyInput | UpdatePartyInput = {
        name: name.trim(),
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
        note: note.trim() || undefined,
      };

      if (isEditing && customerToEdit) {
        await api.patch<Customer>(`/customers/${customerToEdit.id}`, payload);
        showSuccess(`Đã cập nhật khách hàng "${name}" thành công`);
      } else {
        await api.post<Customer>('/customers', payload);
        showSuccess(`Đã thêm khách hàng "${name}" thành công`);
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        showError(err.message);
      } else if (err instanceof Error) {
        showError(err.message);
      } else {
        showError('Không thể lưu thông tin khách hàng');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? `Sửa thông tin khách hàng` : 'Thêm khách hàng mới'}
      maxWidth="540px"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Hủy bỏ
          </Button>
          <Button
            type="submit"
            form="customer-form"
            variant="primary"
            isLoading={isSubmitting}
          >
            {isEditing ? 'Lưu thay đổi' : 'Thêm khách hàng'}
          </Button>
        </>
      }
    >
      <form id="customer-form" onSubmit={handleSubmit} noValidate>
        <Input
          label="Tên khách hàng"
          id="customer-name"
          name="name"
          required
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="VD: Nguyễn Văn A"
          error={errors.name}
        />

        <div className="form-grid-2">
          <Input
            label="Số điện thoại"
            id="customer-phone"
            name="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="VD: 0912 345 678"
            error={errors.phone}
          />

          <Input
            label="Địa chỉ"
            id="customer-address"
            name="address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="VD: 123 Cầu Giấy, Hà Nội"
          />
        </div>

        <div className="form-group">
          <label htmlFor="customer-note" className="form-label">
            Ghi chú
          </label>
          <textarea
            id="customer-note"
            name="note"
            className="input-field"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ghi chú về thói quen mua hàng, yêu cầu đặc biệt..."
          />
        </div>
      </form>
    </Modal>
  );
};
