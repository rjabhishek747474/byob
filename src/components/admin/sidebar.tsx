'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Package,
  FolderTree,
  ShoppingCart,
  Users,
  FileText,
  Paintbrush,
  Palette,
  Image as ImageIcon,
  Tag,
  BarChart3,
  CreditCard,
  Settings,
  Building2,
  X,
  LogOut,
  Store,
  ChevronDown,
  Sparkles,
} from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { cn } from '@/lib/cn';
import { useAdminContext } from './admin-context';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  badgeVariant?: 'primary' | 'secondary' | 'warning';
}

const mainNavItems: NavItem[] = [
  { label: 'Overview', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Products', href: '/products', icon: Package },
  { label: 'Categories', href: '/categories', icon: FolderTree },
  { label: 'Orders', href: '/orders', icon: ShoppingCart },
  { label: 'Customers', href: '/customers', icon: Users },
  { label: 'Pages', href: '/pages', icon: FileText },
  { label: 'Website Builder', href: '/builder', icon: Paintbrush },
  { label: 'Theme', href: '/theme', icon: Palette },
  { label: 'Banners', href: '/banners', icon: ImageIcon },
  { label: 'Promotions', href: '/promotions', icon: Tag },
  { label: 'Analytics', href: '/analytics', icon: BarChart3 },
  {
    label: 'Plans',
    href: '/plans',
    icon: CreditCard,
    badge: 'Pro',
    badgeVariant: 'warning',
  },
  { label: 'Settings', href: '/settings', icon: Settings },
];

const platformNavItems: NavItem[] = [
  { label: 'Tenants', href: '/tenants', icon: Building2 },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const {
    sidebarOpen,
    setSidebarOpen,
    currentTenant,
    isPlatformAdmin,
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

  const navContent = (
    <div className="flex h-full flex-col justify-between bg-white border-r border-gray-200">
      {/* Brand & Active Store Header */}
      <div className="flex flex-col border-b border-gray-200">
        <div className="flex h-16 items-center justify-between px-6">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 font-bold text-gray-900 tracking-tight"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white font-black text-sm shadow-sm">
              B
            </div>
            <span className="text-lg">BYOB Admin</span>
          </Link>
          <button
            type="button"
            className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Selected Tenant Indicator */}
        {currentTenant && (
          <div className="mx-4 mb-3 rounded-lg border border-gray-200 bg-gray-50 p-2.5">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span className="font-medium uppercase tracking-wider text-[10px]">
                Active Store
              </span>
              <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-800">
                {currentTenant.plan}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <Store className="h-4 w-4 text-blue-600 shrink-0" />
              <span className="truncate text-sm font-semibold text-gray-900">
                {currentTenant.name}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Items (Scrollable) */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
        <div>
          <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            Store Management
          </div>
          <nav className="space-y-1">
            {mainNavItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href ||
                (item.href !== '/dashboard' && pathname.startsWith(item.href));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    'group flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Icon
                      className={cn(
                        'h-4 w-4 shrink-0 transition-colors',
                        isActive
                          ? 'text-white'
                          : 'text-gray-500 group-hover:text-gray-700'
                      )}
                    />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span
                      className={cn(
                        'ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                        isActive
                          ? 'bg-blue-500 text-white'
                          : 'bg-amber-100 text-amber-800'
                      )}
                    >
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Platform Section (Platform Admins only) */}
        {isPlatformAdmin && (
          <div>
            <div className="flex items-center gap-1.5 px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              <Sparkles className="h-3 w-3 text-amber-500" />
              <span>Platform Administration</span>
            </div>
            <nav className="space-y-1">
              {platformNavItems.map((item) => {
                const Icon = item.icon;
                const isActive =
                  pathname === item.href || pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={cn(
                      'group flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Icon
                        className={cn(
                          'h-4 w-4 shrink-0 transition-colors',
                          isActive
                            ? 'text-white'
                            : 'text-gray-500 group-hover:text-gray-700'
                        )}
                      />
                      <span>{item.label}</span>
                    </div>
                  </Link>
                );
              })}
            </nav>
          </div>
        )}
      </div>

      {/* User Avatar & Dropdown Footer */}
      <div className="border-t border-gray-200 p-3">
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-lg p-2 text-left text-sm text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-semibold text-sm">
                  AD
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gray-900">
                    Alex Doe
                  </p>
                  <p className="truncate text-xs text-gray-500">
                    admin@byob.store
                  </p>
                </div>
              </div>
              <ChevronDown className="h-4 w-4 text-gray-400" />
            </button>
          </DropdownMenu.Trigger>

          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className="z-50 min-w-56 rounded-md border border-gray-200 bg-white p-1 shadow-lg ring-1 ring-black/5 animate-in fade-in-80"
              side="top"
              align="start"
              sideOffset={8}
            >
              <div className="px-2 py-1.5 text-xs text-gray-500 border-b border-gray-100">
                Signed in as <span className="font-medium text-gray-900">Platform Admin</span>
              </div>
              <DropdownMenu.Item asChild>
                <Link
                  href="/settings"
                  className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-gray-700 outline-none hover:bg-gray-100 focus:bg-gray-100"
                >
                  <Settings className="h-4 w-4" />
                  <span>Store Settings</span>
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
    </div>
  );

  return (
    <>
      {/* Mobile Backdrop & Drawer */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-64 transform transition-transform duration-200 ease-in-out lg:static lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-0 lg:translate-x-0 -translate-x-full'
        )}
      >
        {navContent}
      </aside>
    </>
  );
}
