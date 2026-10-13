'use client';

import * as React from 'react';
import {
  Download,
  Search,
  Eye,
  ShieldAlert,
  UserX,
  CheckCircle,
  ShoppingBag,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { createMoney, formatMoney } from '@/lib/money';

interface CustomerItem {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  ordersCount: number;
  totalSpentMinorUnits: number;
  joinedDate: string;
}

const mockCustomers: CustomerItem[] = [
  {
    id: 'cust_01J8K90001',
    name: 'Priya Sharma',
    email: 'priya.sharma@example.com',
    phone: '+919876543210',
    ordersCount: 8,
    totalSpentMinorUnits: 1499900,
    joinedDate: '2026-03-15T10:00:00Z',
  },
  {
    id: 'cust_01J8K90002',
    name: 'Rahul Verma',
    email: 'rahul.verma@example.com',
    phone: '+919876543211',
    ordersCount: 3,
    totalSpentMinorUnits: 429900,
    joinedDate: '2026-05-20T11:30:00Z',
  },
  {
    id: 'cust_01J8K90003',
    name: 'Neha Gupta',
    email: 'neha.gupta@example.com',
    phone: '+919876543212',
    ordersCount: 12,
    totalSpentMinorUnits: 3120000,
    joinedDate: '2026-01-10T09:15:00Z',
  },
  {
    id: 'cust_01J8K90004',
    name: 'Arjun Das',
    email: 'arjun.das@example.com',
    phone: '+919876543213',
    ordersCount: 1,
    totalSpentMinorUnits: 89900,
    joinedDate: '2026-08-01T14:40:00Z',
  },
  {
    id: 'cust_01J8K90005',
    name: 'Kavita Reddy',
    email: 'kavita.reddy@example.com',
    phone: '+919876543214',
    ordersCount: 5,
    totalSpentMinorUnits: 980000,
    joinedDate: '2026-07-22T16:20:00Z',
  },
];

export default function CustomersPage() {
  const [customers, setCustomers] = React.useState<CustomerItem[]>(mockCustomers);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [anonymizeTarget, setAnonymizeTarget] = React.useState<CustomerItem | null>(null);

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.email && c.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleExportCsv = () => {
    window.location.href = '/api/v1/admin/customers/export';
  };

  const handleAnonymize = () => {
    if (!anonymizeTarget) return;

    setCustomers(
      customers.map((c) =>
        c.id === anonymizeTarget.id
          ? {
              ...c,
              name: 'Anonymized Customer',
              email: `anonymized-${c.id.slice(-6).toLowerCase()}@deleted.local`,
              phone: null,
            }
          : c
      )
    );
    setAnonymizeTarget(null);
  };

  return (
    <div className="space-y-6">
      {/* Title & Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
            Customers
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            View registered shopper accounts, lifetime order history, and handle GDPR/DPDP privacy requests.
          </p>
        </div>
        <Button
          onClick={handleExportCsv}
          variant="outline"
          className="flex items-center gap-1.5 shadow-xs"
        >
          <Download className="h-4 w-4" />
          <span>Export CSV</span>
        </Button>
      </div>

      {/* Filter / Search Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              placeholder="Search by customer name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-9 w-full rounded-md border border-gray-200 bg-white pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </CardContent>
      </Card>

      {/* Customers Table */}
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
                    Email / Phone
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Orders
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Lifetime Spent
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Joined Date
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredCustomers.map((cust) => {
                  const joinedDate = new Date(cust.joinedDate).toLocaleDateString(
                    'en-IN',
                    {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    }
                  );
                  const isAnonymized = cust.name === 'Anonymized Customer';

                  return (
                    <tr key={cust.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${
                              isAnonymized
                                ? 'bg-gray-200 text-gray-500'
                                : 'bg-blue-100 text-blue-700'
                            }`}
                          >
                            {cust.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-semibold text-gray-900">
                              {cust.name}
                            </span>
                            <div className="text-[11px] font-mono text-gray-400">
                              {cust.id}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3 font-mono text-xs text-gray-600">
                        <div>{cust.email || 'N/A'}</div>
                        {cust.phone && <div className="text-gray-400">{cust.phone}</div>}
                      </td>

                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-800">
                          {cust.ordersCount} orders
                        </span>
                      </td>

                      <td className="px-4 py-3 font-semibold text-gray-900">
                        {formatMoney(createMoney(cust.totalSpentMinorUnits, 'INR'))}
                      </td>

                      <td className="px-4 py-3 text-xs text-gray-500">
                        {joinedDate}
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {!isAnonymized && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setAnonymizeTarget(cust)}
                              className="text-gray-400 hover:text-red-600 text-xs flex items-center gap-1"
                              title="Anonymize personal data (GDPR/DPDP)"
                            >
                              <UserX className="h-4 w-4 text-red-500" />
                              <span className="hidden sm:inline">Anonymize</span>
                            </Button>
                          )}
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

      {/* GDPR / DPDP Anonymization Confirmation Modal */}
      {anonymizeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3 text-amber-600">
              <ShieldAlert className="h-6 w-6" />
              <h3 className="text-lg font-bold text-gray-900">
                Confirm Privacy Anonymization
              </h3>
            </div>

            <p className="text-sm text-gray-600 leading-relaxed">
              Under GDPR and DPDP data erasure compliance, anonymizing{' '}
              <strong>{anonymizeTarget.name}</strong> will purge their name, email, and phone number.
            </p>

            <div className="rounded-lg bg-gray-50 p-3 text-xs text-gray-600 border border-gray-200">
              <strong>Tax Law Compliance Notice:</strong> All {anonymizeTarget.ordersCount} financial order
              records and invoice line items will remain preserved in accordance with legal tax retention requirements.
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setAnonymizeTarget(null)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAnonymize}
                className="bg-red-600 text-white hover:bg-red-700"
              >
                Anonymize Data
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
