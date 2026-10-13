import * as React from 'react';
import {
  Plus,
  Folder,
  Layers,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface CategoryItem {
  id: string;
  name: string;
  slug: string;
  productCount: number;
  isActive: boolean;
  subcategories: string[];
}

const mockCategories: CategoryItem[] = [
  {
    id: 'cat_01J8K90001',
    name: 'Apparel & Clothing',
    slug: 'apparel-clothing',
    productCount: 142,
    isActive: true,
    subcategories: ['Men', 'Women', 'Unisex', 'Outerwear', 'Accessories'],
  },
  {
    id: 'cat_01J8K90002',
    name: 'Footwear',
    slug: 'footwear',
    productCount: 56,
    isActive: true,
    subcategories: ['Sneakers', 'Boots', 'Sandals', 'Formal'],
  },
  {
    id: 'cat_01J8K90003',
    name: 'Home & Kitchen',
    slug: 'home-kitchen',
    productCount: 89,
    isActive: true,
    subcategories: ['Cookware', 'Ceramics', 'Coffee & Tea', 'Dining'],
  },
  {
    id: 'cat_01J8K90004',
    name: 'Electronics & Audio',
    slug: 'electronics-audio',
    productCount: 24,
    isActive: false,
    subcategories: ['Headphones', 'Speakers', 'Cables & Adapters'],
  },
];

export default async function CategoriesPage() {
  return (
    <div className="space-y-6">
      {/* Page Title & Action */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
            Categories
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Organize products into hierarchical taxonomies and storefront collections.
          </p>
        </div>
        <Button className="flex items-center gap-1.5 shadow-sm">
          <Plus className="h-4 w-4" />
          <span>Create Category</span>
        </Button>
      </div>

      {/* Categories Grid Cards / Tree */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
        {mockCategories.map((cat) => (
          <Card key={cat.id} className="transition-all hover:shadow-md">
            <CardHeader className="flex flex-row items-start justify-between pb-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <Folder className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold">
                    {cat.name}
                  </CardTitle>
                  <p className="text-xs text-gray-400 font-mono">/{cat.slug}</p>
                </div>
              </div>

              {/* Status Toggle / Badge */}
              <div className="flex items-center gap-2">
                <Badge variant={cat.isActive ? 'success' : 'secondary'}>
                  {cat.isActive ? 'Active' : 'Hidden'}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-3 pt-0">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span className="flex items-center gap-1 font-medium">
                  <Layers className="h-3.5 w-3.5 text-gray-400" />
                  {cat.productCount} Total Products
                </span>
                <span>{cat.subcategories.length} Subcategories</span>
              </div>

              {/* Subcategories list */}
              <div className="rounded-md bg-gray-50 p-2.5">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
                  Subcategories
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {cat.subcategories.map((sub) => (
                    <span
                      key={sub}
                      className="inline-flex items-center rounded bg-white px-2 py-0.5 text-xs text-gray-700 border border-gray-200 shadow-2xs"
                    >
                      {sub}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end pt-2 border-t border-gray-100 gap-2">
                <Button variant="ghost" size="sm" className="text-xs">
                  Edit Taxonomy
                </Button>
                <Button variant="outline" size="sm" className="text-xs">
                  Manage Products
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
