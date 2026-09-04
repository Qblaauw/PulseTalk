'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Standard view header: eyebrow label, large title, optional supporting text,
 * and a trailing action slot. Keeps every destination visually consistent.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
  children,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <header className={cn('flex flex-col gap-4', className)}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && <p className="pt-label mb-2">{eyebrow}</p>}
          <h1 className="pt-title truncate">{title}</h1>
          {description && <p className="pt-subtitle mt-1.5 max-w-2xl">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </header>
  );
}

/** Scrollable page body with the shared max width and gutters. */
export function PageBody({ children, className, wide = false }: { children: ReactNode; className?: string; wide?: boolean }) {
  return (
    <div className={cn('pt-scroll h-full w-full overflow-y-auto', className)}>
      <div
        className={cn('mx-auto w-full px-6 py-8 md:px-10 md:py-10', wide ? 'max-w-[1240px]' : 'max-w-[var(--pt-content-max)]')}
      >
        {children}
      </div>
    </div>
  );
}
