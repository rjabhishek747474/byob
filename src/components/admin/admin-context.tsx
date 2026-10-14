'use client';

import React, { createContext, useContext, useState } from 'react';

export interface TenantInfo {
  id: string;
  name: string;
  slug: string;
  plan: 'Starter' | 'Growth' | 'Pro' | 'Enterprise';
  status: 'active' | 'suspended' | 'archived';
  productsCount: number;
  ordersCount: number;
  revenueMinorUnits: number; // GMV in paise (e.g. 64500000 = ₹6,45,000)
  profitMinorUnits: number;  // Store net profit in paise (e.g. 38700000 = ₹3,87,000)
  platformCommissionRate: number; // e.g. 0.02 (2.0%)
  monthlyPlanFeeMinorUnits: number; // e.g. 249900 = ₹2,499
  billingStatus: 'paid' | 'pending' | 'due';
  customDomain?: string;
  deliveredOrders: number;
  shippedOrders: number;
  processingOrders: number;
  pendingOrders: number;
  customersCount: number;
}

export interface AdminContextValue {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  currentTenant: TenantInfo;
  setCurrentTenant: (tenant: TenantInfo) => void;
  tenantsList: TenantInfo[];
  updateTenantStatus: (id: string, status: 'active' | 'suspended' | 'archived') => void;
  addTenant: (tenant: TenantInfo) => void;
  isPlatformAdmin: boolean;
  setIsPlatformAdmin: (isAdmin: boolean) => void;
}

export const defaultTenantsList: TenantInfo[] = [
  {
    id: 'tenant_01JADMIN000000000000000001',
    name: 'Urban Style & Apparel',
    slug: 'urban-style',
    plan: 'Growth',
    status: 'active',
    productsCount: 42,
    ordersCount: 318,
    revenueMinorUnits: 64500000, // ₹6,45,000
    profitMinorUnits: 38700000,  // ₹3,87,000
    platformCommissionRate: 0.025, // 2.5%
    monthlyPlanFeeMinorUnits: 249900, // ₹2,499/mo
    billingStatus: 'paid',
    customDomain: 'urbanstyle.store',
    deliveredOrders: 274,
    shippedOrders: 28,
    processingOrders: 11,
    pendingOrders: 5,
    customersCount: 184,
  },
  {
    id: 'tenant_01JADMIN000000000000000002',
    name: 'Artisan Crafts Co.',
    slug: 'artisan-crafts',
    plan: 'Pro',
    status: 'active',
    productsCount: 19,
    ordersCount: 94,
    revenueMinorUnits: 21500000, // ₹2,15,000
    profitMinorUnits: 12900000,  // ₹1,29,000
    platformCommissionRate: 0.02,  // 2.0%
    monthlyPlanFeeMinorUnits: 499900, // ₹4,999/mo
    billingStatus: 'paid',
    customDomain: 'artisancrafts.in',
    deliveredOrders: 82,
    shippedOrders: 7,
    processingOrders: 3,
    pendingOrders: 2,
    customersCount: 68,
  },
  {
    id: 'tenant_01JADMIN000000000000000003',
    name: 'Bloom Floral Studio',
    slug: 'bloom-flowers',
    plan: 'Starter',
    status: 'active',
    productsCount: 15,
    ordersCount: 62,
    revenueMinorUnits: 14800000, // ₹1,48,000
    profitMinorUnits: 7400000,   // ₹74,000
    platformCommissionRate: 0.03,  // 3.0%
    monthlyPlanFeeMinorUnits: 99900, // ₹999/mo
    billingStatus: 'due',
    deliveredOrders: 54,
    shippedOrders: 4,
    processingOrders: 2,
    pendingOrders: 2,
    customersCount: 45,
  },
  {
    id: 'tenant_01JADMIN000000000000000004',
    name: 'Apex Sports Equipment',
    slug: 'apex-sports',
    plan: 'Enterprise',
    status: 'suspended',
    productsCount: 120,
    ordersCount: 840,
    revenueMinorUnits: 185000000, // ₹18,50,000
    profitMinorUnits: 92500000,   // ₹92,50,000
    platformCommissionRate: 0.015,  // 1.5%
    monthlyPlanFeeMinorUnits: 1299900, // ₹12,999/mo
    billingStatus: 'pending',
    customDomain: 'apexsports.io',
    deliveredOrders: 790,
    shippedOrders: 32,
    processingOrders: 12,
    pendingOrders: 6,
    customersCount: 520,
  },
];

const AdminContext = createContext<AdminContextValue | undefined>(undefined);

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tenantsList, setTenantsList] = useState<TenantInfo[]>(defaultTenantsList);
  const [currentTenant, setCurrentTenant] = useState<TenantInfo>(defaultTenantsList[0]);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(true);

  const toggleSidebar = () => {
    setSidebarOpen((prev) => !prev);
  };

  const updateTenantStatus = (id: string, status: 'active' | 'suspended' | 'archived') => {
    setTenantsList((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        const updated = { ...t, status };
        if (currentTenant.id === id) {
          setCurrentTenant(updated);
        }
        return updated;
      })
    );
  };

  const addTenant = (tenant: TenantInfo) => {
    setTenantsList((prev) => [tenant, ...prev]);
  };

  return (
    <AdminContext.Provider
      value={{
        sidebarOpen,
        setSidebarOpen,
        toggleSidebar,
        currentTenant,
        setCurrentTenant,
        tenantsList,
        updateTenantStatus,
        addTenant,
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
