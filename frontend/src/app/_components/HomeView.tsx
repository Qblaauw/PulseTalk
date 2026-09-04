'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Check, Circle, Copy, FileAudio, Mic, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { PageBody, PageHeader } from '@/components/AppShell/PageHeader';
import { PrivacyChip, StateChip, SyncChip } from '@/components/AppShell/StateChips';
import { Switch } from '@/components/ui/switch';
import { useConfig } from '@/contexts/ConfigContext';
import { useImportDialog } from '@/contexts/ImportDialogContext';
import { usePermissionCheck } from '@/hooks/usePermissionCheck';
import Analytics from '@/lib/analytics';
import { formatRelativeTime, useLibraryItems, type LibraryItem } from '@/lib/library';
import { CURRENT_SYNC_STATE, providerDisplayName, transcriptionPrivacyState } from '@/lib/privacy';
import { cn } from '@/lib/utils';

type DictationPhase =
  | 'idle'
  | 'listening'
  | 'transcribing'
  | 'cleaning'
  | 'delivering'
  | 'completed'
  | 'failed'
  | 'cancelled';

interface DictationState {
  phase: DictationPhase;
  message?: string | null;
}

interface ShortcutStatus {
  enabled: boolean;
  shortcut?: string | null;
  message?: string | null;
}

const PHASE_COPY: Record<DictationPhase, string> = {
  idle: 'Ready. Hold the shortcut in any text field and speak.',
  listening: 'Listening. Release the shortcut to paste.',
  transcribing: 'Transcribing on this device.',
  cleaning: 'Cleaning up the text on this device.',
  delivering: 'Pasting at your cursor.',
  completed: 'Pasted.',
  failed: 'Saved to your Library instead of pasting.',
  cancelled: 'Cancelled.',
};

function ShortcutKeys({ shortcut }: { shortcut: string }) {
  const parts = shortcut.split('+').map(p => p.trim()).filter(Boolean);
  return (
    <span className="inline-flex items-center gap-1" aria-label={`Shortcut ${shortcut}`}>
      {parts.map((part, index) => (
        <span key={`${part}-${index}`} className="inline-flex items-center gap-1">
          <kbd className="pt-kbd">{part}</kbd>
          {index < parts.length - 1 && <span aria-hidden="true" className="text-[var(--pt-text-tertiary)]">+</span>}
        </span>
      ))}
    </span>
  );
}

function ReadinessRow({
  ok,
  label,
  detail,
  remedy,
  trailing,
}: {
  ok: boolean;
  label: string;
  detail: string;
  remedy?: { label: string; href: string } | null;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="pt-row">
      <span
        className={cn(
          'grid h-6 w-6 shrink-0 place-items-center rounded-full',
          ok ? 'bg-[var(--pt-success-wash)] text-[var(--pt-success)]' : 'bg-[var(--pt-warning-wash)] text-[var(--pt-warning)]',
        )}
        aria-hidden="true"
      >
        {ok ? <Check size={13} strokeWidth={2.5} /> : <TriangleAlert size={13} strokeWidth={2.4} />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-medium leading-5 text-[var(--pt-text)]">{label}</p>
        <p className="text-[13px] leading-5 text-[var(--pt-text-secondary)]">{detail}</p>
      </div>
      {trailing}
      {!ok && remedy && (
        <Link href={remedy.href} className="pt-button pt-button--secondary pt-button--sm shrink-0">
          {remedy.label}
        </Link>
      )}
    </div>
  );
}

function RecentRow({ item, onCopy }: { item: LibraryItem; onCopy: (item: LibraryItem) => void }) {
  const router = useRouter();
  const Icon = item.kind === 'meeting' ? Mic : FileAudio;
  const open = () => {
    if (item.href) router.push(item.href);
  };
  const interactive = Boolean(item.href);
  return (
    <div
      className={cn('pt-row', interactive && 'pt-row--interactive')}
      role={interactive ? 'link' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={interactive ? open : undefined}
      onKeyDown={
        interactive
          ? e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                open();
              }
            }
          : undefined
      }
    >
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] bg-[var(--pt-fill)] text-[var(--pt-text-secondary)]" aria-hidden="true">
        <Icon size={15} strokeWidth={1.9} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-medium leading-5 text-[var(--pt-text)]">{item.title}</p>
        <p className="truncate text-[12.5px] leading-5 text-[var(--pt-text-tertiary)]">
          {item.kind === 'meeting' ? 'Meeting' : 'Dictation'}
          {item.timestamp && <> · {formatRelativeTime(item.timestamp)}</>}
          {item.status === 'failed' && <> · <span className="text-[var(--pt-warning)]">{item.statusDetail ?? 'Did not finish'}</span></>}
        </p>
      </div>
      <SyncChip state={CURRENT_SYNC_STATE} className="hidden lg:inline-flex" />
      {item.copyText && (
        <button
          type="button"
          className="pt-button pt-button--ghost pt-button--icon shrink-0"
          aria-label="Copy dictation text"
          onClick={e => {
            e.stopPropagation();
            onCopy(item);
          }}
        >
          <Copy size={15} aria-hidden="true" />
        </button>
      )}
      {item.href && <ArrowRight size={15} aria-hidden="true" className="shrink-0 text-[var(--pt-text-tertiary)]" />}
    </div>
  );
}

export function HomeView({ onRecord, recordDisabled }: { onRecord: () => void; recordDisabled?: boolean }) {
  const { transcriptModelConfig, betaFeatures } = useConfig();
  const { hasMicrophone, isChecking } = usePermissionCheck();
  const { openImportDialog } = useImportDialog();
  const { items, loading } = useLibraryItems({ dictationLimit: 20 });

  const [dictation, setDictation] = useState<DictationState>({ phase: 'idle' });
  const [shortcut, setShortcut] = useState<ShortcutStatus | null>(null);
  const [overlayEnabled, setOverlayEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    Analytics.trackPageView('home');
    void invoke<ShortcutStatus>('dictation_get_shortcut_status').then(setShortcut).catch(() => setShortcut({ enabled: false, message: 'Shortcut status unavailable.' }));
    void invoke<boolean>('dictation_get_overlay_enabled').then(setOverlayEnabled).catch(() => setOverlayEnabled(null));

    let disposed = false;
    let unlisten: (() => void) | undefined;
    void listen<DictationState>('dictation-state', event => setDictation(event.payload)).then(dispose => {
      if (disposed) dispose();
      else unlisten = dispose;
    });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    if (dictation.phase !== 'completed' && dictation.phase !== 'failed' && dictation.phase !== 'cancelled') return;
    const timer = window.setTimeout(() => setDictation({ phase: 'idle' }), dictation.phase === 'completed' ? 1500 : 4000);
    return () => window.clearTimeout(timer);
  }, [dictation.phase]);

  const toggleOverlay = async (next: boolean) => {
    setOverlayEnabled(next);
    try {
      await invoke('dictation_set_overlay_enabled', { enabled: next });
    } catch (error) {
      setOverlayEnabled(!next);
      toast.error('Could not change the floating indicator', { description: String(error) });
    }
  };

  const copyItem = async (item: LibraryItem) => {
    try {
      if (item.kind === 'dictation') await invoke('dictation_copy_history', { id: item.id });
      else if (item.copyText) await navigator.clipboard.writeText(item.copyText);
      toast.success('Copied');
    } catch (error) {
      toast.error('Could not copy', { description: String(error) });
    }
  };

  const recent = useMemo(() => items.slice(0, 6), [items]);
  const dictationActive = dictation.phase !== 'idle' && dictation.phase !== 'cancelled';
  const modelReady = Boolean(transcriptModelConfig?.model);
  const privacy = transcriptionPrivacyState(transcriptModelConfig?.provider);
  const shortcutLabel = shortcut?.shortcut ?? 'Ctrl+Shift+Space';

  return (
    <PageBody>
      <div className="pt-enter flex flex-col gap-8">
        <PageHeader
          eyebrow="Home"
          title="Speak. It stays here."
          description="Dictate into any app or record a meeting. Audio and text are processed and kept on this device unless you choose otherwise."
          actions={
            <>
              {betaFeatures.importAndRetranscribe && (
                <button type="button" className="pt-button pt-button--secondary" onClick={() => openImportDialog()}>
                  <FileAudio size={16} aria-hidden="true" />
                  Import audio
                </button>
              )}
              <button type="button" className="pt-button pt-button--accent" onClick={onRecord} disabled={recordDisabled}>
                <Circle size={12} className="fill-current" aria-hidden="true" />
                Record meeting
              </button>
            </>
          }
        />

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,1fr)]" aria-label="Dictation">
          {/* Dictation hero */}
          <div className="pt-card relative overflow-hidden p-6 md:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="pt-label">Dictate anywhere</p>
                <h2 className="mt-2 text-[22px] font-semibold leading-tight tracking-[-0.02em]">Hold, speak, release.</h2>
              </div>
              <StateChip tone={dictationActive ? 'accent' : shortcut?.enabled ? 'success' : 'warning'} icon={<span className={cn('pt-dot', dictation.phase === 'listening' && 'pt-pulse')} />}>
                {dictationActive ? 'Active' : shortcut?.enabled ? 'Ready' : 'Needs attention'}
              </StateChip>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <ShortcutKeys shortcut={shortcutLabel} />
              <span className="text-[13px] text-[var(--pt-text-secondary)]">in any text field</span>
            </div>

            <p className="mt-5 min-h-5 text-[14px] leading-5 text-[var(--pt-text-secondary)]" role="status" aria-live="polite">
              {shortcut && !shortcut.enabled && !dictationActive ? shortcut.message ?? 'The shortcut is not active.' : PHASE_COPY[dictation.phase]}
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-2">
              <PrivacyChip state={privacy} />
              <PrivacyChip state="stored-on-device" />
            </div>
          </div>

          {/* Readiness */}
          <div className="pt-group self-start">
            <ReadinessRow
              ok={Boolean(shortcut?.enabled)}
              label="Shortcut"
              detail={shortcut?.enabled ? `${shortcutLabel} is registered.` : shortcut?.message ?? 'Checking the shortcut service.'}
              remedy={{ label: 'Fix', href: '/settings#dictation' }}
            />
            <ReadinessRow
              ok={hasMicrophone || isChecking}
              label="Microphone"
              detail={isChecking ? 'Checking access.' : hasMicrophone ? 'Access granted.' : 'PulseTalq does not have microphone access.'}
              remedy={{ label: 'Allow', href: '/settings#recording' }}
            />
            <ReadinessRow
              ok={modelReady}
              label="Transcription"
              detail={modelReady ? `${providerDisplayName(transcriptModelConfig.provider)} · ${transcriptModelConfig.model}` : 'Choose a transcription model to get started.'}
              remedy={{ label: 'Choose', href: '/settings#transcription' }}
            />
            <ReadinessRow
              ok
              label="Floating indicator"
              detail={overlayEnabled === null ? 'Shows dictation status above other windows.' : overlayEnabled ? 'Shown above other windows while you dictate.' : 'Hidden. Status still appears here.'}
              trailing={
                <Switch
                  checked={Boolean(overlayEnabled)}
                  disabled={overlayEnabled === null}
                  onCheckedChange={toggleOverlay}
                  aria-label="Show floating dictation indicator"
                />
              }
            />
          </div>
        </section>

        {/* Recent */}
        <section aria-labelledby="recent-heading" className="flex flex-col gap-3">
          <div className="flex items-end justify-between gap-4">
            <h2 id="recent-heading" className="pt-section-title">Recent</h2>
            <Link href="/library" className="pt-button pt-button--ghost pt-button--sm -mr-2">
              Open Library
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
          <div className="pt-group">
            {loading && recent.length === 0 && (
              <div className="pt-row text-[13px] text-[var(--pt-text-tertiary)]">Loading…</div>
            )}
            {!loading && recent.length === 0 && (
              <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-[var(--pt-fill)] text-[var(--pt-text-secondary)]" aria-hidden="true">
                  <Mic size={18} strokeWidth={1.8} />
                </span>
                <p className="text-[14px] font-medium">Nothing here yet</p>
                <p className="max-w-sm text-[13px] text-[var(--pt-text-secondary)]">
                  Your dictations and meetings will appear here, stored only on this device.
                </p>
              </div>
            )}
            {recent.map(item => (
              <RecentRow key={item.key} item={item} onCopy={copyItem} />
            ))}
          </div>
        </section>
      </div>
    </PageBody>
  );
}
