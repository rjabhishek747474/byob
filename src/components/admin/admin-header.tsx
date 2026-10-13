'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Bell,
  ExternalLink,
  LifeBuoy,
  LogOut,
  Menu,
  Search,
  Settings,
  User,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export interface AdminHeaderProps {
  onToggleSidebar?: () => void;
  title?: string;
  user?: {
    name: string;
    email: string;
    avatarUrl?: string;
    role?: string;
  };
  storeUrl?: string;
  className?: string;
}

export function AdminHeader({
  onToggleSidebar,
  title,
  user = {
    name: 'Alex Morgan',
    email: 'alex@beyourownboss.dev',
    role: 'Store Owner',
  },
  storeUrl = 'https://demo.beyourownboss.store',
  className,
}: AdminHeaderProps) {
  const userInitials = user.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return (
    <header
      className={cn(
        'sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-gray-200 bg-white/95 px-4 backdrop-blur-xs sm:px-6',
        className
      )}
    >
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleSidebar}
          className="lg:hidden text-gray-500 hover:text-gray-900"
          aria-label="Toggle navigation"
        >
          <Menu className="h-5 w-5" />
        </Button>
        {title && (
          <h1 className="text-base sm:text-lg font-semibold text-gray-900">
            {title}
          </h1>
        )}
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <div className="relative hidden md:block w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
          <input
            type="search"
            placeholder="Search catalog, orders..."
            className="h-9 w-full rounded-md border border-gray-200 bg-gray-50 pl-9 pr-3 text-xs text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {storeUrl && (
          <Button
            asChild
            variant="outline"
            size="sm"
            className="hidden sm:inline-flex text-xs h-9 gap-1.5 text-gray-700"
          >
            <Link href={storeUrl} target="_blank" rel="noopener noreferrer">
              <span>View Store</span>
              <ExternalLink className="h-3.5 w-3.5 text-gray-400" />
            </Link>
          </Button>
        )}

        <Button
          variant="ghost"
          size="icon"
          className="relative text-gray-500 hover:text-gray-900"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          <span className="absolute top-2 right-2 flex h-2 w-2 rounded-full bg-blue-600 ring-2 ring-white" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="relative h-9 w-9 rounded-full p-0 ring-offset-2 hover:ring-2 hover:ring-blue-500 focus:outline-none"
            >
              <Avatar className="h-9 w-9">
                {user.avatarUrl && (
                  <AvatarImage src={user.avatarUrl} alt={user.name} />
                )}
                <AvatarFallback>{userInitials}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none text-gray-900">
                  {user.name}
                </p>
                <p className="text-xs leading-none text-gray-500">
                  {user.email}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem className="cursor-pointer">
                <User className="mr-2 h-4 w-4 text-gray-500" />
                <span>My Profile</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer">
                <Settings className="mr-2 h-4 w-4 text-gray-500" />
                <span>Account Settings</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer">
                <LifeBuoy className="mr-2 h-4 w-4 text-gray-500" />
                <span>Support & Docs</span>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer text-red-600 focus:text-red-700">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Sign out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
