'use client';

import { invoke } from '@tauri-apps/api/core';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, Copy, FileAudio, Mic, MoreHorizontal, Pencil, Search, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { PageBody, PageHeader } from '@/components/AppShell/PageHeader';
import { PrivacyChip, SyncChip } from '@/components/AppShell/StateChips';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useSidebar } from '@/components/Sidebar/SidebarProvider';
import Analytics from '@/lib/analytics';
import {
  announceMeetingsChanged,
  formatAbsoluteTime,
  formatRelativeTime,
  useLibraryItems,
  type LibraryItem,
} from '@/lib/library';
import { CURRENT_SYNC_STATE } from '@/lib/privacy';
import { cn } from '@/lib/utils';

type Filter = 'all' | 'meetings' | 'dictations';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'meetings', label: 'Meetings' },
  { value: 'dictations', label: 'Dictations' },
];

interface TranscriptSearchResult {
  id: string;
  title: string;
  matchContext: string;
  timestamp: string;
}

function parseFilter(value: string | null): Filter {
  return value === 'meetings' || value === 'dictations' ? value : 'all';
}

function groupLabel(iso: string | null, now = new Date()): string {
  if (!iso) return 'Earlier';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Earlier';
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.floor((startOfToday.getTime() - new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()) / 86_400_000);
  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return 'This week';
  if (diffDays < 30) return 'This month';
  return 'Earlier';
}

function LibraryRow({
  item,
  matchContext,
  onCopy,
  onRename,
  onDelete,
}: {
  item: LibraryItem;
  matchContext?: string;
  onCopy: (item: LibraryItem) => void;
  onRename: (item: LibraryItem) => void;
  onDelete: (item: LibraryItem) => void;
}) {
  const router = useRouter();
  const Icon = item.kind === 'meeting' ? Mic : FileAudio;
  const interactive = Boolean(item.href);
  const open = () => {
    if (item.href) router.push(item.href);
  };

  return (
    <div
      className={cn('pt-row group', interactive && 'pt-row--interactive')}
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
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-[var(--pt-fill)] text-[var(--pt-text-secondary)]" aria-hidden="true">
        <Icon size={16} strokeWidth={1.9} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-medium leading-5 text-[var(--pt-text)]">{item.title}</p>
        {matchContext ? (
          <p className="truncate text-[12.5px] leading-5 text-[var(--pt-text-secondary)]">…{matchContext}…</p>
        ) : item.snippet ? (
          <p className="truncate text-[12.5px] leading-5 text-[var(--pt-text-secondary)]">{item.snippet}</p>
        ) : null}
        <p className="truncate text-[12px] leading-5 text-[var(--pt-text-tertiary)]">
          {item.kind === 'meeting' ? 'Meeting' : 'Dictation'}
          {item.timestamp && (
            <>
              {' · '}
              <time dateTime={item.timestamp} title={formatAbsoluteTime(item.timestamp)}>
                {formatRelativeTime(item.timestamp)}
              </time>
            </>
          )}
          {item.status === 'failed' && (
            <>
              {' · '}
              <span className="text-[var(--pt-warning)]">{item.statusDetail ?? 'Did not finish'}</span>
            </>
          )}
        </p>
      </div>
      <SyncChip state={CURRENT_SYNC_STATE} className="hidden xl:inline-flex" />
      <div className="flex shrink-0 items-center gap-1" onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
        {item.copyText && (
          <button
            type="button"
            className="pt-button pt-button--ghost pt-button--icon"
            aria-label="Copy text"
            onClick={() => onCopy(item)}
          >
            <Copy size={15} aria-hidden="true" />
          </button>
        )}
        {item.kind === 'meeting' && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="pt-button pt-button--ghost pt-button--icon" aria-label={`More actions for ${item.title}`}>
                <MoreHorizontal size={16} aria-hidden="true" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="pt-card pt-card--glass min-w-[180px] p-1">
              <DropdownMenuItem onSelect={open} className="gap-2 rounded-[8px]">
                <ArrowRight size={14} aria-hidden="true" /> Open
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onRename(item)} className="gap-2 rounded-[8px]">
                <Pencil size={14} aria-hidden="true" /> Rename
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => onDelete(item)} className="gap-2 rounded-[8px] text-[var(--pt-error)] focus:text-[var(--pt-error)]">
                <Trash2 size={14} aria-hidden="true" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {interactive && <ArrowRight size={15} aria-hidden="true" className="ml-1 text-[var(--pt-text-tertiary)]" />}
      </div>
    </div>
  );
}

function LibraryContent() {
  const router = useRouter();
  const params = useSearchParams();
  const filter = parseFilter(params.get('filter'));
  const { refetchMeetings } = useSidebar();
  const { items, loading, error, refresh } = useLibraryItems({ dictationLimit: 200 });

  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<TranscriptSearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [renameTarget, setRenameTarget] = useState<LibraryItem | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<LibraryItem | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Analytics.trackPageView('library');
  }, []);

  const setFilter = (next: Filter) => {
    const search = next === 'all' ? '' : `?filter=${next}`;
    router.replace(`/library${search}`);
  };

  // Debounced transcript search. Local title matching is instant; transcript
  // body matching goes through the Rust core.
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSearchResults(null);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = window.setTimeout(async () => {
      try {
        const results = await invoke<TranscriptSearchResult[]>('api_search_transcripts', { query: trimmed });
        if (!cancelled) setSearchResults(results);
      } catch (err) {
        console.error('Transcript search failed', err);
        if (!cancelled) setSearchResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  const transcriptMatches = useMemo(() => {
    const map = new Map<string, string>();
    searchResults?.forEach(r => map.set(r.id, r.matchContext));
    return map;
  }, [searchResults]);

  const visible = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    return items.filter(item => {
      if (filter === 'meetings' && item.kind !== 'meeting') return false;
      if (filter === 'dictations' && item.kind !== 'dictation') return false;
      if (!trimmed) return true;
      if (item.title.toLowerCase().includes(trimmed)) return true;
      if (item.snippet?.toLowerCase().includes(trimmed)) return true;
      if (item.copyText?.toLowerCase().includes(trimmed)) return true;
      return item.kind === 'meeting' && transcriptMatches.has(item.id);
    });
  }, [items, filter, query, transcriptMatches]);

  const groups = useMemo(() => {
    const order = ['Today', 'Yesterday', 'This week', 'This month', 'Earlier'];
    const byLabel = new Map<string, LibraryItem[]>();
    visible.forEach(item => {
      const label = groupLabel(item.timestamp);
      byLabel.set(label, [...(byLabel.get(label) ?? []), item]);
    });
    return order.filter(l => byLabel.has(l)).map(l => ({ label: l, items: byLabel.get(l)! }));
  }, [visible]);

  const counts = useMemo(
    () => ({
      all: items.length,
      meetings: items.filter(i => i.kind === 'meeting').length,
      dictations: items.filter(i => i.kind === 'dictation').length,
    }),
    [items],
  );

  const afterMeetingMutation = useCallback(async () => {
    announceMeetingsChanged();
    await Promise.allSettled([refresh(), refetchMeetings()]);
  }, [refresh, refetchMeetings]);

  const copyItem = async (item: LibraryItem) => {
    try {
      if (item.kind === 'dictation') await invoke('dictation_copy_history', { id: item.id });
      else if (item.copyText) await navigator.clipboard.writeText(item.copyText);
      toast.success('Copied');
    } catch (err) {
      toast.error('Could not copy', { description: String(err) });
    }
  };

  const openRename = (item: LibraryItem) => {
    setRenameTarget(item);
    setRenameValue(item.title);
  };

  const submitRename = async () => {
    if (!renameTarget) return;
    const title = renameValue.trim();
    if (!title || title === renameTarget.title) {
      setRenameTarget(null);
      return;
    }
    setBusy(true);
    try {
      await invoke('api_save_meeting_title', { meetingId: renameTarget.id, title });
      toast.success('Renamed');
      setRenameTarget(null);
      await afterMeetingMutation();
    } catch (err) {
      toast.error('Could not rename', { description: String(err) });
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await invoke('api_delete_meeting', { meetingId: deleteTarget.id });
      toast.success('Deleted from this device');
      setDeleteTarget(null);
      await afterMeetingMutation();
    } catch (err) {
      toast.error('Could not delete', { description: String(err) });
    } finally {
      setBusy(false);
    }
  };

  const emptyCopy =
    query.trim()
      ? { title: 'No matches', body: 'Try a different word. Search looks through titles, dictation text, and meeting transcripts.' }
      : filter === 'dictations'
        ? { title: 'No dictations yet', body: 'Hold the shortcut in any text field and speak. Each dictation is saved here.' }
        : filter === 'meetings'
          ? { title: 'No meetings yet', body: 'Record a meeting from Home or the sidebar. Transcripts and summaries land here.' }
          : { title: 'Your Library is empty', body: 'Dictations and meetings appear here, stored only on this device.' };

  return (
    <PageBody>
      <div className="pt-enter flex flex-col gap-6">
        <PageHeader
          eyebrow="Library"
          title="Everything you have said."
          description="Meetings and dictations in one place, newest first."
          actions={<PrivacyChip state="stored-on-device" />}
        />

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="pt-segmented" role="tablist" aria-label="Filter">
            {FILTERS.map(f => (
              <button
                key={f.value}
                type="button"
                role="tab"
                aria-selected={filter === f.value}
                className="pt-segmented__item"
                onClick={() => setFilter(f.value)}
              >
                {f.label}
                <span className="ml-1.5 text-[var(--pt-text-tertiary)]">{counts[f.value]}</span>
              </button>
            ))}
          </div>
          <label className="relative ml-auto flex min-w-[220px] flex-1 items-center sm:max-w-[360px]">
            <Search size={15} aria-hidden="true" className="pointer-events-none absolute left-3 text-[var(--pt-text-tertiary)]" />
            <input
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search titles and transcripts"
              aria-label="Search Library"
              className="pt-input w-full pl-9 pr-9"
            />
            {query && (
              <button
                type="button"
                className="absolute right-2 grid h-6 w-6 place-items-center rounded-full text-[var(--pt-text-tertiary)] hover:bg-[var(--pt-fill)]"
                aria-label="Clear search"
                onClick={() => setQuery('')}
              >
                <X size={13} aria-hidden="true" />
              </button>
            )}
          </label>
        </div>

        {error && <p className="text-[13px] text-[var(--pt-warning)]" role="alert">{error}</p>}

        {/* List */}
        {loading && items.length === 0 ? (
          <div className="pt-group">
            {[0, 1, 2].map(i => (
              <div key={i} className="pt-row animate-pulse">
                <span className="h-9 w-9 rounded-[10px] bg-[var(--pt-fill)]" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-1/3 rounded bg-[var(--pt-fill)]" />
                  <div className="h-2.5 w-1/5 rounded bg-[var(--pt-fill)]" />
                </div>
              </div>
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="pt-card flex flex-col items-center gap-2 px-6 py-16 text-center">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-[var(--pt-fill)] text-[var(--pt-text-secondary)]" aria-hidden="true">
              {searching ? <Search size={18} className="animate-pulse" /> : <Mic size={18} strokeWidth={1.8} />}
            </span>
            <p className="text-[15px] font-medium">{searching ? 'Searching transcripts…' : emptyCopy.title}</p>
            {!searching && <p className="max-w-sm text-[13px] leading-5 text-[var(--pt-text-secondary)]">{emptyCopy.body}</p>}
          </div>
        ) : (
          <div className="flex flex-col gap-6" aria-busy={searching}>
            {groups.map(group => (
              <section key={group.label} aria-labelledby={`group-${group.label}`} className="flex flex-col gap-2">
                <h2 id={`group-${group.label}`} className="pt-label px-1">{group.label}</h2>
                <div className="pt-group">
                  {group.items.map(item => (
                    <LibraryRow
                      key={item.key}
                      item={item}
                      matchContext={item.kind === 'meeting' ? transcriptMatches.get(item.id) : undefined}
                      onCopy={copyItem}
                      onRename={openRename}
                      onDelete={setDeleteTarget}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      {/* Rename */}
      <Dialog open={renameTarget !== null} onOpenChange={open => !open && setRenameTarget(null)}>
        <DialogContent className="pt-card max-w-md p-6">
          <DialogHeader>
            <DialogTitle className="text-[17px] font-semibold tracking-[-0.01em]">Rename meeting</DialogTitle>
            <DialogDescription className="text-[13px] text-[var(--pt-text-secondary)]">The new name is saved on this device.</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={e => {
              e.preventDefault();
              void submitRename();
            }}
            className="mt-2 flex flex-col gap-4"
          >
            <input
              autoFocus
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              aria-label="Meeting title"
              className="pt-input w-full"
              maxLength={200}
            />
            <DialogFooter className="gap-2 sm:gap-2">
              <button type="button" className="pt-button pt-button--secondary" onClick={() => setRenameTarget(null)} disabled={busy}>
                Cancel
              </button>
              <button type="submit" className="pt-button pt-button--accent" disabled={busy || !renameValue.trim()}>
                Save
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <Dialog open={deleteTarget !== null} onOpenChange={open => !open && setDeleteTarget(null)}>
        <DialogContent className="pt-card max-w-md p-6">
          <DialogHeader>
            <DialogTitle className="text-[17px] font-semibold tracking-[-0.01em]">Delete this meeting?</DialogTitle>
            <DialogDescription className="text-[13px] leading-5 text-[var(--pt-text-secondary)]">
              “{deleteTarget?.title}” and its transcript and summary will be removed from this device. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 gap-2 sm:gap-2">
            <button type="button" className="pt-button pt-button--secondary" onClick={() => setDeleteTarget(null)} disabled={busy}>
              Cancel
            </button>
            <button type="button" className="pt-button pt-button--danger" onClick={() => void confirmDelete()} disabled={busy}>
              Delete
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageBody>
  );
}

export default function LibraryPage() {
  return (
    <Suspense fallback={null}>
      <LibraryContent />
    </Suspense>
  );
}
