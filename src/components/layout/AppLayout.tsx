import React, { useState, useEffect } from 'react';
import { Sidebar, type ActiveNav } from './Sidebar';
import { Header } from './Header';
import { useNetwork } from '../../context/NetworkContext';
import { WifiOff } from 'lucide-react';

interface AppLayoutProps {
  activeNav: ActiveNav;
  onNavigate: (nav: ActiveNav) => void;
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  activeNav,
  onNavigate,
  children,
}) => {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const { isOnline } = useNetwork();

  // Close mobile navigation drawer whenever the active route changes
  useEffect(() => {
    setIsMobileNavOpen(false);
  }, [activeNav]);

  // Close mobile navigation when viewport expands beyond mobile breakpoint (768px)
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 768) {
        setIsMobileNavOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Close mobile navigation on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMobileNavOpen) {
        setIsMobileNavOpen(false);
      }
    };
    if (isMobileNavOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isMobileNavOpen]);

  return (
    <div className="app-container">
      <Sidebar
        activeNav={activeNav}
        onNavigate={onNavigate}
        isOpenMobile={isMobileNavOpen}
        onCloseMobile={() => setIsMobileNavOpen(false)}
      />
      <main className="app-main">
        <Header
          activeNav={activeNav}
          onOpenMobileNav={() => setIsMobileNavOpen(true)}
        />
        {!isOnline && (
          <div className="offline-banner" role="alert" data-testid="offline-alert-banner">
            <WifiOff size={16} />
            <span>
              Hệ thống đang hoạt động ở chế độ <strong>Ngoại tuyến (Chỉ xem)</strong>. Mọi thao tác ghi sổ, thanh toán và biến động tài chính bị từ chối để bảo đảm tính toàn vẹn dữ liệu.
            </span>
          </div>
        )}
        <div className="page-body">
          {children}
        </div>
      </main>
    </div>
  );
};
