import { describe, expect, it } from 'vitest';
import { cn } from '@/lib/cn';
import { buttonVariants } from '@/components/ui/button';
import { badgeVariants } from '@/components/ui/badge';

describe('Base UI Components & Utilities', () => {
  it('cn merges class names properly', () => {
    const result = cn('base-class', false && 'hidden', 'extra-class');
    expect(result).toBe('base-class extra-class');
  });

  it('buttonVariants generates correct classes for variants and sizes', () => {
    const defaultBtn = buttonVariants({ variant: 'default', size: 'default' });
    expect(defaultBtn).toContain('bg-blue-600');
    expect(defaultBtn).toContain('h-10');

    const destructiveBtn = buttonVariants({ variant: 'destructive', size: 'sm' });
    expect(destructiveBtn).toContain('bg-red-600');
    expect(destructiveBtn).toContain('h-8');

    const outlineBtn = buttonVariants({ variant: 'outline', size: 'lg' });
    expect(outlineBtn).toContain('border-gray-300');
    expect(outlineBtn).toContain('h-11');
  });

  it('badgeVariants generates correct styles for badge variants', () => {
    const successBadge = badgeVariants({ variant: 'success' });
    expect(successBadge).toContain('bg-green-100');
    expect(successBadge).toContain('text-green-800');

    const dangerBadge = badgeVariants({ variant: 'danger' });
    expect(dangerBadge).toContain('bg-red-100');
    expect(dangerBadge).toContain('text-red-800');

    const warningBadge = badgeVariants({ variant: 'warning' });
    expect(warningBadge).toContain('bg-yellow-100');
  });
});
