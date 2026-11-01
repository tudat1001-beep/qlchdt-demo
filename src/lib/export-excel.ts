import * as XLSX from 'xlsx';
import { sumSignedVnd } from '../../shared/money';
import type { CashResponse, ReportsResponse } from '../types/cash-reports';
import { formatDateTime } from './formatters';

function triggerDownload(workbook: XLSX.WorkBook, filename: string) {
  const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

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

/**
 * Export Cashbook items and balances to an Excel file with preserved VND integers and dates.
 */
export function exportCashbookToExcel(data: CashResponse, filterNote?: string): void {
  const wb = XLSX.utils.book_new();

  // Summary header rows
  const rows: (string | number)[][] = [
    ['SỔ QUỸ THU CHI - QLCHDT'],
    ['Thời điểm xuất:', formatDateTime(new Date().toISOString())],
    ['Số dư tiền mặt (VND):', data.cash_balance],
    ['Số dư tài khoản ngân hàng (VND):', data.bank_balance],
    ['Tổng tồn quỹ (VND):', sumSignedVnd([data.cash_balance, data.bank_balance])],
  ];

  if (filterNote) {
    rows.push(['Bộ lọc áp dụng:', filterNote]);
  }

  rows.push([]); // Empty separator line
  // Table header
  rows.push([
    'Mã giao dịch',
    'Thời gian',
    'Loại phiếu',
    'Hình thức',
    'Tiền vào / Thu (VND)',
    'Tiền ra / Chi (VND)',
    'Danh mục',
    'Ghi chú',
    'Mã chứng từ tham chiếu',
  ]);

  for (const item of data.items) {
    const isIncome = item.direction === 'in';
    const thuAmount = isIncome ? item.amount : 0;
    const chiAmount = !isIncome ? item.amount : 0;
    const categoryName = CATEGORY_NAMES[item.category] || item.category;

    rows.push([
      item.id,
      formatDateTime(item.created_at),
      isIncome ? 'Thu' : 'Chi',
      item.method === 'cash' ? 'Tiền mặt' : 'Chuyển khoản',
      thuAmount,
      chiAmount,
      categoryName,
      item.note || '',
      item.reference_id || '',
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Set column widths
  ws['!cols'] = [
    { wch: 38 }, // ID
    { wch: 20 }, // Date
    { wch: 12 }, // Direction
    { wch: 14 }, // Method
    { wch: 22 }, // In (VND)
    { wch: 22 }, // Out (VND)
    { wch: 26 }, // Category
    { wch: 32 }, // Note
    { wch: 38 }, // Reference
  ];

  // Set number format for monetary cells
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
  for (let R = 0; R <= range.e.r; ++R) {
    for (let C = 0; C <= range.e.c; ++C) {
      const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = ws[cellAddress];
      if (cell && typeof cell.v === 'number') {
        cell.z = '#,##0';
      }
    }
  }

  XLSX.utils.book_append_sheet(wb, ws, 'So_Quy');
  const dateStr = new Date().toISOString().split('T')[0];
  triggerDownload(wb, `so-quy-${dateStr}.xlsx`);
}

/**
 * Export Financial & Inventory Reports to a multi-sheet Excel workbook.
 */
export function exportReportsToExcel(
  data: ReportsResponse,
  range: { from: string; to: string }
): void {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Financial Summary
  const summaryRows: (string | number)[][] = [
    ['BÁO CÁO HOẠT ĐỘNG KINH DOANH & TÀI CHÍNH - QLCHDT'],
    ['Kỳ báo cáo:', `Từ ngày ${range.from} đến ngày ${range.to}`],
    ['Thời điểm xuất:', formatDateTime(new Date().toISOString())],
    [],
    ['Chỉ số tài chính', 'Giá trị (VND)', 'Ghi chú nghiệp vụ'],
    ['Doanh thu thuần', data.revenue, 'Tổng doanh thu sau khi trừ hàng bán trả lại'],
    ['Thực thu bán hàng', data.collected, 'Tiền thực thu từ khách hàng (đã trừ hoàn tiền)'],
    ['Giá vốn hàng bán (COGS)', data.cost, 'Giá vốn thực tế xuất kho theo phương pháp FIFO'],
    ['Lợi nhuận gộp', data.gross_profit, 'Doanh thu thuần trừ Giá vốn (máy chủ tính toán)'],
    ['Chi phí hoạt động', data.expenses, 'Tổng các khoản chi phí phát sinh trong kỳ'],
    ['Công nợ khách hàng phải thu', data.customer_debt, 'Nợ khách hàng lũy kế đến hết ngày kết thúc kỳ'],
    ['Công nợ nhà cung cấp phải trả', data.supplier_debt, 'Nợ NCC lũy kế đến hết ngày kết thúc kỳ'],
    ['Giá trị tồn kho hiện tại', data.stock_value, 'Tổng giá trị hàng hóa và phụ kiện còn trong kho'],
  ];

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary['!cols'] = [{ wch: 32 }, { wch: 22 }, { wch: 50 }];

  // Sheet 2: Daily Breakdown
  const dailyRows: (string | number)[][] = [
    ['BÁO CÁO DOANH THU & LỢI NHUẬN THEO NGÀY'],
    ['Kỳ báo cáo:', `Từ ngày ${range.from} đến ngày ${range.to}`],
    [],
    ['Ngày', 'Doanh thu thuần (VND)', 'Giá vốn (VND)', 'Lợi nhuận gộp (VND)'],
  ];

  for (const row of data.daily) {
    dailyRows.push([row.date, row.revenue, row.cost, row.gross_profit]);
  }

  const wsDaily = XLSX.utils.aoa_to_sheet(dailyRows);
  wsDaily['!cols'] = [{ wch: 16 }, { wch: 24 }, { wch: 20 }, { wch: 24 }];

  // Sheet 3: Best Sellers
  const sellerRows: (string | number)[][] = [
    ['TOP SẢN PHẨM BÁN CHẠY NHẤT'],
    ['Kỳ báo cáo:', `Từ ngày ${range.from} đến ngày ${range.to}`],
    [],
    ['Mã sản phẩm', 'Tên sản phẩm', 'Số lượng đã bán', 'Doanh thu mang lại (VND)'],
  ];

  for (const item of data.best_sellers) {
    sellerRows.push([item.product_id, item.product_name, item.quantity, item.revenue]);
  }

  const wsSellers = XLSX.utils.aoa_to_sheet(sellerRows);
  wsSellers['!cols'] = [{ wch: 38 }, { wch: 35 }, { wch: 18 }, { wch: 26 }];

  // Sheet 4: Low Stock Alert
  const stockRows: (string | number)[][] = [
    ['DANH SÁCH SẢN PHẨM CẢNH BÁO TỒN KHO THẤP'],
    ['Thời điểm kết xuất:', formatDateTime(new Date().toISOString())],
    [],
    ['Mã sản phẩm', 'Mã SKU', 'Tên sản phẩm', 'Loại', 'Tồn kho hiện tại', 'Định mức tối thiểu'],
  ];

  for (const item of data.low_stock) {
    stockRows.push([
      item.id,
      item.sku,
      item.name,
      item.kind === 'PHONE' ? 'Điện thoại' : 'Phụ kiện',
      item.stock_quantity,
      item.min_stock,
    ]);
  }

  const wsStock = XLSX.utils.aoa_to_sheet(stockRows);
  wsStock['!cols'] = [{ wch: 38 }, { wch: 20 }, { wch: 35 }, { wch: 15 }, { wch: 18 }, { wch: 18 }];

  // Format all numbers in all sheets with #,##0
  const sheets = [
    { sheet: wsSummary, name: 'Tong_Hop_Tai_Chinh' },
    { sheet: wsDaily, name: 'Doanh_Thu_Theo_Ngay' },
    { sheet: wsSellers, name: 'Top_Ban_Chay' },
    { sheet: wsStock, name: 'Canh_Bao_Ton_Kho' },
  ];

  for (const { sheet, name } of sheets) {
    const sheetRange = XLSX.utils.decode_range(sheet['!ref'] || 'A1:A1');
    for (let R = 0; R <= sheetRange.e.r; ++R) {
      for (let C = 0; C <= sheetRange.e.c; ++C) {
        const cell = sheet[XLSX.utils.encode_cell({ r: R, c: C })];
        if (cell && typeof cell.v === 'number') {
          cell.z = '#,##0';
        }
      }
    }
    XLSX.utils.book_append_sheet(wb, sheet, name);
  }

  triggerDownload(wb, `bao-cao-tai-chinh-${range.from}-den-${range.to}.xlsx`);
}
