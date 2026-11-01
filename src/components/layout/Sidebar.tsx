import React from 'react';
import { Smartphone, Package, Users, Truck, LogOut, ShoppingCart, Receipt, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export type ActiveNav = 'purchases' | 'pos' | 'sales' | 'warranties' | 'products' | 'customers' | 'suppliers';

interface SidebarProps {
  activeNav: ActiveNav;
  onNavigate: (nav: ActiveNav) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeNav,
  onNavigate,
  isOpenMobile,
  onCloseMobile,
}) => {
  const { user, logout } = useAuth();

  const handleNavClick = (nav: ActiveNav) => {
    onNavigate(nav);
    onCloseMobile();
  };

  return (
    <>
      {isOpenMobile && (
        <div
          className="sidebar-backdrop"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}
      <aside className={`app-sidebar ${isOpenMobile ? 'sidebar-open' : ''}`}>
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon">
            <Smartphone size={18} />
          </div>
          <span>QLCHDT</span>
        </div>

        <nav className="sidebar-nav" aria-label="Điều hướng chính">
          <div className="nav-section-title">Giao dịch nghiệp vụ</div>

          <button
            type="button"
            className={`nav-item ${activeNav === 'pos' ? 'active' : ''}`}
            onClick={() => handleNavClick('pos')}
            aria-current={activeNav === 'pos' ? 'page' : undefined}
          >
            <div className="nav-item-icon">
              <ShoppingCart size={17} />
            </div>
            <span>Bán hàng (POS)</span>
          </button>

          <button
            type="button"
            className={`nav-item ${activeNav === 'sales' ? 'active' : ''}`}
            onClick={() => handleNavClick('sales')}
            aria-current={activeNav === 'sales' ? 'page' : undefined}
          >
            <div className="nav-item-icon">
              <Receipt size={17} />
            </div>
            <span>Phiếu bán & Thu nợ</span>
          </button>

          <button
            type="button"
            className={`nav-item ${activeNav === 'purchases' ? 'active' : ''}`}
            onClick={() => handleNavClick('purchases')}
            aria-current={activeNav === 'purchases' ? 'page' : undefined}
          >
            <div className="nav-item-icon">
              <Truck size={17} />
            </div>
            <span>Nhập hàng & Kho</span>
          </button>

          <button
            type="button"
            className={`nav-item ${activeNav === 'warranties' ? 'active' : ''}`}
            onClick={() => handleNavClick('warranties')}
            aria-current={activeNav === 'warranties' ? 'page' : undefined}
          >
            <div className="nav-item-icon">
              <ShieldCheck size={17} />
            </div>
            <span>Bảo hành & Sửa chữa</span>
          </button>

          <div className="nav-section-title" style={{ marginTop: 12 }}>Danh mục & Đối tác</div>

          <button
            type="button"
            className={`nav-item ${activeNav === 'products' ? 'active' : ''}`}
            onClick={() => handleNavClick('products')}
            aria-current={activeNav === 'products' ? 'page' : undefined}
          >
            <div className="nav-item-icon">
              <Package size={17} />
            </div>
            <span>Hàng hóa & Thiết bị</span>
          </button>

          <button
            type="button"
            className={`nav-item ${activeNav === 'customers' ? 'active' : ''}`}
            onClick={() => handleNavClick('customers')}
            aria-current={activeNav === 'customers' ? 'page' : undefined}
          >
            <div className="nav-item-icon">
              <Users size={17} />
            </div>
            <span>Khách hàng</span>
          </button>

          <button
            type="button"
            className={`nav-item ${activeNav === 'suppliers' ? 'active' : ''}`}
            onClick={() => handleNavClick('suppliers')}
            aria-current={activeNav === 'suppliers' ? 'page' : undefined}
          >
            <div className="nav-item-icon">
              <Truck size={17} />
            </div>
            <span>Nhà cung cấp</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="user-badge">
            <div className="user-avatar" title={user?.username || 'User'}>
              {user?.username ? user.username.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="user-info">
              <span className="user-name">{user?.username || 'Đang kết nối...'}</span>
              <span className="user-role">Quản lý</span>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={logout}
            title="Đăng xuất"
            aria-label="Đăng xuất khỏi hệ thống"
            style={{ color: '#94a3b8', padding: '6px' }}
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>
    </>
  );
};
