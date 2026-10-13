import * as React from 'react';
import {
  Download,
  Search,
  Calendar,
  Eye,
  ShoppingCart,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { createMoney, formatMoney } from '@/lib/money';
import { cn } from '@/lib/cn';

type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

interface OrderItem {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  itemsCount: number;
  totalMinorUnits: number;
  status: OrderStatus;
  date: string;
}

const mockOrders: OrderItem[] = [
  {
    orderNumber: 'ORD-2026-1001',
    customerName: 'Priya Sharma',
    customerEmail: 'priya@example.com',
    itemsCount: 3,
    totalMinorUnits: 349900,
    status: 'delivered',
    date: '2026-10-12T14:32:00Z',
  },
  {
    orderNumber: 'ORD-2026-1002',
    customerName: 'Rahul Verma',
    customerEmail: 'rahul@example.com',
    itemsCount: 1,
    totalMinorUnits: 129900,
    status: 'shipped',
    date: '2026-10-12T15:20:00Z',
  },
  {
    orderNumber: 'ORD-2026-1003',
    customerName: 'Neha Gupta',
    customerEmail: 'neha@example.com',
    itemsCount: 2,
    totalMinorUnits: 219900,
    status: 'processing',
    date: '2026-10-12T16:45:00Z',
  },
  {
    orderNumber: 'ORD-2026-1004',
    customerName: 'Arjun Das',
    customerEmail: 'arjun@example.com',
    itemsCount: 1,
    totalMinorUnits: 89900,
    status: 'confirmed',
    date: '2026-10-12T17:10:00Z',
  },
  {
    orderNumber: 'ORD-2026-1005',
    customerName: 'Kavita Reddy',
    customerEmail: 'kavita@example.com',
    itemsCount: 5,
    totalMinorUnits: 659900,
    status: 'pending',
    date: '2026-10-12T18:00:00Z',
  },
  {
    orderNumber: 'ORD-2026-1006',
    customerName: 'Rohan Mehra',
    customerEmail: 'rohan@example.com',
    itemsCount: 1,
    totalMinorUnits: 149900,
    status: 'cancelled',
    date: '2026-10-11T11:25:00Z',
  },
];

const statusBadgeClasses: Record<OrderStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  confirmed: 'bg-blue-100 text-blue-800 border-blue-200',
  processing: 'bg-purple-100 text-purple-800 border-purple-200',
  shipped: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  delivered: 'bg-green-100 text-green-800 border-green-200',
  cancelled: 'bg-red-100 text-red-800 border-red-200',
};

export default async function OrdersPage() {
  const hasOrders = mockOrders.length > 0;

  return (
    <div className="space-y-6">
      {/* Title & Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
            Orders
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Monitor fulfillment, payments, tracking, and customer orders.
          </p>
        </div>
        <Button variant="outline" className="flex items-center gap-1.5 shadow-sm">
          <Download className="h-4 w-4" />
          <span>Export CSV</span>
        </Button>
      </div>

      {/* Filter Toolbar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                placeholder="Search by order # or customer..."
                className="h-9 w-full rounded-md border border-gray-200 bg-white pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Filter by order status"
                className="h-9 rounded-md border border-gray-200 bg-white px-3 py-1 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                defaultValue="all"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="processing">Processing</option>
                <option value="shipped">Shipped</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
              </select>

              <div className="flex items-center rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700">
                <Calendar className="mr-2 h-4 w-4 text-gray-400" />
                <span>All Time</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Orders Data Table */}
      <Card>
        <CardContent className="p-0">
          {!hasOrders ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-4">
              <div className="rounded-full bg-blue-50 p-4 text-blue-600 mb-3">
                <ShoppingCart className="h-8 w-8" />
              </div>
              <h3 className="text-base font-semibold text-gray-900">
                No orders yet
              </h3>
              <p className="mt-1 max-w-sm text-sm text-gray-500">
                When customers make purchases on your storefront, orders will appear here for processing and fulfillment.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-600">
                <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Order #
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
                    <th scope="col" className="px-4 py-3 text-right font-semibold">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {mockOrders.map((order) => {
                    const total = createMoney(order.totalMinorUnits, 'INR');
                    const formattedDate = new Date(order.date).toLocaleDateString(
                      'en-IN',
                      {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      }
                    );

                    return (
                      <tr key={order.orderNumber} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-mono font-medium text-blue-600 hover:underline">
                          {order.orderNumber}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-gray-900">
                            {order.customerName}
                          </div>
                          <div className="text-xs text-gray-400">
                            {order.customerEmail}
                          </div>
                        </td>
                        <td className="px-4 py-3">{order.itemsCount} items</td>
                        <td className="px-4 py-3 font-medium text-gray-900">
                          {formatMoney(total)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize',
                              statusBadgeClasses[order.status]
                            )}
                          >
                            {order.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {formattedDate}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                            title="View order details"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 text-sm text-gray-500">
            <div>
              Showing <span className="font-medium text-gray-900">1</span> to{' '}
              <span className="font-medium text-gray-900">{mockOrders.length}</span> of{' '}
              <span className="font-medium text-gray-900">{mockOrders.length}</span> orders
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled>
                Previous
              </Button>
              <Button variant="outline" size="sm" disabled>
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
