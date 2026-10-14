'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Menu,
  Search,
  ChevronRight,
  Store,
  Check,
  User,
  Settings,
  LogOut,
  ChevronDown,
  ExternalLink,
} from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useAdminContext, TenantInfo } from './admin-context';

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const {
    toggleSidebar,
    currentTenant,
    setCurrentTenant,
    tenantsList,
  } = useAdminContext();

  const handleSignOut = async () => {
    try {
      await fetch('/api/v1/auth/logout', { method: 'POST' });
    } catch (e) {
      console.error('Sign out failed', e);
    } finally {
      router.push('/login');
    }
  };

  // Generate breadcrumb segments from pathname
  const segments = pathname.split('/').filter(Boolean);
  const breadcrumbItems = segments.map((seg, idx) => {
    const href = '/' + segments.slice(0, idx + 1).join('/');
    const title = seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, ' ');
    return { title, href, isLast: idx === segments.length - 1 };
  });

  const isDev = process.env.NODE_ENV !== 'production';

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-gray-200 bg-white/95 px-4 backdrop-blur sm:px-6">
      {/* Left: Mobile hamburger & Breadcrumbs */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggleSidebar}
          className="rounded-md p-2 text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 lg:hidden"
          aria-label="Toggle navigation menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Breadcrumb nav */}
        <nav aria-label="Breadcrumb" className="hidden sm:flex items-center space-x-1 text-sm text-gray-500">
          <Link
            href="/dashboard"
            className="font-medium text-gray-700 hover:text-blue-600 transition-colors"
          >
            Admin
          </Link>
          {breadcrumbItems.map((item) => (
            <React.Fragment key={item.href}>
              <ChevronRight className="h-4 w-4 text-gray-400" />
              {item.isLast ? (
                <span className="font-semibold text-gray-900">{item.title}</span>
              ) : (
                <Link
                  href={item.href}
                  className="hover:text-blue-600 transition-colors"
                >
                  {item.title}
                </Link>
              )}
            </React.Fragment>
          ))}
        </nav>
      </div>

      {/* Middle: Search bar */}
      <div className="hidden md:flex flex-1 max-w-md mx-6">
        <div className="relative w-full">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            placeholder="Search products, orders, customers..."
            className="h-9 w-full rounded-md border border-gray-200 bg-gray-50 pl-9 pr-4 text-sm text-gray-900 transition-colors placeholder:text-gray-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Right: Tenant selector, Env badge, User Profile */}
      <div className="flex items-center gap-2 sm:gap-4">
        {/* Environment Badge */}
        {isDev && (
          <span className="inline-flex items-center rounded-md bg-amber-100 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-amber-800">
            DEV
          </span>
        )}

        {/* Quick View Storefront Button */}
        <a
          href={`http://localhost:3000/?tenant=${currentTenant.slug}`}
          target="_blank"
          rel="noreferrer"
          className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 px-2.5 py-1.5 rounded-md shadow-xs transition-colors"
          title="Open live website for the active store"
        >
          <Store className="h-3.5 w-3.5 text-blue-600" />
          <span>Live Site</span>
          <ExternalLink className="h-3 w-3 text-gray-400" />
        </a>

        {/* Tenant / Store Selector Dropdown */}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs sm:text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <Store className="h-4 w-4 text-blue-600" />
              <span className="max-w-[100px] truncate sm:max-w-[140px]">
                {currentTenant.name}
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
            </button>
          </DropdownMenu.Trigger>

          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className="z-50 min-w-48 rounded-md border border-gray-200 bg-white p-1 shadow-lg ring-1 ring-black/5 animate-in fade-in-80"
              side="bottom"
              align="end"
              sideOffset={4}
            >
              <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                Switch Store
              </div>
              {tenantsList.map((t: TenantInfo) => {
                const isSelected = t.id === currentTenant.id;
                return (
                  <DropdownMenu.Item
                    key={t.id}
                    onClick={() => setCurrentTenant(t)}
                    className="flex cursor-pointer items-center justify-between rounded-sm px-2 py-1.5 text-sm text-gray-700 outline-none hover:bg-gray-100 focus:bg-gray-100"
                  >
                    <div className="flex flex-col">
                      <span className="font-medium text-gray-900">{t.name}</span>
                      <span className="text-xs text-gray-400">{t.plan} Plan</span>
                    </div>
                    {isSelected && <Check className="h-4 w-4 text-blue-600" />}
                  </DropdownMenu.Item>
                );
              })}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>

        {/* User Profile Avatar & Dropdown */}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-white font-semibold text-sm shadow-sm hover:ring-2 hover:ring-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="User profile menu"
            >
              AD
            </button>
          </DropdownMenu.Trigger>

          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className="z-50 min-w-48 rounded-md border border-gray-200 bg-white p-1 shadow-lg ring-1 ring-black/5 animate-in fade-in-80"
              side="bottom"
              align="end"
              sideOffset={4}
            >
              <div className="px-2 py-1.5 text-xs text-gray-500 border-b border-gray-100">
                <p className="font-semibold text-gray-900">Alex Doe</p>
                <p className="truncate text-gray-500">admin@byob.store</p>
              </div>
              <DropdownMenu.Item asChild>
                <Link
                  href="/settings"
                  className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-gray-700 outline-none hover:bg-gray-100 focus:bg-gray-100"
                >
                  <User className="h-4 w-4" />
                  <span>Profile</span>
                </Link>
              </DropdownMenu.Item>
              <DropdownMenu.Item asChild>
                <Link
                  href="/settings"
                  className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-gray-700 outline-none hover:bg-gray-100 focus:bg-gray-100"
                >
                  <Settings className="h-4 w-4" />
                  <span>Settings</span>
                </Link>
              </DropdownMenu.Item>
              <DropdownMenu.Separator className="my-1 h-px bg-gray-100" />
              <DropdownMenu.Item
                onClick={handleSignOut}
                className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-red-600 outline-none hover:bg-red-50 focus:bg-red-50"
              >
                <LogOut className="h-4 w-4" />
                <span>Sign Out</span>
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </header>
  );
}
