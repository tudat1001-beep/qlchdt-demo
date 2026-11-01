import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../context/ToastContext';
import { api, ApiClientError } from '../../lib/api-client';
import type { Product, ProductKind, CreateProductInput, UpdateProductInput } from '../../types/catalog';

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  productToEdit?: Product | null;
  onSuccess: () => void;
}

export const ProductModal: React.FC<ProductModalProps> = ({
  isOpen,
  onClose,
  productToEdit,
  onSuccess,
}) => {
  const { showSuccess, showError } = useToast();
  const isEditing = !!productToEdit;

  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [kind, setKind] = useState<ProductKind>('PHONE');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [variant, setVariant] = useState('');
  const [color, setColor] = useState('');
  const [storage, setStorage] = useState('');
  const [salePrice, setSalePrice] = useState<string>('0');
  const [minStock, setMinStock] = useState<string>('0');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (productToEdit) {
        setSku(productToEdit.sku || '');
        setName(productToEdit.name || '');
        setKind(productToEdit.kind || 'PHONE');
        setBrand(productToEdit.brand || '');
        setModel(productToEdit.model || '');
        setVariant(productToEdit.variant || '');
        setColor(productToEdit.color || '');
        setStorage(productToEdit.storage || '');
        setSalePrice(productToEdit.sale_price !== undefined ? String(productToEdit.sale_price) : '0');
        setMinStock(productToEdit.min_stock !== undefined && productToEdit.min_stock !== null ? String(productToEdit.min_stock) : '0');
      } else {
        setSku('');
        setName('');
        setKind('PHONE');
        setBrand('');
        setModel('');
        setVariant('');
        setColor('');
        setStorage('');
        setSalePrice('0');
        setMinStock('0');
      }
      setErrors({});
    }
  }, [isOpen, productToEdit]);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};

    if (!isEditing && !sku.trim()) {
      errs.sku = 'Mã SKU không được để trống';
    }
    if (!name.trim()) {
      errs.name = 'Tên sản phẩm không được để trống';
    }

    const priceNum = Number(salePrice);
    if (isNaN(priceNum) || priceNum < 0) {
      errs.salePrice = 'Giá bán phải là số nguyên không âm';
    }

    const minStockNum = Number(minStock);
    if (isNaN(minStockNum) || minStockNum < 0) {
      errs.minStock = 'Tồn kho tối thiểu phải là số nguyên không âm';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      if (isEditing && productToEdit) {
        // Contract note: kind and sku are immutable after creation.
        // Omit kind and sku from PATCH payload.
        const updatePayload: UpdateProductInput = {
          name: name.trim(),
          brand: brand.trim() || undefined,
          model: model.trim() || undefined,
          variant: variant.trim() || undefined,
          color: color.trim() || undefined,
          storage: storage.trim() || undefined,
          sale_price: Math.round(Number(salePrice)),
          min_stock: Math.round(Number(minStock)),
        };

        await api.patch<Product>(`/products/${productToEdit.id}`, updatePayload);
        showSuccess(`Đã cập nhật sản phẩm "${name}" thành công`);
      } else {
        const createPayload: CreateProductInput = {
          sku: sku.trim().toUpperCase(),
          name: name.trim(),
          kind,
          brand: brand.trim() || undefined,
          model: model.trim() || undefined,
          variant: variant.trim() || undefined,
          color: color.trim() || undefined,
          storage: storage.trim() || undefined,
          sale_price: Math.round(Number(salePrice)),
          min_stock: Math.round(Number(minStock)),
        };

        await api.post<Product>('/products', createPayload);
        showSuccess(`Đã thêm sản phẩm "${name}" thành công`);
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        showError(err.message);
      } else if (err instanceof Error) {
        showError(err.message);
      } else {
        showError('Không thể lưu thông tin sản phẩm');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? `Sửa sản phẩm: ${productToEdit?.sku}` : 'Thêm sản phẩm mới'}
      maxWidth="620px"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Hủy bỏ
          </Button>
          <Button
            type="submit"
            form="product-form"
            variant="primary"
            isLoading={isSubmitting}
          >
            {isEditing ? 'Lưu thay đổi' : 'Thêm sản phẩm'}
          </Button>
        </>
      }
    >
      <form id="product-form" onSubmit={handleSubmit} noValidate>
        <div className="form-grid-2">
          <Input
            label="Mã hàng (SKU)"
            id="product-sku"
            name="sku"
            required={!isEditing}
            disabled={isEditing}
            value={sku}
            onChange={(e) => setSku(e.target.value.toUpperCase())}
            placeholder="VD: IP15PM-256-TN"
            error={errors.sku}
            helperText={isEditing ? 'Mã hàng SKU cố định, không thể chỉnh sửa' : 'Mã định danh duy nhất của sản phẩm'}
          />

          <Select
            label="Phân loại hàng hóa"
            id="product-kind"
            name="kind"
            required
            disabled={isEditing}
            value={kind}
            onChange={(e) => setKind(e.target.value as ProductKind)}
            options={[
              { value: 'PHONE', label: 'Điện thoại (Quản lý theo IMEI)' },
              { value: 'ACCESSORY', label: 'Phụ kiện (Quản lý theo số lượng/lô)' },
            ]}
          />
        </div>

        <Input
          label="Tên sản phẩm"
          id="product-name"
          name="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="VD: iPhone 15 Pro Max 256GB Titan Tự Nhiên"
          error={errors.name}
        />

        <div className="form-grid-3">
          <Input
            label="Thương hiệu"
            id="product-brand"
            name="brand"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            placeholder="VD: Apple, Samsung"
          />

          <Input
            label="Dòng máy (Model)"
            id="product-model"
            name="model"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="VD: iPhone 15 Pro Max"
          />

          <Input
            label="Phiên bản (Variant)"
            id="product-variant"
            name="variant"
            value={variant}
            onChange={(e) => setVariant(e.target.value)}
            placeholder="VD: VN/A, LL/A"
          />
        </div>

        <div className="form-grid-2">
          <Input
            label="Màu sắc"
            id="product-color"
            name="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            placeholder="VD: Titan Tự Nhiên"
          />

          <Input
            label="Dung lượng bộ nhớ"
            id="product-storage"
            name="storage"
            value={storage}
            onChange={(e) => setStorage(e.target.value)}
            placeholder="VD: 128GB, 256GB"
          />
        </div>

        <div className="form-grid-2">
          <Input
            label="Giá bán niêm yết (VND)"
            id="product-sale-price"
            name="sale_price"
            type="number"
            min="0"
            step="1000"
            required
            value={salePrice}
            onChange={(e) => setSalePrice(e.target.value)}
            error={errors.salePrice}
          />

          <Input
            label="Cảnh báo tồn tối thiểu"
            id="product-min-stock"
            name="min_stock"
            type="number"
            min="0"
            step="1"
            value={minStock}
            onChange={(e) => setMinStock(e.target.value)}
            error={errors.minStock}
            helperText="Báo động khi tồn kho xuống dưới mức này"
          />
        </div>
      </form>
    </Modal>
  );
};
