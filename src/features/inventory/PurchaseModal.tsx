import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { useToast } from '../../context/ToastContext';
import { api, ApiClientError } from '../../lib/api-client';
import { formatVND } from '../../lib/formatters';
import { sumVnd, multiplyVnd } from '../../../shared/money';
import type { Product } from '../../types/catalog';
import type { Supplier } from '../../types/parties';
import type { PurchaseInputPayload, PurchaseDetail } from '../../types/inventory';
import { Plus, Trash2, Smartphone, Package, AlertCircle } from 'lucide-react';

interface DeviceFormState {
  imei: string;
  condition: 'NEW' | 'USED';
  cosmetic: string;
  battery: string;
  defects: string;
  included_accessories: string;
  sale_price: string;
}

interface LineFormState {
  id: string; // internal unique id for key
  product_id: string;
  quantity: number;
  unit_cost: number;
  devices: DeviceFormState[];
}

interface PurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (purchase: PurchaseDetail) => void;
}

export const PurchaseModal: React.FC<PurchaseModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [supplierId, setSupplierId] = useState('');
  const [extraCost, setExtraCost] = useState<number>(0);
  const [cashAmount, setCashAmount] = useState<number>(0);
  const [bankAmount, setBankAmount] = useState<number>(0);
  const [note, setNote] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [lines, setLines] = useState<LineFormState[]>([
    {
      id: 'line-1',
      product_id: '',
      quantity: 1,
      unit_cost: 0,
      devices: [],
    },
  ]);
  const [devicePages, setDevicePages] = useState<Record<string, number>>({});
  const devicePageSize = 8;

  // Fetch suppliers and products
  const { data: suppliersData } = useQuery<{ items: Supplier[] }>({
    queryKey: ['suppliers'],
    queryFn: () => api.get<{ items: Supplier[] }>('/suppliers'),
    enabled: isOpen,
  });

  const { data: productsData } = useQuery<{ items: Product[] }>({
    queryKey: ['products'],
    queryFn: () => api.get<{ items: Product[] }>('/products'),
    enabled: isOpen,
  });

  const suppliers = suppliersData?.items || [];
  const products = productsData?.items || [];
  const productMap = new Map(products.map((p) => [p.id, p]));

  // Calculate totals
  const subtotal = lines.reduce((acc, line) => {
    const qty = line.devices.length > 0 ? line.devices.length : line.quantity;
    return acc + multiplyVnd(line.unit_cost, qty);
  }, 0);

  const total = sumVnd([subtotal, extraCost]);
  const paid = sumVnd([cashAmount, bankAmount]);
  const debt = Math.max(0, total - paid);

  const handleAddLine = () => {
    setLines((prev) => [
      ...prev,
      {
        id: `line-${Date.now()}-${Math.random()}`,
        product_id: '',
        quantity: 1,
        unit_cost: 0,
        devices: [],
      },
    ]);
  };

  const handleRemoveLine = (index: number) => {
    if (lines.length <= 1) return;
    setLines((prev) => prev.filter((_, i) => i !== index));
  };

  const handleProductChange = (lineIndex: number, prodId: string) => {
    const prod = productMap.get(prodId);
    setDevicePages((current) => ({ ...current, [lines[lineIndex].id]: 1 }));
    setLines((prev) => {
      const next = [...prev];
      const isPhone = prod?.kind === 'PHONE';
      next[lineIndex] = {
        ...next[lineIndex],
        product_id: prodId,
        quantity: isPhone ? 1 : next[lineIndex].quantity || 1,
        devices: isPhone
          ? [
              {
                imei: '',
                condition: 'NEW',
                cosmetic: '',
                battery: '',
                defects: '',
                included_accessories: '',
                sale_price: prod?.sale_price ? String(prod.sale_price) : '',
              },
            ]
          : [],
      };
      return next;
    });
  };

  const handleAddDevice = (lineIndex: number) => {
    const prod = productMap.get(lines[lineIndex].product_id);
    setDevicePages((current) => ({ ...current, [lines[lineIndex].id]: Math.ceil((lines[lineIndex].devices.length + 1) / devicePageSize) }));
    setLines((prev) => {
      const next = [...prev];
      const line = next[lineIndex];
      const newDevice: DeviceFormState = {
        imei: '',
        condition: 'NEW',
        cosmetic: '',
        battery: '',
        defects: '',
        included_accessories: '',
        sale_price: prod?.sale_price ? String(prod.sale_price) : '',
      };
      const updatedDevices = [...line.devices, newDevice];
      next[lineIndex] = {
        ...line,
        devices: updatedDevices,
        quantity: updatedDevices.length,
      };
      return next;
    });
  };

  const handleRemoveDevice = (lineIndex: number, devIndex: number) => {
    const currentLine = lines[lineIndex];
    if (currentLine.devices.length <= 1) return;
    setDevicePages((current) => ({ ...current, [currentLine.id]: Math.min(current[currentLine.id] || 1, Math.max(1, Math.ceil((currentLine.devices.length - 1) / devicePageSize))) }));
    setLines((prev) => {
      const next = [...prev];
      const line = next[lineIndex];
      const updatedDevices = line.devices.filter((_, i) => i !== devIndex);
      next[lineIndex] = {
        ...line,
        devices: updatedDevices,
        quantity: updatedDevices.length,
      };
      return next;
    });
  };

  const handleDeviceChange = (
    lineIndex: number,
    devIndex: number,
    field: keyof DeviceFormState,
    value: string
  ) => {
    setLines((prev) => {
      const next = [...prev];
      const line = next[lineIndex];
      const updatedDevices = [...line.devices];
      updatedDevices[devIndex] = {
        ...updatedDevices[devIndex],
        [field]: value,
      };
      next[lineIndex] = { ...line, devices: updatedDevices };
      return next;
    });
  };

  const setFullPayment = () => {
    setCashAmount(total);
    setBankAmount(0);
  };

  const setZeroPayment = () => {
    setCashAmount(0);
    setBankAmount(0);
  };

  const mutation = useMutation({
    mutationFn: (payload: PurchaseInputPayload) =>
      api.post<PurchaseDetail>('/purchases', payload),
    onSuccess: (data) => {
      showToast('Tạo phiếu nhập kho thành công', 'success');
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      if (onSuccess) onSuccess(data);
      onClose();
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
          ? err.message
          : 'Không thể tạo phiếu nhập kho';
      setErrorMsg(msg);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!supplierId) {
      setErrorMsg('Vui lòng chọn nhà cung cấp');
      return;
    }

    if (lines.length === 0) {
      setErrorMsg('Phiếu nhập phải có ít nhất một dòng sản phẩm');
      return;
    }

    // Validate lines
    const allImeis: string[] = [];
    const formattedLines = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.product_id) {
        setErrorMsg(`Dòng ${i + 1}: Vui lòng chọn sản phẩm`);
        return;
      }

      const prod = productMap.get(line.product_id);
      if (!prod) {
        setErrorMsg(`Dòng ${i + 1}: Sản phẩm không tồn tại`);
        return;
      }

      if (line.unit_cost < 0) {
        setErrorMsg(`Dòng ${i + 1}: Đơn giá nhập không được âm`);
        return;
      }

      if (prod.kind === 'PHONE') {
        if (!line.devices || line.devices.length === 0) {
          setErrorMsg(`Dòng ${i + 1}: Điện thoại cần ít nhất một máy/IMEI`);
          return;
        }

        const deviceInputs = [];
        for (let d = 0; d < line.devices.length; d++) {
          const dev = line.devices[d];
          const cleanImei = dev.imei.trim();
          if (!/^\d{15}$/.test(cleanImei)) {
            setErrorMsg(
              `Dòng ${i + 1}, máy ${d + 1}: IMEI phải là chuỗi 15 chữ số hợp lệ (${cleanImei || 'trống'})`
            );
            return;
          }
          if (allImeis.includes(cleanImei)) {
            setErrorMsg(`IMEI ${cleanImei} bị trùng lặp trong phiếu nhập`);
            return;
          }
          allImeis.push(cleanImei);

          const batteryNum = dev.battery ? parseInt(dev.battery, 10) : undefined;
          if (batteryNum !== undefined && (isNaN(batteryNum) || batteryNum < 0 || batteryNum > 100)) {
            setErrorMsg(`Dòng ${i + 1}, máy ${d + 1}: Phần trăm pin phải từ 0 đến 100`);
            return;
          }

          const salePriceNum = dev.sale_price ? parseInt(dev.sale_price, 10) : undefined;

          deviceInputs.push({
            imei: cleanImei,
            condition: dev.condition,
            cosmetic: dev.cosmetic.trim() || undefined,
            battery: batteryNum,
            defects: dev.defects.trim() || undefined,
            included_accessories: dev.included_accessories.trim() || undefined,
            sale_price: salePriceNum,
          });
        }

        formattedLines.push({
          product_id: line.product_id,
          quantity: deviceInputs.length,
          unit_cost: line.unit_cost,
          devices: deviceInputs,
        });
      } else {
        // ACCESSORY
        if (!line.quantity || line.quantity < 1) {
          setErrorMsg(`Dòng ${i + 1}: Số lượng phụ kiện phải từ 1 trở lên`);
          return;
        }

        formattedLines.push({
          product_id: line.product_id,
          quantity: line.quantity,
          unit_cost: line.unit_cost,
        });
      }
    }

    if (extraCost < 0) {
      setErrorMsg('Chi phí mua hàng không được âm');
      return;
    }

    if (paid > total) {
      setErrorMsg('Tổng tiền thanh toán không được vượt tổng phiếu nhập');
      return;
    }

    const payments: { method: 'cash' | 'bank'; amount: number }[] = [];
    if (cashAmount > 0) payments.push({ method: 'cash', amount: cashAmount });
    if (bankAmount > 0) payments.push({ method: 'bank', amount: bankAmount });

    const payload: PurchaseInputPayload = {
      supplier_id: supplierId,
      extra_cost: extraCost,
      note: note.trim() || undefined,
      payments,
      lines: formattedLines,
    };

    mutation.mutate(payload);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={mutation.isPending ? () => {} : onClose}
      title="Tạo phiếu nhập hàng"
      maxWidth="880px"
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, width: '100%' }}>
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={mutation.isPending}
          >
            Hủy bỏ
          </Button>
          <Button
            type="submit"
            form="purchase-form"
            variant="primary"
            isLoading={mutation.isPending}
            disabled={mutation.isPending}
          >
            Hoàn tất & Nhập kho
          </Button>
        </div>
      }
    >
      <form id="purchase-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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

        {/* Section: Thông tin chung */}
        <div className="purchase-general-grid">
          <Select
            label="Nhà cung cấp (*)"
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            options={[
              { value: '', label: '-- Chọn nhà cung cấp --' },
              ...suppliers.map((s) => ({
                value: s.id,
                label: `${s.name} ${s.phone ? `(${s.phone})` : ''} - Nợ: ${formatVND(s.debt)}`,
              })),
            ]}
            required
            disabled={mutation.isPending}
          />
          <Input
            id="purchase-extra-cost"
            label="Chi phí mua hàng phát sinh (VND)"
            type="number"
            min={0}
            value={extraCost === 0 ? '' : extraCost}
            onChange={(e) => setExtraCost(Math.max(0, parseInt(e.target.value || '0', 10)))}
            placeholder="0"
            helperText="Phân bổ đều vào giá vốn từng máy/lô hàng"
            disabled={mutation.isPending}
          />
        </div>

        {/* Section: Danh sách sản phẩm nhập */}
        <div style={{ borderTop: '1px solid var(--slate-200)', paddingTop: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontWeight: 600, color: 'var(--slate-800)', fontSize: '13.5px' }}>
              Chi tiết mặt hàng ({lines.length} dòng)
            </span>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleAddLine}
              disabled={mutation.isPending}
            >
              <Plus size={14} style={{ marginRight: 4 }} /> Thêm dòng hàng
            </Button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {lines.map((line, lineIndex) => {
              const selectedProd = productMap.get(line.product_id);
              const isPhone = selectedProd?.kind === 'PHONE';
              const lineQty = isPhone ? line.devices.length : line.quantity;
              const lineTotal = multiplyVnd(line.unit_cost, lineQty);

              return (
                <div
                  key={line.id}
                  style={{
                    backgroundColor: 'var(--slate-50)',
                    border: '1px solid var(--slate-200)',
                    borderRadius: 'var(--radius-md)',
                    padding: '12px 14px',
                  }}
                >
                  <div
                    className="purchase-line-grid"
                    style={{
                      display: 'grid',
                      gap: 10,
                      alignItems: 'flex-start',
                    }}
                  >
                    <Select
                      label={`Sản phẩm dòng #${lineIndex + 1}`}
                      value={line.product_id}
                      onChange={(e) => handleProductChange(lineIndex, e.target.value)}
                      options={[
                        { value: '', label: '-- Chọn sản phẩm --' },
                        ...products.map((p) => ({
                          value: p.id,
                          label: `[${p.sku}] ${p.name} (${p.kind === 'PHONE' ? 'Máy' : 'Phụ kiện'})`,
                        })),
                      ]}
                      required
                      disabled={mutation.isPending}
                    />

                    <Input
                      label="Đơn giá nhập (VND)"
                      type="number"
                      min={0}
                      value={line.unit_cost === 0 ? '' : line.unit_cost}
                      onChange={(e) => {
                        const val = Math.max(0, parseInt(e.target.value || '0', 10));
                        setLines((prev) => {
                          const next = [...prev];
                          next[lineIndex] = { ...next[lineIndex], unit_cost: val };
                          return next;
                        });
                      }}
                      placeholder="0"
                      data-testid={`unit-cost-${lineIndex}`}
                      required
                      disabled={mutation.isPending}
                    />

                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--slate-700)', marginBottom: 4 }}>
                        Số lượng
                      </label>
                      {isPhone ? (
                        <div
                          style={{
                            height: 32,
                            display: 'flex',
                            alignItems: 'center',
                            padding: '0 10px',
                            backgroundColor: 'var(--slate-200)',
                            borderRadius: 'var(--radius-sm)',
                            fontWeight: 600,
                            fontSize: '13px',
                          }}
                        >
                          {line.devices.length} máy
                        </div>
                      ) : (
                        <input
                          type="number"
                          min={1}
                          data-testid={`accessory-qty-${lineIndex}`}
                          value={line.quantity}
                          onChange={(e) => {
                            const val = Math.max(1, parseInt(e.target.value || '1', 10));
                            setLines((prev) => {
                              const next = [...prev];
                              next[lineIndex] = { ...next[lineIndex], quantity: val };
                              return next;
                            });
                          }}
                          className="input"
                          style={{ height: 32 }}
                          disabled={mutation.isPending}
                        />
                      )}
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--slate-700)', marginBottom: 4 }}>
                        Thành tiền
                      </label>
                      <div
                        style={{
                          height: 32,
                          display: 'flex',
                          alignItems: 'center',
                          fontWeight: 600,
                          color: 'var(--teal-800)',
                          fontSize: '13px',
                        }}
                      >
                        {formatVND(lineTotal)}
                      </div>
                    </div>

                    <div style={{ paddingTop: 22 }}>
                      <button
                        type="button"
                        onClick={() => handleRemoveLine(lineIndex)}
                        disabled={lines.length <= 1 || mutation.isPending}
                        className="btn btn-ghost btn-sm"
                        style={{ color: 'var(--danger-600)', padding: 6 }}
                        title="Xóa dòng"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Chi tiết từng máy nếu là PHONE */}
                  {isPhone && (
                    <div
                      style={{
                        marginTop: 12,
                        padding: '10px 12px',
                        backgroundColor: '#ffffff',
                        border: '1px solid var(--slate-200)',
                        borderRadius: 'var(--radius-sm)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--slate-700)', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Smartphone size={14} /> Danh sách IMEI ({line.devices.length} máy)
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleAddDevice(lineIndex)}
                          disabled={mutation.isPending}
                        >
                          <Plus size={12} style={{ marginRight: 4 }} /> Thêm IMEI
                        </Button>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {line.devices.slice(((devicePages[line.id] || 1) - 1) * devicePageSize, (devicePages[line.id] || 1) * devicePageSize).map((dev, deviceOffset) => {
                          const devIndex = ((devicePages[line.id] || 1) - 1) * devicePageSize + deviceOffset;
                          return (
                          <div
                            key={devIndex}
                            className="purchase-device-grid"
                            style={{
                              display: 'grid',
                              gap: 6,
                              alignItems: 'center',
                              fontSize: '12px',
                            }}
                          >
                            <input
                              type="text"
                              value={dev.imei}
                              onChange={(e) => handleDeviceChange(lineIndex, devIndex, 'imei', e.target.value.replace(/\D/g, '').slice(0, 15))}
                              placeholder="15 số IMEI (*)"
                              className="input"
                              style={{ height: 30, fontSize: '12px', fontFamily: 'var(--font-mono)' }}
                              required
                              disabled={mutation.isPending}
                            />
                            <select
                              value={dev.condition}
                              onChange={(e) => handleDeviceChange(lineIndex, devIndex, 'condition', e.target.value as 'NEW' | 'USED')}
                              className="input"
                              style={{ height: 30, fontSize: '12px', padding: '0 4px' }}
                              disabled={mutation.isPending}
                            >
                              <option value="NEW">Mới (NEW)</option>
                              <option value="USED">Cũ (USED)</option>
                            </select>
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={dev.battery}
                              onChange={(e) => handleDeviceChange(lineIndex, devIndex, 'battery', e.target.value)}
                              placeholder="Pin %"
                              className="input"
                              style={{ height: 30, fontSize: '12px' }}
                              disabled={mutation.isPending}
                            />
                            <input
                              type="text"
                              value={dev.cosmetic}
                              onChange={(e) => handleDeviceChange(lineIndex, devIndex, 'cosmetic', e.target.value)}
                              placeholder="Ngoại hình (99%, trầy nhẹ...)"
                              className="input"
                              style={{ height: 30, fontSize: '12px' }}
                              disabled={mutation.isPending}
                            />
                            <input
                              type="number"
                              min={0}
                              value={dev.sale_price}
                              onChange={(e) => handleDeviceChange(lineIndex, devIndex, 'sale_price', e.target.value)}
                              placeholder="Giá bán niêm yết"
                              className="input"
                              style={{ height: 30, fontSize: '12px' }}
                              disabled={mutation.isPending}
                            />
                            <button
                              type="button"
                              onClick={() => handleRemoveDevice(lineIndex, devIndex)}
                              disabled={line.devices.length <= 1 || mutation.isPending}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                cursor: line.devices.length <= 1 ? 'not-allowed' : 'pointer',
                                color: line.devices.length <= 1 ? 'var(--slate-300)' : 'var(--danger-600)',
                                padding: 2,
                              }}
                              title="Xóa IMEI này"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                          );
                        })}
                      </div>
                      {line.devices.length > devicePageSize && (
                        <div className="compact-pagination" aria-label={`Phân trang IMEI dòng ${lineIndex + 1}`}>
                          <span>{line.devices.length} máy · Trang {devicePages[line.id] || 1} / {Math.ceil(line.devices.length / devicePageSize)}</span>
                          <div>
                            <Button type="button" variant="secondary" size="sm" disabled={(devicePages[line.id] || 1) <= 1} onClick={() => setDevicePages((current) => ({ ...current, [line.id]: (current[line.id] || 1) - 1 }))}>Trước</Button>
                            <Button type="button" variant="secondary" size="sm" disabled={(devicePages[line.id] || 1) >= Math.ceil(line.devices.length / devicePageSize)} onClick={() => setDevicePages((current) => ({ ...current, [line.id]: (current[line.id] || 1) + 1 }))}>Sau</Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Section: Thanh toán & Ghi nợ */}
        <div className="purchase-payment-grid">
          <div className="purchase-payment-fields">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontWeight: 600, color: 'var(--slate-800)', fontSize: '13px' }}>
                Thanh toán cho nhà cung cấp
              </span>
              <div className="purchase-payment-actions" style={{ display: 'flex', gap: 6 }}>
                <button
                  type="button"
                  onClick={setFullPayment}
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: '11.5px', color: 'var(--teal-700)', padding: '2px 8px' }}
                >
                  Thanh toán đủ
                </button>
                <button
                  type="button"
                  onClick={setZeroPayment}
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: '11.5px', color: 'var(--slate-600)', padding: '2px 8px' }}
                >
                  Ghi nợ tất cả
                </button>
              </div>
            </div>

            <div className="purchase-payment-input-grid">
              <Input
                id="purchase-cash"
                label="Tiền mặt (VND)"
                type="number"
                min={0}
                value={cashAmount === 0 ? '' : cashAmount}
                onChange={(e) => setCashAmount(Math.max(0, parseInt(e.target.value || '0', 10)))}
                placeholder="0"
                disabled={mutation.isPending}
              />
              <Input
                id="purchase-bank"
                label="Chuyển khoản (VND)"
                type="number"
                min={0}
                value={bankAmount === 0 ? '' : bankAmount}
                onChange={(e) => setBankAmount(Math.max(0, parseInt(e.target.value || '0', 10)))}
                placeholder="0"
                disabled={mutation.isPending}
              />
            </div>

            <div style={{ marginTop: 10 }}>
              <Input
                label="Ghi chú phiếu nhập"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ví dụ: Nhập hàng lô đợt 1 tháng 11..."
                disabled={mutation.isPending}
              />
            </div>
          </div>

          {/* Bảng tổng kết tiền */}
          <div
            style={{
              backgroundColor: 'var(--slate-50)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--slate-200)',
              padding: '12px 16px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className="purchase-summary-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px' }}>
                <span style={{ color: 'var(--slate-600)' }}>Tiền hàng ({lines.reduce((s, l) => s + (l.devices.length || l.quantity), 0)} sản phẩm):</span>
                <span style={{ fontWeight: 500 }}>{formatVND(subtotal)}</span>
              </div>
              <div className="purchase-summary-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px' }}>
                <span style={{ color: 'var(--slate-600)' }}>Chi phí mua hàng:</span>
                <span style={{ fontWeight: 500 }}>{formatVND(extraCost)}</span>
              </div>
              <div
                className="purchase-summary-row purchase-summary-total"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '14px',
                  fontWeight: 700,
                  color: 'var(--slate-900)',
                  borderTop: '1px dashed var(--slate-300)',
                  paddingTop: 8,
                }}
              >
                <span>Tổng phiếu nhập:</span>
                <span style={{ color: 'var(--teal-700)' }}>{formatVND(total)}</span>
              </div>
              <div className="purchase-summary-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginTop: 4 }}>
                <span style={{ color: 'var(--slate-600)' }}>Đã thanh toán (Tiền mặt + CK):</span>
                <span style={{ fontWeight: 600, color: 'var(--success-700)' }}>{formatVND(paid)}</span>
              </div>
              <div
                className="purchase-summary-row"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: debt > 0 ? 'var(--danger-700)' : 'var(--slate-700)',
                  backgroundColor: debt > 0 ? 'var(--danger-50)' : 'transparent',
                  padding: debt > 0 ? '4px 8px' : '0',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                <span>Còn nợ NCC:</span>
                <span>{formatVND(debt)}</span>
              </div>
            </div>

            <div style={{ fontSize: '11px', color: 'var(--slate-500)', marginTop: 8 }}>
              * Phiếu nhập kho được ghi sổ append-only, tự động phân bổ giá vốn FIFO và hạch toán sổ quỹ.
            </div>
          </div>
        </div>
      </form>
    </Modal>
  );
};
