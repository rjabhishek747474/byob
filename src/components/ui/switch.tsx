'use client';

import * as React from 'react';
import * as SwitchPrimitives from '@radix-ui/react-switch';
import { cn } from '@/lib/cn';

export interface SwitchProps
  extends React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root> {
  label?: string;
  description?: string;
}

export const Switch = React.forwardRef<
  React.ComponentRef<typeof SwitchPrimitives.Root>,
  SwitchProps
>(({ className, id, label, description, disabled, ...props }, ref) => {
  const generatedId = React.useId();
  const switchId = id || (label ? generatedId : undefined);

  const switchElement = (
    <SwitchPrimitives.Root
      id={switchId}
      ref={ref}
      disabled={disabled}
      className={cn(
        'peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-blue-600 data-[state=unchecked]:bg-gray-200',
        className
      )}
      {...props}
    >
      <SwitchPrimitives.Thumb
        className={cn(
          'pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0'
        )}
      />
    </SwitchPrimitives.Root>
  );

  if (!label) {
    return switchElement;
  }

  return (
    <div className="flex items-start space-x-3">
      {switchElement}
      <div className="space-y-0.5">
        <label
          htmlFor={switchId}
          className={cn(
            'text-sm font-medium text-gray-900 select-none cursor-pointer',
            disabled && 'cursor-not-allowed opacity-50'
          )}
        >
          {label}
        </label>
        {description && (
          <p className="text-xs text-gray-500 select-none">{description}</p>
        )}
      </div>
    </div>
  );
});

Switch.displayName = SwitchPrimitives.Root.displayName;
