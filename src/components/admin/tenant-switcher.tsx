'use client';

import * as React from 'react';
import { Check, ChevronsUpDown, PlusCircle, Store } from 'lucide-react';
import { cn } from '@/lib/cn';
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

export interface TenantOption {
  id: string;
  name: string;
  slug: string;
  domain?: string;
  role?: string;
}

export interface TenantSwitcherProps {
  tenants?: TenantOption[];
  currentTenantId?: string;
  onSelectTenant?: (tenant: TenantOption) => void;
  className?: string;
}

const DEFAULT_TENANTS: TenantOption[] = [
  {
    id: 'ten_01HXYZ1234ABC',
    name: 'Apex Athletics',
    slug: 'apex-athletics',
    domain: 'apex.beyourownboss.store',
    role: 'Owner',
  },
  {
    id: 'ten_02JKLM5678DEF',
    name: 'Zenith Roasters',
    slug: 'zenith-roasters',
    domain: 'zenith.beyourownboss.store',
    role: 'Admin',
  },
];

export function TenantSwitcher({
  tenants = DEFAULT_TENANTS,
  currentTenantId = DEFAULT_TENANTS[0]?.id,
  onSelectTenant,
  className,
}: TenantSwitcherProps) {
  const [selectedId, setSelectedId] = React.useState<string>(currentTenantId);

  const activeTenant =
    tenants.find((t) => t.id === selectedId) || tenants[0] || null;

  const handleSelect = (tenant: TenantOption) => {
    setSelectedId(tenant.id);
    onSelectTenant?.(tenant);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-label="Select store"
          className={cn(
            'w-full justify-between border-gray-200 bg-white hover:bg-gray-50 text-gray-900 px-3 py-2 h-auto text-left',
            className
          )}
        >
          <div className="flex items-center gap-2.5 truncate">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-50 text-blue-600 border border-blue-200 shrink-0">
              <Store className="h-4 w-4" />
            </div>
            <div className="flex flex-col truncate">
              <span className="text-xs font-semibold leading-tight truncate">
                {activeTenant?.name ?? 'Select Store'}
              </span>
              <span className="text-[10px] text-gray-500 font-normal leading-tight truncate">
                {activeTenant?.domain ?? 'No store configured'}
              </span>
            </div>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-gray-400" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64" align="start">
        <DropdownMenuLabel>Stores & Tenants</DropdownMenuLabel>
        <DropdownMenuGroup>
          {tenants.map((tenant) => {
            const isSelected = tenant.id === activeTenant?.id;
            return (
              <DropdownMenuItem
                key={tenant.id}
                onSelect={() => handleSelect(tenant)}
                className="flex items-center justify-between cursor-pointer py-2"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-gray-900">
                    {tenant.name}
                  </span>
                  <span className="text-xs text-gray-500">
                    {tenant.slug} &bull; {tenant.role ?? 'Member'}
                  </span>
                </div>
                {isSelected && <Check className="h-4 w-4 text-blue-600" />}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            // Trigger new tenant flow
          }}
          className="cursor-pointer text-blue-600 focus:text-blue-700"
        >
          <PlusCircle className="mr-2 h-4 w-4" />
          <span>Create New Store</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
