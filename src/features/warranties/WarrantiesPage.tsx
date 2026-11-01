import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api-client';
import { formatDateTime } from '../../lib/formatters';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { WarrantyReceiveModal } from './WarrantyReceiveModal';
import { WarrantyDrawer } from './WarrantyDrawer';
import type { Warranty, WarrantyStatus } from '../../types/warranty';
import { Search, Eye, RefreshCw, Plus, ShieldCheck, Wrench, Smartphone } from 'lucide-react';

export const WarrantiesPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | WarrantyStatus>('all');
  const [selectedWarranty, setSelectedWarranty] = useState<Warranty | null>(null);
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const {
    data: warrantiesData,
    isLoading,
    refetch,
  } = useQuery<{ items: Warranty[] }>({
    queryKey: ['warranties', searchQuery],
    queryFn: () => {
      const q = searchQuery.trim();
      return api.get<{ items: Warranty[] }>(`/warranties${q ? `?q=${encodeURIComponent(q)}` : ''}`);
    },
  });

  const warranties = warrantiesData?.items || [];

  const filteredWarranties = useMemo(() => {
    if (statusFilter === 'all') return warranties;
    return warranties.filter((w) => w.status === statusFilter);
  }, [warranties, statusFilter]);

  const handleOpenDetail = (w: Warranty) => {
    setSelectedWarranty(w);
    setIsDrawerOpen(true);
  };

  const handleWarrantyUpdated = () => {
    refetch();
    if (selectedWarranty) {
      // Refresh current selected warranty from server
      api.get<{ items: Warranty[] }>(`/warranties?q=${encodeURIComponent(selectedWarranty.imei || '')}`).then((res) => {
        const found = res.items.find((item) => item.id === selectedWarranty.id);
        if (found) setSelectedWarranty(found);
      });
    }
  };

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

  return (
    <div className="page-container">
      {/* Header trang */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Hồ sơ bảo hành & Sửa chữa</h1>
          <p className="page-subtitle">
            Tiếp nhận bảo hành, theo dõi tiến độ sửa chữa thiết bị khách hàng và cách ly tồn kho
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Button type="button" variant="secondary" onClick={() => refetch()} title="Làm mới">
            <RefreshCw size={15} style={{ marginRight: 6 }} /> Làm mới
          </Button>
          <Button type="button" variant="primary" onClick={() => setIsReceiveModalOpen(true)}>
            <Plus size={15} style={{ marginRight: 6 }} /> Tiếp nhận bảo hành
          </Button>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 14,
          flexWrap: 'wrap',
          gap: 10,
        }}
      >
        <div style={{ position: 'relative', width: '100%', maxWidth: 360 }}>
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
            style={{ paddingLeft: 34, width: '100%' }}
            placeholder="Tìm theo số IMEI, khách hàng, lỗi..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Status Filter Tabs */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(['all', 'received', 'processing', 'completed', 'cancelled'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setStatusFilter(tab)}
              style={{
                padding: '5px 12px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '12px',
                fontWeight: statusFilter === tab ? 600 : 400,
                border: '1px solid',
                borderColor: statusFilter === tab ? 'var(--teal-600)' : 'var(--slate-200)',
                backgroundColor: statusFilter === tab ? '#f0fdfa' : '#ffffff',
                color: statusFilter === tab ? 'var(--teal-900)' : 'var(--slate-600)',
                cursor: 'pointer',
              }}
            >
              {tab === 'all'
                ? 'Tất cả'
                : tab === 'received'
                ? 'Tiếp nhận'
                : tab === 'processing'
                ? 'Đang xử lý'
                : tab === 'completed'
                ? 'Hoàn tất'
                : 'Đã hủy'}
            </button>
          ))}
        </div>
      </div>

      {/* Table of Warranties */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--slate-500)' }}>
            Đang tải danh sách hồ sơ bảo hành...
          </div>
        ) : filteredWarranties.length === 0 ? (
          <EmptyState
            icon={<ShieldCheck size={28} />}
            title="Chưa có hồ sơ bảo hành nào"
            description={
              searchQuery
                ? 'Không tìm thấy hồ sơ bảo hành phù hợp từ khóa tìm kiếm.'
                : 'Bấm nút "Tiếp nhận bảo hành" để tạo hồ sơ sửa chữa đầu tiên.'
            }
          />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table-misa" style={{ minWidth: '780px' }}>
              <thead>
                <tr>
                  <th style={{ width: 100 }}>Mã hồ sơ</th>
                  <th style={{ width: 140 }}>Thời gian</th>
                  <th style={{ width: 160 }}>Số IMEI</th>
                  <th style={{ width: 150 }}>Khách hàng</th>
                  <th style={{ width: 120 }}>Nguồn gốc</th>
                  <th>Hiện tượng lỗi</th>
                  <th style={{ textAlign: 'center', width: 110 }}>Trạng thái</th>
                  <th style={{ textAlign: 'center', width: 90 }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredWarranties.map((w) => {
                  const isCustomerDevice = !!w.sale_id;

                  return (
                    <tr key={w.id}>
                      <td style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                        <button
                          type="button"
                          onClick={() => handleOpenDetail(w)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--teal-700)',
                            cursor: 'pointer',
                            fontWeight: 600,
                            padding: 0,
                          }}
                        >
                          #{w.id.slice(0, 8)}
                        </button>
                      </td>
                      <td style={{ color: 'var(--slate-600)', fontSize: '12px' }}>{formatDateTime(w.created_at)}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Smartphone size={13} color="var(--slate-400)" />
                          {w.imei || '—'}
                        </div>
                      </td>
                      <td style={{ fontWeight: 500 }}>
                        {w.customer_name || (isCustomerDevice ? 'Khách lẻ' : <span style={{ color: 'var(--slate-400)', fontStyle: 'italic' }}>Cửa hàng</span>)}
                      </td>
                      <td>
                        <span style={{ fontSize: '11.5px', color: isCustomerDevice ? 'var(--teal-800)' : 'var(--warning-700)', fontWeight: 500 }}>
                          {isCustomerDevice ? 'Máy khách mua' : 'Kho cửa hàng'}
                        </span>
                      </td>
                      <td style={{ maxWidth: '240px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={w.issue}>
                        {w.issue}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {renderStatusBadge(w.status)}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenDetail(w)}
                          title="Xem chi tiết & chuyển trạng thái"
                        >
                          <Eye size={14} />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Warranty Receive Modal */}
      <WarrantyReceiveModal
        isOpen={isReceiveModalOpen}
        onClose={() => setIsReceiveModalOpen(false)}
        onSuccess={() => refetch()}
      />

      {/* Warranty Detail & Status Update Drawer */}
      <WarrantyDrawer
        warranty={selectedWarranty}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onUpdated={handleWarrantyUpdated}
      />
    </div>
  );
};
