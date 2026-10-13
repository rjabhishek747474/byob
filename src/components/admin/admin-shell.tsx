'use client';

import * as React from 'react';
import { cn } from '@/lib/cn';
import { Toaster } from '@/components/ui/toast';
import { AdminHeader, type AdminHeaderProps } from './admin-header';
import { AdminSidebar } from './admin-sidebar';

export interface AdminShellProps {
  children: React.ReactNode;
  title?: string;
  user?: AdminHeaderProps['user'];
  storeUrl?: string;
  className?: string;
}

export function AdminShell({
  children,
  title,
  user,
  storeUrl,
  className,
}: AdminShellProps) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = React.useState(false);

  // Close mobile sidebar on Escape key
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileSidebarOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile Drawer Backdrop */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs transition-opacity lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile Drawer Content */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 transform bg-white transition-transform duration-200 ease-in-out lg:hidden',
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <AdminSidebar onCloseMobile={() => setMobileSidebarOpen(false)} />
      </div>

      {/* Desktop Persistent Sidebar */}
      <div className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0">
        <AdminSidebar />
      </div>

      {/* Main Administrative Content Area */}
      <div className="flex flex-1 flex-col lg:pl-64">
        <AdminHeader
          title={title}
          user={user}
          storeUrl={storeUrl}
          onToggleSidebar={() => setMobileSidebarOpen((prev) => !prev)}
        />

        <main className={cn('flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto', className)}>
          {children}
        </main>
      </div>

      {/* Global Toast Notification Viewport */}
      <Toaster />
    </div>
  );
}
