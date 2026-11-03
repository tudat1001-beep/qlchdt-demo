import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api-client';
import { formatVND, formatNumber } from '../../lib/formatters';
import { exportReportsToExcel } from '../../lib/export-excel';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import type { ReportsResponse } from '../../types/cash-reports';
import {
  TrendingUp,
  DollarSign,
  Receipt,
  Truck,
  Users,
  Package,
  AlertTriangle,
  FileSpreadsheet,
  RefreshCw,
  Calendar,
  Layers,
  ArrowUpRight,
  ShieldAlert,
} from 'lucide-react';

type ReportTab = 'daily' | 'best_sellers' | 'low_stock';

// Helper to get local ISO date string YYYY-MM-DD
function getLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const ReportsPage: React.FC = () => {
  // Preset calculations
  const today = new Date();
  const todayStr = getLocalDateString(today);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(today.getDate() - 29);
  const thirtyDaysAgoStr = getLocalDateString(thirtyDaysAgo);

  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const firstDayOfMonthStr = getLocalDateString(firstDayOfMonth);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(today.getDate() - 6);
  const sevenDaysAgoStr = getLocalDateString(sevenDaysAgo);

  const [from, setFrom] = useState(thirtyDaysAgoStr);
  const [to, setTo] = useState(todayStr);
  const [activeTab, setActiveTab] = useState<ReportTab>('daily');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    setPage(1);
  }, [activeTab, from, to]);

  const { data, isLoading, refetch, isFetching } = useQuery<ReportsResponse>({
    queryKey: ['reports', from, to],
    queryFn: () => api.get<ReportsResponse>(`/reports?from=${from}&to=${to}`),
    enabled: Boolean(from && to && from <= to),
  });

  const dailyItems = data?.daily || [];
  const bestSellersItems = data?.best_sellers || [];
  const lowStockItems = data?.low_stock || [];

  const handleApplyPreset = (presetFrom: string, presetTo: string) => {
    setFrom(presetFrom);
    setTo(presetTo);
  };

  const handleExport = () => {
    if (!data) return;
    exportReportsToExcel(data, { from, to });
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Báo cáo tài chính & Tồn kho</h1>
          <p className="page-subtitle">
            Tổng hợp doanh thu, giá vốn, lợi nhuận, thực thu, công nợ hai chiều và cảnh báo tồn kho
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Button
            type="button"
            variant="secondary"
            onClick={() => refetch()}
            disabled={isFetching}
            title="Làm mới số liệu báo cáo"
          >
            <RefreshCw size={15} style={{ marginRight: 6 }} className={isFetching ? 'spinner' : ''} />
            Làm mới
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleExport}
            disabled={isLoading || !data}
            title="Xuất báo cáo chi tiết ra tệp Excel nhiều Sheet"
            data-testid="export-reports-btn"
          >
            <FileSpreadsheet size={15} style={{ marginRight: 6 }} />
            Xuất Excel Báo cáo
          </Button>
        </div>
      </div>

      {/* Date Range Selector Toolbar */}
      <div className="toolbar-card report-toolbar-card" style={{ marginBottom: 14 }}>
        <div className="toolbar-group report-toolbar-group">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '13px', fontWeight: 600, color: 'var(--slate-700)' }}>
            <Calendar size={15} color="var(--slate-500)" />
            <span>Kỳ báo cáo:</span>
          </div>

          {/* Quick Presets */}
          <button
            type="button"
            className={`btn btn-sm ${from === todayStr && to === todayStr ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => handleApplyPreset(todayStr, todayStr)}
          >
            Hôm nay
          </button>
          <button
            type="button"
            className={`btn btn-sm ${from === sevenDaysAgoStr && to === todayStr ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => handleApplyPreset(sevenDaysAgoStr, todayStr)}
          >
            7 ngày qua
          </button>
          <button
            type="button"
            className={`btn btn-sm ${from === thirtyDaysAgoStr && to === todayStr ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => handleApplyPreset(thirtyDaysAgoStr, todayStr)}
          >
            30 ngày qua
          </button>
          <button
            type="button"
            className={`btn btn-sm ${from === firstDayOfMonthStr && to === todayStr ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => handleApplyPreset(firstDayOfMonthStr, todayStr)}
          >
            Tháng này
          </button>

          {/* Date Picker Inputs */}
          <div className="report-date-range" style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 8 }}>
            <span style={{ fontSize: '13px', color: 'var(--slate-500)' }}>Từ</span>
            <input
              type="date"
              className="input input-sm"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              style={{ width: 140 }}
              data-testid="report-from-date"
            />
            <span style={{ fontSize: '13px', color: 'var(--slate-500)' }}>Đến</span>
            <input
              type="date"
              className="input input-sm"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              style={{ width: 140 }}
              data-testid="report-to-date"
            />
          </div>
        </div>

        {from > to && (
          <div style={{ fontSize: '12px', color: 'var(--rose-600)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <AlertTriangle size={14} /> Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc
          </div>
        )}
      </div>

      {/* 8 Visibly Distinct & Server-Derived Metric Cards */}
      <div
        className="metrics-grid report-metrics-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 12,
          marginBottom: 16,
        }}
      >
        {/* 1. Doanh thu thuần */}
        <div
          className="metric-card"
          data-testid="report-metric-revenue"
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid var(--slate-200)',
            borderRadius: 'var(--radius-md)',
            padding: '14px 16px',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--slate-500)', textTransform: 'uppercase' }}>
              Doanh thu thuần
            </span>
            <span
              style={{
                padding: '3px 8px',
                borderRadius: 4,
                backgroundColor: 'var(--teal-50, #f0fdfa)',
                color: 'var(--teal-700, #0f766e)',
                fontSize: '11px',
                fontWeight: 600,
              }}
            >
              Sau trừ hàng trả
            </span>
          </div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--teal-800, #115e59)', marginTop: 8 }}>
            {isLoading ? '…' : formatVND(data?.revenue)}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--slate-500)', marginTop: 4 }}>
            Chỉ số máy chủ tính từ hóa đơn bán
          </div>
        </div>

        {/* 2. Thực thu bán hàng (DISTINCT from revenue!) */}
        <div
          className="metric-card"
          data-testid="report-metric-collected"
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid var(--emerald-200, #a7f3d0)',
            borderRadius: 'var(--radius-md)',
            padding: '14px 16px',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--emerald-800, #065f46)', textTransform: 'uppercase' }}>
              Tiền thực thu (Collected)
            </span>
            <span
              style={{
                padding: '3px 8px',
                borderRadius: 4,
                backgroundColor: 'var(--emerald-50, #ecfdf5)',
                color: 'var(--emerald-700, #047857)',
                fontSize: '11px',
                fontWeight: 600,
              }}
            >
              Tiền vào thực tế
            </span>
          </div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--emerald-700, #047857)', marginTop: 8 }}>
            {isLoading ? '…' : formatVND(data?.collected)}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--slate-500)', marginTop: 4 }}>
            Đã khấu trừ số tiền đã hoàn cho khách
          </div>
        </div>

        {/* 3. Giá vốn hàng bán (COGS) */}
        <div
          className="metric-card"
          data-testid="report-metric-cost"
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid var(--slate-200)',
            borderRadius: 'var(--radius-md)',
            padding: '14px 16px',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--slate-500)', textTransform: 'uppercase' }}>
              Giá vốn hàng bán
            </span>
            <span
              style={{
                padding: '3px 8px',
                borderRadius: 4,
                backgroundColor: 'var(--slate-100)',
                color: 'var(--slate-600)',
                fontSize: '11px',
                fontWeight: 600,
              }}
            >
              FIFO xuất kho
            </span>
          </div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--slate-800)', marginTop: 8 }}>
            {isLoading ? '…' : formatVND(data?.cost)}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--slate-500)', marginTop: 4 }}>
            Giá vốn thực tế các đợt nhập hàng
          </div>
        </div>

        {/* 4. Lợi nhuận gộp */}
        <div
          className="metric-card"
          data-testid="report-metric-gross-profit"
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid var(--teal-300, #5eead4)',
            borderRadius: 'var(--radius-md)',
            padding: '14px 16px',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--teal-900)', textTransform: 'uppercase' }}>
              Lợi nhuận gộp
            </span>
            <span
              style={{
                padding: '3px 8px',
                borderRadius: 4,
                backgroundColor: 'var(--teal-100, #ccfbf1)',
                color: 'var(--teal-800, #115e59)',
                fontSize: '11px',
                fontWeight: 600,
              }}
            >
              Doanh thu - Giá vốn
            </span>
          </div>
          <div
            style={{
              fontSize: '20px',
              fontWeight: 700,
              color: (data?.gross_profit ?? 0) >= 0 ? 'var(--teal-700, #0f766e)' : 'var(--rose-600)',
              marginTop: 8,
            }}
          >
            {isLoading ? '…' : formatVND(data?.gross_profit)}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--slate-500)', marginTop: 4 }}>
            Lợi nhuận gộp thuần từ bán lẻ
          </div>
        </div>

        {/* 5. Chi phí hoạt động */}
        <div
          className="metric-card"
          data-testid="report-metric-expenses"
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid var(--slate-200)',
            borderRadius: 'var(--radius-md)',
            padding: '14px 16px',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--slate-500)', textTransform: 'uppercase' }}>
              Chi phí hoạt động
            </span>
            <span
              style={{
                padding: '3px 8px',
                borderRadius: 4,
                backgroundColor: 'var(--amber-50, #fffbeb)',
                color: 'var(--amber-800, #92400e)',
                fontSize: '11px',
                fontWeight: 600,
              }}
            >
              Sổ quỹ
            </span>
          </div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--amber-700, #b45309)', marginTop: 8 }}>
            {isLoading ? '…' : formatVND(data?.expenses)}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--slate-500)', marginTop: 4 }}>
            Tổng các phiếu chi phí trong kỳ
          </div>
        </div>

        {/* 6. Công nợ khách hàng */}
        <div
          className="metric-card"
          data-testid="report-metric-customer-debt"
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid var(--slate-200)',
            borderRadius: 'var(--radius-md)',
            padding: '14px 16px',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--slate-500)', textTransform: 'uppercase' }}>
              Nợ khách hàng
            </span>
            <span
              style={{
                padding: '3px 8px',
                borderRadius: 4,
                backgroundColor: 'var(--indigo-50, #eef2ff)',
                color: 'var(--indigo-700, #4338ca)',
                fontSize: '11px',
                fontWeight: 600,
              }}
            >
              Phải thu
            </span>
          </div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--indigo-700, #4338ca)', marginTop: 8 }}>
            {isLoading ? '…' : formatVND(data?.customer_debt)}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--slate-500)', marginTop: 4 }}>
            Lũy kế đến hết ngày {to}
          </div>
        </div>

        {/* 7. Công nợ nhà cung cấp */}
        <div
          className="metric-card"
          data-testid="report-metric-supplier-debt"
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid var(--slate-200)',
            borderRadius: 'var(--radius-md)',
            padding: '14px 16px',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--slate-500)', textTransform: 'uppercase' }}>
              Nợ nhà cung cấp
            </span>
            <span
              style={{
                padding: '3px 8px',
                borderRadius: 4,
                backgroundColor: 'var(--violet-50, #f5f3ff)',
                color: 'var(--violet-700, #6d28d9)',
                fontSize: '11px',
                fontWeight: 600,
              }}
            >
              Phải trả NCC
            </span>
          </div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--violet-700, #6d28d9)', marginTop: 8 }}>
            {isLoading ? '…' : formatVND(data?.supplier_debt)}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--slate-500)', marginTop: 4 }}>
            Lũy kế đến hết ngày {to}
          </div>
        </div>

        {/* 8. Giá trị tồn kho */}
        <div
          className="metric-card"
          data-testid="report-metric-stock-value"
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid var(--slate-200)',
            borderRadius: 'var(--radius-md)',
            padding: '14px 16px',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--slate-500)', textTransform: 'uppercase' }}>
              Giá trị tồn kho
            </span>
            <span
              style={{
                padding: '3px 8px',
                borderRadius: 4,
                backgroundColor: 'var(--sky-50, #f0f9ff)',
                color: 'var(--sky-700, #0369a1)',
                fontSize: '11px',
                fontWeight: 600,
              }}
            >
              Hiện thời
            </span>
          </div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--sky-800, #075985)', marginTop: 8 }}>
            {isLoading ? '…' : formatVND(data?.stock_value)}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--slate-500)', marginTop: 4 }}>
            Thiết bị & phụ kiện sẵn sàng bán/cách ly
          </div>
        </div>
      </div>

      {/* Tabs navigation */}
      <div className="report-tabs" style={{ display: 'flex', borderBottom: '1px solid var(--slate-200)', gap: 8, marginBottom: 14 }}>
        <button
          type="button"
          className={`btn ${activeTab === 'daily' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('daily')}
          style={{ borderRadius: '6px 6px 0 0' }}
        >
          <TrendingUp size={15} style={{ marginRight: 6 }} />
          Doanh thu theo ngày ({data?.daily?.length ?? 0})
        </button>

        <button
          type="button"
          className={`btn ${activeTab === 'best_sellers' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('best_sellers')}
          style={{ borderRadius: '6px 6px 0 0' }}
        >
          <Layers size={15} style={{ marginRight: 6 }} />
          Top bán chạy ({data?.best_sellers?.length ?? 0})
        </button>

        <button
          type="button"
          className={`btn ${activeTab === 'low_stock' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('low_stock')}
          style={{ borderRadius: '6px 6px 0 0' }}
        >
          <ShieldAlert size={15} style={{ marginRight: 6, color: (data?.low_stock?.length ?? 0) > 0 ? 'var(--rose-500)' : undefined }} />
          Cảnh báo tồn kho ({data?.low_stock?.length ?? 0})
        </button>
      </div>

      {/* Tab 1: Doanh thu theo ngày */}
      {activeTab === 'daily' && (
        <div className="table-card">
          <div className="table-responsive-wrapper report-table-daily">
            <table className="table-misa" data-testid="daily-report-table">
              <thead>
                <tr>
                  <th style={{ width: 140 }}>Ngày</th>
                  <th style={{ width: 180 }} className="col-money">Doanh thu thuần (VND)</th>
                  <th style={{ width: 180 }} className="col-money">Giá vốn (COGS)</th>
                  <th style={{ width: 180 }} className="col-money">Lợi nhuận gộp (VND)</th>
                  <th>Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '36px 0', color: 'var(--slate-500)' }}>
                      Đang kết xuất dữ liệu doanh thu theo ngày...
                    </td>
                  </tr>
                ) : dailyItems.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '36px 0' }}>
                      <EmptyState
                        title="Không có dữ liệu trong khoảng thời gian này"
                        description="Vui lòng chọn khoảng thời gian khác hoặc kiểm tra lại bộ lọc."
                      />
                    </td>
                  </tr>
                ) : (
                  dailyItems.slice((page - 1) * pageSize, page * pageSize).map((row) => (
                    <tr key={row.date}>
                      <td data-label="Ngày" style={{ fontWeight: 600 }}>{row.date}</td>
                      <td data-label="Doanh thu thuần" className="col-money" style={{ color: 'var(--teal-700)' }}>
                        {formatVND(row.revenue)}
                      </td>
                      <td data-label="Giá vốn (COGS)" className="col-money" style={{ color: 'var(--slate-600)' }}>
                        {formatVND(row.cost)}
                      </td>
                      <td
                        data-label="Lợi nhuận gộp"
                        className="col-money"
                        style={{
                          fontWeight: 600,
                          color: row.gross_profit >= 0 ? 'var(--emerald-600)' : 'var(--rose-600)',
                        }}
                      >
                        {formatVND(row.gross_profit)}
                      </td>
                      <td data-label="Ghi chú" style={{ fontSize: '12px', color: 'var(--slate-500)' }}>
                        {row.revenue > 0 ? 'Có phát sinh doanh thu' : 'Không có phát sinh'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="table-footer-pagination" aria-label="Phân trang doanh thu theo ngày">
            <span>
              Tổng cộng: <strong>{dailyItems.length}</strong> ngày · Trang {Math.min(page, Math.max(1, Math.ceil(dailyItems.length / pageSize)))} / {Math.max(1, Math.ceil(dailyItems.length / pageSize))}
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <Button type="button" variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Trước</Button>
              <Button type="button" variant="secondary" size="sm" disabled={page >= Math.max(1, Math.ceil(dailyItems.length / pageSize))} onClick={() => setPage((p) => p + 1)}>Sau</Button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Top sản phẩm bán chạy */}
      {activeTab === 'best_sellers' && (
        <div className="table-card">
          <div className="table-responsive-wrapper report-table-bestsellers">
            <table className="table-misa" data-testid="best-sellers-table">
              <thead>
                <tr>
                  <th style={{ width: 60 }} className="col-center">Hạng</th>
                  <th style={{ width: 160 }}>Mã sản phẩm</th>
                  <th style={{ minWidth: 260 }}>Tên sản phẩm</th>
                  <th style={{ width: 120 }} className="col-center">Số lượng đã bán</th>
                  <th style={{ width: 180 }} className="col-money">Doanh thu mang lại</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '36px 0', color: 'var(--slate-500)' }}>
                      Đang phân tích top sản phẩm bán chạy...
                    </td>
                  </tr>
                ) : bestSellersItems.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '36px 0' }}>
                      <EmptyState
                        title="Chưa có dữ liệu bán hàng trong kỳ"
                        description="Không có mặt hàng nào phát sinh số lượng bán thuần > 0 trong khoảng thời gian đã chọn."
                      />
                    </td>
                  </tr>
                ) : (
                  bestSellersItems.slice((page - 1) * pageSize, page * pageSize).map((item, index) => {
                    const rank = (page - 1) * pageSize + index + 1;
                    return (
                    <tr key={item.product_id}>
                      <td data-label="Hạng" className="col-center" style={{ fontWeight: 700, color: rank <= 3 ? 'var(--teal-600)' : 'var(--slate-500)' }}>
                        #{rank}
                      </td>
                      <td data-label="Mã sản phẩm" className="col-sku">{item.product_id.slice(0, 8)}…</td>
                      <td data-label="Tên sản phẩm" style={{ fontWeight: 600 }}>{item.product_name}</td>
                      <td data-label="Số lượng đã bán" className="col-center" style={{ fontWeight: 600 }}>
                        {formatNumber(item.quantity)}
                      </td>
                      <td data-label="Doanh thu mang lại" className="col-money" style={{ fontWeight: 600, color: 'var(--teal-700)' }}>
                        {formatVND(item.revenue)}
                      </td>
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="table-footer-pagination" aria-label="Phân trang top bán chạy">
            <span>
              Tổng cộng: <strong>{bestSellersItems.length}</strong> sản phẩm · Trang {Math.min(page, Math.max(1, Math.ceil(bestSellersItems.length / pageSize)))} / {Math.max(1, Math.ceil(bestSellersItems.length / pageSize))}
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <Button type="button" variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Trước</Button>
              <Button type="button" variant="secondary" size="sm" disabled={page >= Math.max(1, Math.ceil(bestSellersItems.length / pageSize))} onClick={() => setPage((p) => p + 1)}>Sau</Button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Cảnh báo tồn kho */}
      {activeTab === 'low_stock' && (
        <div className="table-card">
          <div className="table-responsive-wrapper report-table-lowstock">
            <table className="table-misa" data-testid="low-stock-table">
              <thead>
                <tr>
                  <th style={{ width: 140 }}>Mã SKU</th>
                  <th style={{ minWidth: 240 }}>Tên hàng hóa</th>
                  <th style={{ width: 120 }}>Chủng loại</th>
                  <th style={{ width: 140 }} className="col-center">Tồn kho thực tế</th>
                  <th style={{ width: 140 }} className="col-center">Định mức an toàn</th>
                  <th style={{ width: 160 }} className="col-center">Tình trạng cảnh báo</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '36px 0', color: 'var(--slate-500)' }}>
                      Đang kiểm tra ngưỡng tồn kho tối thiểu...
                    </td>
                  </tr>
                ) : lowStockItems.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '36px 0' }}>
                      <EmptyState
                        title="Tồn kho ở mức an toàn"
                        description="Hiện không có sản phẩm nào chạm hoặc thấp hơn định mức tối thiểu."
                      />
                    </td>
                  </tr>
                ) : (
                  lowStockItems.slice((page - 1) * pageSize, page * pageSize).map((item) => {
                    const isZero = item.stock_quantity <= 0;
                    return (
                      <tr key={item.id}>
                        <td data-label="Mã SKU" className="col-sku">{item.sku}</td>
                        <td data-label="Tên hàng hóa" style={{ fontWeight: 600 }}>{item.name}</td>
                        <td data-label="Chủng loại">
                          {item.kind === 'PHONE' ? (
                            <Badge variant="phone">Điện thoại</Badge>
                          ) : (
                            <Badge variant="accessory">Phụ kiện</Badge>
                          )}
                        </td>
                        <td
                          data-label="Tồn kho thực tế"
                          className="col-center"
                          style={{
                            fontWeight: 700,
                            color: isZero ? 'var(--rose-600)' : 'var(--amber-600)',
                          }}
                        >
                          {formatNumber(item.stock_quantity)}
                        </td>
                        <td data-label="Định mức an toàn" className="col-center">{formatNumber(item.min_stock)}</td>
                        <td data-label="Tình trạng cảnh báo" className="col-center">
                          {isZero ? (
                            <Badge variant="quarantine">Hết hàng (0)</Badge>
                          ) : (
                            <Badge variant="debt">Sắp hết hàng</Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="table-footer-pagination" aria-label="Phân trang cảnh báo tồn kho">
            <span>
              Tổng cộng: <strong>{lowStockItems.length}</strong> sản phẩm · Trang {Math.min(page, Math.max(1, Math.ceil(lowStockItems.length / pageSize)))} / {Math.max(1, Math.ceil(lowStockItems.length / pageSize))}
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <Button type="button" variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Trước</Button>
              <Button type="button" variant="secondary" size="sm" disabled={page >= Math.max(1, Math.ceil(lowStockItems.length / pageSize))} onClick={() => setPage((p) => p + 1)}>Sau</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
