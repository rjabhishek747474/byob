'use client';

import * as React from 'react';
import {
  CreditCard,
  Plus,
  Trash2,
  AlertTriangle,
  Users,
  ShieldCheck,
  Calendar,
  CheckCircle,
  Clock,
  Sparkles,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { createMoney, formatMoney } from '@/lib/money';

interface PlanItem {
  id: string;
  name: string;
  description: string;
  priceMinorUnits: number;
  currency: string;
  durationDays: number;
  isVisible: boolean;
  status: 'active' | 'inactive';
}

interface SubscriberItem {
  id: string;
  customerName: string;
  customerEmail: string;
  planName: string;
  status: 'active' | 'expired' | 'cancelled';
  startDate: string;
  endDate: string;
}

const mockPlans: PlanItem[] = [
  {
    id: 'plan_01',
    name: 'VIP Bronze Member',
    description: 'Complimentary standard shipping on all orders + 5% bonus reward points.',
    priceMinorUnits: 49900, // ₹499.00
    currency: 'INR',
    durationDays: 30,
    isVisible: true,
    status: 'active',
  },
  {
    id: 'plan_02',
    name: 'VIP Gold Annual Pass',
    description: 'Year-round free express shipping, priority 24/7 support, and early access to drops.',
    priceMinorUnits: 299900, // ₹2,999.00
    currency: 'INR',
    durationDays: 365,
    isVisible: true,
    status: 'active',
  },
  {
    id: 'plan_03',
    name: 'Artisan Coffee Club (Prepaid)',
    description: 'Bi-weekly roaster bean selection delivered to your doorstep for 90 days.',
    priceMinorUnits: 149900, // ₹1,499.00
    currency: 'INR',
    durationDays: 90,
    isVisible: true,
    status: 'active',
  },
];

const mockSubscribers: SubscriberItem[] = [
  {
    id: 'sub_01',
    customerName: 'Priya Sharma',
    customerEmail: 'priya@example.com',
    planName: 'VIP Gold Annual Pass',
    status: 'active',
    startDate: '2026-01-10T10:00:00Z',
    endDate: '2027-01-10T10:00:00Z',
  },
  {
    id: 'sub_02',
    customerName: 'Rahul Verma',
    customerEmail: 'rahul@example.com',
    planName: 'VIP Bronze Member',
    status: 'active',
    startDate: '2026-09-15T12:00:00Z',
    endDate: '2026-10-15T12:00:00Z',
  },
  {
    id: 'sub_03',
    customerName: 'Arjun Das',
    customerEmail: 'arjun@example.com',
    planName: 'Artisan Coffee Club (Prepaid)',
    status: 'expired',
    startDate: '2026-06-01T08:00:00Z',
    endDate: '2026-09-01T08:00:00Z',
  },
];

export default function PlansPage() {
  const [plans, setPlans] = React.useState<PlanItem[]>(mockPlans);
  const [subscribers] = React.useState<SubscriberItem[]>(mockSubscribers);
  const [activeTab, setActiveTab] = React.useState<'plans' | 'subscribers'>('plans');

  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [priceRupees, setPriceRupees] = React.useState<number>(499);
  const [durationDays, setDurationDays] = React.useState<number>(30);
  const [isVisible, setIsVisible] = React.useState(true);

  const handleCreatePlan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newPlan: PlanItem = {
      id: `plan_${Date.now()}`,
      name: name.trim(),
      description: description.trim(),
      priceMinorUnits: Math.round(priceRupees * 100),
      currency: 'INR',
      durationDays: Number(durationDays) || 30,
      isVisible,
      status: 'active',
    };

    setPlans([newPlan, ...plans]);
    setName('');
    setDescription('');
    setPriceRupees(499);
    setDurationDays(30);
    setIsCreateOpen(false);
  };

  const handleDeletePlan = (id: string) => {
    setPlans(plans.filter((p) => p.id !== id));
  };

  const handleTogglePlan = (id: string) => {
    setPlans(
      plans.map((p) =>
        p.id === id ? { ...p, status: p.status === 'active' ? 'inactive' : 'active' } : p
      )
    );
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
            Commerce Subscriptions &amp; Memberships
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Define recurring memberships, VIP clubs, and prepaid recurring packages.
          </p>
        </div>
        {activeTab === 'plans' && (
          <Button
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus className="h-4 w-4" />
            <span>Create Plan</span>
          </Button>
        )}
      </div>

      {/* Prominent MVP Billing Disclaimer Banner */}
      <div className="rounded-xl border border-amber-300 bg-amber-50/90 p-4 shadow-xs">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-amber-900">
              No Automatic Recurring Card Billing in MVP
            </h4>
            <p className="text-xs text-amber-800 leading-relaxed">
              Automatic recurring credit/debit card mandates are not enabled in this release.
              All subscription tiers operate on <strong>upfront prepaid terms or manual renewals</strong>.
              Shoppers purchase fixed-duration memberships (e.g., 30, 90, or 365 days) that expire automatically unless repurchased.
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'plans' | 'subscribers')}>
        <TabsList className="bg-gray-100 p-1 rounded-xl">
          <TabsTrigger
            value="plans"
            className="text-xs py-2 px-4 data-[state=active]:bg-white data-[state=active]:text-blue-700 font-semibold"
          >
            Subscription Plans ({plans.length})
          </TabsTrigger>
          <TabsTrigger
            value="subscribers"
            className="text-xs py-2 px-4 data-[state=active]:bg-white data-[state=active]:text-blue-700 font-semibold"
          >
            Subscribers ({subscribers.length})
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Plans */}
        <TabsContent value="plans" className="mt-6 space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {plans.map((p) => {
              const money = createMoney(p.priceMinorUnits, p.currency);
              return (
                <Card key={p.id} className="flex flex-col justify-between shadow-xs hover:border-gray-300 transition-all">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <Badge variant={p.status === 'active' ? 'success' : 'secondary'}>
                        {p.status === 'active' ? 'Active' : 'Inactive'}
                      </Badge>
                      <span className="text-xs font-mono text-gray-400">
                        {p.durationDays} days prepaid
                      </span>
                    </div>
                    <CardTitle className="text-lg font-bold text-gray-900 mt-2">
                      {p.name}
                    </CardTitle>
                    <div className="text-2xl font-black text-blue-600 mt-1">
                      {formatMoney(money)}
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4 pt-0">
                    <p className="text-xs text-gray-600 leading-relaxed min-h-[40px]">
                      {p.description || 'No description provided.'}
                    </p>

                    <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleTogglePlan(p.id)}
                        className="text-xs"
                      >
                        {p.status === 'active' ? 'Disable' : 'Activate'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeletePlan(p.id)}
                        className="text-gray-400 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Tab 2: Subscribers */}
        <TabsContent value="subscribers" className="mt-6">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-600">
                  <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase text-gray-500">
                    <tr>
                      <th scope="col" className="px-4 py-3 font-semibold">
                        Customer
                      </th>
                      <th scope="col" className="px-4 py-3 font-semibold">
                        Plan
                      </th>
                      <th scope="col" className="px-4 py-3 font-semibold">
                        Start Date
                      </th>
                      <th scope="col" className="px-4 py-3 font-semibold">
                        End Date
                      </th>
                      <th scope="col" className="px-4 py-3 font-semibold">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {subscribers.map((sub) => {
                      const startDate = new Date(sub.startDate).toLocaleDateString('en-IN', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      });
                      const endDate = new Date(sub.endDate).toLocaleDateString('en-IN', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      });

                      return (
                        <tr key={sub.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="font-semibold text-gray-900">{sub.customerName}</div>
                            <div className="text-xs text-gray-400 font-mono">{sub.customerEmail}</div>
                          </td>
                          <td className="px-4 py-3 font-medium text-gray-900">
                            {sub.planName}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500">{startDate}</td>
                          <td className="px-4 py-3 text-xs text-gray-500">{endDate}</td>
                          <td className="px-4 py-3">
                            <Badge variant={sub.status === 'active' ? 'success' : 'secondary'}>
                              {sub.status}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Plan Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Create Subscription Plan</h3>
            <form onSubmit={handleCreatePlan} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700">
                  Plan Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. VIP Club 90-Day Pass"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700">
                  Description / Member Benefits
                </label>
                <textarea
                  rows={3}
                  placeholder="Detail shipping discounts, exclusive perks, or member benefits."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700">
                    Prepaid Price (₹)
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={priceRupees}
                    onChange={(e) => setPriceRupees(Number(e.target.value))}
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700">
                    Duration (Days)
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={durationDays}
                    onChange={(e) => setDurationDays(Number(e.target.value))}
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="visibilityCheck"
                  checked={isVisible}
                  onChange={(e) => setIsVisible(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="visibilityCheck" className="text-xs text-gray-700 font-medium">
                  Visible in customer membership catalog
                </label>
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
                  Save Plan
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
