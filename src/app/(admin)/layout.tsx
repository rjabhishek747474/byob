import * as React from 'react';
import { Sidebar } from '@/components/admin/sidebar';
import { Header } from '@/components/admin/header';
import { AdminProvider } from '@/components/admin/admin-context';

export interface AdminLayoutProps {
  children: React.ReactNode;
}

/**
 * Admin root layout wrapping all administrative routes.
 * Features a fixed/collapsible sidebar and sticky top header with responsive main content.
 */
export default async function AdminLayout({ children }: AdminLayoutProps) {
  // TODO: Add auth check wrapper (e.g. verifySession() from cookies / middleware redirect)
  // const session = await verifySession();
  // if (!session) { redirect('/login'); }

  return (
    <AdminProvider>
      <div className="flex min-h-screen bg-gray-50 text-gray-900">
        {/* Left Sidebar (Desktop fixed 256px / Mobile drawer) */}
        <Sidebar />

        {/* Right Content Area */}
        <div className="flex min-w-0 flex-1 flex-col">
          <Header />
          <main className="flex-1 p-4 sm:p-6 lg:p-8">
            <div className="mx-auto max-w-7xl">{children}</div>
          </main>
        </div>
      </div>
    </AdminProvider>
  );
}
