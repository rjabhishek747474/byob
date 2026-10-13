'use client';

import * as React from 'react';
import {
  BarChart3,
  TrendingUp,
  Users,
  Activity,
  AlertCircle,
  Clock,
  Calendar,
  Filter,
  CheckCircle2,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { DataTable, ColumnDef } from '@/components/ui/data-table';
import { formatMoney, createMoney } from '@/lib/money';

interface FunnelMilestone {
  step: number;
  name: string;
  uniqueSessions: number;
  conversionRateFromStart: number;
  dropOffRate: number | null;
  dropOffLabel: string;
}

interface TopProduct {
  productId: string;
  productTitle: string;
  viewSessions: number;
  cartSessions: number;
  addToCartRate: number | null;
  statusLabel: string;
  [key: string]: unknown;
}

interface LastObservedStep {
  lastEventName: string;
  sessionCount: number;
  percentage: number;
  [key: string]: unknown;
}

export default function AdminAnalyticsDashboard() {
  const [dateRange, setDateRange] = React.useState('30d');
  const [loading, setLoading] = React.useState(true);
  const [freshness, setFreshness] = React.useState('Events processed in real time');
  const [funnelMilestones, setFunnelMilestones] = React.useState<FunnelMilestone[]>([]);
  const [overallConversionRate, setOverallConversionRate] = React.useState(0);
  const [totalStartSessions, setTotalStartSessions] = React.useState(0);
  const [completedSessions, setCompletedSessions] = React.useState(0);
  const [topProducts, setTopProducts] = React.useState<TopProduct[]>([]);
  const [lastObservedSteps, setLastObservedSteps] = React.useState<LastObservedStep[]>([]);
  const [lastObservedDisclaimer, setLastObservedDisclaimer] = React.useState(
    'Estimated based on last observed event received; does not indicate cause of exit.'
  );
  const [revenue, setRevenue] = React.useState<{
    orderCount: number;
    totalRevenueMinorUnits: number;
    averageOrderValueMinorUnits: number;
    currency: string;
    disclaimer: string;
  }>({
    orderCount: 0,
    totalRevenueMinorUnits: 0,
    averageOrderValueMinorUnits: 0,
    currency: 'INR',
    disclaimer: '',
  });

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    try {
      const now = new Date();
      const fromDate = new Date();
      if (dateRange === '7d') {
        fromDate.setDate(now.getDate() - 7);
      } else if (dateRange === '30d') {
        fromDate.setDate(now.getDate() - 30);
      } else if (dateRange === '90d') {
        fromDate.setDate(now.getDate() - 90);
      } else {
        fromDate.setDate(now.getDate() - 365);
      }

      const params = new URLSearchParams({
        fromDate: fromDate.toISOString(),
        toDate: now.toISOString(),
      });

      const [overviewRes, productsRes] = await Promise.all([
        fetch(`/api/v1/admin/analytics/overview?${params.toString()}`),
        fetch(`/api/v1/admin/analytics/products?${params.toString()}&limit=10`),
      ]);

      if (overviewRes.ok) {
        const json = await overviewRes.json();
        if (json.success && json.data) {
          const { funnel, revenue: rev, lastObserved, freshness: fresh } = json.data;
          setFunnelMilestones(funnel?.milestones || []);
          setTotalStartSessions(funnel?.totalStartSessions || 0);
          setCompletedSessions(funnel?.completedSessions || 0);
          setOverallConversionRate(funnel?.overallConversionRate || 0);
          if (rev) setRevenue(rev);
          if (lastObserved) {
            setLastObservedSteps(lastObserved.steps || []);
            setLastObservedDisclaimer(lastObserved.disclaimer);
          }
          if (fresh) setFreshness(fresh);
        }
      }

      if (productsRes.ok) {
        const json = await productsRes.json();
        if (json.success && json.data?.products) {
          setTopProducts(json.data.products);
        }
      }
    } catch (err) {
      console.error('Failed to load analytics dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      void fetchData();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchData]);

  const productColumns: ColumnDef<TopProduct>[] = [
    {
      key: 'productTitle',
      header: 'Product',
      cell: (item) => (
        <div>
          <span className="font-medium text-gray-900">{item.productTitle}</span>
          <span className="block text-xs text-gray-400">ID: {item.productId}</span>
        </div>
      ),
    },
    {
      key: 'viewSessions',
      header: 'Unique View Sessions',
      cell: (item) => (
        <span className="tabular-nums font-medium text-gray-700">{item.viewSessions.toLocaleString()}</span>
      ),
    },
    {
      key: 'cartSessions',
      header: 'Cart Sessions',
      cell: (item) => (
        <span className="tabular-nums font-medium text-gray-700">{item.cartSessions.toLocaleString()}</span>
      ),
    },
    {
      key: 'addToCartRate',
      header: 'Add-to-Cart Rate',
      cell: (item) =>
        item.addToCartRate !== null ? (
          <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 font-semibold">
            {item.addToCartRate}%
          </Badge>
        ) : (
          <span className="text-xs text-gray-400 italic">insufficient data</span>
        ),
    },
  ];

  const lastObservedColumns: ColumnDef<LastObservedStep>[] = [
    {
      key: 'lastEventName',
      header: 'Last Observed Event',
      cell: (item) => (
        <code className="text-xs font-mono bg-gray-100 text-gray-800 px-2 py-0.5 rounded">
          {item.lastEventName}
        </code>
      ),
    },
    {
      key: 'sessionCount',
      header: 'Sessions',
      cell: (item) => (
        <span className="tabular-nums font-medium text-gray-700">{item.sessionCount.toLocaleString()}</span>
      ),
    },
    {
      key: 'percentage',
      header: 'Share',
      cell: (item) => (
        <div className="flex items-center gap-2">
          <div className="w-16 bg-gray-200 h-2 rounded-full overflow-hidden">
            <div
              className="bg-blue-600 h-full rounded-full"
              style={{ width: `${Math.min(100, item.percentage)}%` }}
            />
          </div>
          <span className="text-xs text-gray-600 font-medium tabular-nums">{item.percentage}%</span>
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-blue-600" />
            Behavioral Analytics & Conversion Funnels
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Privacy-first shopper journey tracking with strict Anti-PII sanitization
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 px-2.5 py-1.5 rounded-md font-medium border border-emerald-100">
            <Activity className="w-3.5 h-3.5 animate-pulse" />
            <span>{freshness}</span>
          </div>

          <div className="w-44">
            <Select value={dateRange} onValueChange={(val) => setDateRange(val)}>
              <SelectTrigger>
                <SelectValue placeholder="Date range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
                <SelectItem value="365d">Last 12 months</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium text-gray-500">
              Browse Sessions
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-gray-900">
              {totalStartSessions.toLocaleString()}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-gray-500 flex items-center gap-1">
            <Users className="w-3.5 h-3.5 text-gray-400" />
            <span>Unique browse sessions</span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium text-gray-500">
              Completed Orders
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-gray-900">
              {completedSessions.toLocaleString()}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-gray-500 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span>Unique completed checkouts</span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium text-gray-500">
              Overall Funnel Conversion
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-emerald-600">
              {overallConversionRate}%
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-gray-500 flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
            <span>Browse to completed purchase</span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium text-gray-500">
              Verified Revenue
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-gray-900">
              {formatMoney(createMoney(revenue.totalRevenueMinorUnits, revenue.currency))}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-gray-500 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-blue-500" />
            <span>{revenue.orderCount} delivered orders</span>
          </CardContent>
        </Card>
      </div>

      {/* 6-Step Conversion Funnel Visualization */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold text-gray-900 flex items-center justify-between">
            <span>6-Step Conversion Funnel</span>
            <Badge variant="outline" className="text-xs text-gray-500 font-normal">
              Distinct Session Milestones
            </Badge>
          </CardTitle>
          <CardDescription className="text-xs text-gray-500">
            Measures sessions progressing through ordered checkout phases. Denominators use DISTINCT sessions consistently.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            {funnelMilestones.map((milestone) => (
              <div key={milestone.step} className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 flex items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-bold">
                      {milestone.step}
                    </span>
                    <span className="text-sm font-semibold text-gray-900">{milestone.name}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="font-semibold text-gray-900">
                      {milestone.uniqueSessions.toLocaleString()} sessions
                    </span>
                    <span className="text-gray-500">
                      ({milestone.conversionRateFromStart}% from start)
                    </span>
                  </div>
                </div>

                {/* Funnel Progress Bar */}
                <div className="w-full bg-gray-200 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-blue-600 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(1, milestone.conversionRateFromStart))}%` }}
                  />
                </div>

                {/* Drop-off notice */}
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-gray-500">
                  <span>{milestone.dropOffLabel}</span>
                  {milestone.dropOffRate !== null && (
                    <span className="text-rose-600 font-medium">
                      -{milestone.dropOffRate}% drop-off
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Grid: Top Products and Last Observed Step */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Products */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold text-gray-900">
              Top Products by Engagement
            </CardTitle>
            <CardDescription className="text-xs text-gray-500">
              Unique session views vs add-to-cart actions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              data={topProducts}
              columns={productColumns}
              loading={loading}
              emptyMessage="No product view events found in selected period."
            />
          </CardContent>
        </Card>

        {/* Last Observed Step Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold text-gray-900">
              Last Observed Step Before Inactivity
            </CardTitle>
            <CardDescription className="text-xs text-gray-500 flex items-start gap-1">
              <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
              <span>{lastObservedDisclaimer}</span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              data={lastObservedSteps}
              columns={lastObservedColumns}
              loading={loading}
              emptyMessage="No telemetry events recorded in selected period."
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
