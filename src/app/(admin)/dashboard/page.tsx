'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  IndianRupee,
  ShoppingCart,
  Package,
  Users,
  ArrowUpRight,
  TrendingUp,
  ExternalLink,
  Store,
  Paintbrush,
  Truck,
  Sparkles,
  Layers,
  CheckCircle2,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAdminContext } from '@/components/admin/admin-context';
import { formatMoney, createMoney } from '@/lib/money';

const sampleRecentOrdersMap: Record<
  string,
  Array<{
    id: string;
    customerName: string;
    customerEmail: string;
    itemsCount: number;
    totalMinorUnits: number;
    status: 'delivered' | 'shipped' | 'processing' | 'pending';
    createdAt: string;
  }>
> = {
  'urban-style': [
    {
      id: 'ord_01J8K90001',
      customerName: 'Priya Sharma',
      customerEmail: 'p****@example.com',
      itemsCount: 2,
      totalMinorUnits: 249900,
      status: 'delivered',
      createdAt: '12 Oct 2026',
    },
    {
      id: 'ord_01J8K90002',
      customerName: 'Rahul Verma',
      customerEmail: 'r****@example.com',
      itemsCount: 1,
      totalMinorUnits: 129900,
      status: 'processing',
      createdAt: '12 Oct 2026',
    },
    {
      id: 'ord_01J8K90003',
      customerName: 'Ananya Patel',
      customerEmail: 'a****@example.com',
      itemsCount: 4,
      totalMinorUnits: 589000,
      status: 'shipped',
      createdAt: '12 Oct 2026',
    },
    {
      id: 'ord_01J8K90004',
      customerName: 'Vikram Singh',
      customerEmail: 'v****@example.com',
      itemsCount: 1,
      totalMinorUnits: 89900,
      status: 'pending',
      createdAt: '12 Oct 2026',
    },
  ],
  'artisan-crafts': [
    {
      id: 'ord_01J8K91001',
      customerName: 'Meera Nambiar',
      customerEmail: 'm****@example.com',
      itemsCount: 3,
      totalMinorUnits: 450000,
      status: 'delivered',
      createdAt: '13 Oct 2026',
    },
    {
      id: 'ord_01J8K91002',
      customerName: 'Kabir Mehta',
      customerEmail: 'k****@example.com',
      itemsCount: 1,
      totalMinorUnits: 320000,
      status: 'shipped',
      createdAt: '13 Oct 2026',
    },
    {
      id: 'ord_01J8K91003',
      customerName: 'Aarav Joshi',
      customerEmail: 'a****@example.com',
      itemsCount: 2,
      totalMinorUnits: 185000,
      status: 'processing',
      createdAt: '12 Oct 2026',
    },
  ],
  'bloom-flowers': [
    {
      id: 'ord_01J8K92001',
      customerName: 'Sunita Reddy',
      customerEmail: 's****@example.com',
      itemsCount: 2,
      totalMinorUnits: 149900,
      status: 'delivered',
      createdAt: '13 Oct 2026',
    },
    {
      id: 'ord_01J8K92002',
      customerName: 'Tanvi Shah',
      customerEmail: 't****@example.com',
      itemsCount: 1,
      totalMinorUnits: 99900,
      status: 'pending',
      createdAt: '13 Oct 2026',
    },
  ],
  'apex-sports': [
    {
      id: 'ord_01J8K93001',
      customerName: 'Rohan Deshmukh',
      customerEmail: 'r****@example.com',
      itemsCount: 5,
      totalMinorUnits: 1249900,
      status: 'delivered',
      createdAt: '13 Oct 2026',
    },
    {
      id: 'ord_01J8K93002',
      customerName: 'Zoya Khan',
      customerEmail: 'z****@example.com',
      itemsCount: 2,
      totalMinorUnits: 649900,
      status: 'shipped',
      createdAt: '13 Oct 2026',
    },
  ],
};

export default function TenantDashboardPage() {
  const { currentTenant } = useAdminContext();

  const orders = sampleRecentOrdersMap[currentTenant.slug] || sampleRecentOrdersMap['urban-style'];
  const liveStoreUrl = `http://localhost:3000/?tenant=${currentTenant.slug}`;

  return (
    <div className="space-y-8">
      {/* Active Store Identification Banner */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xl shadow-sm shrink-0">
            {currentTenant.name.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                Store Owner Panel
              </span>
              <Badge variant="outline" className="text-xs font-semibold border-gray-300">
                {currentTenant.plan} Plan
              </Badge>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 mt-1">
              {currentTenant.name}
            </h1>
            <p className="text-xs text-gray-400 font-mono mt-0.5">
              subdomain: {currentTenant.slug}.byob.store{' '}
              {currentTenant.customDomain && `• domain: ${currentTenant.customDomain}`}
            </p>
          </div>
        </div>

        {/* Store Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          <a
            href={liveStoreUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 px-3 py-2 rounded-lg shadow-xs transition-colors"
          >
            <Store className="w-4 h-4 text-blue-600" />
            <span>View Live Website</span>
            <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
          </a>

          <Link href="/builder">
            <Button size="sm" className="flex items-center gap-1.5">
              <Paintbrush className="w-3.5 h-3.5" />
              <span>Customize Website</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Store Financial & Operational KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Gross Revenue */}
        <Card className="border-gray-200 shadow-sm bg-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Total Sales Revenue
            </CardTitle>
            <div className="rounded-md bg-blue-50 p-2 text-blue-600">
              <IndianRupee className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              {formatMoney(createMoney(currentTenant.revenueMinorUnits, 'INR'))}
            </div>
            <div className="mt-2 flex items-center text-xs text-emerald-600 font-medium">
              <ArrowUpRight className="mr-0.5 h-3.5 w-3.5" />
              <span>+18.4% vs last month</span>
            </div>
          </CardContent>
        </Card>

        {/* Estimated Store Net Profit */}
        <Card className="border-emerald-200 shadow-sm bg-gradient-to-br from-emerald-50/50 to-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-emerald-900">
              Estimated Net Profit
            </CardTitle>
            <div className="rounded-md bg-emerald-100 p-2 text-emerald-700">
              <TrendingUp className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-950">
              {formatMoney(createMoney(currentTenant.profitMinorUnits, 'INR'))}
            </div>
            <p className="mt-2 text-xs text-gray-500 font-medium">
              ~60% operating margin after costs
            </p>
          </CardContent>
        </Card>

        {/* Total Orders & Delivery Breakdown */}
        <Card className="border-gray-200 shadow-sm bg-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Orders & Delivery
            </CardTitle>
            <div className="rounded-md bg-purple-50 p-2 text-purple-600">
              <Truck className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              {currentTenant.ordersCount} Orders
            </div>
            <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
              <span className="font-semibold text-emerald-700">{currentTenant.deliveredOrders} delivered</span>
              <span>•</span>
              <span className="font-semibold text-blue-700">{currentTenant.shippedOrders} transit</span>
            </div>
          </CardContent>
        </Card>

        {/* Active Products & Buyers */}
        <Card className="border-gray-200 shadow-sm bg-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Catalog & Buyers
            </CardTitle>
            <div className="rounded-md bg-amber-50 p-2 text-amber-600">
              <Package className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              {currentTenant.productsCount} Products
            </div>
            <div className="mt-2 text-xs text-gray-500 flex items-center gap-1 font-medium">
              <Users className="w-3.5 h-3.5 text-gray-400" />
              <span>{currentTenant.customersCount} active customers</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Access Tiles for Store Owner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Link
          href="/products"
          className="p-4 bg-white border border-gray-200 rounded-xl hover:border-blue-400 hover:shadow-xs transition-all group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <Package className="w-5 h-5 text-gray-500 group-hover:text-blue-600 transition-colors" />
            <ArrowUpRight className="w-4 h-4 text-gray-300 group-hover:text-blue-600" />
          </div>
          <div className="mt-3">
            <p className="font-bold text-xs text-gray-900">Products Catalog</p>
            <p className="text-[11px] text-gray-400 mt-0.5">Manage pricing & stock</p>
          </div>
        </Link>

        <Link
          href="/orders"
          className="p-4 bg-white border border-gray-200 rounded-xl hover:border-blue-400 hover:shadow-xs transition-all group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <ShoppingCart className="w-5 h-5 text-gray-500 group-hover:text-blue-600 transition-colors" />
            <ArrowUpRight className="w-4 h-4 text-gray-300 group-hover:text-blue-600" />
          </div>
          <div className="mt-3">
            <p className="font-bold text-xs text-gray-900">Orders & Shipping</p>
            <p className="text-[11px] text-gray-400 mt-0.5">Fulfill customer packages</p>
          </div>
        </Link>

        <Link
          href="/builder"
          className="p-4 bg-white border border-gray-200 rounded-xl hover:border-blue-400 hover:shadow-xs transition-all group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <Paintbrush className="w-5 h-5 text-gray-500 group-hover:text-blue-600 transition-colors" />
            <ArrowUpRight className="w-4 h-4 text-gray-300 group-hover:text-blue-600" />
          </div>
          <div className="mt-3">
            <p className="font-bold text-xs text-gray-900">Website Builder</p>
            <p className="text-[11px] text-gray-400 mt-0.5">Drag-and-drop store blocks</p>
          </div>
        </Link>

        <Link
          href="/theme"
          className="p-4 bg-white border border-gray-200 rounded-xl hover:border-blue-400 hover:shadow-xs transition-all group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <Sparkles className="w-5 h-5 text-gray-500 group-hover:text-blue-600 transition-colors" />
            <ArrowUpRight className="w-4 h-4 text-gray-300 group-hover:text-blue-600" />
          </div>
          <div className="mt-3">
            <p className="font-bold text-xs text-gray-900">Theme & Colors</p>
            <p className="text-[11px] text-gray-400 mt-0.5">Branding & typography</p>
          </div>
        </Link>
      </div>

      {/* Recent Orders & Delivery Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base font-bold text-gray-900">
              Recent Orders & Fulfillment
            </CardTitle>
            <p className="mt-0.5 text-xs text-gray-500">
              Latest transactions placed across {currentTenant.name}.
            </p>
          </div>
          <Link href="/orders">
            <Button variant="outline" size="sm" className="text-xs flex items-center gap-1">
              <span>View All Orders</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase text-gray-500 font-semibold">
                <tr>
                  <th scope="col" className="px-4 py-3">Order ID</th>
                  <th scope="col" className="px-4 py-3">Customer</th>
                  <th scope="col" className="px-4 py-3">Items</th>
                  <th scope="col" className="px-4 py-3">Total</th>
                  <th scope="col" className="px-4 py-3">Fulfillment Status</th>
                  <th scope="col" className="px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono font-medium text-gray-900 text-xs">
                      {order.id}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 text-xs">{order.customerName}</div>
                      <div className="text-[11px] text-gray-400">{order.customerEmail}</div>
                    </td>
                    <td className="px-4 py-3 text-xs">{order.itemsCount}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900 text-xs">
                      {formatMoney(createMoney(order.totalMinorUnits, 'INR'))}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${
                          order.status === 'delivered'
                            ? 'bg-emerald-50 text-emerald-800'
                            : order.status === 'shipped'
                            ? 'bg-blue-50 text-blue-800'
                            : order.status === 'processing'
                            ? 'bg-gray-100 text-gray-800'
                            : 'bg-amber-50 text-amber-800'
                        }`}
                      >
                        {order.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{order.createdAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
