import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';

export const badgeVariants = cva(
  'inline-flex items-center rounded-full font-medium transition-colors select-none',
  {
    variants: {
      variant: {
        default:
          'bg-blue-100 text-blue-800 border border-transparent',
        success:
          'bg-green-100 text-green-800 border border-transparent',
        warning:
          'bg-yellow-100 text-yellow-800 border border-transparent',
        danger:
          'bg-red-100 text-red-800 border border-transparent',
        secondary:
          'bg-gray-100 text-gray-800 border border-transparent',
        outline:
          'bg-transparent text-gray-700 border border-gray-300',
      },
      size: {
        default: 'px-2.5 py-0.5 text-xs',
        sm: 'px-2 py-0.25 text-[10px] uppercase tracking-wider',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(badgeVariants({ variant, size, className }))}
        {...props}
      />
    );
  }
);

Badge.displayName = 'Badge';
