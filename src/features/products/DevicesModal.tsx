import React, { useState, useEffect, useCallback } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatVND } from '../../lib/formatters';
import { api, ApiClientError } from '../../lib/api-client';
import type { Device, DeviceStatus } from '../../types/catalog';
import { Search, Smartphone, RefreshCw } from 'lucide-react';

interface DevicesModalProps {
  isOpen: boolean;
  onClose: () => void;
  productId?: string | null;
  productName?: string | null;
}

export const DevicesModal: React.FC<DevicesModalProps> = ({
  isOpen,
  onClose,
  productId,
  productName,
}) => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const fetchDevices = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (productId) params.set('product_id', productId);
      if (searchQuery.trim()) params.set('q', searchQuery.trim());
      if (statusFilter) params.set('status', statusFilter);

      const qs = params.toString() ? `?${params.toString()}` : '';
      const response = await api.get<{ items: Device[] }>(`/devices${qs}`);
      setDevices(response.items || []);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError('Không thể tải danh sách thiết bị');
      }
      setDevices([]);
    } finally {
      setIsLoading(false);
    }
  }, [productId, searchQuery, statusFilter]);

  useEffect(() => {
    if (isOpen) {
      fetchDevices();
    }
  }, [isOpen, fetchDevices]);

  const getStatusBadge = (status: DeviceStatus) => {
    switch (status) {
      case 'available':
        return <Badge variant="available">Sẵn sàng bán</Badge>;
      case 'sold':
        return <Badge variant="sold">Đã bán</Badge>;
      case 'quarantine':
        return <Badge variant="quarantine">Cách ly / Bảo hành</Badge>;
      case 'returned_supplier':
        return <Badge variant="default">Đã trả NCC</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={productName ? `Danh sách IMEI: ${productName}` : 'Quản lý thiết bị theo IMEI'}
      maxWidth="860px"
      footer={
        <Button variant="secondary" onClick={onClose}>
          Đóng
        </Button>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="search-input-wrapper" style={{ flex: 1, minWidth: '220px' }}>
            <Search size={15} />
            <input
              type="text"
              className="search-input"
              style={{ width: '100%' }}
              placeholder="Tìm kiếm theo số IMEI (15 chữ số)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  fetchDevices();
                }
              }}
            />
          </div>

          <select
            className="select-field"
            style={{ width: '180px' }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="available">Sẵn sàng (available)</option>
            <option value="sold">Đã bán (sold)</option>
            <option value="quarantine">Cách ly (quarantine)</option>
            <option value="returned_supplier">Đã trả NCC (returned)</option>
          </select>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={fetchDevices}
            isLoading={isLoading}
            icon={<RefreshCw size={14} />}
          >
            Làm mới
          </Button>
        </div>

        {error && (
          <div className="form-error" role="alert" style={{ padding: '8px 12px', background: '#fee2e2', borderRadius: 4 }}>
            {error}
          </div>
        )}

        <div className="table-card">
          <div className="table-responsive-wrapper" style={{ maxHeight: '400px' }}>
            <table className="table-misa">
              <thead>
                <tr>
                  <th style={{ width: '160px' }}>Số IMEI</th>
                  {!productId && <th>Sản phẩm</th>}
                  <th style={{ width: '110px' }}>Tình trạng</th>
                  <th style={{ width: '140px' }}>Trạng thái</th>
                  <th style={{ width: '70px' }} className="col-center">Pin</th>
                  <th>Ngoại hình / Lỗi</th>
                  <th style={{ width: '120px' }} className="col-num">Giá bán</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={productId ? 6 : 7} style={{ textAlign: 'center', padding: '24px' }}>
                      Đang tải danh sách thiết bị...
                    </td>
                  </tr>
                ) : devices.length === 0 ? (
                  <tr>
                    <td colSpan={productId ? 6 : 7}>
                      <EmptyState
                        icon={<Smartphone size={24} />}
                        title="Chưa có thiết bị nào"
                        description="Thiết bị với số IMEI định danh sẽ được nhập kho tự động thông qua phiếu nhập hàng."
                      />
                    </td>
                  </tr>
                ) : (
                  devices.map((device) => (
                    <tr key={device.id}>
                      <td className="col-sku" style={{ fontWeight: 600, color: '#0f766e' }}>
                        {device.imei}
                      </td>
                      {!productId && (
                        <td>
                          <div style={{ fontWeight: 500 }}>{device.product_name}</div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>{device.sku}</div>
                        </td>
                      )}
                      <td>
                        <Badge variant={device.condition === 'NEW' ? 'new' : 'used'}>
                          {device.condition === 'NEW' ? 'Mới (NEW)' : 'Cũ (USED)'}
                        </Badge>
                      </td>
                      <td>{getStatusBadge(device.status)}</td>
                      <td className="col-center">
                        {device.battery !== null && device.battery !== undefined ? `${device.battery}%` : '—'}
                      </td>
                      <td style={{ fontSize: '12px', color: '#475569' }}>
                        <div>{device.cosmetic || 'Ngoại hình chuẩn'}</div>
                        {device.defects && <div style={{ color: '#dc2626' }}>Lỗi: {device.defects}</div>}
                        {device.included_accessories && (
                          <div style={{ color: '#64748b' }}>Kèm: {device.included_accessories}</div>
                        )}
                      </td>
                      <td className="col-money">
                        {formatVND(device.sale_price)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Modal>
  );
};
