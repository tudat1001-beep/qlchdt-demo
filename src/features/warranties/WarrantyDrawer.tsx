import React, { useState, useEffect } from 'react';
import { Drawer } from '../../components/ui/Drawer';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { api, ApiClientError } from '../../lib/api-client';
import { formatDateTime } from '../../lib/formatters';
import type { Warranty, WarrantyStatus, WarrantyPatchPayload } from '../../types/warranty';
import {
  ShieldAlert,
  Calendar,
  User,
  Smartphone,
  AlertCircle,
  Clock,
  CheckCircle,
  XCircle,
  ArrowRight,
  Loader2,
  PackageCheck,
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';

interface WarrantyDrawerProps {
  warranty: Warranty | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdated: () => void;
}

export const WarrantyDrawer: React.FC<WarrantyDrawerProps> = ({
  warranty,
  isOpen,
  onClose,
  onUpdated,
}) => {
  const { showSuccess } = useToast();

  // Status transition confirmation dialog state
  const [transitionTarget, setTransitionTarget] = useState<WarrantyStatus | null>(null);
  const [resolutionInput, setResolutionInput] = useState('');
  const [releaseToStock, setReleaseToStock] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Initialize modal fields when transition target changes
  useEffect(() => {
    if (transitionTarget && warranty) {
      setResolutionInput(warranty.resolution || '');
      setReleaseToStock(false);
      setErrorMessage(null);
    }
  }, [transitionTarget, warranty]);

  if (!warranty) return null;

  const isCustomerDevice = !!warranty.sale_id;

  const renderStatusBadge = (status: WarrantyStatus) => {
    switch (status) {
      case 'received':
        return <Badge variant="received">Tiếp nhận</Badge>;
      case 'processing':
        return <Badge variant="processing">Đang xử lý</Badge>;
      case 'completed':
        return <Badge variant="completed">Hoàn tất</Badge>;
      case 'cancelled':
        return <Badge variant="cancelled">Đã hủy</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  const handleOpenTransitionModal = (target: WarrantyStatus) => {
    setTransitionTarget(target);
    setErrorMessage(null);
  };

  const handleConfirmTransition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transitionTarget) return;

    setErrorMessage(null);
    const payload: WarrantyPatchPayload = {
      status: transitionTarget,
      resolution: resolutionInput.trim() || undefined,
    };

    // ONLY pass release_to_stock if shop-owned device (sale_id is null)
    // Never offer or pass for customer device
    if (!isCustomerDevice && ['completed', 'cancelled'].includes(transitionTarget)) {
      payload.release_to_stock = releaseToStock;
    }

    setIsSubmitting(true);
    try {
      await api.patch(`/warranties/${warranty.id}`, payload);
      showSuccess(`Cập nhật trạng thái bảo hành thành công: ${transitionTarget}`);
      setTransitionTarget(null);
      setErrorMessage(null);
      onUpdated();
    } catch (err: unknown) {
      // PRESERVE user input upon failure
      if (err instanceof ApiClientError) {
        setErrorMessage(err.message || 'Lỗi cập nhật trạng thái bảo hành');
      } else if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Đã xảy ra lỗi không xác định');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Drawer
        isOpen={isOpen}
        onClose={onClose}
        title={`Hồ sơ bảo hành #${warranty.id.slice(0, 8)}`}
        subtitle={formatDateTime(warranty.created_at)}
        maxWidth="680px"
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              {/* Allowed transitions based on current status */}
              {warranty.status === 'received' && (
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => handleOpenTransitionModal('processing')}
                >
                  <ArrowRight size={14} style={{ marginRight: 6 }} /> Chuyển sang: Đang xử lý
                </Button>
              )}

              {warranty.status === 'processing' && (
                <>
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={() => handleOpenTransitionModal('completed')}
                  >
                    <CheckCircle size={14} style={{ marginRight: 6 }} /> Hoàn tất bảo hành
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    onClick={() => handleOpenTransitionModal('cancelled')}
                  >
                    <XCircle size={14} style={{ marginRight: 6 }} /> Hủy bảo hành
                  </Button>
                </>
              )}
            </div>

            <Button type="button" variant="secondary" size="sm" onClick={onClose}>
              Đóng
            </Button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Thông tin đầu hồ sơ */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 12,
              padding: '12px 14px',
              backgroundColor: 'var(--slate-50)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--slate-200)',
            }}
          >
            <div>
              <div style={{ fontSize: '11.5px', color: 'var(--slate-500)', marginBottom: 2 }}>Trạng thái hồ sơ</div>
              <div>{renderStatusBadge(warranty.status)}</div>
            </div>

            <div>
              <div style={{ fontSize: '11.5px', color: 'var(--slate-500)', marginBottom: 2 }}>Nguồn gốc thiết bị</div>
              <div style={{ fontWeight: 600, fontSize: '13px', color: isCustomerDevice ? 'var(--teal-800)' : 'var(--warning-700)' }}>
                {isCustomerDevice ? 'Máy khách hàng đã mua' : 'Hàng tồn kho cửa hàng'}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '11.5px', color: 'var(--slate-500)', marginBottom: 2 }}>Khách hàng</div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--slate-800)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <User size={14} color="var(--slate-500)" />
                {warranty.customer_name || (isCustomerDevice ? 'Khách lẻ' : 'Cửa hàng')}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '11.5px', color: 'var(--slate-500)', marginBottom: 2 }}>Số IMEI thiết bị</div>
              <div style={{ fontSize: '13px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--slate-800)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Smartphone size={14} color="var(--teal-700)" />
                {warranty.imei || '—'}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '11.5px', color: 'var(--slate-500)', marginBottom: 2 }}>Thời gian tiếp nhận</div>
              <div style={{ fontSize: '12.5px', color: 'var(--slate-700)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Calendar size={14} color="var(--slate-400)" />
                {formatDateTime(warranty.created_at)}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '11.5px', color: 'var(--slate-500)', marginBottom: 2 }}>Cập nhật lần cuối</div>
              <div style={{ fontSize: '12.5px', color: 'var(--slate-700)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Clock size={14} color="var(--slate-400)" />
                {formatDateTime(warranty.updated_at)}
              </div>
            </div>
          </div>

          {/* Chi tiết hiện tượng lỗi */}
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--slate-800)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              <ShieldAlert size={15} color="var(--danger-600)" /> Hiện tượng lỗi & Yêu cầu khách hàng:
            </div>
            <div
              style={{
                padding: '12px 14px',
                backgroundColor: '#ffffff',
                border: '1px solid var(--slate-200)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '13px',
                color: 'var(--slate-800)',
                whiteSpace: 'pre-wrap',
                lineHeight: 1.5,
              }}
            >
              {warranty.issue}
            </div>
          </div>

          {/* Kết quả & Tiến độ xử lý */}
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--slate-800)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              <CheckCircle size={15} color="var(--teal-700)" /> Kết quả / Hướng xử lý:
            </div>
            <div
              style={{
                padding: '12px 14px',
                backgroundColor: warranty.resolution ? '#f8fafc' : 'var(--slate-50)',
                border: '1px solid var(--slate-200)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '13px',
                color: warranty.resolution ? 'var(--slate-800)' : 'var(--slate-400)',
                fontStyle: warranty.resolution ? 'normal' : 'italic',
                whiteSpace: 'pre-wrap',
                minHeight: '48px',
                lineHeight: 1.5,
              }}
            >
              {warranty.resolution || 'Chưa có ghi nhận giải pháp hoặc kết quả xử lý.'}
            </div>
          </div>

          {/* Quy tắc chuyển trạng thái hướng dẫn */}
          <div
            style={{
              padding: '12px 14px',
              backgroundColor: 'var(--slate-50)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--slate-200)',
              fontSize: '12px',
              color: 'var(--slate-600)',
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 4, color: 'var(--slate-700)' }}>Quy trình chuyển trạng thái theo hợp đồng API:</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 600, color: '#0369a1' }}>Tiếp nhận (received)</span>
              <span>→</span>
              <span style={{ fontWeight: 600, color: '#b45309' }}>Đang xử lý (processing)</span>
              <span>→</span>
              <span style={{ fontWeight: 600, color: '#15803d' }}>Hoàn tất (completed)</span>
              <span>hoặc</span>
              <span style={{ fontWeight: 600, color: '#64748b' }}>Đã hủy (cancelled)</span>
            </div>
          </div>
        </div>
      </Drawer>

      {/* Confirmation & Context Modal for Status Transition */}
      {transitionTarget && (
        <Modal
          isOpen={!!transitionTarget}
          onClose={() => setTransitionTarget(null)}
          title={`Xác nhận chuyển trạng thái: ${
            transitionTarget === 'processing'
              ? 'Đang xử lý'
              : transitionTarget === 'completed'
              ? 'Hoàn tất bảo hành'
              : 'Hủy bảo hành'
          }`}
          maxWidth="540px"
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, width: '100%' }}>
              <Button type="button" variant="secondary" onClick={() => setTransitionTarget(null)} disabled={isSubmitting}>
                Hủy bỏ
              </Button>
              <Button
                type="submit"
                form="warranty-transition-form"
                variant={transitionTarget === 'cancelled' ? 'danger' : 'primary'}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={14} className="spinner" style={{ marginRight: 6, animation: 'spin 1s linear infinite' }} />
                    Đang lưu...
                  </>
                ) : (
                  'Xác nhận cập nhật'
                )}
              </Button>
            </div>
          }
        >
          <form id="warranty-transition-form" onSubmit={handleConfirmTransition} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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

            <div style={{ fontSize: '13px', color: 'var(--slate-700)' }}>
              <div>IMEI: <strong style={{ fontFamily: 'var(--font-mono)' }}>{warranty.imei}</strong></div>
              <div>Trạng thái hiện tại: <strong>{warranty.status}</strong> → Chuyển sang: <strong style={{ color: 'var(--teal-800)' }}>{transitionTarget}</strong></div>
            </div>

            <div>
              <label htmlFor="warranty-resolution-input" style={{ display: 'block', fontWeight: 600, fontSize: '12.5px', marginBottom: 4, color: 'var(--slate-700)' }}>
                Kết quả / Ghi chú xử lý (resolution):
              </label>
              <textarea
                id="warranty-resolution-input"
                className="input"
                rows={3}
                value={resolutionInput}
                onChange={(e) => setResolutionInput(e.target.value)}
                placeholder="Nhập kết quả kiểm tra, linh kiện đã thay thế, hướng giải quyết..."
                disabled={isSubmitting}
                style={{ width: '100%', resize: 'vertical' }}
              />
            </div>

            {/* CRITICAL: release_to_stock handling */}
            {['completed', 'cancelled'].includes(transitionTarget) && (
              <div>
                {isCustomerDevice ? (
                  /* NEVER offer stock release for customer-owned sold devices */
                  <div
                    style={{
                      padding: '10px 12px',
                      backgroundColor: '#f1f5f9',
                      border: '1px solid #cbd5e1',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '12px',
                      color: '#475569',
                    }}
                  >
                    <strong>Quy định sở hữu:</strong> Thiết bị thuộc sở hữu của khách hàng; không đưa vào tồn kho cửa hàng.
                  </div>
                ) : (
                  /* Shop-owned device in quarantine: offer explicit checkbox with context */
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                      padding: '10px 12px',
                      backgroundColor: releaseToStock ? '#f0fdf4' : '#f8fafc',
                      border: `1px solid ${releaseToStock ? '#bbf7d0' : '#cbd5e1'}`,
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={releaseToStock}
                      onChange={(e) => setReleaseToStock(e.target.checked)}
                      disabled={isSubmitting}
                      style={{ marginTop: 3 }}
                    />
                    <div style={{ fontSize: '12.5px' }}>
                      <strong style={{ color: 'var(--slate-800)' }}>
                        Đưa thiết bị về kho khả dụng (release_to_stock)
                      </strong>
                      <div style={{ color: 'var(--slate-600)', fontSize: '11.5px', marginTop: 2 }}>
                        Tích chọn để cập nhật trạng thái thiết bị từ Cách ly (quarantine) trở lại Tồn kho khả dụng (available).
                      </div>
                    </div>
                  </label>
                )}
              </div>
            )}
          </form>
        </Modal>
      )}
    </>
  );
};
