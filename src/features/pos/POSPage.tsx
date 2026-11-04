import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiClientError } from '../../lib/api-client';
import { formatVND } from '../../lib/formatters';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../context/ToastContext';
import { multiplyVnd, sumVnd, allocateDiscount } from '../../../shared/money';
import type { Product, Device } from '../../types/catalog';
import type { Customer } from '../../types/parties';
import type { SaleDetail, SaleInputPayload } from '../../types/sales';
import { SaleDrawer } from '../sales/SaleDrawer';
import {
  Search,
  ShoppingCart,
  Trash2,
  Smartphone,
  Package,
  Plus,
  Minus,
  AlertCircle,
  CreditCard,
  User,
  CheckCircle2,
  Printer,
} from 'lucide-react';

interface CartItem {
  id: string; // unique item id in cart
  product_id: string;
  product_name: string;
  sku: string;
  kind: 'PHONE' | 'ACCESSORY';
  device_id?: string;
  imei?: string;
  condition?: 'NEW' | 'USED';
  battery?: number | null;
  quantity: number;
  unit_price: number;
  available_stock: number;
}

export const POSPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [discount, setDiscount] = useState<number>(0);
  const [cashAmount, setCashAmount] = useState<number>(0);
  const [bankAmount, setBankAmount] = useState<number>(0);
  const [note, setNote] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [devSearchPage, setDevSearchPage] = useState(1);
  const [prodSearchPage, setProdSearchPage] = useState(1);
  const [catalogPage, setCatalogPage] = useState(1);
  const searchPageSize = 5;
  const catalogPageSize = 10;

  // IMEI Selection Modal state for phone products
  const [imeiModalProduct, setImeiModalProduct] = useState<Product | null>(null);
  const [imeiSearchQuery, setImeiSearchQuery] = useState('');
  const [imeiModalPage, setImeiModalPage] = useState(1);
  const [selectedImeiIds, setSelectedImeiIds] = useState<string[]>([]);
  const imeiModalPageSize = 10;

  useEffect(() => {
    setImeiModalPage(1);
  }, [imeiModalProduct, imeiSearchQuery]);

  const handleOpenImeiModal = (prod: Product) => {
    setImeiModalProduct(prod);
    setImeiSearchQuery('');
    setImeiModalPage(1);
    setSelectedImeiIds([]);
  };

  const handleCloseImeiModal = () => {
    setImeiModalProduct(null);
    setImeiSearchQuery('');
    setImeiModalPage(1);
    setSelectedImeiIds([]);
  };

  useEffect(() => {
    setDevSearchPage(1);
    setProdSearchPage(1);
  }, [searchQuery]);

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);

  // Success completed sale for printing
  const [completedSale, setCompletedSale] = useState<SaleDetail | null>(null);

  // Queries
  const { data: productsData } = useQuery<{ items: Product[] }>({
    queryKey: ['products'],
    queryFn: () => api.get<{ items: Product[] }>('/products'),
  });

  const { data: devicesData } = useQuery<{ items: Device[] }>({
    queryKey: ['devices', 'available'],
    queryFn: () => api.get<{ items: Device[] }>('/devices?status=available'),
  });

  const { data: customersData } = useQuery<{ items: Customer[] }>({
    queryKey: ['customers'],
    queryFn: () => api.get<{ items: Customer[] }>('/customers'),
  });

  const products = productsData?.items || [];
  const devices = devicesData?.items || [];
  const customers = customersData?.items || [];

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);

  // Devices grouped by product_id
  const devicesByProduct = useMemo(() => {
    const map = new Map<string, Device[]>();
    for (const d of devices) {
      const arr = map.get(d.product_id) || [];
      arr.push(d);
      map.set(d.product_id, arr);
    }
    return map;
  }, [devices]);

  // Filtered devices for IMEI selection modal
  const availableModalDevices = useMemo(() => {
    if (!imeiModalProduct) return [];
    const list = (devicesByProduct.get(imeiModalProduct.id) || []).filter(
      (device) => (!device.status || device.status === 'available') &&
        !cart.some((item) => item.device_id === device.id)
    );
    return list;
  }, [imeiModalProduct, devicesByProduct, cart]);

  const filteredModalDevices = useMemo(() => {
    if (!imeiSearchQuery.trim()) return availableModalDevices;
    const q = imeiSearchQuery.trim().toLowerCase();
    return availableModalDevices.filter((d) => d.imei.toLowerCase().includes(q));
  }, [availableModalDevices, imeiSearchQuery]);

  const totalModalPages = Math.max(1, Math.ceil(filteredModalDevices.length / imeiModalPageSize));
  const currentModalPage = Math.min(Math.max(1, imeiModalPage), totalModalPages);
  const visibleModalDevices = filteredModalDevices.slice(
    (currentModalPage - 1) * imeiModalPageSize,
    currentModalPage * imeiModalPageSize
  );
  const selectedModalDevices = availableModalDevices.filter((device) => selectedImeiIds.includes(device.id));
  const allVisibleDevicesSelected = visibleModalDevices.length > 0 &&
    visibleModalDevices.every((device) => selectedImeiIds.includes(device.id));

  const handleToggleVisibleImeiDevices = () => {
    const visibleIds = visibleModalDevices.map((device) => device.id);
    setSelectedImeiIds((current) => allVisibleDevicesSelected
      ? current.filter((id) => !visibleIds.includes(id))
      : [...new Set([...current, ...visibleIds])]);
  };

  const handleAddSelectedImeiDevices = () => {
    selectedModalDevices.forEach(handleAddDevice);
    handleCloseImeiModal();
  };

  // Filtered search results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return { devices: [] as Device[], products: [] as Product[] };
    const q = searchQuery.toLowerCase().trim();

    // 1. Matching available devices by IMEI
    const matchedDevices = devices.filter(
      (d) =>
        d.imei.includes(q) ||
        d.product_name.toLowerCase().includes(q) ||
        d.sku.toLowerCase().includes(q)
    );

    // 2. Matching products by SKU or name
    const matchedProducts = products.filter(
      (p) =>
        p.sku.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        (p.brand && p.brand.toLowerCase().includes(q))
    );

    return {
      devices: matchedDevices,
      products: matchedProducts,
    };
  }, [searchQuery, devices, products]);

  // Add accessory to cart
  const handleAddAccessory = (prod: Product) => {
    if (prod.kind !== 'ACCESSORY') return;
    setErrorMsg(null);
    const stock = prod.stock_quantity ?? 0;

    const existingIndex = cart.findIndex((item) => item.product_id === prod.id);
    if (existingIndex >= 0) {
      const existing = cart[existingIndex];
      if (existing.quantity >= stock) {
        setErrorMsg(`Sản phẩm [${prod.sku}] chỉ còn tồn kho ${stock}`);
        return;
      }
      setCart((prev) => {
        const next = [...prev];
        next[existingIndex] = {
          ...existing,
          quantity: existing.quantity + 1,
        };
        return next;
      });
    } else {
      if (stock <= 0) {
        setErrorMsg(`Sản phẩm [${prod.sku}] hiện đã hết hàng trong kho`);
        return;
      }
      setCart((prev) => [
        ...prev,
        {
          id: `cart-item-${Date.now()}-${Math.random()}`,
          product_id: prod.id,
          product_name: prod.name,
          sku: prod.sku,
          kind: 'ACCESSORY',
          quantity: 1,
          unit_price: prod.sale_price ?? 0,
          available_stock: stock,
        },
      ]);
    }
  };

  // Add phone device to cart
  const handleAddDevice = (device: Device) => {
    setErrorMsg(null);
    const alreadyInCart = cart.some((item) => item.device_id === device.id);
    if (alreadyInCart) {
      setErrorMsg(`Thiết bị IMEI ${device.imei} đã có trong giỏ hàng`);
      return;
    }

    setCart((prev) => [
      ...prev,
      {
        id: `cart-item-${Date.now()}-${Math.random()}`,
        product_id: device.product_id,
        product_name: device.product_name,
        sku: device.sku,
        kind: 'PHONE',
        device_id: device.id,
        imei: device.imei,
        condition: device.condition,
        battery: device.battery,
        quantity: 1,
        unit_price: device.sale_price ?? 0,
        available_stock: 1,
      },
    ]);
  };

  // Update item quantity (accessories only)
  const handleUpdateQuantity = (itemId: string, newQty: number) => {
    setErrorMsg(null);
    setCart((prev) =>
      prev.map((item) => {
        if (item.id === itemId && item.kind === 'ACCESSORY') {
          const clamped = Math.max(1, Math.min(newQty, item.available_stock));
          return { ...item, quantity: clamped };
        }
        return item;
      })
    );
  };

  // Update item unit price
  const handleUpdatePrice = (itemId: string, newPrice: number) => {
    setCart((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, unit_price: Math.max(0, newPrice) } : item))
    );
  };

  // Remove item from cart
  const handleRemoveItem = (itemId: string) => {
    setCart((prev) => prev.filter((item) => item.id !== itemId));
  };

  // Cart calculations
  const grossLines = cart.map((item) => multiplyVnd(item.unit_price, item.quantity));
  const subtotal = sumVnd(grossLines);
  const safeDiscount = Math.min(discount, subtotal);
  const total = Math.max(0, subtotal - safeDiscount);
  const paid = sumVnd([cashAmount, bankAmount]);
  const debt = Math.max(0, total - paid);

  // Fast payment presets
  const handlePayFullCash = () => {
    setCashAmount(total);
    setBankAmount(0);
  };

  const handlePayFullBank = () => {
    setCashAmount(0);
    setBankAmount(total);
  };

  const handleDebtAll = () => {
    setCashAmount(0);
    setBankAmount(0);
  };

  // Mutation to create sale
  const mutation = useMutation({
    mutationFn: (payload: SaleInputPayload) => api.post<SaleDetail>('/sales', payload),
    onSuccess: (data) => {
      showToast(`Tạo phiếu bán ${data.number} thành công!`, 'success');
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] });

      // Clear cart only on success!
      setCart([]);
      setDiscount(0);
      setCashAmount(0);
      setBankAmount(0);
      setNote('');
      setSelectedCustomerId('');
      setErrorMsg(null);

      // Open completed sale drawer for printing
      setCompletedSale(data);
    },
    onError: (err: unknown) => {
      // Preserve cart on error!
      const msg =
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
          ? err.message
          : 'Không thể tạo phiếu bán';
      setErrorMsg(msg);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (cart.length === 0) {
      setErrorMsg('Giỏ hàng trống. Vui lòng chọn sản phẩm cần bán.');
      return;
    }

    if (paid > total) {
      setErrorMsg('Số tiền thanh toán vượt quá tổng giá trị phiếu bán');
      return;
    }

    if (paid < total && !selectedCustomerId) {
      setErrorMsg('Bán chịu hoặc thanh toán chưa đủ bắt buộc phải chọn khách hàng');
      return;
    }

    if (safeDiscount > subtotal) {
      setErrorMsg('Chiết khấu không được vượt quá tổng tiền hàng');
      return;
    }

    const formattedLines = cart.map((item) => ({
      product_id: item.product_id,
      device_id: item.device_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
    }));

    const payments: { method: 'cash' | 'bank'; amount: number }[] = [];
    if (cashAmount > 0) payments.push({ method: 'cash', amount: cashAmount });
    if (bankAmount > 0) payments.push({ method: 'bank', amount: bankAmount });

    const payload: SaleInputPayload = {
      customer_id: selectedCustomerId || null,
      discount: safeDiscount,
      note: note.trim() || undefined,
      payments,
      lines: formattedLines,
    };

    mutation.mutate(payload);
  };

  return (
    <div className="page-container" style={{ maxWidth: '100%' }}>
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: 12 }}>
        <div>
          <h1 className="page-title">Bán hàng (POS)</h1>
          <p className="page-subtitle">
            Tìm kiếm hàng hóa, chọn IMEI máy, lập hóa đơn bán lẻ và ghi nhận thanh toán
          </p>
        </div>
      </div>

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
            marginBottom: 12,
          }}
        >
          <AlertCircle size={16} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main 2-column POS layout: Left = Catalog & Picking, Right = Multi-line Cart & Payment */}
      <div
        className="pos-layout"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(420px, 1.2fr) minmax(380px, 1fr)',
          gap: 16,
          alignItems: 'flex-start',
        }}
      >
        {/* LEFT COLUMN: Tìm kiếm & Chọn mặt hàng */}
        <div className="pos-catalog" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Search box */}
          <div className="card" style={{ padding: '12px 14px' }}>
            <div style={{ position: 'relative' }}>
              <Search
                size={16}
                style={{
                  position: 'absolute',
                  left: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--slate-400)',
                }}
              />
              <input
                type="text"
                className="input"
                style={{ paddingLeft: 34, height: 38, fontSize: '13.5px' }}
                placeholder="Tìm sản phẩm, SKU hoặc gõ 15 số IMEI để chọn ngay máy..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
              />
            </div>

            {searchQuery && (
              <div style={{ marginTop: 10, maxHeight: 320, overflowY: 'auto' }}>
                {searchResults.devices?.length === 0 && searchResults.products?.length === 0 ? (
                  <div style={{ padding: '12px', textAlign: 'center', color: 'var(--slate-500)', fontSize: '12.5px' }}>
                    Không tìm thấy sản phẩm hoặc máy nào phù hợp với "{searchQuery}"
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {/* Matching Devices (Phones by IMEI) */}
                    {searchResults.devices?.length > 0 && (() => {
                      const totalDevPages = Math.max(1, Math.ceil(searchResults.devices.length / searchPageSize));
                      const curDevPage = Math.min(Math.max(1, devSearchPage), totalDevPages);
                      const visibleDevs = searchResults.devices.slice((curDevPage - 1) * searchPageSize, curDevPage * searchPageSize);

                      return (
                        <div>
                          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--teal-700)', textTransform: 'uppercase', marginBottom: 4 }}>
                            Thiết bị sẵn sàng bán ({searchResults.devices.length})
                          </div>
                          {visibleDevs.map((dev) => (
                            <div
                              key={dev.id}
                              style={{
                                padding: '8px 10px',
                                backgroundColor: 'var(--slate-50)',
                                border: '1px solid var(--slate-200)',
                                borderRadius: 'var(--radius-sm)',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: 4,
                              }}
                            >
                              <div>
                                <div style={{ fontWeight: 600, fontSize: '12.5px' }}>
                                  [{dev.sku}] {dev.product_name}
                                </div>
                                <div style={{ fontSize: '11.5px', color: 'var(--slate-600)', display: 'flex', gap: 8 }}>
                                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>IMEI: {dev.imei}</span>
                                  <Badge variant={dev.condition === 'NEW' ? 'new' : 'used'}>
                                    {dev.condition === 'NEW' ? 'Mới' : 'Cũ'}
                                  </Badge>
                                  {dev.battery !== null && <span>Pin: {dev.battery}%</span>}
                                </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontWeight: 600, color: 'var(--teal-800)', fontSize: '13px' }}>
                                  {formatVND(dev.sale_price)}
                                </span>
                                <Button
                                  type="button"
                                  variant="primary"
                                  size="sm"
                                  onClick={() => handleAddDevice(dev)}
                                >
                                  <Plus size={13} style={{ marginRight: 2 }} /> Chọn
                                </Button>
                              </div>
                            </div>
                          ))}
                          <div className="compact-pagination" aria-label="Phân trang thiết bị tìm kiếm">
                            <span>{searchResults.devices.length} máy · Trang {curDevPage} / {totalDevPages}</span>
                            <div>
                              <Button type="button" variant="secondary" size="sm" disabled={curDevPage <= 1} onClick={() => setDevSearchPage((p) => Math.max(1, p - 1))}>Trước</Button>
                              <Button type="button" variant="secondary" size="sm" disabled={curDevPage >= totalDevPages} onClick={() => setDevSearchPage((p) => p + 1)}>Sau</Button>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Matching Products */}
                    {searchResults.products?.length > 0 && (() => {
                      const totalProdPages = Math.max(1, Math.ceil(searchResults.products.length / searchPageSize));
                      const curProdPage = Math.min(Math.max(1, prodSearchPage), totalProdPages);
                      const visibleProds = searchResults.products.slice((curProdPage - 1) * searchPageSize, curProdPage * searchPageSize);

                      return (
                        <div style={{ marginTop: 6 }}>
                          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--slate-600)', textTransform: 'uppercase', marginBottom: 4 }}>
                            Mặt hàng ({searchResults.products.length})
                          </div>
                          {visibleProds.map((p) => {
                            const isPhone = p.kind === 'PHONE';
                            const availDevices = devicesByProduct.get(p.id) || [];

                            return (
                              <div
                                key={p.id}
                                style={{
                                  padding: '8px 10px',
                                  backgroundColor: '#ffffff',
                                  border: '1px solid var(--slate-200)',
                                  borderRadius: 'var(--radius-sm)',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  marginBottom: 4,
                                }}
                              >
                                <div>
                                  <div style={{ fontWeight: 600, fontSize: '12.5px' }}>
                                    [{p.sku}] {p.name}
                                  </div>
                                  <div style={{ fontSize: '11.5px', color: 'var(--slate-500)', display: 'flex', gap: 6 }}>
                                    <Badge variant={isPhone ? 'phone' : 'accessory'}>
                                      {isPhone ? 'Điện thoại' : 'Phụ kiện'}
                                    </Badge>
                                    <span>Tồn: <strong>{p.stock_quantity}</strong></span>
                                    {p.brand && <span>Hãng: {p.brand}</span>}
                                  </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <span style={{ fontWeight: 600, color: 'var(--slate-800)', fontSize: '13px' }}>
                                    {formatVND(p.sale_price)}
                                  </span>
                                  {isPhone ? (
                                    <span style={{ fontSize: '11.5px', color: 'var(--slate-500)' }}>
                                      {availDevices.length > 0 ? `(${availDevices.length} máy sẵn sàng)` : '(Hết máy)'}
                                    </span>
                                  ) : (
                                    <Button
                                      type="button"
                                      variant="secondary"
                                      size="sm"
                                      onClick={() => handleAddAccessory(p)}
                                      disabled={(p.stock_quantity ?? 0) <= 0}
                                    >
                                      <Plus size={13} style={{ marginRight: 2 }} /> Thêm
                                    </Button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                          <div className="compact-pagination" aria-label="Phân trang mặt hàng tìm kiếm">
                            <span>{searchResults.products.length} mặt hàng · Trang {curProdPage} / {totalProdPages}</span>
                            <div>
                              <Button type="button" variant="secondary" size="sm" disabled={curProdPage <= 1} onClick={() => setProdSearchPage((p) => Math.max(1, p - 1))}>Trước</Button>
                              <Button type="button" variant="secondary" size="sm" disabled={curProdPage >= totalProdPages} onClick={() => setProdSearchPage((p) => p + 1)}>Sau</Button>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Quick Product Catalog Grid */}
          <div className="card" style={{ padding: '12px 14px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--slate-800)', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Danh mục hàng hóa có sẵn ({products.length})</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10, maxHeight: 420, overflowY: 'auto' }}>
              {products.slice((catalogPage - 1) * catalogPageSize, catalogPage * catalogPageSize).map((p) => {
                const isPhone = p.kind === 'PHONE';
                const availDevices = devicesByProduct.get(p.id) || [];
                const stockQty = p.stock_quantity ?? 0;

                return (
                  <div
                    key={p.id}
                    style={{
                      border: '1px solid var(--slate-200)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '10px',
                      backgroundColor: stockQty > 0 ? '#ffffff' : 'var(--slate-50)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      opacity: stockQty > 0 ? 1 : 0.65,
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <span style={{ fontSize: '10.5px', fontFamily: 'var(--font-mono)', color: 'var(--slate-500)' }}>
                          {p.sku}
                        </span>
                        <Badge variant={isPhone ? 'phone' : 'accessory'}>
                          {isPhone ? 'Máy' : 'PK'}
                        </Badge>
                      </div>
                      <div style={{ fontWeight: 600, fontSize: '12.5px', marginTop: 4, lineHeight: 1.3 }}>
                        {p.name}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--slate-500)', marginTop: 2 }}>
                        Tồn: <strong style={{ color: stockQty > 0 ? 'var(--slate-800)' : 'var(--danger-700)' }}>{stockQty}</strong>
                      </div>
                    </div>

                    <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--slate-100)' }}>
                      <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--teal-800)', marginBottom: 6 }}>
                        {formatVND(p.sale_price)}
                      </div>

                      {isPhone ? (
                        availDevices.length > 0 ? (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            style={{ width: '100%' }}
                            onClick={() => handleOpenImeiModal(p)}
                          >
                            Chọn IMEI
                          </Button>
                        ) : (
                          <div style={{ fontSize: '11px', color: 'var(--slate-400)', textAlign: 'center' }}>Hết máy tồn</div>
                        )
                      ) : (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          style={{ width: '100%' }}
                          onClick={() => handleAddAccessory(p)}
                          disabled={stockQty <= 0}
                        >
                          <Plus size={13} style={{ marginRight: 4 }} /> Thêm vào giỏ
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="compact-pagination" aria-label="Phân trang danh mục hàng hóa">
              <span>{products.length} mặt hàng · Trang {Math.min(catalogPage, Math.max(1, Math.ceil(products.length / catalogPageSize)))} / {Math.max(1, Math.ceil(products.length / catalogPageSize))}</span>
              <div>
                <Button type="button" variant="secondary" size="sm" disabled={catalogPage <= 1} onClick={() => setCatalogPage((p) => Math.max(1, p - 1))}>Trước</Button>
                <Button type="button" variant="secondary" size="sm" disabled={catalogPage >= Math.max(1, Math.ceil(products.length / catalogPageSize))} onClick={() => setCatalogPage((p) => p + 1)}>Sau</Button>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Giỏ hàng đa dòng & Thanh toán */}
        <div className="card pos-cart" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--slate-200)', paddingBottom: 10 }}>
            <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--slate-800)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <ShoppingCart size={17} color="var(--teal-700)" /> Giỏ hàng ({cart.length} mặt hàng)
            </span>
            {cart.length > 0 && (
              <button
                type="button"
                onClick={() => setCart([])}
                className="btn btn-ghost btn-sm"
                style={{ fontSize: '11.5px', color: 'var(--danger-600)', padding: '2px 6px' }}
                disabled={mutation.isPending}
              >
                Xóa tất cả
              </button>
            )}
          </div>

          {/* Cart Lines */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 280, overflowY: 'auto' }}>
            {cart.length === 0 ? (
              <div style={{ padding: '30px 10px', textAlign: 'center', color: 'var(--slate-400)', fontSize: '13px' }}>
                Chưa có mặt hàng nào trong giỏ.<br />Hãy tìm kiếm hoặc chọn sản phẩm ở cột bên trái.
              </div>
            ) : (
              cart.map((item, idx) => {
                const itemTotal = multiplyVnd(item.unit_price, item.quantity);

                return (
                  <div
                    key={item.id}
                    style={{
                      padding: '8px 10px',
                      backgroundColor: 'var(--slate-50)',
                      border: '1px solid var(--slate-200)',
                      borderRadius: 'var(--radius-sm)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '12.5px' }}>
                          #{idx + 1}. [{item.sku}] {item.product_name}
                        </div>
                        {item.kind === 'PHONE' && (
                          <div style={{ fontSize: '11.5px', color: 'var(--slate-600)', display: 'flex', gap: 6 }}>
                            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>IMEI: {item.imei}</span>
                            <Badge variant={item.condition === 'NEW' ? 'new' : 'used'}>
                              {item.condition === 'NEW' ? 'Mới' : 'Cũ'}
                            </Badge>
                            {item.battery !== null && <span>Pin: {item.battery}%</span>}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.id)}
                        disabled={mutation.isPending}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--danger-600)',
                          cursor: 'pointer',
                          padding: 2,
                        }}
                        title="Xóa khỏi giỏ"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      {/* Quantity control */}
                      {item.kind === 'ACCESSORY' ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '2px 6px', height: 26 }}
                            onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                            disabled={item.quantity <= 1 || mutation.isPending}
                          >
                            <Minus size={12} />
                          </button>
                          <Input
                            bare
                            formatThousands
                            type="number"
                            min={1}
                            max={item.available_stock}
                            value={item.quantity}
                            onChange={(e) => handleUpdateQuantity(item.id, parseInt(e.target.value || '1', 10))}
                            className="input"
                            style={{ width: 44, height: 26, textAlign: 'center', padding: '0 4px', fontSize: '12px' }}
                            disabled={mutation.isPending}
                          />
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '2px 6px', height: 26 }}
                            onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                            disabled={item.quantity >= item.available_stock || mutation.isPending}
                          >
                            <Plus size={12} />
                          </button>
                          <span style={{ fontSize: '11px', color: 'var(--slate-500)', marginLeft: 4 }}>
                            (tồn: {item.available_stock})
                          </span>
                        </div>
                      ) : (
                        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--slate-600)' }}>
                          SL: 1 máy
                        </div>
                      )}

                      {/* Price & total */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ fontSize: '11.5px', color: 'var(--slate-500)' }}>
                          x {formatVND(item.unit_price)}
                        </div>
                        <div style={{ fontWeight: 700, color: 'var(--teal-800)', fontSize: '13px' }}>
                          {formatVND(itemTotal)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Customer Selection (Mandatory for Debt) */}
          <div style={{ borderTop: '1px solid var(--slate-200)', paddingTop: 10 }}>
            <Select
              id="pos-customer-select"
              label="Khách hàng"
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              options={[
                { value: '', label: 'Khách lẻ (Thanh toán 100%, không nợ)' },
                ...customers.map((c) => ({
                  value: c.id,
                  label: `${c.name} ${c.phone ? `(${c.phone})` : ''} - Nợ: ${formatVND(c.debt)}`,
                })),
              ]}
              disabled={mutation.isPending}
            />
            {debt > 0 && !selectedCustomerId && (
              <div style={{ fontSize: '11.5px', color: 'var(--danger-700)', marginTop: 4, fontWeight: 500 }}>
                * Đơn hàng còn nợ ({formatVND(debt)}) bắt buộc phải chọn hồ sơ khách hàng.
              </div>
            )}
          </div>

          {/* Discount & Note */}
          <div className="pos-payment-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Input
              id="pos-discount"
              label="Chiết khấu đơn (VND)"
              formatThousands
              type="number"
              min={0}
              max={subtotal}
              value={discount === 0 ? '' : discount}
              onChange={(e) => setDiscount(Math.min(subtotal, Math.max(0, parseInt(e.target.value || '0', 10))))}
              placeholder="0"
              disabled={mutation.isPending}
            />
            <Input
              id="pos-note"
              label="Ghi chú đơn hàng"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ví dụ: Tặng kèm ốp lưng..."
              disabled={mutation.isPending}
            />
          </div>

          {/* Payment breakdown */}
          <div style={{ borderTop: '1px solid var(--slate-200)', paddingTop: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, flexWrap: 'wrap', gap: 6 }}>
              <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--slate-800)' }}>
                Khách thanh toán
              </span>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={handlePayFullCash}
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: '11px', color: 'var(--teal-700)', padding: '2px 6px' }}
                  disabled={mutation.isPending}
                >
                  Đủ tiền mặt
                </button>
                <button
                  type="button"
                  onClick={handlePayFullBank}
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: '11px', color: 'var(--teal-700)', padding: '2px 6px' }}
                  disabled={mutation.isPending}
                >
                  Đủ chuyển khoản
                </button>
                {selectedCustomerId && (
                  <button
                    type="button"
                    onClick={handleDebtAll}
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: '11px', color: 'var(--danger-600)', padding: '2px 6px' }}
                    disabled={mutation.isPending}
                  >
                    Ghi nợ tất cả
                  </button>
                )}
              </div>
            </div>

            <div className="pos-payment-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Input
                id="pos-cash"
                label="Tiền mặt (VND)"
                formatThousands
                type="number"
                min={0}
                value={cashAmount === 0 ? '' : cashAmount}
                onChange={(e) => setCashAmount(Math.max(0, parseInt(e.target.value || '0', 10)))}
                placeholder="0"
                disabled={mutation.isPending}
              />
              <Input
                id="pos-bank"
                label="Chuyển khoản (VND)"
                formatThousands
                type="number"
                min={0}
                value={bankAmount === 0 ? '' : bankAmount}
                onChange={(e) => setBankAmount(Math.max(0, parseInt(e.target.value || '0', 10)))}
                placeholder="0"
                disabled={mutation.isPending}
              />
            </div>
          </div>

          {/* Totals Summary Panel */}
          <div
            style={{
              padding: '12px 14px',
              backgroundColor: 'var(--slate-50)',
              border: '1px solid var(--slate-200)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              fontSize: '13px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--slate-600)' }}>
              <span>Tổng tiền hàng:</span>
              <span>{formatVND(subtotal)}</span>
            </div>
            {safeDiscount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--danger-600)' }}>
                <span>Chiết khấu:</span>
                <span>-{formatVND(safeDiscount)}</span>
              </div>
            )}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontWeight: 700,
                fontSize: '15px',
                color: 'var(--slate-900)',
                borderTop: '1px dashed var(--slate-300)',
                paddingTop: 6,
              }}
            >
              <span>Tổng cộng thanh toán:</span>
              <span style={{ color: 'var(--teal-700)' }}>{formatVND(total)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--success-700)', fontWeight: 600 }}>
              <span>Đã thanh toán (TM + CK):</span>
              <span>{formatVND(paid)}</span>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontWeight: 700,
                color: debt > 0 ? 'var(--danger-700)' : 'var(--slate-700)',
              }}
            >
              <span>Còn nợ khách hàng:</span>
              <span>{formatVND(debt)}</span>
            </div>
          </div>

          {/* Checkout Button */}
          <Button
            type="button"
            variant="primary"
            style={{ width: '100%', height: 42, fontSize: '14px', fontWeight: 700 }}
            onClick={handleSubmit}
            isLoading={mutation.isPending}
            disabled={mutation.isPending || cart.length === 0}
          >
            Xác nhận bán hàng ({formatVND(total)})
          </Button>
        </div>
      </div>

      {/* Completed Sale Drawer for Invoice Printing & PDF */}
      <SaleDrawer
        saleId={completedSale?.id || null}
        isOpen={!!completedSale}
        onClose={() => setCompletedSale(null)}
      />

      {/* IMEI Selection Modal for Phone Products */}
      <Modal
        isOpen={!!imeiModalProduct}
        onClose={handleCloseImeiModal}
        title={imeiModalProduct ? `Chọn IMEI: ${imeiModalProduct.name}` : 'Chọn IMEI'}
        maxWidth="640px"
        footer={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'var(--slate-600)' }}>{selectedModalDevices.length} máy đã chọn</span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <Button type="button" variant="secondary" onClick={handleCloseImeiModal}>Đóng</Button>
              <Button type="button" variant="primary" disabled={selectedModalDevices.length === 0} onClick={handleAddSelectedImeiDevices}>
                Thêm {selectedModalDevices.length} máy vào giỏ
              </Button>
            </div>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Simple IMEI search */}
          <div style={{ position: 'relative' }}>
            <Search
              size={16}
              style={{
                position: 'absolute',
                left: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--slate-400)',
              }}
            />
            <input
              type="text"
              className="input"
              style={{ paddingLeft: 34, height: 38, fontSize: '13.5px', width: '100%' }}
              placeholder="Tìm kiếm theo số IMEI..."
              value={imeiSearchQuery}
              onChange={(e) => setImeiSearchQuery(e.target.value)}
              autoFocus
            />
          </div>

          {/* List of currently available devices */}
          {filteredModalDevices.length === 0 ? (
            <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--slate-500)', fontSize: '13px' }}>
              {imeiSearchQuery
                ? `Không tìm thấy máy nào khớp với "${imeiSearchQuery}"`
                : 'Không có thiết bị sẵn sàng bán cho sản phẩm này'}
            </div>
          ) : (
            <div className="popup-table-wrap" style={{ maxHeight: 420, overflowY: 'auto' }}>
              <table className="table-misa popup-table" aria-label="Chọn IMEI để bán">
                <thead>
                  <tr>
                    <th style={{ width: 48 }} className="col-center">
                      <input type="checkbox" aria-label="Chọn tất cả máy trên trang này" style={{ width: 20, height: 20, cursor: 'pointer' }} checked={allVisibleDevicesSelected} onChange={handleToggleVisibleImeiDevices} />
                    </th>
                    <th>IMEI</th>
                    <th style={{ width: 90 }} className="col-center">Tình trạng</th>
                    <th style={{ width: 80 }} className="col-center">Pin</th>
                    <th style={{ width: 130 }} className="col-money">Giá bán</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleModalDevices.map((dev) => (
                    <tr key={dev.id}>
                      <td data-label="Chọn" className="col-center">
                        <input
                          type="checkbox"
                          aria-label={`Chọn IMEI ${dev.imei}`}
                          style={{ width: 20, height: 20, cursor: 'pointer' }}
                          checked={selectedImeiIds.includes(dev.id)}
                          onChange={() => setSelectedImeiIds((current) => current.includes(dev.id)
                            ? current.filter((id) => id !== dev.id)
                            : [...current, dev.id])}
                        />
                      </td>
                      <td data-label="IMEI" className="col-sku">{dev.imei}</td>
                      <td data-label="Tình trạng" className="col-center">
                        <Badge variant={dev.condition === 'NEW' ? 'new' : 'used'}>{dev.condition === 'NEW' ? 'Mới' : 'Cũ'}</Badge>
                      </td>
                      <td data-label="Pin" className="col-center">{dev.battery !== null && dev.battery !== undefined ? `${dev.battery}%` : '—'}</td>
                      <td data-label="Giá bán" className="col-money">{formatVND(dev.sale_price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Compact Client-Side Pagination */}
          {filteredModalDevices.length > 0 && (
            <div className="compact-pagination" aria-label="Phân trang thiết bị IMEI">
              <span>{filteredModalDevices.length} máy · Trang {currentModalPage} / {totalModalPages}</span>
              <div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={currentModalPage <= 1}
                  onClick={() => setImeiModalPage((p) => Math.max(1, p - 1))}
                >
                  Trước
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={currentModalPage >= totalModalPages}
                  onClick={() => setImeiModalPage((p) => p + 1)}
                >
                  Sau
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};
