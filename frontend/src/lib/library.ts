'use client';

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/** Shape returned by the `api_get_meetings` Tauri command. */
export interface MeetingRecord {
  id: string;
  title: string;
  created_at?: string | null;
  updated_at?: string | null;
}

/** Shape returned by the `dictation_list_history` Tauri command. */
export interface DictationRecord {
  id: string;
  phase: string;
  finalText?: string | null;
  failureCode?: string | null;
  failureMessage?: string | null;
  retryable: boolean;
  startedAt: string;
}

export type LibraryKind = 'meeting' | 'dictation';
export type LibraryStatus = 'ready' | 'failed' | 'processing';

export interface LibraryItem {
  key: string;
  id: string;
  kind: LibraryKind;
  title: string;
  snippet: string | null;
  /** ISO timestamp, or null when the backend did not supply one. */
  timestamp: string | null;
  status: LibraryStatus;
  statusDetail: string | null;
  /** Route for items that open in a dedicated view. Dictations have none. */
  href: string | null;
  /** Text that can be copied to the clipboard directly from the list. */
  copyText: string | null;
}

const DICTATION_TITLE_LENGTH = 72;

function firstLine(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, ' ');
  if (trimmed.length <= DICTATION_TITLE_LENGTH) return trimmed;
  return `${trimmed.slice(0, DICTATION_TITLE_LENGTH - 1).trimEnd()}…`;
}

export function meetingToLibraryItem(meeting: MeetingRecord): LibraryItem {
  return {
    key: `meeting:${meeting.id}`,
    id: meeting.id,
    kind: 'meeting',
    title: meeting.title || 'Untitled meeting',
    snippet: null,
    timestamp: meeting.created_at ?? null,
    status: 'ready',
    statusDetail: null,
    href: `/meeting-details?id=${encodeURIComponent(meeting.id)}`,
    copyText: null,
  };
}

export function dictationToLibraryItem(item: DictationRecord): LibraryItem {
  const finished = item.phase === 'completed' || item.phase === 'failed' || item.phase === 'cancelled';
  const failed = item.phase === 'failed' || (!item.finalText && finished);
  const text = item.finalText?.trim() ?? '';
  return {
    key: `dictation:${item.id}`,
    id: item.id,
    kind: 'dictation',
    title: text ? firstLine(text) : failed ? 'Dictation did not finish' : 'Dictation in progress',
    snippet: text.length > DICTATION_TITLE_LENGTH ? text : null,
    timestamp: item.startedAt,
    status: failed ? 'failed' : finished ? 'ready' : 'processing',
    statusDetail: failed ? item.failureMessage ?? item.failureCode?.replaceAll('_', ' ') ?? null : null,
    href: null,
    copyText: text || null,
  };
}

export function sortByNewest(items: LibraryItem[]): LibraryItem[] {
  return [...items].sort((a, b) => {
    const at = a.timestamp ? Date.parse(a.timestamp) : 0;
    const bt = b.timestamp ? Date.parse(b.timestamp) : 0;
    return bt - at;
  });
}

export async function fetchMeetings(): Promise<MeetingRecord[]> {
  return invoke<MeetingRecord[]>('api_get_meetings');
}

export async function fetchDictations(limit = 100): Promise<DictationRecord[]> {
  return invoke<DictationRecord[]>('dictation_list_history', { limit });
}

interface UseLibraryItemsOptions {
  /** Poll interval in ms for dictations, which can change while the app is open. */
  pollMs?: number;
  dictationLimit?: number;
}

export function useLibraryItems({ pollMs = 8000, dictationLimit = 100 }: UseLibraryItemsOptions = {}) {
  const [meetings, setMeetings] = useState<MeetingRecord[]>([]);
  const [dictations, setDictations] = useState<DictationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const mounted = useRef(true);

  const refresh = useCallback(async (showLoading = false) => {
    if (inFlight.current) return;
    inFlight.current = true;
    if (showLoading) setLoading(true);
    const results = await Promise.allSettled([fetchMeetings(), fetchDictations(dictationLimit)]);
    if (!mounted.current) {
      inFlight.current = false;
      return;
    }
    const [meetingsResult, dictationsResult] = results;
    const problems: string[] = [];
    if (meetingsResult.status === 'fulfilled') setMeetings(meetingsResult.value);
    else problems.push('Meetings could not be loaded.');
    if (dictationsResult.status === 'fulfilled') setDictations(dictationsResult.value);
    else problems.push('Dictations could not be loaded.');
    setError(problems.length ? problems.join(' ') : null);
    setLoading(false);
    inFlight.current = false;
  }, [dictationLimit]);

  useEffect(() => {
    mounted.current = true;
    void refresh(true);

    const poll = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, pollMs);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);

    let disposed = false;
    let unlistenState: (() => void) | undefined;
    void listen<{ phase: string }>('dictation-state', event => {
      if (event.payload.phase === 'completed' || event.payload.phase === 'failed') void refresh();
    }).then(dispose => {
      if (disposed) dispose();
      else unlistenState = dispose;
    });

    const onMeetingsChanged = () => void refresh();
    window.addEventListener('pulse-talq:meetings-changed', onMeetingsChanged);

    return () => {
      mounted.current = false;
      disposed = true;
      window.clearInterval(poll);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pulse-talq:meetings-changed', onMeetingsChanged);
      unlistenState?.();
    };
  }, [refresh, pollMs]);

  const items = useMemo(
    () => sortByNewest([...meetings.map(meetingToLibraryItem), ...dictations.map(dictationToLibraryItem)]),
    [meetings, dictations],
  );

  return { items, meetings, dictations, loading, error, refresh };
}

/** Notify list views that meetings changed (rename, delete, recovery). */
export function announceMeetingsChanged() {
  window.dispatchEvent(new Event('pulse-talq:meetings-changed'));
}

export function formatRelativeTime(iso: string | null, now = Date.now()): string {
  if (!iso) return '';
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return '';
  const diff = now - time;
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return 'Just now';
  if (diff < hour) return `${Math.floor(diff / minute)} min ago`;
  if (diff < day) {
    const hours = Math.floor(diff / hour);
    return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
  }
  const date = new Date(time);
  const today = new Date(now);
  const yesterday = new Date(now - day);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const timeLabel = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (sameDay(date, today)) return `Today at ${timeLabel}`;
  if (sameDay(date, yesterday)) return `Yesterday at ${timeLabel}`;
  if (diff < 7 * day) return date.toLocaleDateString([], { weekday: 'long' });
  return date.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() === today.getFullYear() ? undefined : 'numeric',
  });
}

export function formatAbsoluteTime(iso: string | null): string {
  if (!iso) return '';
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return '';
  return new Date(time).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
