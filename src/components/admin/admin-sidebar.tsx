'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sparkles, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ADMIN_NAV_SECTIONS, type NavItem } from './admin-nav';
import { TenantSwitcher } from './tenant-switcher';

export interface AdminSidebarProps {
  onCloseMobile?: () => void;
  className?: string;
}

export function AdminSidebar({ onCloseMobile, className }: AdminSidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        'flex h-full w-64 flex-col border-r border-gray-200 bg-white text-gray-900',
        className
      )}
    >
      {/* Brand Header */}
      <div className="flex h-16 items-center justify-between border-b border-gray-200 px-4">
        <Link href="/admin" className="flex items-center gap-2 font-bold tracking-tight text-gray-900">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white font-black text-base shadow-xs">
            B
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold leading-none tracking-tight">BeYourOwnBoss</span>
            <span className="text-[10px] font-medium text-gray-400">Admin Platform</span>
          </div>
        </Link>
        {onCloseMobile && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onCloseMobile}
            className="lg:hidden text-gray-400 hover:text-gray-900"
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </Button>
        )}
      </div>

      {/* Tenant Switcher Section */}
      <div className="p-3 border-b border-gray-100">
        <TenantSwitcher />
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {ADMIN_NAV_SECTIONS.map((section, sIdx) => (
          <div key={`section-${sIdx}`} className="space-y-1">
            {section.title && (
              <h2 className="px-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                {section.title}
              </h2>
            )}
            <ul className="space-y-0.5">
              {section.items.map((item: NavItem) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== '/admin' && pathname?.startsWith(item.href));
                const Icon = item.icon;

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onCloseMobile}
                      className={cn(
                        'group flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-blue-50 text-blue-700 font-semibold'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <Icon
                          className={cn(
                            'h-4 w-4 shrink-0 transition-colors',
                            isActive
                              ? 'text-blue-600'
                              : 'text-gray-400 group-hover:text-gray-600'
                          )}
                        />
                        <span>{item.title}</span>
                      </div>
                      {item.badge && (
                        <Badge
                          variant="secondary"
                          size="sm"
                          className="ml-auto text-[10px]"
                        >
                          {item.badge}
                        </Badge>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Plan / Multi-Tenant Isolation Badge */}
      <div className="border-t border-gray-200 p-4">
        <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-900 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-blue-600" /> Pro Plan
            </span>
            <Badge variant="success" size="sm">Active</Badge>
          </div>
          <p className="text-[11px] text-gray-500">
            Tenant isolation active. PostgreSQL schema isolated.
          </p>
        </div>
      </div>
    </aside>
  );
}
