'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  FileText,
  Plus,
  Search,
  ExternalLink,
  Edit3,
  Copy,
  Trash2,
  CheckCircle,
  Clock,
  Sparkles,
  Eye,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAdminContext } from '@/components/admin/admin-context';

export interface PageRecord {
  id: string;
  title: string;
  slug: string;
  status: 'published' | 'draft';
  isHome: boolean;
  versionNumber: number;
  blocksCount: number;
  updatedAt: string;
}

const initialPages: PageRecord[] = [
  {
    id: 'page_home',
    title: 'Storefront Homepage',
    slug: 'home',
    status: 'published',
    isHome: true,
    versionNumber: 3,
    blocksCount: 10,
    updatedAt: '2026-10-12T18:30:00Z',
  },
  {
    id: 'page_about',
    title: 'About Our Brand',
    slug: 'about',
    status: 'published',
    isHome: false,
    versionNumber: 2,
    blocksCount: 5,
    updatedAt: '2026-10-10T12:00:00Z',
  },
  {
    id: 'page_terms',
    title: 'Terms & Conditions',
    slug: 'terms',
    status: 'published',
    isHome: false,
    versionNumber: 1,
    blocksCount: 3,
    updatedAt: '2026-09-28T09:15:00Z',
  },
  {
    id: 'page_privacy',
    title: 'Privacy Policy',
    slug: 'privacy',
    status: 'published',
    isHome: false,
    versionNumber: 1,
    blocksCount: 3,
    updatedAt: '2026-09-28T09:15:00Z',
  },
  {
    id: 'page_festive_drop',
    title: 'Festive Season Drop (Preview)',
    slug: 'festive-drop',
    status: 'draft',
    isHome: false,
    versionNumber: 1,
    blocksCount: 7,
    updatedAt: '2026-10-11T16:45:00Z',
  },
];

export default function PagesAdminPage() {
  const { currentTenant } = useAdminContext();
  const [pagesList, setPagesList] = React.useState<PageRecord[]>(initialPages);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<'all' | 'published' | 'draft'>('all');
  const [isNewPageModalOpen, setIsNewPageModalOpen] = React.useState(false);
  const [newTitle, setNewTitle] = React.useState('');
  const [newSlug, setNewSlug] = React.useState('');
  const [toastMessage, setToastMessage] = React.useState<string | null>(null);

  const filteredPages = pagesList.filter((page) => {
    const matchesSearch =
      page.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      page.slug.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || page.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleTitleChange = (val: string) => {
    setNewTitle(val);
    if (!newSlug || newSlug === newTitle.toLowerCase().replace(/[^a-z0-9]/g, '-')) {
      setNewSlug(val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
    }
  };

  const handleCreatePage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newSlug.trim()) return;

    const newPage: PageRecord = {
      id: `page_${Date.now().toString(36)}`,
      title: newTitle.trim(),
      slug: newSlug.trim().toLowerCase(),
      status: 'draft',
      isHome: false,
      versionNumber: 1,
      blocksCount: 0,
      updatedAt: new Date().toISOString(),
    };

    setPagesList((prev) => [newPage, ...prev]);
    setIsNewPageModalOpen(false);
    setNewTitle('');
    setNewSlug('');
    setToastMessage(`Page "${newPage.title}" created! Ready to customize in Builder.`);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleDeletePage = (id: string, isHome: boolean) => {
    if (isHome) {
      alert('The primary homepage cannot be deleted.');
      return;
    }
    setPagesList((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <div className="space-y-6">
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-800 flex items-center gap-2 shadow-sm animate-fade-in">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl flex items-center gap-2.5">
            <FileText className="w-7 h-7 text-blue-600" />
            <span>Store Pages</span>
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage custom storefront pages, legal notices, and landing layouts for {currentTenant.name}.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/builder">
            <Button variant="outline" className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-blue-600" />
              <span>Launch Builder</span>
            </Button>
          </Link>
          <Button onClick={() => setIsNewPageModalOpen(true)} className="flex items-center gap-1.5">
            <Plus className="w-4 h-4" />
            <span>New Page</span>
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <Card>
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search pages by title or slug..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="flex items-center gap-2">
              {(['all', 'published', 'draft'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg capitalize transition-colors ${
                    statusFilter === status
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pages Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase text-gray-500 font-semibold">
                <tr>
                  <th scope="col" className="px-6 py-3.5">Page Title</th>
                  <th scope="col" className="px-6 py-3.5">URL Slug</th>
                  <th scope="col" className="px-6 py-3.5">Status</th>
                  <th scope="col" className="px-6 py-3.5">Blocks</th>
                  <th scope="col" className="px-6 py-3.5">Version</th>
                  <th scope="col" className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredPages.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      <FileText className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                      <p className="font-semibold text-gray-900">No pages found</p>
                      <p className="text-xs text-gray-500 mt-0.5">Try adjusting your search query.</p>
                    </td>
                  </tr>
                ) : (
                  filteredPages.map((page) => (
                    <tr key={page.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-gray-900">{page.title}</span>
                              {page.isHome && (
                                <Badge variant="secondary" className="text-[10px] bg-blue-50 text-blue-700">
                                  Default Home
                                </Badge>
                              )}
                            </div>
                            <span className="text-xs text-gray-400">
                              Updated {new Date(page.updatedAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4 font-mono text-xs text-gray-600">
                        /{page.isHome ? '' : page.slug}
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full capitalize ${
                            page.status === 'published'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              page.status === 'published' ? 'bg-emerald-500' : 'bg-amber-500'
                            }`}
                          />
                          {page.status}
                        </span>
                      </td>

                      <td className="px-6 py-4 font-mono text-xs text-gray-700">
                        {page.blocksCount} blocks
                      </td>

                      <td className="px-6 py-4 font-mono text-xs text-gray-500">
                        v{page.versionNumber}
                      </td>

                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href="/builder"
                            className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded transition-colors"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>Edit Builder</span>
                          </Link>

                          {!page.isHome && (
                            <button
                              onClick={() => handleDeletePage(page.id, page.isHome)}
                              className="text-gray-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors"
                              title="Delete Page"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Create Page Modal */}
      {isNewPageModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden border border-gray-200">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg text-gray-900">Create New Store Page</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Add a landing page, policies, or brand story for {currentTenant.name}.
                </p>
              </div>
              <button
                onClick={() => setIsNewPageModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold leading-none p-1"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreatePage} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                  Page Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sustainability Commitment"
                  value={newTitle}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                  Page URL Path Slug *
                </label>
                <div className="flex rounded-lg shadow-sm">
                  <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-xs font-mono">
                    /
                  </span>
                  <input
                    type="text"
                    required
                    placeholder="sustainability"
                    value={newSlug}
                    onChange={(e) => setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    className="flex-1 text-sm border border-gray-300 rounded-r-lg px-3 py-2 font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-gray-100">
                <Button type="button" variant="outline" onClick={() => setIsNewPageModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Create Page</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
