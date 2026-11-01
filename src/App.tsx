import React, { useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/query-client';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppLayout } from './components/layout/AppLayout';
import type { ActiveNav } from './components/layout/Sidebar';
import { LoginPage } from './features/auth/LoginPage';
import { ProductsPage } from './features/products/ProductsPage';
import { CustomersPage } from './features/customers/CustomersPage';
import { SuppliersPage } from './features/suppliers/SuppliersPage';
import { PurchasesPage } from './features/inventory/PurchasesPage';
import { Smartphone, Loader2 } from 'lucide-react';

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
      {activeNav === 'purchases' && <PurchasesPage />}
      {activeNav === 'products' && <ProductsPage />}
      {activeNav === 'customers' && <CustomersPage />}
      {activeNav === 'suppliers' && <SuppliersPage />}
    </AppLayout>
  );
};

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>
          <MainContent />
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
};

export default App;
