'use client';

import React, { createContext, useContext, useState } from 'react';

export interface TenantInfo {
  id: string;
  name: string;
  slug: string;
  plan: string;
}

export interface AdminContextValue {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  currentTenant: TenantInfo;
  setCurrentTenant: (tenant: TenantInfo) => void;
  tenantsList: TenantInfo[];
  isPlatformAdmin: boolean;
  setIsPlatformAdmin: (isAdmin: boolean) => void;
}

const defaultTenant: TenantInfo = {
  id: 'tenant_01JADMIN000000000000000001',
  name: 'Acme Outfitters',
  slug: 'acme-outfitters',
  plan: 'Growth',
};

const defaultTenantsList: TenantInfo[] = [
  {
    id: 'tenant_01JADMIN000000000000000001',
    name: 'Acme Outfitters',
    slug: 'acme-outfitters',
    plan: 'Growth',
  },
  {
    id: 'tenant_01JADMIN000000000000000002',
    name: 'Urban Kicks',
    slug: 'urban-kicks',
    plan: 'Pro',
  },
  {
    id: 'tenant_01JADMIN000000000000000003',
    name: 'Artisan Coffee Roasters',
    slug: 'artisan-coffee',
    plan: 'Starter',
  },
];

const AdminContext = createContext<AdminContextValue | undefined>(undefined);

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentTenant, setCurrentTenant] = useState<TenantInfo>(defaultTenant);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(true);

  const toggleSidebar = () => {
    setSidebarOpen((prev) => !prev);
  };

  return (
    <AdminContext.Provider
      value={{
        sidebarOpen,
        setSidebarOpen,
        toggleSidebar,
        currentTenant,
        setCurrentTenant,
        tenantsList: defaultTenantsList,
        isPlatformAdmin,
        setIsPlatformAdmin,
      }}
    >
      {children}
    </AdminContext.Provider>
  );
}

export function useAdminContext(): AdminContextValue {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error('useAdminContext must be used within an AdminProvider');
  }
  return context;
}
