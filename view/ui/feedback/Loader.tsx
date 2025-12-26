import React from 'react';

import { cn } from '@/core/tailwind/utils';
import { Icon } from '@/view/ui/primitive/Icon';

interface LoaderProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function Loader({ className, size = 'md' }: LoaderProps) {
  const sizes = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-10 w-10',
  };

  return <Icon.Spinner className={cn('animate-spin text-blue-600', sizes[size], className)} />;
}
