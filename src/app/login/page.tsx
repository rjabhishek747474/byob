'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod/v4';
import { ShieldAlert, ArrowRight } from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters long'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [formData, setFormData] = React.useState<LoginFormData>({
    email: '',
    password: '',
  });
  const [fieldErrors, setFieldErrors] = React.useState<Partial<Record<keyof LoginFormData, string>>>({});
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear error on change
    if (fieldErrors[name as keyof LoginFormData]) {
      setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
    }
    if (serverError) {
      setServerError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    // Validate with Zod
    const validation = loginSchema.safeParse(formData);
    if (!validation.success) {
      const errors: Partial<Record<keyof LoginFormData, string>> = {};
      for (const issue of validation.error.issues) {
        const fieldName = issue.path[0] as keyof LoginFormData;
        if (fieldName && !errors[fieldName]) {
          errors[fieldName] = issue.message;
        }
      }
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setIsLoading(true);

    try {
      const response = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setServerError(
          data?.error?.message || 'Invalid email or password. Please try again.'
        );
        return;
      }

      // Successful login -> redirect to dashboard
      router.push('/dashboard');
      router.refresh();
    } catch {
      setServerError('An unexpected network error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      {/* Brand Logo Header */}
      <div className="mb-6 flex flex-col items-center text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white font-black text-xl shadow-md">
          B
        </div>
        <h2 className="mt-4 text-2xl font-bold tracking-tight text-gray-900">
          BYOB Admin
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Multi-tenant e-commerce control panel
        </p>
      </div>

      {/* Main Login Card */}
      <Card className="w-full max-w-md shadow-lg border-gray-200">
        <CardHeader className="space-y-1">
          <CardTitle className="text-xl font-semibold text-center text-gray-900">
            Sign in to your account
          </CardTitle>
          <CardDescription className="text-center text-gray-500 text-xs">
            Enter your administrator credentials to manage your store
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit} noValidate>
          <CardContent className="space-y-4">
            {serverError && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800"
              >
                <ShieldAlert className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                <span>{serverError}</span>
              </div>
            )}

            <div>
              <Input
                label="Email address"
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="admin@byob.store"
                value={formData.email}
                onChange={handleChange}
                error={fieldErrors.email}
                required
              />
            </div>

            <div>
              <Input
                label="Password"
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••••••"
                value={formData.password}
                onChange={handleChange}
                error={fieldErrors.password}
                required
              />
            </div>

            {/* MFA Security Note */}
            <div className="rounded-md border border-blue-100 bg-blue-50/70 p-3 text-[11px] text-blue-900 leading-relaxed">
              <span className="font-semibold">Security Note:</span> MFA will be required for administrators in production environments.
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-3">
            <Button
              type="submit"
              className="w-full"
              loading={isLoading}
            >
              <span>Sign In</span>
              {!isLoading && <ArrowRight className="h-4 w-4 ml-1" />}
            </Button>

            <div className="text-center text-xs text-gray-400">
              Default demo credentials: <span className="font-mono text-gray-600">admin@byob.store</span> / <span className="font-mono text-gray-600">AdminPassword123!</span>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
