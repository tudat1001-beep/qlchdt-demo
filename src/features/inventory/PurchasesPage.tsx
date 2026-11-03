import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api-client';
import { formatVND, formatDateTime } from '../../lib/formatters';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { PurchaseModal } from './PurchaseModal';
import { PurchaseDrawer } from './PurchaseDrawer';
import { PaymentModal } from '../payments/PaymentModal';
import type { Purchase, StockMovement } from '../../types/inventory';
import type { Device } from '../../types/catalog';
import { Plus, Search, Eye, RefreshCw, Truck, ArrowUpDown, Smartphone, Package, CreditCard } from 'lucide-react';

type InventoryTab = 'purchases' | 'movements' | 'devices';

export const PurchasesPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<InventoryTab>('purchases');
  const [searchQuery, setSearchQuery] = useState('');
  const [deviceStatusFilter, setDeviceStatusFilter] = useState<string>('all');

  // Modals & Drawers state
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [selectedPurchaseId, setSelectedPurchaseId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Payment modal state
  const [paymentData, setPaymentData] = useState<{
    referenceId: string;
    referenceNumber: string;
    partyName: string;
    outstandingDebt: number;
  } | null>(null);

  // Queries
  const {
    data: purchasesData,
    isLoading: isLoadingPurchases,
    refetch: refetchPurchases,
  } = useQuery<{ items: Purchase[] }>({
    queryKey: ['purchases'],
    queryFn: () => api.get<{ items: Purchase[] }>('/purchases'),
    enabled: activeTab === 'purchases',
  });

  const {
    data: movementsData,
    isLoading: isLoadingMovements,
    refetch: refetchMovements,
  } = useQuery<{ items: StockMovement[] }>({
    queryKey: ['stock-movements'],
    queryFn: () => api.get<{ items: StockMovement[] }>('/stock-movements'),
    enabled: activeTab === 'movements',
  });

  const {
    data: devicesData,
    isLoading: isLoadingDevices,
    refetch: refetchDevices,
  } = useQuery<{ items: Device[] }>({
    queryKey: ['devices', deviceStatusFilter],
    queryFn: () => {
      const url = deviceStatusFilter && deviceStatusFilter !== 'all'
        ? `/devices?status=${deviceStatusFilter}`
        : '/devices';
      return api.get<{ items: Device[] }>(url);
    },
    enabled: activeTab === 'devices',
  });

  const purchases = purchasesData?.items || [];
  const movements = movementsData?.items || [];
  const devices = devicesData?.items || [];

  // Filtered purchases
  const filteredPurchases = useMemo(() => {
    if (!searchQuery.trim()) return purchases;
    const q = searchQuery.toLowerCase();
    return purchases.filter(
      (p) =>
        p.number.toLowerCase().includes(q) ||
        p.supplier_name.toLowerCase().includes(q) ||
        (p.note && p.note.toLowerCase().includes(q))
    );
  }, [purchases, searchQuery]);

  // Filtered movements
  const filteredMovements = useMemo(() => {
    if (!searchQuery.trim()) return movements;
    const q = searchQuery.toLowerCase();
    return movements.filter(
      (m) =>
        (m.product_name && m.product_name.toLowerCase().includes(q)) ||
        (m.imei && m.imei.toLowerCase().includes(q)) ||
        (m.note && m.note.toLowerCase().includes(q))
    );
  }, [movements, searchQuery]);

  // Filtered devices
  const filteredDevices = useMemo(() => {
    if (!searchQuery.trim()) return devices;
    const q = searchQuery.toLowerCase();
    return devices.filter(
      (d) =>
        d.imei.toLowerCase().includes(q) ||
        d.product_name.toLowerCase().includes(q) ||
        d.sku.toLowerCase().includes(q)
    );
  }, [devices, searchQuery]);

  const handleOpenDetail = (id: string) => {
    setSelectedPurchaseId(id);
    setIsDrawerOpen(true);
  };

  const handleOpenPayment = (purchase: Purchase) => {
    setPaymentData({
      referenceId: purchase.id,
      referenceNumber: purchase.number,
      partyName: purchase.supplier_name,
      outstandingDebt: purchase.debt,
    });
  };

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Quản lý Nhập hàng & Kho</h1>
          <p className="page-subtitle">
            Nhập hàng từ nhà cung cấp, theo dõi giá vốn, sổ kho biến động và quản lý IMEI
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              if (activeTab === 'purchases') refetchPurchases();
              if (activeTab === 'movements') refetchMovements();
              if (activeTab === 'devices') refetchDevices();
            }}
            title="Làm mới dữ liệu"
          >
            <RefreshCw size={15} style={{ marginRight: 6 }} /> Làm mới
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={() => setIsPurchaseModalOpen(true)}
          >
            <Plus size={16} style={{ marginRight: 6 }} /> Nhập hàng mới
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="inventory-tabs" style={{ display: 'flex', gap: 6, borderBottom: '1px solid var(--slate-200)', marginBottom: 16 }}>
        <button
          type="button"
          onClick={() => { setActiveTab('purchases'); setSearchQuery(''); }}
          style={{
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: 600,
            color: activeTab === 'purchases' ? 'var(--teal-700)' : 'var(--slate-600)',
            borderBottom: activeTab === 'purchases' ? '2px solid var(--teal-600)' : '2px solid transparent',
            background: 'none',
            borderTop: 'none',
            borderLeft: 'none',
            borderRight: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Truck size={15} /> Phiếu nhập hàng ({purchases.length})
        </button>

        <button
          type="button"
          onClick={() => { setActiveTab('movements'); setSearchQuery(''); }}
          style={{
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: 600,
            color: activeTab === 'movements' ? 'var(--teal-700)' : 'var(--slate-600)',
            borderBottom: activeTab === 'movements' ? '2px solid var(--teal-600)' : '2px solid transparent',
            background: 'none',
            borderTop: 'none',
            borderLeft: 'none',
            borderRight: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <ArrowUpDown size={15} /> Sổ kho biến động ({movements.length})
        </button>

        <button
          type="button"
          onClick={() => { setActiveTab('devices'); setSearchQuery(''); }}
          style={{
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: 600,
            color: activeTab === 'devices' ? 'var(--teal-700)' : 'var(--slate-600)',
            borderBottom: activeTab === 'devices' ? '2px solid var(--teal-600)' : '2px solid transparent',
            background: 'none',
            borderTop: 'none',
            borderLeft: 'none',
            borderRight: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Smartphone size={15} /> Danh sách thiết bị ({devices.length})
        </button>
      </div>

      {/* Filter / Search Bar */}
      <div className="page-filter-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 12 }}>
        <div style={{ position: 'relative', width: 340 }}>
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
            style={{ paddingLeft: 34 }}
            placeholder={
              activeTab === 'purchases'
                ? 'Tìm theo mã phiếu, nhà cung cấp...'
                : activeTab === 'movements'
                ? 'Tìm theo tên sản phẩm, IMEI...'
                : 'Tìm theo IMEI, SKU, sản phẩm...'
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {activeTab === 'devices' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '12.5px', color: 'var(--slate-600)' }}>Trạng thái:</span>
            <select
              value={deviceStatusFilter}
              onChange={(e) => setDeviceStatusFilter(e.target.value)}
              className="input"
              style={{ width: 170, height: 34, fontSize: '12.5px' }}
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="available">Sẵn sàng bán (Tồn)</option>
              <option value="sold">Đã bán</option>
              <option value="quarantine">Cách ly / Lỗi</option>
              <option value="returned_supplier">Đã trả nhà cung cấp</option>
            </select>
          </div>
        )}
      </div>

      {/* TAB 1: Danh sách Phiếu nhập hàng */}
      {activeTab === 'purchases' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {isLoadingPurchases ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--slate-500)' }}>
              Đang tải danh sách phiếu nhập kho...
            </div>
          ) : filteredPurchases.length === 0 ? (
            <EmptyState
              title="Chưa có phiếu nhập hàng nào"
              description={searchQuery ? 'Không tìm thấy phiếu nhập phù hợp với từ khóa' : 'Hãy tạo phiếu nhập kho đầu tiên để nhập sản phẩm và thiết bị.'}
              actionLabel="Nhập hàng ngay"
              onAction={() => setIsPurchaseModalOpen(true)}
            />
          ) : (
            <div className={`table-responsive-wrapper inventory-table inventory-table-${activeTab}`}>
              <table className="table-misa">
              <thead>
                <tr>
                  <th style={{ width: 110 }}>Mã phiếu</th>
                  <th style={{ width: 150 }}>Thời gian</th>
                  <th>Nhà cung cấp</th>
                  <th style={{ textAlign: 'right', width: 120 }}>Chi phí mua</th>
                  <th style={{ textAlign: 'right', width: 130 }}>Tổng tiền</th>
                  <th style={{ textAlign: 'right', width: 130 }}>Đã trả</th>
                  <th style={{ textAlign: 'right', width: 130 }}>Còn nợ</th>
                  <th style={{ textAlign: 'center', width: 110 }}>Trạng thái</th>
                  <th style={{ textAlign: 'center', width: 130 }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredPurchases.map((p) => (
                  <tr key={p.id}>
                    <td data-label="Mã phiếu" style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                      <button
                        type="button"
                        onClick={() => handleOpenDetail(p.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--teal-700)',
                          cursor: 'pointer',
                          fontWeight: 600,
                          padding: 0,
                        }}
                      >
                        {p.number}
                      </button>
                    </td>
                    <td data-label="Thời gian" style={{ color: 'var(--slate-600)' }}>{formatDateTime(p.created_at)}</td>
                    <td data-label="Nhà cung cấp" style={{ fontWeight: 500 }}>{p.supplier_name}</td>
                    <td data-label="Chi phí mua" style={{ textAlign: 'right', color: 'var(--slate-600)' }}>{formatVND(p.extra_cost)}</td>
                    <td data-label="Tổng tiền" style={{ textAlign: 'right', fontWeight: 600, color: 'var(--slate-900)' }}>{formatVND(p.total)}</td>
                    <td data-label="Đã trả" style={{ textAlign: 'right', color: 'var(--success-700)', fontWeight: 500 }}>{formatVND(p.paid)}</td>
                    <td data-label="Còn nợ" style={{ textAlign: 'right', fontWeight: 600, color: p.debt > 0 ? 'var(--danger-700)' : 'var(--slate-500)' }}>
                      {formatVND(p.debt)}
                    </td>
                    <td data-label="Trạng thái" style={{ textAlign: 'center' }}>
                      <Badge variant="available">Đã nhập kho</Badge>
                    </td>
                    <td data-label="Thao tác" style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: 6 }}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenDetail(p.id)}
                          title="Xem chi tiết phiếu nhập"
                        >
                          <Eye size={14} />
                        </Button>
                        {p.debt > 0 && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleOpenPayment(p)}
                            title="Trả nợ nhà cung cấp"
                            style={{ color: 'var(--teal-700)', padding: '2px 8px', fontSize: '11.5px' }}
                          >
                            <CreditCard size={12} style={{ marginRight: 3 }} /> Trả nợ
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Sổ kho biến động */}
      {activeTab === 'movements' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {isLoadingMovements ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--slate-500)' }}>
              Đang tải sổ kho biến động...
            </div>
          ) : filteredMovements.length === 0 ? (
            <EmptyState
              title="Chưa có dữ liệu sổ kho"
              description="Các giao dịch nhập hàng và xuất bán sẽ tự động ghi sổ kho append-only tại đây."
            />
          ) : (
            <div className={`table-responsive-wrapper inventory-table inventory-table-${activeTab}`}>
              <table className="table-misa">
              <thead>
                <tr>
                  <th style={{ width: 150 }}>Thời gian</th>
                  <th>Sản phẩm</th>
                  <th style={{ width: 160 }}>IMEI / Lô</th>
                  <th style={{ textAlign: 'center', width: 100 }}>Số lượng</th>
                  <th style={{ textAlign: 'right', width: 130 }}>Giá vốn</th>
                  <th style={{ width: 110, textAlign: 'center' }}>Nghiệp vụ</th>
                  <th>Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {filteredMovements.map((m) => {
                  const isPositive = m.quantity > 0;
                  return (
                    <tr key={m.id}>
                      <td data-label="Thời gian" style={{ color: 'var(--slate-600)' }}>{formatDateTime(m.created_at)}</td>
                      <td data-label="Sản phẩm" style={{ fontWeight: 500 }}>{m.product_name}</td>
                      <td data-label="IMEI / Lô" style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                        {m.imei || (m.lot_id ? `Lô: ${m.lot_id.slice(0, 8)}` : '—')}
                      </td>
                      <td data-label="Số lượng" style={{ textAlign: 'center', fontWeight: 600 }}>
                        <span style={{ color: isPositive ? 'var(--success-700)' : 'var(--danger-700)' }}>
                          {isPositive ? `+${m.quantity}` : m.quantity}
                        </span>
                      </td>
                      <td data-label="Giá vốn" style={{ textAlign: 'right', fontWeight: 500 }}>
                        <span style={{ color: isPositive ? 'var(--slate-800)' : 'var(--slate-500)' }}>
                          {formatVND(m.cost)}
                        </span>
                      </td>
                      <td data-label="Nghiệp vụ" style={{ textAlign: 'center' }}>
                        <Badge variant={m.reference_type === 'purchase' ? 'default' : 'phone'}>
                          {m.reference_type === 'purchase' ? 'Nhập hàng' : 'Bán hàng'}
                        </Badge>
                      </td>
                      <td data-label="Ghi chú" style={{ color: 'var(--slate-500)', fontSize: '12px' }}>
                        {m.note || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Danh sách thiết bị (IMEI) */}
      {activeTab === 'devices' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {isLoadingDevices ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--slate-500)' }}>
              Đang tải danh sách thiết bị...
            </div>
          ) : filteredDevices.length === 0 ? (
            <EmptyState
              title="Không có thiết bị nào"
              description="Chưa có thiết bị nào trong kho hoặc không tìm thấy thiết bị thỏa mãn điều kiện lọc."
            />
          ) : (
            <div className={`table-responsive-wrapper inventory-table inventory-table-${activeTab}`}>
              <table className="table-misa">
              <thead>
                <tr>
                  <th style={{ width: 160 }}>Số IMEI</th>
                  <th>Sản phẩm</th>
                  <th style={{ width: 120 }}>Mã SKU</th>
                  <th style={{ width: 100, textAlign: 'center' }}>Tình trạng</th>
                  <th style={{ width: 80, textAlign: 'center' }}>Pin (%)</th>
                  <th style={{ width: 130, textAlign: 'center' }}>Trạng thái</th>
                  <th style={{ textAlign: 'right', width: 130 }}>Giá vốn</th>
                  <th style={{ textAlign: 'right', width: 130 }}>Giá bán NY</th>
                </tr>
              </thead>
              <tbody>
                {filteredDevices.map((d) => (
                  <tr key={d.id}>
                    <td data-label="Số IMEI" style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{d.imei}</td>
                    <td data-label="Sản phẩm" style={{ fontWeight: 500 }}>{d.product_name}</td>
                    <td data-label="Mã SKU" style={{ color: 'var(--slate-600)', fontFamily: 'var(--font-mono)' }}>{d.sku}</td>
                    <td data-label="Tình trạng" style={{ textAlign: 'center' }}>
                      <Badge variant={d.condition === 'NEW' ? 'new' : 'used'}>
                        {d.condition === 'NEW' ? 'Mới' : 'Cũ (Lướt)'}
                      </Badge>
                    </td>
                    <td data-label="Pin (%)" style={{ textAlign: 'center' }}>
                      {d.battery !== null ? `${d.battery}%` : '—'}
                    </td>
                    <td data-label="Trạng thái" style={{ textAlign: 'center' }}>
                      {d.status === 'available' && <Badge variant="available">Sẵn sàng bán</Badge>}
                      {d.status === 'sold' && <Badge variant="sold">Đã bán</Badge>}
                      {d.status === 'quarantine' && <Badge variant="quarantine">Cách ly / Lỗi</Badge>}
                      {d.status === 'returned_supplier' && <Badge variant="used">Đã trả NCC</Badge>}
                    </td>
                    <td data-label="Giá vốn" style={{ textAlign: 'right', fontWeight: 500 }}>{formatVND(d.cost)}</td>
                    <td data-label="Giá bán NY" style={{ textAlign: 'right', fontWeight: 600, color: 'var(--teal-700)' }}>{formatVND(d.sale_price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>
      )}

      {/* Modals and Drawers */}
      <PurchaseModal
        isOpen={isPurchaseModalOpen}
        onClose={() => setIsPurchaseModalOpen(false)}
        onSuccess={(p) => {
          setSelectedPurchaseId(p.id);
          setIsDrawerOpen(true);
        }}
      />

      <PurchaseDrawer
        purchaseId={selectedPurchaseId}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onOpenPayment={(p) => handleOpenPayment(p)}
      />

      {paymentData && (
        <PaymentModal
          isOpen={!!paymentData}
          onClose={() => setPaymentData(null)}
          partyType="supplier"
          referenceId={paymentData.referenceId}
          referenceNumber={paymentData.referenceNumber}
          partyName={paymentData.partyName}
          outstandingDebt={paymentData.outstandingDebt}
          onSuccess={() => {
            refetchPurchases();
          }}
        />
      )}
    </div>
  );
};
