import React, { lazy, Suspense, useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/query-client';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppLayout } from './components/layout/AppLayout';
import type { ActiveNav } from './components/layout/Sidebar';
import { LoginPage } from './features/auth/LoginPage';
import { NetworkProvider } from './context/NetworkContext';
import { Smartphone, Loader2 } from 'lucide-react';

const ProductsPage = lazy(() => import('./features/products/ProductsPage').then((m) => ({ default: m.ProductsPage })));
const CustomersPage = lazy(() => import('./features/customers/CustomersPage').then((m) => ({ default: m.CustomersPage })));
const SuppliersPage = lazy(() => import('./features/suppliers/SuppliersPage').then((m) => ({ default: m.SuppliersPage })));
const PurchasesPage = lazy(() => import('./features/inventory/PurchasesPage').then((m) => ({ default: m.PurchasesPage })));
const POSPage = lazy(() => import('./features/pos/POSPage').then((m) => ({ default: m.POSPage })));
const SalesPage = lazy(() => import('./features/sales/SalesPage').then((m) => ({ default: m.SalesPage })));
const WarrantiesPage = lazy(() => import('./features/warranties/WarrantiesPage').then((m) => ({ default: m.WarrantiesPage })));
const CashbookPage = lazy(() => import('./features/cashbook/CashbookPage').then((m) => ({ default: m.CashbookPage })));
const ReportsPage = lazy(() => import('./features/reports/ReportsPage').then((m) => ({ default: m.ReportsPage })));

class PageLoadBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    console.error('Không tải được màn hình ứng dụng:', error);
  }

  render() {
    if (this.state.failed) {
      return (
        <div role="alert" style={{ padding: 24, textAlign: 'center' }}>
          <p>Không tải được màn hình này. Hãy tải lại ứng dụng để tiếp tục.</p>
          <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>Tải lại ứng dụng</button>
        </div>
      );
    }
    return this.props.children;
  }
}

const MainContent: React.FC = () => {
  const { user, isLoading } = useAuth();
  const [activeNav, setActiveNav] = useState<ActiveNav>('products');

  if (isLoading) {
    return (
      <div
        style={{
          width: '100vw',
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0f172a',
          color: '#ffffff',
          gap: 16,
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 8,
            backgroundColor: '#0d9488',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Smartphone size={28} color="#ffffff" />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '14px', color: '#cbd5e1' }}>
          <Loader2 size={16} className="spinner" style={{ animation: 'spin 1s linear infinite' }} />
          <span>Đang kết nối hệ thống QLCHDT...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <AppLayout activeNav={activeNav} onNavigate={setActiveNav}>
      <PageLoadBoundary>
        <Suspense fallback={<div role="status" style={{ padding: 24, color: 'var(--slate-600)' }}>Đang tải chức năng...</div>}>
          {activeNav === 'pos' && <POSPage />}
          {activeNav === 'sales' && <SalesPage />}
          {activeNav === 'purchases' && <PurchasesPage />}
          {activeNav === 'warranties' && <WarrantiesPage />}
          {activeNav === 'cashbook' && <CashbookPage />}
          {activeNav === 'reports' && <ReportsPage />}
          {activeNav === 'products' && <ProductsPage />}
          {activeNav === 'customers' && <CustomersPage />}
          {activeNav === 'suppliers' && <SuppliersPage />}
        </Suspense>
      </PageLoadBoundary>
    </AppLayout>
  );
};

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <NetworkProvider>
          <AuthProvider>
            <MainContent />
          </AuthProvider>
        </NetworkProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
};

export default App;
