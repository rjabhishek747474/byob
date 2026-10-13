import * as React from 'react';
import Link from 'next/link';
import {
  IndianRupee,
  ShoppingCart,
  Package,
  Users,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  ExternalLink,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { createMoney, formatMoney } from '@/lib/money';

// Mock KPI data
// TODO: Connect to real tenant-scoped metrics via Drizzle ORM analytics service
const mockKpis = {
  totalRevenue: createMoney(0, 'INR'),
  totalOrders: 0,
  activeProducts: 0,
  totalCustomers: 0,
  revenueChange: '+0.0%',
  ordersChange: '+0.0%',
  productsChange: '+0.0%',
  customersChange: '+0.0%',
};

// Mock Recent Orders data
// TODO: Connect to real orders from tenant database
const mockRecentOrders = [
  {
    id: 'ord_01J8K90001',
    customerName: 'Priya Sharma',
    customerEmail: 'p****@example.com',
    itemsCount: 2,
    totalMinorUnits: 249900,
    status: 'delivered',
    createdAt: '2026-10-12T14:32:00Z',
  },
  {
    id: 'ord_01J8K90002',
    customerName: 'Rahul Verma',
    customerEmail: 'r****@example.com',
    itemsCount: 1,
    totalMinorUnits: 129900,
    status: 'processing',
    createdAt: '2026-10-12T16:15:00Z',
  },
  {
    id: 'ord_01J8K90003',
    customerName: 'Ananya Patel',
    customerEmail: 'a****@example.com',
    itemsCount: 4,
    totalMinorUnits: 589000,
    status: 'shipped',
    createdAt: '2026-10-12T17:40:00Z',
  },
  {
    id: 'ord_01J8K90004',
    customerName: 'Vikram Singh',
    customerEmail: 'v****@example.com',
    itemsCount: 1,
    totalMinorUnits: 89900,
    status: 'pending',
    createdAt: '2026-10-12T18:05:00Z',
  },
];

const statusVariantMap: Record<
  string,
  'default' | 'success' | 'warning' | 'danger' | 'secondary'
> = {
  pending: 'warning',
  confirmed: 'default',
  processing: 'secondary',
  shipped: 'default',
  delivered: 'success',
  cancelled: 'danger',
};

export default async function DashboardPage() {
  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Overview of your store&apos;s performance and recent activity.
          </p>
        </div>

        {/* Date Range Selector Placeholder */}
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm">
            <Calendar className="mr-2 h-4 w-4 text-gray-500" />
            <span>Last 30 Days</span>
          </div>
          <Button variant="outline" size="sm">
            Refresh
          </Button>
        </div>
      </div>

      {/* 4 KPI Cards Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Revenue */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Total Revenue
            </CardTitle>
            <div className="rounded-md bg-blue-50 p-2 text-blue-600">
              <IndianRupee className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              {formatMoney(mockKpis.totalRevenue)}
            </div>
            <div className="mt-2 flex items-center text-xs text-gray-500">
              <span className="flex items-center font-medium text-emerald-600">
                <ArrowUpRight className="mr-0.5 h-3.5 w-3.5" />
                {mockKpis.revenueChange}
              </span>
              <span className="ml-1.5">vs previous period</span>
            </div>
          </CardContent>
        </Card>

        {/* Total Orders */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Total Orders
            </CardTitle>
            <div className="rounded-md bg-indigo-50 p-2 text-indigo-600">
              <ShoppingCart className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              {mockKpis.totalOrders}
            </div>
            <div className="mt-2 flex items-center text-xs text-gray-500">
              <span className="flex items-center font-medium text-emerald-600">
                <ArrowUpRight className="mr-0.5 h-3.5 w-3.5" />
                {mockKpis.ordersChange}
              </span>
              <span className="ml-1.5">vs previous period</span>
            </div>
          </CardContent>
        </Card>

        {/* Active Products */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Active Products
            </CardTitle>
            <div className="rounded-md bg-emerald-50 p-2 text-emerald-600">
              <Package className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              {mockKpis.activeProducts}
            </div>
            <div className="mt-2 flex items-center text-xs text-gray-500">
              <span className="flex items-center font-medium text-gray-500">
                <ArrowDownRight className="mr-0.5 h-3.5 w-3.5" />
                {mockKpis.productsChange}
              </span>
              <span className="ml-1.5">in catalog</span>
            </div>
          </CardContent>
        </Card>

        {/* Total Customers */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Total Customers
            </CardTitle>
            <div className="rounded-md bg-amber-50 p-2 text-amber-600">
              <Users className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              {mockKpis.totalCustomers}
            </div>
            <div className="mt-2 flex items-center text-xs text-gray-500">
              <span className="flex items-center font-medium text-emerald-600">
                <ArrowUpRight className="mr-0.5 h-3.5 w-3.5" />
                {mockKpis.customersChange}
              </span>
              <span className="ml-1.5">active buyers</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Orders Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Recent Orders</CardTitle>
            <p className="mt-1 text-sm text-gray-500">
              Latest transactions placed across your online store.
            </p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/orders" className="flex items-center gap-1">
              <span>View All</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Order ID
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Customer
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Items
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Total
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {mockRecentOrders.map((order) => {
                  const money = createMoney(order.totalMinorUnits, 'INR');
                  const formattedDate = new Date(order.createdAt).toLocaleDateString(
                    'en-IN',
                    {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    }
                  );

                  return (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono font-medium text-gray-900">
                        {order.id}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">
                          {order.customerName}
                        </div>
                        <div className="text-xs text-gray-400">
                          {order.customerEmail}
                        </div>
                      </td>
                      <td className="px-4 py-3">{order.itemsCount}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {formatMoney(money)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={statusVariantMap[order.status] ?? 'secondary'}
                        >
                          {order.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {formattedDate}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
