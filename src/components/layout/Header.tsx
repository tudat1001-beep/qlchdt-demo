import React, { useState } from 'react';
import { Menu, LogOut, Store, Loader2, Wifi, WifiOff } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useNetwork } from '../../context/NetworkContext';
import type { ActiveNav } from './Sidebar';

interface HeaderProps {
  activeNav: ActiveNav;
  onOpenMobileNav: () => void;
}

export const Header: React.FC<HeaderProps> = ({ activeNav, onOpenMobileNav }) => {
  const { logout } = useAuth();
  const { showError } = useToast();
  const { isOnline } = useNetwork();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const titles: Record<ActiveNav, string> = {
    pos: 'Bán hàng (POS)',
    sales: 'Phiếu bán & Thu nợ',
    purchases: 'Nhập hàng & Kho',
    warranties: 'Hồ sơ bảo hành',
    cashbook: 'Sổ quỹ thu chi',
    reports: 'Báo cáo tài chính & Tồn kho',
    products: 'Hàng hóa & Thiết bị',
    customers: 'Khách hàng',
    suppliers: 'Nhà cung cấp',
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Đăng xuất thất bại do lỗi kết nối máy chủ';
      showError(msg);
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <header className="app-header">
      <div className="header-left">
        <button
          type="button"
          className="mobile-menu-btn"
          onClick={onOpenMobileNav}
          aria-label="Mở menu điều hướng"
        >
          <Menu size={18} />
        </button>
        <h1 className="page-title">{titles[activeNav]}</h1>
      </div>

      <div className="header-right">
        {/* Visible Network Status Indicator */}
        <div
          className={`network-badge ${isOnline ? 'online' : 'offline'}`}
          data-testid="network-status"
          title={isOnline ? 'Hệ thống trực tuyến' : 'Hệ thống ngoại tuyến - Chỉ xem dữ liệu'}
        >
          {isOnline ? (
            <>
              <Wifi size={13} className="network-icon" />
              <span>Trực tuyến</span>
            </>
          ) : (
            <>
              <WifiOff size={13} className="network-icon" />
              <span>Ngoại tuyến (Chỉ xem)</span>
            </>
          )}
        </div>

        <div className="header-store-badge">
          <Store size={14} color="#0d9488" />
          <span>Cửa hàng chính</span>
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-sm header-logout-btn"
          onClick={handleLogout}
          disabled={isLoggingOut}
          title="Đăng xuất"
          aria-label="Đăng xuất khỏi hệ thống"
        >
          {isLoggingOut ? (
            <Loader2 size={13} className="spinner" style={{ animation: 'spin 1s linear infinite' }} />
          ) : (
            <LogOut size={13} />
          )}
          <span>Đăng xuất</span>
        </button>
      </div>
    </header>
  );
};
