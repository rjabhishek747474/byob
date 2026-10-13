'use client';

import * as React from 'react';
import {
  Building2,
  Plus,
  Search,
  ExternalLink,
  CheckCircle,
  AlertTriangle,
  Archive,
  Store,
  Layers,
  Sparkles,
  Users,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAdminContext } from '@/components/admin/admin-context';

export interface TenantRecord {
  id: string;
  name: string;
  slug: string;
  plan: 'Starter' | 'Growth' | 'Pro' | 'Enterprise';
  status: 'active' | 'suspended' | 'archived';
  customDomain?: string;
  productsCount: number;
  ordersCount: number;
  createdAt: string;
}

const initialTenants: TenantRecord[] = [
  {
    id: 'tenant_01JADMIN000000000000000001',
    name: 'Urban Style & Apparel',
    slug: 'urban-style',
    plan: 'Growth',
    status: 'active',
    customDomain: 'urbanstyle.store',
    productsCount: 42,
    ordersCount: 318,
    createdAt: '2026-01-15T08:00:00Z',
  },
  {
    id: 'tenant_01JADMIN000000000000000002',
    name: 'Artisan Crafts Co.',
    slug: 'artisan-crafts',
    plan: 'Pro',
    status: 'active',
    customDomain: 'artisancrafts.in',
    productsCount: 19,
    ordersCount: 94,
    createdAt: '2026-02-01T10:30:00Z',
  },
  {
    id: 'tenant_01JADMIN000000000000000003',
    name: 'Bloom Floral Studio',
    slug: 'bloom-flowers',
    plan: 'Starter',
    status: 'active',
    productsCount: 15,
    ordersCount: 62,
    createdAt: '2026-03-10T14:15:00Z',
  },
  {
    id: 'tenant_01JADMIN000000000000000004',
    name: 'Apex Sports Equipment',
    slug: 'apex-sports',
    plan: 'Enterprise',
    status: 'suspended',
    customDomain: 'apexsports.io',
    productsCount: 120,
    ordersCount: 840,
    createdAt: '2025-11-20T09:00:00Z',
  },
];

export default function TenantsPage() {
  const { currentTenant, setCurrentTenant } = useAdminContext();
  const [tenantsList, setTenantsList] = React.useState<TenantRecord[]>(initialTenants);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<'all' | 'active' | 'suspended' | 'archived'>('all');
  const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false);
  const [successToast, setSuccessToast] = React.useState<string | null>(null);

  // New Tenant Form state
  const [newName, setNewName] = React.useState('');
  const [newSlug, setNewSlug] = React.useState('');
  const [newPlan, setNewPlan] = React.useState<'Starter' | 'Growth' | 'Pro' | 'Enterprise'>('Growth');
  const [newEmail, setNewEmail] = React.useState('');

  const filteredTenants = tenantsList.filter((tenant) => {
    const matchesSearch =
      tenant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tenant.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (tenant.customDomain && tenant.customDomain.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || tenant.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleNameChange = (val: string) => {
    setNewName(val);
    if (!newSlug || newSlug === newName.toLowerCase().replace(/[^a-z0-9]/g, '-')) {
      setNewSlug(val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
    }
  };

  const handleCreateTenant = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newSlug.trim()) return;

    const newTenant: TenantRecord = {
      id: `tenant_${Date.now().toString(36)}`,
      name: newName.trim(),
      slug: newSlug.trim().toLowerCase(),
      plan: newPlan,
      status: 'active',
      productsCount: 0,
      ordersCount: 0,
      createdAt: new Date().toISOString(),
    };

    setTenantsList((prev) => [newTenant, ...prev]);
    setIsCreateModalOpen(false);
    setSuccessToast(`Tenant "${newTenant.name}" successfully created!`);
    setTimeout(() => setSuccessToast(null), 4000);

    // Reset form
    setNewName('');
    setNewSlug('');
    setNewEmail('');
  };

  const handleToggleStatus = (id: string) => {
    setTenantsList((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        const newStatus = t.status === 'active' ? 'suspended' : 'active';
        return { ...t, status: newStatus };
      })
    );
  };

  const handleSwitchTenant = (tenant: TenantRecord) => {
    setCurrentTenant({
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      plan: tenant.plan,
    });
    setSuccessToast(`Switched active context to ${tenant.name}`);
    setTimeout(() => setSuccessToast(null), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Toast Feedback */}
      {successToast && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-800 flex items-center gap-2 shadow-sm animate-fade-in">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl flex items-center gap-2.5">
            <Building2 className="w-7 h-7 text-blue-600" />
            <span>Platform Tenants</span>
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Provision, monitor, and manage multi-tenant e-commerce client brands and isolated stores.
          </p>
        </div>

        <Button onClick={() => setIsCreateModalOpen(true)} className="flex items-center gap-1.5 self-start sm:self-auto">
          <Plus className="w-4 h-4" />
          <span>Create Tenant</span>
        </Button>
      </div>

      {/* Active Context Banner */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/80 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-base shadow-sm">
            {currentTenant.name.charAt(0)}
          </div>
          <div>
            <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Active Workspace Tenant</p>
            <h3 className="font-bold text-gray-900 text-base">{currentTenant.name}</h3>
            <p className="text-xs text-gray-500 font-mono">slug: {currentTenant.slug} • Plan: {currentTenant.plan}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`http://localhost:3000?tenant=${currentTenant.slug}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 bg-white border border-blue-200 px-3 py-1.5 rounded-lg shadow-sm hover:bg-blue-50 transition-colors"
          >
            <Store className="w-3.5 h-3.5" />
            <span>Open Storefront</span>
            <ExternalLink className="w-3 h-3 text-gray-400" />
          </a>
        </div>
      </div>

      {/* Filters & Search */}
      <Card>
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name, slug, or custom domain..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
              {(['all', 'active', 'suspended', 'archived'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg capitalize transition-colors ${
                    statusFilter === status
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tenants Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase text-gray-500 font-semibold">
                <tr>
                  <th scope="col" className="px-6 py-3.5">Brand / Store</th>
                  <th scope="col" className="px-6 py-3.5">Plan</th>
                  <th scope="col" className="px-6 py-3.5">Status</th>
                  <th scope="col" className="px-6 py-3.5">Catalog</th>
                  <th scope="col" className="px-6 py-3.5">Orders</th>
                  <th scope="col" className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredTenants.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      <Building2 className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                      <p className="font-semibold text-gray-900">No tenants found</p>
                      <p className="text-xs text-gray-500 mt-0.5">Try adjusting your search terms or filter.</p>
                    </td>
                  </tr>
                ) : (
                  filteredTenants.map((tenant) => {
                    const isCurrent = currentTenant.id === tenant.id;
                    return (
                      <tr key={tenant.id} className="hover:bg-gray-50/80 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-gray-100 border border-gray-200 text-gray-700 flex items-center justify-center font-bold text-sm">
                              {tenant.name.charAt(0)}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-gray-900">{tenant.name}</span>
                                {isCurrent && (
                                  <span className="text-[10px] font-bold uppercase bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                                    Current
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400 font-mono">
                                <span>slug: {tenant.slug}</span>
                                {tenant.customDomain && (
                                  <>
                                    <span>•</span>
                                    <span className="text-gray-500">{tenant.customDomain}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          <Badge variant="outline" className="font-medium text-xs">
                            {tenant.plan}
                          </Badge>
                        </td>

                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full capitalize ${
                              tenant.status === 'active'
                                ? 'bg-emerald-50 text-emerald-700'
                                : tenant.status === 'suspended'
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                tenant.status === 'active'
                                  ? 'bg-emerald-500'
                                  : tenant.status === 'suspended'
                                  ? 'bg-amber-500'
                                  : 'bg-gray-400'
                              }`}
                            />
                            {tenant.status}
                          </span>
                        </td>

                        <td className="px-6 py-4 font-mono text-gray-700 text-xs">
                          {tenant.productsCount} items
                        </td>

                        <td className="px-6 py-4 font-mono text-gray-700 text-xs">
                          {tenant.ordersCount}
                        </td>

                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {!isCurrent && (
                              <button
                                onClick={() => handleSwitchTenant(tenant)}
                                className="text-xs font-medium text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded transition-colors"
                              >
                                Switch To
                              </button>
                            )}

                            <button
                              onClick={() => handleToggleStatus(tenant.id)}
                              className={`text-xs font-medium px-2.5 py-1 rounded transition-colors ${
                                tenant.status === 'active'
                                  ? 'text-amber-700 hover:bg-amber-50'
                                  : 'text-emerald-700 hover:bg-emerald-50'
                              }`}
                            >
                              {tenant.status === 'active' ? 'Suspend' : 'Activate'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Provision New Tenant Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full overflow-hidden border border-gray-200">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg text-gray-900">Provision New Tenant</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Creates an isolated tenant database partition, default theme, and starter storefront.
                </p>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold leading-none p-1"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateTenant} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                  Tenant / Brand Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Velvet & Oak Home"
                  value={newName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                  Subdomain / Slug *
                </label>
                <div className="flex rounded-lg shadow-sm">
                  <input
                    type="text"
                    required
                    placeholder="velvet-oak"
                    value={newSlug}
                    onChange={(e) => setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    className="flex-1 text-sm border border-gray-300 rounded-l-lg px-3 py-2 font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <span className="inline-flex items-center px-3 rounded-r-lg border border-l-0 border-gray-300 bg-gray-50 text-gray-500 text-xs font-mono">
                    .byob.store
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                  Owner Email
                </label>
                <input
                  type="email"
                  placeholder="owner@brand.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                  Subscription Tier
                </label>
                <select
                  value={newPlan}
                  onChange={(e) => setNewPlan(e.target.value as any)}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="Starter">Starter (Up to 50 products)</option>
                  <option value="Growth">Growth (Up to 500 products)</option>
                  <option value="Pro">Pro (Unlimited products + Custom domains)</option>
                  <option value="Enterprise">Enterprise (Dedicated AWS partition)</option>
                </select>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-gray-100">
                <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Provision Tenant</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
