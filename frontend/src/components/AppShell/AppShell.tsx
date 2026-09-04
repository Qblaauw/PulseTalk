'use client';

import type { ReactNode } from 'react';
import Sidebar from '@/components/Sidebar';
import MainContent from '@/components/MainContent';
import { useSidebar } from '@/components/Sidebar/SidebarProvider';

/**
 * Two column desktop shell: translucent sidebar plus main region.
 * `data-compact` drives the sidebar width through CSS variables, and a media
 * query in globals.css compacts the sidebar automatically on narrow windows.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { isCollapsed } = useSidebar();
  return (
    <div className="pt-shell flex h-screen w-screen overflow-hidden" data-compact={isCollapsed ? 'true' : 'false'}>
      <a
        href="#pt-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-[var(--pt-surface)] focus:px-3 focus:py-2 focus:text-sm focus:shadow-[var(--pt-shadow-md)]"
      >
        Skip to content
      </a>
      <Sidebar />
      <MainContent>{children}</MainContent>
    </div>
  );
}
