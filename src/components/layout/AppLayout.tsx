import React, { useState } from 'react';
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
