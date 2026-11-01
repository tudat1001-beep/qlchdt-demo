import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api-client';
import { formatVND, formatDateTime } from '../../lib/formatters';
import { exportCashbookToExcel } from '../../lib/export-excel';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { CashEntryModal } from './CashEntryModal';
import type { CashResponse, CashEntry } from '../../types/cash-reports';
import {
  Wallet,
  Coins,
  CreditCard,
  Plus,
  FileSpreadsheet,
  RefreshCw,
  Search,
  Filter,
  ArrowDownRight,
  ArrowUpRight,
} from 'lucide-react';

const CATEGORY_NAMES: Record<string, string> = {
  sale: 'Thu tiền bán hàng',
  sale_return: 'Chi hoàn tiền trả hàng',
  purchase: 'Chi thanh toán nhập hàng',
  purchase_return: 'Thu hoàn tiền trả hàng NCC',
  customer_debt: 'Thu nợ khách hàng',
  supplier_debt: 'Chi trả nợ NCC',
  expense: 'Chi phí hoạt động',
  other_income: 'Thu nhập khác',
};

export const CashbookPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [directionFilter, setDirectionFilter] = useState<'all' | 'in' | 'out'>('all');
  const [methodFilter, setMethodFilter] = useState<'all' | 'cash' | 'bank'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data, isLoading, refetch, isFetching } = useQuery<CashResponse>({
    queryKey: ['cash'],
    queryFn: () => api.get<CashResponse>('/cash'),
  });

  const items = data?.items || [];
  const cashBalance = data?.cash_balance ?? 0;
  const bankBalance = data?.bank_balance ?? 0;
  const totalBalance = cashBalance + bankBalance;

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Direction filter
      if (directionFilter !== 'all' && item.direction !== directionFilter) {
        return false;
      }
      // Method filter
      if (methodFilter !== 'all' && item.method !== methodFilter) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const noteMatch = (item.note || '').toLowerCase().includes(q);
        const refMatch = (item.reference_id || '').toLowerCase().includes(q);
        const idMatch = item.id.toLowerCase().includes(q);
        const catMatch = (CATEGORY_NAMES[item.category] || item.category).toLowerCase().includes(q);
        return noteMatch || refMatch || idMatch || catMatch;
      }
      return true;
    });
  }, [items, directionFilter, methodFilter, searchQuery]);

  const handleExport = () => {
    if (!data) return;
    const filterDesc = [
      directionFilter !== 'all' ? `Loại: ${directionFilter === 'in' ? 'Thu' : 'Chi'}` : null,
      methodFilter !== 'all' ? `Hình thức: ${methodFilter === 'cash' ? 'Tiền mặt' : 'Ngân hàng'}` : null,
      searchQuery.trim() ? `Từ khóa: ${searchQuery.trim()}` : null,
    ]
      .filter(Boolean)
      .join(', ');

    exportCashbookToExcel(
      {
        ...data,
        items: filteredItems,
      },
      filterDesc || undefined
    );
  };

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Sổ quỹ thu chi</h1>
          <p className="page-subtitle">
            Quản lý dòng tiền vào / ra, theo dõi số dư tiền mặt tại quỹ và tài khoản ngân hàng
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Button
            type="button"
            variant="secondary"
            onClick={() => refetch()}
            disabled={isFetching}
            title="Làm mới sổ quỹ"
          >
            <RefreshCw size={15} style={{ marginRight: 6 }} className={isFetching ? 'spinner' : ''} />
            Làm mới
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={handleExport}
            disabled={isLoading || items.length === 0}
            title="Xuất bảng kê sổ quỹ ra file Excel"
            data-testid="export-cashbook-btn"
          >
            <FileSpreadsheet size={15} style={{ marginRight: 6, color: '#16a34a' }} />
            Xuất Excel
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={() => setIsModalOpen(true)}
            data-testid="create-cash-entry-btn"
          >
            <Plus size={15} style={{ marginRight: 6 }} />
            Lập phiếu thu / chi
          </Button>
        </div>
      </div>

      {/* Server-Derived Balance Summary Cards */}
      <div
        className="metrics-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 14,
          marginBottom: 14,
        }}
      >
        {/* Cash Balance Card */}
        <div
          className="metric-card"
          data-testid="cash-balance-card"
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid var(--slate-200)',
            borderRadius: 'var(--radius-md)',
            padding: '14px 18px',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--teal-50, #f0fdfa)',
              color: 'var(--teal-600, #0d9488)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Coins size={24} />
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--slate-500)', textTransform: 'uppercase' }}>
              Tiền mặt tại quỹ (Server)
            </div>
            <div
              style={{
                fontSize: '20px',
                fontWeight: 700,
                color: cashBalance >= 0 ? 'var(--slate-900)' : 'var(--rose-600)',
                marginTop: 2,
              }}
            >
              {formatVND(cashBalance)}
            </div>
          </div>
        </div>

        {/* Bank Balance Card */}
        <div
          className="metric-card"
          data-testid="bank-balance-card"
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid var(--slate-200)',
            borderRadius: 'var(--radius-md)',
            padding: '14px 18px',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--blue-50, #eff6ff)',
              color: 'var(--blue-600, #2563eb)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <CreditCard size={24} />
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--slate-500)', textTransform: 'uppercase' }}>
              Tài khoản ngân hàng (Server)
            </div>
            <div
              style={{
                fontSize: '20px',
                fontWeight: 700,
                color: bankBalance >= 0 ? 'var(--slate-900)' : 'var(--rose-600)',
                marginTop: 2,
              }}
            >
              {formatVND(bankBalance)}
            </div>
          </div>
        </div>

        {/* Total Balance Card */}
        <div
          className="metric-card"
          data-testid="total-balance-card"
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid var(--slate-200)',
            borderRadius: 'var(--radius-md)',
            padding: '14px 18px',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--emerald-50, #ecfdf5)',
              color: 'var(--emerald-600, #059669)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Wallet size={24} />
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--slate-500)', textTransform: 'uppercase' }}>
              Tổng tồn quỹ thực tế
            </div>
            <div
              style={{
                fontSize: '20px',
                fontWeight: 700,
                color: totalBalance >= 0 ? 'var(--emerald-700, #047857)' : 'var(--rose-600)',
                marginTop: 2,
              }}
            >
              {formatVND(totalBalance)}
            </div>
          </div>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="toolbar-card">
        <div className="toolbar-group">
          {/* Search */}
          <div style={{ position: 'relative', minWidth: 260 }}>
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
              type="text"
              className="input input-sm"
              style={{ paddingLeft: 32 }}
              placeholder="Tìm theo ghi chú, mã chứng từ, ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Direction Filter */}
          <select
            className="input input-sm"
            style={{ width: 'auto' }}
            value={directionFilter}
            onChange={(e) => setDirectionFilter(e.target.value as 'all' | 'in' | 'out')}
          >
            <option value="all">Tất cả chiều tiền (Thu & Chi)</option>
            <option value="in">Chỉ tiền vào (Thu +)</option>
            <option value="out">Chỉ tiền ra (Chi -)</option>
          </select>

          {/* Method Filter */}
          <select
            className="input input-sm"
            style={{ width: 'auto' }}
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value as 'all' | 'cash' | 'bank')}
          >
            <option value="all">Tất cả hình thức</option>
            <option value="cash">Tiền mặt tại quỹ</option>
            <option value="bank">Chuyển khoản ngân hàng</option>
          </select>
        </div>

        <div style={{ fontSize: '13px', color: 'var(--slate-500)' }}>
          Hiển thị <strong>{filteredItems.length}</strong> / {items.length} bản ghi
        </div>
      </div>

      {/* Table Card */}
      <div className="table-card" style={{ marginTop: 14 }}>
        <div className="table-responsive-wrapper">
          <table className="table-misa" data-testid="cashbook-table">
            <thead>
              <tr>
                <th style={{ width: 100 }}>Mã giao dịch</th>
                <th style={{ width: 140 }}>Thời gian</th>
                <th style={{ width: 100 }} className="col-center">Loại phiếu</th>
                <th style={{ width: 120 }}>Hình thức</th>
                <th style={{ width: 140 }} className="col-money">Thu vào (VND)</th>
                <th style={{ width: 140 }} className="col-money">Chi ra (VND)</th>
                <th style={{ width: 160 }}>Danh mục nghiệp vụ</th>
                <th style={{ minWidth: 200 }}>Diễn giải / Ghi chú</th>
                <th style={{ width: 140 }}>Mã chứng từ gốc</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '36px 0', color: 'var(--slate-500)' }}>
                    Đang tải dữ liệu sổ quỹ từ máy chủ...
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: '36px 0' }}>
                    <EmptyState
                      title="Không có giao dịch quỹ phù hợp"
                      description="Chưa có phát sinh thu/chi nào khớp với bộ lọc tìm kiếm hiện tại."
                    />
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const isIncome = item.direction === 'in';
                  return (
                    <tr key={item.id}>
                      <td className="col-sku" title={item.id}>
                        {item.id.slice(0, 8)}…
                      </td>
                      <td style={{ fontSize: '12px' }}>{formatDateTime(item.created_at)}</td>
                      <td className="col-center">
                        {isIncome ? (
                          <span
                            className="badge badge-success"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                          >
                            <ArrowUpRight size={12} /> Thu
                          </span>
                        ) : (
                          <span
                            className="badge badge-warning"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                          >
                            <ArrowDownRight size={12} /> Chi
                          </span>
                        )}
                      </td>
                      <td>
                        <span style={{ fontSize: '13px' }}>
                          {item.method === 'cash' ? 'Tiền mặt' : 'Chuyển khoản'}
                        </span>
                      </td>
                      <td className="col-money" style={{ color: isIncome ? 'var(--emerald-600)' : 'var(--slate-400)' }}>
                        {isIncome ? `+${formatVND(item.amount)}` : '—'}
                      </td>
                      <td className="col-money" style={{ color: !isIncome ? 'var(--rose-600)' : 'var(--slate-400)' }}>
                        {!isIncome ? `-${formatVND(item.amount)}` : '—'}
                      </td>
                      <td>
                        <span style={{ fontSize: '13px', fontWeight: 500 }}>
                          {CATEGORY_NAMES[item.category] || item.category}
                        </span>
                      </td>
                      <td style={{ fontSize: '13px', color: 'var(--slate-700)' }}>{item.note || '—'}</td>
                      <td className="col-sku" title={item.reference_id || ''}>
                        {item.reference_id ? item.reference_id.slice(0, 8) + '…' : '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cash Entry Modal */}
      <CashEntryModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => refetch()}
      />
    </div>
  );
};
