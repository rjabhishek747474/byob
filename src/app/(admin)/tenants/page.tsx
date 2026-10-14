'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2,
  Plus,
  Search,
  ExternalLink,
  CheckCircle,
  AlertTriangle,
  Store,
  Sparkles,
  Receipt,
  IndianRupee,
  Package,
  ShoppingCart,
  TrendingUp,
  FileText,
  CreditCard,
  Send,
  Eye,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAdminContext, TenantInfo } from '@/components/admin/admin-context';
import { formatMoney, createMoney } from '@/lib/money';

export default function PlatformTenantsPage() {
  const router = useRouter();
  const {
    currentTenant,
    setCurrentTenant,
    tenantsList,
    updateTenantStatus,
    addTenant,
  } = useAdminContext();

  const [searchQuery, setSearchQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<'all' | 'active' | 'suspended' | 'archived'>('all');
  const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false);
  const [selectedInvoiceTenant, setSelectedInvoiceTenant] = React.useState<TenantInfo | null>(null);
  const [toastMessage, setToastMessage] = React.useState<string | null>(null);

  // New Tenant Form state
  const [newName, setNewName] = React.useState('');
  const [newSlug, setNewSlug] = React.useState('');
  const [newPlan, setNewPlan] = React.useState<'Starter' | 'Growth' | 'Pro' | 'Enterprise'>('Growth');
  const [newDomain, setNewDomain] = React.useState('');

  // Platform Aggregations for the SaaS Owner
  const totalStores = tenantsList.length;
  const activeStores = tenantsList.filter((t) => t.status === 'active').length;
  const totalEcosystemGMVMinorUnits = tenantsList.reduce((acc, t) => acc + t.revenueMinorUnits, 0);
  const totalEcosystemOrders = tenantsList.reduce((acc, t) => acc + t.ordersCount, 0);
  const totalEcosystemProducts = tenantsList.reduce((acc, t) => acc + t.productsCount, 0);

  // Platform Company SaaS Earnings (Monthly Subscriptions + Commission)
  const totalSubscriptionFeesMinorUnits = tenantsList.reduce(
    (acc, t) => acc + (t.status === 'active' ? t.monthlyPlanFeeMinorUnits : 0),
    0
  );
  const totalCommissionFeesMinorUnits = tenantsList.reduce(
    (acc, t) => acc + Math.round(t.revenueMinorUnits * t.platformCommissionRate),
    0
  );
  const totalPlatformEarningsMinorUnits = totalSubscriptionFeesMinorUnits + totalCommissionFeesMinorUnits;

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

  const planPricingMap: Record<'Starter' | 'Growth' | 'Pro' | 'Enterprise', { feeMinor: number; commission: number }> = {
    Starter: { feeMinor: 99900, commission: 0.03 },
    Growth: { feeMinor: 249900, commission: 0.025 },
    Pro: { feeMinor: 499900, commission: 0.02 },
    Enterprise: { feeMinor: 1299900, commission: 0.015 },
  };

  const handleCreateTenant = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newSlug.trim()) return;

    const pricing = planPricingMap[newPlan];
    const newTenant: TenantInfo = {
      id: `tenant_${Date.now().toString(36)}`,
      name: newName.trim(),
      slug: newSlug.trim().toLowerCase(),
      plan: newPlan,
      status: 'active',
      productsCount: 0,
      ordersCount: 0,
      revenueMinorUnits: 0,
      profitMinorUnits: 0,
      platformCommissionRate: pricing.commission,
      monthlyPlanFeeMinorUnits: pricing.feeMinor,
      billingStatus: 'pending',
      customDomain: newDomain.trim() || undefined,
      deliveredOrders: 0,
      shippedOrders: 0,
      processingOrders: 0,
      pendingOrders: 0,
      customersCount: 0,
    };

    addTenant(newTenant);
    setIsCreateModalOpen(false);
    setToastMessage(`Client store "${newTenant.name}" successfully provisioned!`);
    setTimeout(() => setToastMessage(null), 4000);

    setNewName('');
    setNewSlug('');
    setNewDomain('');
  };

  const handleSwitchToStoreAdmin = (tenant: TenantInfo) => {
    setCurrentTenant(tenant);
    setToastMessage(`Switched active context to ${tenant.name}. Redirecting to Store Dashboard...`);
    setTimeout(() => {
      router.push('/dashboard');
    }, 600);
  };

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-800 flex items-center gap-2 shadow-sm animate-fade-in">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Company Admin Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-gray-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider bg-blue-600 text-white px-2.5 py-0.5 rounded-full">
              SaaS Owner Panel
            </span>
            <span className="text-xs font-medium text-gray-500">Platform Company View</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl mt-1 flex items-center gap-2.5">
            <Building2 className="w-7 h-7 text-blue-600" />
            <span>Client Stores & Tenant Billing</span>
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Track all client store products, orders, GMV sales, and billable platform revenue/commission.
          </p>
        </div>

        <Button onClick={() => setIsCreateModalOpen(true)} className="flex items-center gap-1.5 self-start sm:self-auto">
          <Plus className="w-4 h-4" />
          <span>Provision New Store</span>
        </Button>
      </div>

      {/* Top Company KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Platform Stores */}
        <Card className="border-gray-200 shadow-sm bg-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between text-gray-500">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Total Client Brands</span>
              <Store className="w-4 h-4 text-blue-600" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-gray-900">{totalStores} Stores</span>
              <span className="text-xs font-semibold text-emerald-600">{activeStores} active</span>
            </div>
            <p className="mt-1 text-xs text-gray-400 font-mono">{totalEcosystemProducts} total catalog products</p>
          </CardContent>
        </Card>

        {/* Total Ecosystem GMV */}
        <Card className="border-gray-200 shadow-sm bg-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between text-gray-500">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Total Client Sales (GMV)</span>
              <TrendingUp className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-gray-900">
                {formatMoney(createMoney(totalEcosystemGMVMinorUnits, 'INR'))}
              </span>
            </div>
            <p className="mt-1 text-xs text-gray-400 font-mono">{totalEcosystemOrders} orders processed across all stores</p>
          </CardContent>
        </Card>

        {/* Company SaaS Earnings (Monthly Fees + Commission) */}
        <Card className="border-blue-200 shadow-sm bg-gradient-to-br from-blue-50/60 to-indigo-50/50">
          <CardContent className="p-5">
            <div className="flex items-center justify-between text-blue-700">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-900">Your Platform Earnings</span>
              <IndianRupee className="w-4 h-4 text-blue-700" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-blue-950">
                {formatMoney(createMoney(totalPlatformEarningsMinorUnits, 'INR'))}
              </span>
            </div>
            <p className="mt-1 text-xs text-blue-800/80 font-medium">
              Plans: {formatMoney(createMoney(totalSubscriptionFeesMinorUnits, 'INR'))} + Cut: {formatMoney(createMoney(totalCommissionFeesMinorUnits, 'INR'))}
            </p>
          </CardContent>
        </Card>

        {/* Total Orders Handled */}
        <Card className="border-gray-200 shadow-sm bg-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between text-gray-500">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Total Orders Fulfilled</span>
              <ShoppingCart className="w-4 h-4 text-purple-600" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-gray-900">{totalEcosystemOrders.toLocaleString()}</span>
              <span className="text-xs font-semibold text-emerald-600">All Stores</span>
            </div>
            <p className="mt-1 text-xs text-gray-400 font-mono">Real-time fulfillment tracking</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card>
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search stores by brand name, slug, or domain..."
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

      {/* Tenant Performance & Billing Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase text-gray-500 font-semibold">
                <tr>
                  <th scope="col" className="px-5 py-3.5">Client Store</th>
                  <th scope="col" className="px-4 py-3.5">Catalog</th>
                  <th scope="col" className="px-4 py-3.5">Orders</th>
                  <th scope="col" className="px-4 py-3.5">Store Revenue (GMV)</th>
                  <th scope="col" className="px-4 py-3.5">Plan & Fee</th>
                  <th scope="col" className="px-4 py-3.5">Commission Cut</th>
                  <th scope="col" className="px-4 py-3.5 font-bold text-gray-900">Total Billable</th>
                  <th scope="col" className="px-4 py-3.5">Status</th>
                  <th scope="col" className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredTenants.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-12 text-center text-gray-500">
                      <Building2 className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                      <p className="font-semibold text-gray-900">No stores found</p>
                      <p className="text-xs text-gray-500 mt-0.5">Try adjusting your search criteria.</p>
                    </td>
                  </tr>
                ) : (
                  filteredTenants.map((tenant) => {
                    const isCurrent = currentTenant.id === tenant.id;
                    const commissionAmount = Math.round(tenant.revenueMinorUnits * tenant.platformCommissionRate);
                    const totalBillableAmount = tenant.monthlyPlanFeeMinorUnits + commissionAmount;
                    const liveWebsiteUrl = `http://localhost:3000/?tenant=${tenant.slug}`;

                    return (
                      <tr key={tenant.id} className="hover:bg-gray-50/80 transition-colors">
                        {/* Store Info */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center font-bold text-sm shadow-sm shrink-0">
                              {tenant.name.charAt(0)}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-gray-900">{tenant.name}</span>
                                {isCurrent && (
                                  <span className="text-[10px] font-bold uppercase bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                                    Active Now
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

                        {/* Catalog */}
                        <td className="px-4 py-4 font-mono text-gray-800 text-xs">
                          {tenant.productsCount} products
                        </td>

                        {/* Orders */}
                        <td className="px-4 py-4">
                          <div className="font-mono text-gray-900 font-medium text-xs">
                            {tenant.ordersCount} orders
                          </div>
                          <div className="text-[11px] text-gray-400">
                            {tenant.deliveredOrders} delivered
                          </div>
                        </td>

                        {/* Store Sales (GMV) */}
                        <td className="px-4 py-4">
                          <span className="font-semibold text-gray-900 text-xs">
                            {formatMoney(createMoney(tenant.revenueMinorUnits, 'INR'))}
                          </span>
                        </td>

                        {/* Plan & Monthly Fee */}
                        <td className="px-4 py-4">
                          <Badge variant="outline" className="font-medium text-[11px] border-blue-300 text-blue-700 bg-blue-50/40">
                            {tenant.plan}
                          </Badge>
                          <div className="text-[11px] text-gray-500 mt-1">
                            {formatMoney(createMoney(tenant.monthlyPlanFeeMinorUnits, 'INR'))}/mo
                          </div>
                        </td>

                        {/* Platform Commission Cut */}
                        <td className="px-4 py-4 text-xs font-mono text-gray-600">
                          <div>{(tenant.platformCommissionRate * 100).toFixed(1)}% cut</div>
                          <div className="font-semibold text-gray-800">
                            {formatMoney(createMoney(commissionAmount, 'INR'))}
                          </div>
                        </td>

                        {/* Total Billable to Client */}
                        <td className="px-4 py-4">
                          <div className="font-bold text-blue-900 text-xs">
                            {formatMoney(createMoney(totalBillableAmount, 'INR'))}
                          </div>
                          <span
                            className={`inline-block mt-0.5 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                              tenant.billingStatus === 'paid'
                                ? 'bg-emerald-100 text-emerald-800'
                                : tenant.billingStatus === 'due'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {tenant.billingStatus}
                          </span>
                        </td>

                        {/* Store Status */}
                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${
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

                        {/* Actions */}
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* View Live Storefront Website */}
                            <a
                              href={liveWebsiteUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-medium text-gray-700 hover:text-blue-600 bg-white border border-gray-200 hover:bg-gray-50 px-2 py-1 rounded shadow-xs transition-colors"
                              title="Open this client's live website"
                            >
                              <ExternalLink className="w-3 h-3 text-gray-500" />
                              <span>Live Site</span>
                            </a>

                            {/* View Bill / Invoice Details */}
                            <button
                              onClick={() => setSelectedInvoiceTenant(tenant)}
                              className="inline-flex items-center gap-1 text-xs font-medium text-gray-700 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded transition-colors"
                              title="Inspect billing calculation & invoice"
                            >
                              <Receipt className="w-3 h-3 text-gray-500" />
                              <span>Bill</span>
                            </button>

                            {/* Switch to this tenant's admin dashboard */}
                            <button
                              onClick={() => handleSwitchToStoreAdmin(tenant)}
                              className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-white bg-blue-50 hover:bg-blue-600 px-2.5 py-1 rounded transition-colors"
                              title="Switch to this store's admin panel"
                            >
                              <Store className="w-3 h-3" />
                              <span>Store Admin</span>
                            </button>

                            {/* Suspend / Activate Toggle */}
                            <button
                              onClick={() =>
                                updateTenantStatus(
                                  tenant.id,
                                  tenant.status === 'active' ? 'suspended' : 'active'
                                )
                              }
                              className={`text-[11px] font-medium px-2 py-1 rounded transition-colors ${
                                tenant.status === 'active'
                                  ? 'text-amber-700 hover:bg-amber-50'
                                  : 'text-emerald-700 hover:bg-emerald-50'
                              }`}
                              title={tenant.status === 'active' ? 'Suspend store' : 'Activate store'}
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

      {/* Invoice / Billing Breakdown Modal */}
      {selectedInvoiceTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden border border-gray-200">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-gray-900">Tenant Billing Statement</h3>
                  <p className="text-xs text-gray-500 font-mono">
                    Client: {selectedInvoiceTenant.name} ({selectedInvoiceTenant.slug})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedInvoiceTenant(null)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold leading-none p-1"
              >
                &times;
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="rounded-lg bg-blue-50/60 border border-blue-100 p-3.5 flex justify-between items-center text-xs">
                <div>
                  <span className="font-bold text-blue-900 uppercase">Billing Cycle:</span>{' '}
                  <span className="text-blue-800">October 2026</span>
                </div>
                <div>
                  <Badge variant="outline" className="border-blue-300 text-blue-800 bg-white">
                    {selectedInvoiceTenant.plan} Tier
                  </Badge>
                </div>
              </div>

              {/* Itemized Calculations */}
              <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 text-xs">
                <div className="p-3 flex justify-between items-center">
                  <div>
                    <p className="font-semibold text-gray-900">{selectedInvoiceTenant.plan} Subscription Plan</p>
                    <p className="text-gray-400 text-[11px]">Monthly fixed SaaS platform hosting & builder license</p>
                  </div>
                  <span className="font-mono font-medium text-gray-900">
                    {formatMoney(createMoney(selectedInvoiceTenant.monthlyPlanFeeMinorUnits, 'INR'))}
                  </span>
                </div>

                <div className="p-3 flex justify-between items-center">
                  <div>
                    <p className="font-semibold text-gray-900">
                      Platform Transaction Fee ({(selectedInvoiceTenant.platformCommissionRate * 100).toFixed(1)}%)
                    </p>
                    <p className="text-gray-400 text-[11px]">
                      Applied on {selectedInvoiceTenant.ordersCount} orders (GMV:{' '}
                      {formatMoney(createMoney(selectedInvoiceTenant.revenueMinorUnits, 'INR'))})
                    </p>
                  </div>
                  <span className="font-mono font-medium text-gray-900">
                    {formatMoney(
                      createMoney(
                        Math.round(selectedInvoiceTenant.revenueMinorUnits * selectedInvoiceTenant.platformCommissionRate),
                        'INR'
                      )
                    )}
                  </span>
                </div>

                <div className="p-3 bg-gray-50 flex justify-between items-center font-bold text-sm text-gray-900">
                  <span>Total Billable to Client</span>
                  <span className="text-blue-900">
                    {formatMoney(
                      createMoney(
                        selectedInvoiceTenant.monthlyPlanFeeMinorUnits +
                          Math.round(selectedInvoiceTenant.revenueMinorUnits * selectedInvoiceTenant.platformCommissionRate),
                        'INR'
                      )
                    )}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-gray-500 pt-2">
                <span>Payment Status:</span>
                <span className="font-bold uppercase text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                  {selectedInvoiceTenant.billingStatus}
                </span>
              </div>
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedInvoiceTenant(null)}
              >
                Close
              </Button>
              <Button
                size="sm"
                className="flex items-center gap-1.5"
                onClick={() => {
                  alert(`Invoice sent to ${selectedInvoiceTenant.name} billing contact!`);
                  setSelectedInvoiceTenant(null);
                }}
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send Bill to Client</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Provision New Store Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full overflow-hidden border border-gray-200">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg text-gray-900">Provision New Client Store</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Creates an isolated tenant partition, default theme, and storefront.
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
                  Store / Brand Name *
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
                  Store Subdomain Slug *
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
                  Custom Vanity Domain (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. www.velvetandoak.com"
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                  Subscription Tier & Commission Rate
                </label>
                <select
                  value={newPlan}
                  onChange={(e) => setNewPlan(e.target.value as any)}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="Starter">Starter (₹999/mo + 3.0% platform commission)</option>
                  <option value="Growth">Growth (₹2,499/mo + 2.5% platform commission)</option>
                  <option value="Pro">Pro (₹4,999/mo + 2.0% platform commission)</option>
                  <option value="Enterprise">Enterprise (₹12,999/mo + 1.5% platform commission)</option>
                </select>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-gray-100">
                <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Provision Store</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
