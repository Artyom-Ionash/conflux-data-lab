import Link from 'next/link';
import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  href?: string;
  className?: string;
}

export function Card({ children, href, className = '' }: CardProps) {
  const baseClasses = 'block rounded-lg border border-zinc-200 bg-white p-6 shadow-sm transition-all hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900';
  
  if (href) {
    return (
      <Link href={href} className={`${baseClasses} ${className}`}>
        {children}
      </Link>
    );
  }
  
  return (
    <div className={`${baseClasses} ${className}`}>
      {children}
    </div>
  );
}


