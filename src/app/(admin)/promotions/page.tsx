'use client';

import * as React from 'react';
import {
  Tag,
  Plus,
  Trash2,
  CheckCircle,
  XCircle,
  Ticket,
  Calendar,
  Percent,
  IndianRupee,
  Search,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { createMoney, formatMoney } from '@/lib/money';

interface CouponItem {
  id: string;
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minSubtotal: number;
  maxUses: number | null;
  usedCount: number;
  perCustomerLimit: number;
  startsAt: string | null;
  expiresAt: string | null;
  isActive: boolean;
}

const mockCoupons: CouponItem[] = [
  {
    id: 'coup_01',
    code: 'WELCOME10',
    discountType: 'percentage',
    discountValue: 10,
    minSubtotal: 49900,
    maxUses: 500,
    usedCount: 142,
    perCustomerLimit: 1,
    startsAt: '2026-01-01T00:00:00Z',
    expiresAt: '2026-12-31T23:59:59Z',
    isActive: true,
  },
  {
    id: 'coup_02',
    code: 'FESTIVE250',
    discountType: 'fixed',
    discountValue: 25000,
    minSubtotal: 199900,
    maxUses: 200,
    usedCount: 88,
    perCustomerLimit: 2,
    startsAt: '2026-10-01T00:00:00Z',
    expiresAt: '2026-11-15T23:59:59Z',
    isActive: true,
  },
  {
    id: 'coup_03',
    code: 'VIP50',
    discountType: 'percentage',
    discountValue: 50,
    minSubtotal: 499900,
    maxUses: 50,
    usedCount: 50,
    perCustomerLimit: 1,
    startsAt: '2026-08-01T00:00:00Z',
    expiresAt: '2026-09-01T23:59:59Z',
    isActive: false,
  },
];

export default function PromotionsPage() {
  const [couponsList, setCouponsList] = React.useState<CouponItem[]>(mockCoupons);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);

  // Form states
  const [formCode, setFormCode] = React.useState('');
  const [formType, setFormType] = React.useState<'percentage' | 'fixed'>('percentage');
  const [formValue, setFormValue] = React.useState<number>(10);
  const [formMinSubtotalRupees, setFormMinSubtotalRupees] = React.useState<number>(0);
  const [formMaxUses, setFormMaxUses] = React.useState<string>('');
  const [formPerCustomer, setFormPerCustomer] = React.useState<number>(1);
  const [formExpiresAt, setFormExpiresAt] = React.useState<string>('');

  const filteredCoupons = couponsList.filter((c) =>
    c.code.toLowerCase().includes(searchTerm.toLowerCase().trim())
  );

  const handleCreateCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCode.trim()) return;

    // Convert fixed amount or min subtotal from Rupees to minor units (x100)
    const discountValue = formType === 'fixed' ? formValue * 100 : formValue;
    const minSubtotal = Math.round(formMinSubtotalRupees * 100);

    const newCoupon: CouponItem = {
      id: `coup_${Date.now()}`,
      code: formCode.trim().toUpperCase(),
      discountType: formType,
      discountValue,
      minSubtotal,
      maxUses: formMaxUses ? Number(formMaxUses) : null,
      usedCount: 0,
      perCustomerLimit: formPerCustomer || 1,
      startsAt: new Date().toISOString(),
      expiresAt: formExpiresAt ? new Date(formExpiresAt).toISOString() : null,
      isActive: true,
    };

    setCouponsList([newCoupon, ...couponsList]);
    setIsCreateOpen(false);
    setFormCode('');
    setFormValue(10);
    setFormMinSubtotalRupees(0);
    setFormMaxUses('');
    setFormExpiresAt('');
  };

  const handleToggleStatus = (id: string) => {
    setCouponsList(
      couponsList.map((c) => (c.id === id ? { ...c, isActive: !c.isActive } : c))
    );
  };

  const handleDeleteCoupon = (id: string) => {
    setCouponsList(couponsList.filter((c) => c.id !== id));
  };

  const totalRedemptions = couponsList.reduce((acc, c) => acc + c.usedCount, 0);
  const activeCount = couponsList.filter((c) => c.isActive).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
            Coupons &amp; Promotions
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Create discount vouchers, configure minimum basket thresholds, and track usage counts.
          </p>
        </div>
        <Button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
        >
          <Plus className="h-4 w-4" />
          <span>Create Coupon</span>
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Active Coupons
            </CardTitle>
            <div className="rounded-md bg-emerald-50 p-2 text-emerald-600">
              <CheckCircle className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{activeCount}</div>
            <p className="mt-1 text-xs text-gray-500">Out of {couponsList.length} total</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Total Redemptions
            </CardTitle>
            <div className="rounded-md bg-indigo-50 p-2 text-indigo-600">
              <Ticket className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{totalRedemptions}</div>
            <p className="mt-1 text-xs text-gray-500">All-time redemptions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Tenant Isolation
            </CardTitle>
            <div className="rounded-md bg-blue-50 p-2 text-blue-600">
              <Tag className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-semibold text-emerald-600">Strictly Scoped</div>
            <p className="mt-1 text-xs text-gray-500">Enforced by unique tenant index</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter bar */}
      <Card>
        <CardContent className="p-4">
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              placeholder="Search coupon code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-9 w-full rounded-md border border-gray-200 bg-white pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none"
            />
          </div>
        </CardContent>
      </Card>

      {/* Coupon Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Code
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Discount
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Min Subtotal
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Usage
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Expiry
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredCoupons.map((c) => {
                  const minSubtotalMoney = createMoney(c.minSubtotal, 'INR');
                  const formattedExpiry = c.expiresAt
                    ? new Date(c.expiresAt).toLocaleDateString('en-IN', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : 'No Expiry';

                  return (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <span className="font-mono font-bold text-gray-900 bg-gray-100 px-2 py-0.5 rounded text-xs">
                          {c.code}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        {c.discountType === 'percentage' ? (
                          <span className="font-semibold text-emerald-600">
                            {c.discountValue}% Off
                          </span>
                        ) : (
                          <span className="font-semibold text-emerald-600">
                            {formatMoney(createMoney(c.discountValue, 'INR'))} Off
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-xs text-gray-600">
                        {c.minSubtotal > 0 ? formatMoney(minSubtotalMoney) : 'None'}
                      </td>

                      <td className="px-4 py-3 text-xs">
                        <span className="font-semibold text-gray-900">{c.usedCount}</span>
                        <span className="text-gray-400">
                          {c.maxUses ? ` / ${c.maxUses}` : ' (unlimited)'}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-xs text-gray-500">
                        {formattedExpiry}
                      </td>

                      <td className="px-4 py-3">
                        <Badge variant={c.isActive ? 'success' : 'secondary'}>
                          {c.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleToggleStatus(c.id)}
                            className="text-xs h-7 px-2"
                          >
                            {c.isActive ? 'Deactivate' : 'Activate'}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteCoupon(c.id)}
                            className="text-gray-400 hover:text-red-600 h-7 w-7 p-0"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Create Coupon Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Create Discount Coupon</h3>
            <form onSubmit={handleCreateCoupon} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700">
                  Coupon Code
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. SUMMER20"
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                  className="mt-1 w-full uppercase font-mono rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700">
                    Discount Type
                  </label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as 'percentage' | 'fixed')}
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount (₹)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700">
                    {formType === 'percentage' ? 'Percentage (Max 100)' : 'Amount (₹)'}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={formType === 'percentage' ? 100 : 100000}
                    required
                    value={formValue}
                    onChange={(e) => setFormValue(Number(e.target.value))}
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700">
                    Min Subtotal (₹)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={formMinSubtotalRupees}
                    onChange={(e) => setFormMinSubtotalRupees(Number(e.target.value))}
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700">
                    Max Redemptions
                  </label>
                  <input
                    type="number"
                    placeholder="Unlimited"
                    value={formMaxUses}
                    onChange={(e) => setFormMaxUses(e.target.value)}
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700">
                    Per Customer Limit
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={formPerCustomer}
                    onChange={(e) => setFormPerCustomer(Number(e.target.value))}
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700">
                    Expiry Date
                  </label>
                  <input
                    type="date"
                    value={formExpiresAt}
                    onChange={(e) => setFormExpiresAt(e.target.value)}
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" className="bg-blue-600 text-white hover:bg-blue-700">
                  Save Coupon
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
