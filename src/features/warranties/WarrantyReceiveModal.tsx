import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { api, ApiClientError } from '../../lib/api-client';
import type { WarrantyCreateInputPayload } from '../../types/warranty';
import { Search, ShieldAlert, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

interface DeviceItem {
  id: string;
  imei: string;
  product_id: string;
  product_name: string;
  sku: string;
  status: 'available' | 'sold' | 'quarantine' | 'returned_supplier';
  condition: 'NEW' | 'USED';
  cosmetic?: string;
  battery?: number;
  defects?: string;
}

interface WarrantyReceiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const WarrantyReceiveModal: React.FC<WarrantyReceiveModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { showSuccess } = useToast();
  const [deviceSearch, setDeviceSearch] = useState('');
  const [selectedDevice, setSelectedDevice] = useState<DeviceItem | null>(null);
  const [issue, setIssue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Search devices
  const { data: devicesData, isFetching: isSearching } = useQuery<{ items: DeviceItem[] }>({
    queryKey: ['devices-search', deviceSearch],
    queryFn: () => api.get<{ items: DeviceItem[] }>(`/devices?q=${encodeURIComponent(deviceSearch.trim())}`),
    enabled: isOpen && deviceSearch.trim().length >= 2,
  });

  const searchResults = devicesData?.items || [];

  const handleSelectDevice = (dev: DeviceItem) => {
    setSelectedDevice(dev);
    setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!selectedDevice) {
      setErrorMessage('Vui lòng tìm kiếm và chọn thiết bị cần tiếp nhận bảo hành');
      return;
    }

    if (!['available', 'sold', 'quarantine'].includes(selectedDevice.status)) {
      setErrorMessage('Thiết bị này không đủ điều kiện tiếp nhận bảo hành (đã trả NCC hoặc trạng thái không hợp lệ)');
      return;
    }

    const trimmedIssue = issue.trim();
    if (!trimmedIssue) {
      setErrorMessage('Vui lòng mô tả hiện tượng lỗi / yêu cầu bảo hành');
      return;
    }

    const payload: WarrantyCreateInputPayload = {
      device_id: selectedDevice.id,
      issue: trimmedIssue,
    };

    setIsSubmitting(true);
    try {
      await api.post('/warranties', payload);
      showSuccess('Tiếp nhận hồ sơ bảo hành thành công');
      // Reset only after success
      setSelectedDevice(null);
      setDeviceSearch('');
      setIssue('');
      setErrorMessage(null);
      onSuccess();
      onClose();
    } catch (err: unknown) {
      // PRESERVE user input upon failure
      if (err instanceof ApiClientError) {
        setErrorMessage(err.message || 'Lỗi tiếp nhận bảo hành từ máy chủ');
      } else if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Đã xảy ra lỗi không xác định');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderDeviceStatusBadge = (status: string) => {
    switch (status) {
      case 'sold':
        return <Badge variant="sold">Đã bán cho khách</Badge>;
      case 'available':
        return <Badge variant="available">Tồn kho khả dụng</Badge>;
      case 'quarantine':
        return <Badge variant="quarantine">Đang cách ly</Badge>;
      case 'returned_supplier':
        return <Badge variant="debt">Đã trả NCC</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Tiếp nhận bảo hành thiết bị"
      maxWidth="620px"
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, width: '100%' }}>
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Hủy bỏ
          </Button>
          <Button
            type="submit"
            form="warranty-receive-form"
            variant="primary"
            disabled={isSubmitting || !selectedDevice}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={14} className="spinner" style={{ marginRight: 6, animation: 'spin 1s linear infinite' }} />
                Đang xử lý...
              </>
            ) : (
              'Xác nhận tiếp nhận'
            )}
          </Button>
        </div>
      }
    >
      <form id="warranty-receive-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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

        {/* Tìm kiếm thiết bị theo IMEI */}
        <div>
          <label htmlFor="device-search-input" style={{ display: 'block', fontWeight: 600, fontSize: '12.5px', marginBottom: 4, color: 'var(--slate-700)' }}>
            Tìm thiết bị theo số IMEI hoặc tên máy: <span style={{ color: 'var(--danger-600)' }}>*</span>
          </label>
          <div style={{ position: 'relative' }}>
            <Search
              size={15}
              style={{
                position: 'absolute',
                left: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--slate-400)',
              }}
            />
            <input
              id="device-search-input"
              type="text"
              className="input"
              style={{ paddingLeft: 34, width: '100%' }}
              placeholder="Nhập ít nhất 2 ký tự IMEI hoặc tên máy..."
              value={deviceSearch}
              onChange={(e) => setDeviceSearch(e.target.value)}
              disabled={isSubmitting}
            />
            {isSearching && (
              <Loader2
                size={14}
                className="spinner"
                style={{
                  position: 'absolute',
                  right: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--teal-600)',
                  animation: 'spin 1s linear infinite',
                }}
              />
            )}
          </div>

          {/* Kết quả tìm kiếm */}
          {deviceSearch.trim().length >= 2 && searchResults.length > 0 && !selectedDevice && (
            <div
              style={{
                maxHeight: '180px',
                overflowY: 'auto',
                border: '1px solid var(--slate-200)',
                borderRadius: 'var(--radius-sm)',
                marginTop: 6,
                backgroundColor: '#ffffff',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              {searchResults.map((dev) => (
                <div
                  key={dev.id}
                  onClick={() => handleSelectDevice(dev)}
                  style={{
                    padding: '8px 12px',
                    borderBottom: '1px solid var(--slate-100)',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '12.5px',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f0fdfa';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#ffffff';
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>{dev.product_name}</div>
                    <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--slate-500)' }}>
                      IMEI: <strong>{dev.imei}</strong>
                    </div>
                  </div>
                  <div>
                    {renderDeviceStatusBadge(dev.status)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {deviceSearch.trim().length >= 2 && searchResults.length === 0 && !isSearching && !selectedDevice && (
            <div style={{ fontSize: '12px', color: 'var(--slate-400)', fontStyle: 'italic', marginTop: 4 }}>
              Không tìm thấy thiết bị nào khớp với từ khóa tìm kiếm.
            </div>
          )}
        </div>

        {/* Thiết bị đã chọn */}
        {selectedDevice && (
          <div
            style={{
              padding: '12px 14px',
              backgroundColor: '#f0fdfa',
              border: '1px solid var(--teal-200)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '12.5px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckCircle2 size={16} color="var(--teal-700)" />
                <strong style={{ color: 'var(--teal-900)' }}>Thiết bị được chọn:</strong>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDevice(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--danger-600)',
                  fontSize: '12px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  padding: 0,
                }}
              >
                Đổi thiết bị khác
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, color: 'var(--slate-700)' }}>
              <div>Sản phẩm: <strong>{selectedDevice.product_name}</strong></div>
              <div>IMEI: <strong style={{ fontFamily: 'var(--font-mono)' }}>{selectedDevice.imei}</strong></div>
              <div>Tình trạng: <strong>{selectedDevice.condition === 'NEW' ? 'Mới' : 'Cũ'}</strong></div>
              <div>Trạng thái: {renderDeviceStatusBadge(selectedDevice.status)}</div>
            </div>

            {selectedDevice.status === 'available' && (
              <div style={{ marginTop: 8, fontSize: '11.5px', color: 'var(--warning-700)', backgroundColor: 'var(--warning-50)', padding: '6px 8px', borderRadius: 4 }}>
                * Chú ý: Thiết bị tồn kho sẽ tự động chuyển sang trạng thái <strong>Cách ly (quarantine)</strong> trong suốt thời gian bảo hành.
              </div>
            )}

            {selectedDevice.status === 'sold' && (
              <div style={{ marginTop: 8, fontSize: '11.5px', color: 'var(--teal-800)', backgroundColor: '#ccfbf1', padding: '6px 8px', borderRadius: 4 }}>
                * Thiết bị thuộc sở hữu của khách hàng. Hệ thống sẽ tự động liên kết với phiếu bán và khách hàng hiện tại.
              </div>
            )}
          </div>
        )}

        {/* Hiện tượng lỗi */}
        <div>
          <label htmlFor="warranty-issue-input" style={{ display: 'block', fontWeight: 600, fontSize: '12.5px', marginBottom: 4, color: 'var(--slate-700)' }}>
            Hiện tượng lỗi / Yêu cầu tiếp nhận: <span style={{ color: 'var(--danger-600)' }}>*</span>
          </label>
          <textarea
            id="warranty-issue-input"
            className="input"
            rows={3}
            value={issue}
            onChange={(e) => setIssue(e.target.value)}
            placeholder="Mô tả chi tiết tình trạng máy lỗi (ví dụ: Màn hình nhấp nháy, không nhận sạc, loa rè...)"
            required
            disabled={isSubmitting}
            style={{ width: '100%', resize: 'vertical' }}
          />
        </div>
      </form>
    </Modal>
  );
};
