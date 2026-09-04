'use client';

import { useMemo } from 'react';
import { Copy, Languages } from 'lucide-react';
import { VirtualizedTranscriptView } from '@/components/VirtualizedTranscriptView';
import { PermissionWarning } from '@/components/PermissionWarning';
import { PrivacyChip, StateChip } from '@/components/AppShell/StateChips';
import { useTranscripts } from '@/contexts/TranscriptContext';
import { useConfig } from '@/contexts/ConfigContext';
import { useRecordingState } from '@/contexts/RecordingStateContext';
import { usePermissionCheck } from '@/hooks/usePermissionCheck';
import { ModalType } from '@/hooks/useModalState';
import { useIsLinux } from '@/hooks/usePlatform';
import { transcriptionPrivacyState } from '@/lib/privacy';
import { cn } from '@/lib/utils';

/**
 * Live capture view shown while a meeting is being recorded or finalized.
 * The header is a translucent bar so the transcript can scroll beneath it.
 */
interface TranscriptPanelProps {
  isProcessingStop: boolean;
  isStopping: boolean;
  showModal: (name: ModalType, message?: string) => void;
}

export function TranscriptPanel({ isProcessingStop, isStopping, showModal }: TranscriptPanelProps) {
  const { transcripts, transcriptContainerRef, copyTranscript, meetingTitle } = useTranscripts();
  const { transcriptModelConfig } = useConfig();
  const { isRecording, isPaused } = useRecordingState();
  const { checkPermissions, isChecking, hasSystemAudio, hasMicrophone } = usePermissionCheck();
  const isLinux = useIsLinux();

  const segments = useMemo(
    () =>
      transcripts.map(t => ({
        id: t.id,
        timestamp: t.audio_start_time ?? 0,
        endTime: t.audio_end_time,
        text: t.text,
        confidence: t.confidence,
      })),
    [transcripts],
  );

  const statusLabel = isStopping || isProcessingStop ? 'Finishing' : isPaused ? 'Paused' : isRecording ? 'Recording' : 'Ready';
  const statusTone = isRecording && !isPaused ? 'accent' : isPaused ? 'warning' : 'neutral';

  return (
    <div ref={transcriptContainerRef} className="pt-scroll flex h-full w-full flex-col overflow-y-auto bg-[var(--pt-bg)]">
      <div className="sticky top-0 z-10 border-b border-[var(--pt-border)] bg-[var(--pt-glass)] px-6 py-4 backdrop-blur-xl md:px-10">
        <div className="mx-auto flex max-w-[var(--pt-content-max)] flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="pt-label">Meeting</p>
            <h1 className="truncate text-[20px] font-semibold leading-tight tracking-[-0.02em]">{meetingTitle || 'New meeting'}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StateChip
              tone={statusTone}
              icon={<span className={cn('pt-dot', isRecording && !isPaused && 'pt-pulse')} aria-hidden="true" />}
            >
              {statusLabel}
            </StateChip>
            <PrivacyChip state={transcriptionPrivacyState(transcriptModelConfig.provider)} className="hidden md:inline-flex" />
            {transcripts.length > 0 && (
              <button type="button" className="pt-button pt-button--secondary pt-button--sm" onClick={copyTranscript}>
                <Copy size={14} aria-hidden="true" />
                <span className="hidden sm:inline">Copy</span>
              </button>
            )}
            {transcriptModelConfig.provider === 'localWhisper' && (
              <button type="button" className="pt-button pt-button--secondary pt-button--sm" onClick={() => showModal('languageSettings')}>
                <Languages size={14} aria-hidden="true" />
                <span className="hidden sm:inline">Language</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {!isRecording && !isChecking && !isLinux && (
        <div className="mx-auto w-full max-w-[var(--pt-content-max)] px-6 pt-6 md:px-10">
          <PermissionWarning hasMicrophone={hasMicrophone} hasSystemAudio={hasSystemAudio} onRecheck={checkPermissions} isRechecking={isChecking} />
        </div>
      )}

      <div className="mx-auto w-full max-w-[820px] flex-1 px-6 pb-40 pt-6 md:px-10">
        <VirtualizedTranscriptView
          segments={segments}
          isRecording={isRecording}
          isPaused={isPaused}
          isProcessing={isProcessingStop}
          isStopping={isStopping}
          enableStreaming={isRecording}
          showConfidence
        />
      </div>
    </div>
  );
}
