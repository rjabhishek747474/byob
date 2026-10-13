import * as React from 'react';
import {
  Plus,
  Search,
  Filter,
  Package,
  Edit,
  Trash2,
  Eye,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { createMoney, formatMoney } from '@/lib/money';

// Mock product item representation
interface ProductItem {
  id: string;
  title: string;
  category: string;
  priceMinorUnits: number;
  stock: number;
  status: 'active' | 'draft' | 'archived';
  image: string;
}

// Mock products data - set to empty array when testing empty state
// TODO: Connect to tenant products query via Drizzle ORM
const mockProducts: ProductItem[] = [
  {
    id: 'prod_01J8K90001',
    title: 'Minimalist Cotton T-Shirt',
    category: 'Apparel',
    priceMinorUnits: 89900,
    stock: 45,
    status: 'active',
    image: '/placeholder-product.png',
  },
  {
    id: 'prod_01J8K90002',
    title: 'Vintage Leather Backpack',
    category: 'Accessories',
    priceMinorUnits: 299900,
    stock: 12,
    status: 'active',
    image: '/placeholder-product.png',
  },
  {
    id: 'prod_01J8K90003',
    title: 'Ceramic Pour-Over Dripper',
    category: 'Kitchenware',
    priceMinorUnits: 149900,
    stock: 0,
    status: 'draft',
    image: '/placeholder-product.png',
  },
];

export default async function ProductsPage() {
  const hasProducts = mockProducts.length > 0;

  return (
    <div className="space-y-6">
      {/* Page Title & Action */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
            Products
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage your store catalog, pricing, inventory, and visibility.
          </p>
        </div>
        <Button className="flex items-center gap-1.5 shadow-sm">
          <Plus className="h-4 w-4" />
          <span>Create Product</span>
        </Button>
      </div>

      {/* Filter & Search Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                placeholder="Search products by title, SKU..."
                className="h-9 w-full rounded-md border border-gray-200 bg-white pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Filter by category"
                className="h-9 rounded-md border border-gray-200 bg-white px-3 py-1 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                defaultValue="all"
              >
                <option value="all">All Categories</option>
                <option value="apparel">Apparel</option>
                <option value="accessories">Accessories</option>
                <option value="kitchenware">Kitchenware</option>
              </select>

              <select
                aria-label="Filter by status"
                className="h-9 rounded-md border border-gray-200 bg-white px-3 py-1 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                defaultValue="all"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="draft">Draft</option>
                <option value="archived">Archived</option>
              </select>

              <Button variant="outline" size="sm" className="h-9">
                <Filter className="mr-1.5 h-3.5 w-3.5" />
                Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Products Data Table or Empty State */}
      <Card>
        <CardContent className="p-0">
          {!hasProducts ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-4">
              <div className="rounded-full bg-blue-50 p-4 text-blue-600 mb-3">
                <Package className="h-8 w-8" />
              </div>
              <h3 className="text-base font-semibold text-gray-900">
                No products yet. Create your first product.
              </h3>
              <p className="mt-1 max-w-sm text-sm text-gray-500">
                Start adding items with custom variants, imagery, and pricing to build your online catalog.
              </p>
              <Button className="mt-4 flex items-center gap-1.5">
                <Plus className="h-4 w-4" />
                <span>Create Product</span>
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-600">
                <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Image
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Title
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Category
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Price
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Stock
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Status
                    </th>
                    <th scope="col" className="px-4 py-3 text-right font-semibold">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {mockProducts.map((product) => {
                    const price = createMoney(product.priceMinorUnits, 'INR');
                    return (
                      <tr key={product.id} className="hover:bg-gray-50">
                        {/* Image Column */}
                        <td className="px-4 py-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-md border border-gray-200 bg-gray-100 text-gray-400">
                            <Package className="h-5 w-5" />
                          </div>
                        </td>

                        {/* Title Column */}
                        <td className="px-4 py-3">
                          <div className="font-semibold text-gray-900">
                            {product.title}
                          </div>
                          <div className="text-xs text-gray-400 font-mono">
                            {product.id}
                          </div>
                        </td>

                        {/* Category */}
                        <td className="px-4 py-3">{product.category}</td>

                        {/* Price */}
                        <td className="px-4 py-3 font-medium text-gray-900">
                          {formatMoney(price)}
                        </td>

                        {/* Stock */}
                        <td className="px-4 py-3">
                          {product.stock > 0 ? (
                            <span className="text-gray-900 font-medium">
                              {product.stock} in stock
                            </span>
                          ) : (
                            <span className="text-red-600 font-semibold text-xs">
                              Out of stock
                            </span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3">
                          <Badge
                            variant={
                              product.status === 'active'
                                ? 'success'
                                : product.status === 'draft'
                                  ? 'warning'
                                  : 'secondary'
                            }
                          >
                            {product.status}
                          </Badge>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                              title="Preview"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                              title="Edit"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 text-sm text-gray-500">
            <div>
              Showing <span className="font-medium text-gray-900">1</span> to{' '}
              <span className="font-medium text-gray-900">{mockProducts.length}</span> of{' '}
              <span className="font-medium text-gray-900">{mockProducts.length}</span> results
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled>
                Previous
              </Button>
              <Button variant="outline" size="sm" disabled>
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
