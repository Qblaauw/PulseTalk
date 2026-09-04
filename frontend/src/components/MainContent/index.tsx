'use client';

import type { ReactNode } from 'react';

/**
 * Main content region. Sits beside the sidebar inside the shell flex row, so
 * it needs no margin bookkeeping. Fixed overlays that must align to this
 * region read `--pt-shell-sidebar` from the shell instead.
 */
export default function MainContent({ children }: { children: ReactNode }) {
  return (
    <main
      id="pt-main"
      className="relative h-screen min-w-0 flex-1 overflow-hidden bg-[var(--pt-bg)] text-[var(--pt-text)]"
      tabIndex={-1}
    >
      {children}
    </main>
  );
}
