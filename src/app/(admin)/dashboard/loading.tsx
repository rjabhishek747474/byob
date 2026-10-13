import * as React from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';

export default function DashboardLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Page Header Skeleton */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="h-8 w-48 rounded bg-gray-200" />
          <div className="mt-2 h-4 w-72 rounded bg-gray-200" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-32 rounded bg-gray-200" />
          <div className="h-9 w-20 rounded bg-gray-200" />
        </div>
      </div>

      {/* 4 KPI Cards Grid Skeleton */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="h-4 w-24 rounded bg-gray-200" />
              <div className="h-8 w-8 rounded-md bg-gray-200" />
            </CardHeader>
            <CardContent>
              <div className="h-7 w-28 rounded bg-gray-200" />
              <div className="mt-3 h-3 w-36 rounded bg-gray-200" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Orders Table Skeleton */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <div className="h-5 w-32 rounded bg-gray-200" />
            <div className="mt-2 h-4 w-60 rounded bg-gray-200" />
          </div>
          <div className="h-8 w-20 rounded bg-gray-200" />
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <div className="h-10 w-full rounded bg-gray-100 mb-4" />
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-2 border-b border-gray-100"
                >
                  <div className="h-4 w-28 rounded bg-gray-200" />
                  <div className="h-4 w-40 rounded bg-gray-200" />
                  <div className="h-4 w-12 rounded bg-gray-200" />
                  <div className="h-4 w-20 rounded bg-gray-200" />
                  <div className="h-6 w-16 rounded-full bg-gray-200" />
                  <div className="h-4 w-24 rounded bg-gray-200" />
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
