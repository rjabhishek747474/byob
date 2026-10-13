import * as React from 'react';
import { notFound } from 'next/navigation';
import {
  CheckCircle2,
  Clock,
  Package,
  Truck,
  Home,
  AlertCircle,
  HelpCircle,
  ShieldCheck,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getPublicOrderTracking } from '@/modules/orders/order-service';

interface TrackingPageProps {
  params: Promise<{ token: string }> | { token: string };
}

/**
 * Standard linear fulfillment stages for visual stepper.
 */
const TRACKING_STEPS = [
  { key: 'pending_confirmation', label: 'Order Placed', icon: Clock },
  { key: 'confirmed', label: 'Confirmed', icon: CheckCircle2 },
  { key: 'processing', label: 'Processing', icon: Package },
  { key: 'shipped', label: 'Shipped', icon: Truck },
  { key: 'delivered', label: 'Delivered', icon: Home },
] as const;

export default async function OrderTrackingPage({ params }: TrackingPageProps) {
  const resolvedParams = await params;
  const token = resolvedParams?.token;

  if (!token) {
    notFound();
  }

  let trackingData;
  try {
    trackingData = await getPublicOrderTracking(token);
  } catch (err: unknown) {
    notFound();
  }

  const { orderNumber, status, createdAt, deliveryStatus, statusHistory, items } = trackingData;

  const isCancelled = status === 'cancelled';
  const isReturned = status === 'returned' || status === 'refunded';

  // Determine active step index
  const activeStepIndex = TRACKING_STEPS.findIndex((step) => step.key === status);
  const currentStep = activeStepIndex !== -1 ? activeStepIndex : 0;

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm text-gray-500 font-medium">
              <span>Order Tracking</span>
              <span>•</span>
              <span className="flex items-center gap-1 text-emerald-600">
                <ShieldCheck className="h-4 w-4" />
                Verified Purchase
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 mt-1">
              {orderNumber}
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              Placed on {new Date(createdAt).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>

          <div>
            <Badge
              variant={
                isCancelled
                  ? 'danger'
                  : isReturned
                  ? 'warning'
                  : status === 'delivered'
                  ? 'success'
                  : 'outline'
              }
              className="text-sm px-3 py-1 font-semibold capitalize"
            >
              {deliveryStatus}
            </Badge>
          </div>
        </div>

        {/* Stepper Card */}
        <Card className="shadow-sm border-gray-200">
          <CardHeader className="border-b border-gray-100 bg-gray-50/50 pb-4">
            <CardTitle className="text-base font-semibold text-gray-900">
              Delivery Progress
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {isCancelled ? (
              <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
                <AlertCircle className="h-6 w-6 shrink-0" />
                <div>
                  <div className="font-semibold text-sm">Order Cancelled</div>
                  <div className="text-xs mt-0.5">
                    This order was cancelled. Any payment hold will be released automatically.
                  </div>
                </div>
              </div>
            ) : isReturned ? (
              <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800">
                <AlertCircle className="h-6 w-6 shrink-0" />
                <div>
                  <div className="font-semibold text-sm">Order Returned</div>
                  <div className="text-xs mt-0.5">
                    The items in this order have been processed for return or refund.
                  </div>
                </div>
              </div>
            ) : (
              <div className="relative">
                {/* Horizontal progress track on desktop */}
                <div className="hidden sm:block absolute top-5 left-6 right-6 h-0.5 bg-gray-200 -z-0">
                  <div
                    className="h-full bg-blue-600 transition-all duration-500"
                    style={{
                      width: `${(Math.max(0, currentStep) / (TRACKING_STEPS.length - 1)) * 100}%`,
                    }}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-5 gap-6 sm:gap-2">
                  {TRACKING_STEPS.map((step, idx) => {
                    const isCompleted = idx <= currentStep;
                    const isCurrent = idx === currentStep;
                    const Icon = step.icon;

                    return (
                      <div
                        key={step.key}
                        className="flex sm:flex-col items-center gap-3 sm:gap-2 text-left sm:text-center relative z-10"
                      >
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                            isCompleted
                              ? 'bg-blue-600 border-blue-600 text-white'
                              : 'bg-white border-gray-300 text-gray-400'
                          } ${isCurrent ? 'ring-4 ring-blue-100' : ''}`}
                        >
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <p
                            className={`text-xs font-semibold ${
                              isCompleted ? 'text-gray-900' : 'text-gray-400'
                            }`}
                          >
                            {step.label}
                          </p>
                          {isCurrent && (
                            <span className="text-[10px] text-blue-600 font-medium block">
                              In Progress
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Estimated delivery placeholder */}
            {!isCancelled && !isReturned && (
              <div className="mt-8 pt-6 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-gray-600 gap-2">
                <div>
                  <span className="font-semibold text-gray-700">Estimated Delivery: </span>
                  <span>3-5 business days from order confirmation</span>
                </div>
                <div className="text-gray-400">Standard Delivery</div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Items Summary Card */}
        <Card className="shadow-sm border-gray-200">
          <CardHeader className="border-b border-gray-100 bg-gray-50/50 pb-4">
            <CardTitle className="text-base font-semibold text-gray-900">
              Items in Order ({items.reduce((acc, i) => acc + i.quantity, 0)})
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-gray-100 p-0">
            {items.map((item, index) => (
              <div key={index} className="flex items-center justify-between p-4 hover:bg-gray-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 shrink-0 border border-gray-200">
                    <Package className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900">
                      {item.productTitle}
                    </h4>
                    {item.variantName && (
                      <p className="text-xs text-gray-500">{item.variantName}</p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-1 rounded">
                    Qty: {item.quantity}
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Timeline Updates */}
        {statusHistory.length > 0 && (
          <Card className="shadow-sm border-gray-200">
            <CardHeader className="border-b border-gray-100 bg-gray-50/50 pb-4">
              <CardTitle className="text-base font-semibold text-gray-900">
                Status History
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 pb-6">
              <ul className="space-y-4">
                {statusHistory.map((history, idx) => (
                  <li key={idx} className="flex items-start gap-3 text-xs">
                    <div className="w-2 h-2 rounded-full bg-blue-600 mt-1.5 shrink-0" />
                    <div className="flex-1">
                      <span className="font-semibold text-gray-800 capitalize">
                        {history.status.replace(/_/g, ' ')}
                      </span>
                      {history.reason && (
                        <p className="text-gray-500 mt-0.5">{history.reason}</p>
                      )}
                    </div>
                    <span className="text-gray-400 shrink-0">
                      {new Date(history.timestamp).toLocaleDateString('en-IN', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Privacy Note & Support Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between text-xs text-gray-500 gap-3 px-2">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-gray-400" />
            <span>Customer personal information is shielded for privacy protection.</span>
          </div>

          <div className="flex items-center gap-1.5 hover:text-blue-600 cursor-pointer">
            <HelpCircle className="h-4 w-4" />
            <span>Need help with this order? Contact store support.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

