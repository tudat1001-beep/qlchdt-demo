import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../context/ToastContext';
import { api, ApiClientError } from '../../lib/api-client';
import type { Supplier, CreatePartyInput, UpdatePartyInput } from '../../types/parties';

interface SupplierModalProps {
  isOpen: boolean;
  onClose: () => void;
  supplierToEdit?: Supplier | null;
  onSuccess: () => void;
}

export const SupplierModal: React.FC<SupplierModalProps> = ({
  isOpen,
  onClose,
  supplierToEdit,
  onSuccess,
}) => {
  const { showSuccess, showError } = useToast();
  const isEditing = !!supplierToEdit;

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (supplierToEdit) {
        setName(supplierToEdit.name || '');
        setPhone(supplierToEdit.phone || '');
        setAddress(supplierToEdit.address || '');
        setNote(supplierToEdit.note || '');
      } else {
        setName('');
        setPhone('');
        setAddress('');
        setNote('');
      }
      setErrors({});
    }
  }, [isOpen, supplierToEdit]);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!name.trim()) {
      errs.name = 'Tên nhà cung cấp không được để trống';
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

      if (isEditing && supplierToEdit) {
        await api.patch<Supplier>(`/suppliers/${supplierToEdit.id}`, payload);
        showSuccess(`Đã cập nhật nhà cung cấp "${name}" thành công`);
      } else {
        await api.post<Supplier>('/suppliers', payload);
        showSuccess(`Đã thêm nhà cung cấp "${name}" thành công`);
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        showError(err.message);
      } else if (err instanceof Error) {
        showError(err.message);
      } else {
        showError('Không thể lưu thông tin nhà cung cấp');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? `Sửa nhà cung cấp: ${supplierToEdit?.name}` : 'Thêm nhà cung cấp mới'}
      maxWidth="540px"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Hủy bỏ
          </Button>
          <Button
            type="submit"
            form="supplier-form"
            variant="primary"
            isLoading={isSubmitting}
          >
            {isEditing ? 'Lưu thay đổi' : 'Thêm nhà cung cấp'}
          </Button>
        </>
      }
    >
      <form id="supplier-form" onSubmit={handleSubmit} noValidate>
        <Input
          label="Tên nhà cung cấp / đại lý"
          id="supplier-name"
          name="name"
          required
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="VD: Tổng kho phân phối DigiTech"
          error={errors.name}
        />

        <div className="form-grid-2">
          <Input
            label="Số điện thoại liên hệ"
            id="supplier-phone"
            name="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="VD: 0903 112 233"
            error={errors.phone}
          />

          <Input
            label="Địa chỉ văn phòng / kho"
            id="supplier-address"
            name="address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="VD: Số 45 Lê Duẩn, Hà Nội"
          />
        </div>

        <div className="form-group">
          <label htmlFor="supplier-note" className="form-label">
            Ghi chú đối tác
          </label>
          <textarea
            id="supplier-note"
            name="note"
            className="input-field"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Chính sách bảo hành nguồn/màn hình, thời hạn công nợ..."
          />
        </div>
      </form>
    </Modal>
  );
};
