'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import {
  Circle,
  FileAudio,
  Home,
  LibraryBig,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  UserRound,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useSidebar } from '@/components/Sidebar/SidebarProvider';
import { useRecordingState } from '@/contexts/RecordingStateContext';
import { useConfig } from '@/contexts/ConfigContext';
import { useImportDialog } from '@/contexts/ImportDialogContext';
import { CURRENT_SYNC_STATE, SYNC_LABELS } from '@/lib/privacy';
import Analytics from '@/lib/analytics';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: typeof Home;
  isActive: (pathname: string) => boolean;
}

const PRIMARY_NAV: NavItem[] = [
  { href: '/', label: 'Home', icon: Home, isActive: p => p === '/' },
  {
    href: '/library',
    label: 'Library',
    icon: LibraryBig,
    isActive: p => p.startsWith('/library') || p.startsWith('/meeting-details') || p.startsWith('/dictation-history'),
  },
];

const UTILITY_NAV: NavItem[] = [
  { href: '/account', label: 'Account and sync', icon: UserRound, isActive: p => p.startsWith('/account') },
  { href: '/settings', label: 'Settings', icon: Settings, isActive: p => p.startsWith('/settings') },
];

function formatDuration(seconds: number | null): string {
  if (seconds === null) return '';
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function NavLink({ item, pathname, compact }: { item: NavItem; pathname: string; compact: boolean }) {
  const Icon = item.icon;
  const active = item.isActive(pathname);
  const link = (
    <Link
      href={item.href}
      className="pt-nav-item"
      aria-current={active ? 'page' : undefined}
      aria-label={compact ? item.label : undefined}
    >
      <Icon size={18} strokeWidth={1.9} aria-hidden="true" />
      <span className="pt-sidebar-label truncate">{item.label}</span>
      {item.href === '/account' && (
        <span className="pt-sidebar-label ml-auto text-[11px] font-medium text-[var(--pt-text-tertiary)]">
          {SYNC_LABELS[CURRENT_SYNC_STATE]}
        </span>
      )}
    </Link>
  );
  if (!compact) return link;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  );
}

export default function Sidebar() {
  const pathname = usePathname() ?? '/';
  const router = useRouter();
  const { isCollapsed, toggleCollapse, handleRecordingToggle } = useSidebar();
  const { isRecording, isPaused, activeDuration } = useRecordingState();
  const { betaFeatures } = useConfig();
  const { openImportDialog } = useImportDialog();

  // The tray menu calls this to open Settings from outside React.
  useEffect(() => {
    (window as unknown as { openSettings?: () => void }).openSettings = () => {
      router.push('/settings');
    };
    return () => {
      delete (window as unknown as { openSettings?: () => void }).openSettings;
    };
  }, [router]);

  const compact = isCollapsed;

  const onRecordClick = () => {
    if (isRecording) {
      Analytics.trackButtonClick('go_to_recording', 'sidebar');
      router.push('/');
      return;
    }
    handleRecordingToggle();
  };

  const recordLabel = isRecording ? (isPaused ? 'Paused' : 'Recording') : 'Record meeting';

  const recordButton = (
    <button
      type="button"
      onClick={onRecordClick}
      aria-label={compact ? recordLabel : undefined}
      className={cn(
        'pt-button w-full justify-start gap-2.5 px-3',
        isRecording ? 'pt-button--secondary' : 'pt-button--accent',
        compact && 'justify-center px-0',
      )}
    >
      <Circle
        size={12}
        aria-hidden="true"
        className={cn(
          'shrink-0',
          isRecording
            ? cn('fill-[var(--pt-accent)] text-[var(--pt-accent)]', !isPaused && 'pt-pulse')
            : 'fill-current',
        )}
      />
      <span className="pt-sidebar-label truncate">{recordLabel}</span>
      {isRecording && !compact && (
        <span className="pt-sidebar-label pt-mono ml-auto text-[12px] text-[var(--pt-text-secondary)]" aria-live="off">
          {formatDuration(activeDuration)}
        </span>
      )}
    </button>
  );

  return (
    <aside
      className="pt-sidebar flex h-screen shrink-0 flex-col transition-[width] duration-200 [transition-timing-function:var(--pt-ease)]"
      style={{ width: 'var(--pt-shell-sidebar)' }}
      aria-label="Primary"
    >
      {/* Brand */}
      <div className={cn('flex h-14 items-center px-4', compact && 'justify-center px-0')}>
        <Link
          href="/"
          className={cn('pulse-talq-mark', compact && 'pulse-talq-mark--compact')}
          aria-label="PulseTalq home"
        >
          {compact ? <strong>p</strong> : <>pulse<strong>talq</strong></>}
        </Link>
      </div>

      {/* Primary action */}
      <div className={cn('px-3 pb-3', compact && 'px-2.5')}>
        {compact ? (
          <Tooltip>
            <TooltipTrigger asChild>{recordButton}</TooltipTrigger>
            <TooltipContent side="right">{recordLabel}</TooltipContent>
          </Tooltip>
        ) : (
          recordButton
        )}
        {betaFeatures.importAndRetranscribe && (
          <button
            type="button"
            onClick={() => {
              Analytics.trackButtonClick('import_audio', 'sidebar');
              openImportDialog();
            }}
            className={cn('pt-nav-item mt-1.5', compact && 'justify-center px-0')}
            aria-label={compact ? 'Import audio' : undefined}
          >
            <FileAudio size={18} strokeWidth={1.9} aria-hidden="true" />
            <span className="pt-sidebar-label">Import audio</span>
          </button>
        )}
      </div>

      {/* Destinations */}
      <nav className={cn('flex flex-col gap-0.5 px-3', compact && 'px-2.5')} aria-label="Sections">
        {PRIMARY_NAV.map(item => (
          <NavLink key={item.href} item={item} pathname={pathname} compact={compact} />
        ))}
      </nav>

      <div className="flex-1" />

      {/* Utilities */}
      <nav className={cn('flex flex-col gap-0.5 px-3 pb-2', compact && 'px-2.5')} aria-label="Account and settings">
        {UTILITY_NAV.map(item => (
          <NavLink key={item.href} item={item} pathname={pathname} compact={compact} />
        ))}
      </nav>

      <div className={cn('flex items-center justify-between border-t border-[var(--pt-border)] px-3 py-2', compact && 'justify-center px-2')}>
        <span className="pt-sidebar-label text-[11px] text-[var(--pt-text-tertiary)]">v0.4.3</span>
        <button
          type="button"
          onClick={toggleCollapse}
          className="pt-button pt-button--ghost pt-button--icon"
          aria-label={compact ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-pressed={compact}
        >
          {compact ? <PanelLeftOpen size={16} aria-hidden="true" /> : <PanelLeftClose size={16} aria-hidden="true" />}
        </button>
      </div>
    </aside>
  );
}
