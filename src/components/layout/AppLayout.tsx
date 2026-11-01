import React, { useState, useEffect } from 'react';
import { Sidebar, type ActiveNav } from './Sidebar';
import { Header } from './Header';

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
        <div className="page-body">
          {children}
        </div>
      </main>
    </div>
  );
};
