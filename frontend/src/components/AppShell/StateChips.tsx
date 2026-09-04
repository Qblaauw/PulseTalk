'use client';

import { Cloud, CloudOff, HardDrive, Loader2, Lock, Send, TriangleAlert, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import {
  PRIVACY_LABELS,
  SYNC_LABELS,
  SYNC_TONE,
  type PrivacyState,
  type SyncState,
} from '@/lib/privacy';
import { cn } from '@/lib/utils';

type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'error' | 'accent';

const toneClass: Record<Tone, string> = {
  neutral: '',
  info: 'pt-badge--info',
  success: 'pt-badge--success',
  warning: 'pt-badge--warning',
  error: 'pt-badge--error',
  accent: 'pt-badge--accent',
};

export function StateChip({
  tone = 'neutral',
  icon,
  children,
  className,
  title,
}: {
  tone?: Tone;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <span className={cn('pt-badge', toneClass[tone], className)} title={title}>
      {icon}
      {children}
    </span>
  );
}

const privacyIcon: Record<PrivacyState, ReactNode> = {
  'stored-on-device': <HardDrive size={12} aria-hidden="true" />,
  'processed-on-device': <Lock size={12} aria-hidden="true" />,
  'sent-to-provider': <Send size={12} aria-hidden="true" />,
  'synced-to-account': <Cloud size={12} aria-hidden="true" />,
  'shared-with-workspace': <Users size={12} aria-hidden="true" />,
};

export function PrivacyChip({ state, className }: { state: PrivacyState; className?: string }) {
  const tone: Tone = state === 'sent-to-provider' ? 'warning' : state === 'shared-with-workspace' ? 'info' : 'neutral';
  return (
    <StateChip tone={tone} icon={privacyIcon[state]} className={className}>
      {PRIVACY_LABELS[state]}
    </StateChip>
  );
}

const syncIcon: Record<SyncState, ReactNode> = {
  'local-only': <HardDrive size={12} aria-hidden="true" />,
  syncing: <Loader2 size={12} aria-hidden="true" className="animate-spin" />,
  synced: <Cloud size={12} aria-hidden="true" />,
  offline: <CloudOff size={12} aria-hidden="true" />,
  'needs-attention': <TriangleAlert size={12} aria-hidden="true" />,
};

export function SyncChip({ state, className }: { state: SyncState; className?: string }) {
  return (
    <StateChip tone={SYNC_TONE[state]} icon={syncIcon[state]} className={className}>
      {SYNC_LABELS[state]}
    </StateChip>
  );
}
