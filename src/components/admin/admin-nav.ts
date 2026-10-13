import {
  BarChart3,
  Boxes,
  FolderTree,
  LayoutDashboard,
  LucideIcon,
  Palette,
  Settings,
  ShoppingBag,
  Users,
} from 'lucide-react';

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
  description?: string;
}

export interface NavSection {
  title?: string;
  items: NavItem[];
}

export const ADMIN_NAV_SECTIONS: NavSection[] = [
  {
    title: 'Overview',
    items: [
      {
        title: 'Dashboard',
        href: '/admin',
        icon: LayoutDashboard,
      },
      {
        title: 'Analytics',
        href: '/admin/analytics',
        icon: BarChart3,
      },
    ],
  },
  {
    title: 'Commerce',
    items: [
      {
        title: 'Products',
        href: '/admin/products',
        icon: Boxes,
      },
      {
        title: 'Categories',
        href: '/admin/categories',
        icon: FolderTree,
      },
      {
        title: 'Orders',
        href: '/admin/orders',
        icon: ShoppingBag,
      },
      {
        title: 'Customers',
        href: '/admin/customers',
        icon: Users,
      },
    ],
  },
  {
    title: 'Marketing & Growth',
    items: [
      {
        title: '7-Day Banners',
        href: '/admin/banners',
        icon: Palette,
      },
      {
        title: 'Coupons & Promos',
        href: '/admin/promotions',
        icon: ShoppingBag,
      },
      {
        title: 'Subscription Plans',
        href: '/admin/plans',
        icon: Boxes,
      },
    ],
  },
  {
    title: 'Customization & Settings',
    items: [
      {
        title: 'Theme Engine',
        href: '/admin/theme',
        icon: Palette,
      },
      {
        title: 'Settings',
        href: '/admin/settings',
        icon: Settings,
      },
    ],
  },
];
