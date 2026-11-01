import React from 'react';
import { Menu, LogOut, Store } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import type { ActiveNav } from './Sidebar';

interface HeaderProps {
  activeNav: ActiveNav;
  onOpenMobileNav: () => void;
}

export const Header: React.FC<HeaderProps> = ({ activeNav, onOpenMobileNav }) => {
  const { user, logout } = useAuth();

  const titles: Record<ActiveNav, string> = {
    products: 'Quản lý Hàng hóa & Thiết bị',
    customers: 'Quản lý Khách hàng',
    suppliers: 'Quản lý Nhà cung cấp',
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '12px', color: '#64748b' }}>
          <Store size={15} color="#0d9488" />
          <span>Cửa hàng chính</span>
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={logout}
          title="Đăng xuất"
          aria-label="Đăng xuất"
        >
          <LogOut size={14} />
          <span>Đăng xuất</span>
        </button>
      </div>
    </header>
  );
};
