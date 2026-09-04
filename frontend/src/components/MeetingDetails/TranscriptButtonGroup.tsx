"use client";

import { useState, useCallback } from 'react';
import { Copy, FolderOpen, RefreshCw } from 'lucide-react';
import Analytics from '@/lib/analytics';
import { RetranscribeDialog } from './RetranscribeDialog';
import { useConfig } from '@/contexts/ConfigContext';


interface TranscriptButtonGroupProps {
  transcriptCount: number;
  onCopyTranscript: () => void;
  onOpenMeetingFolder: () => Promise<void>;
  meetingId?: string;
  meetingFolderPath?: string | null;
  onRefetchTranscripts?: () => Promise<void>;
}


export function TranscriptButtonGroup({
  transcriptCount,
  onCopyTranscript,
  onOpenMeetingFolder,
  meetingId,
  meetingFolderPath,
  onRefetchTranscripts,
}: TranscriptButtonGroupProps) {
  const { betaFeatures } = useConfig();
  const [showRetranscribeDialog, setShowRetranscribeDialog] = useState(false);

  const handleRetranscribeComplete = useCallback(async () => {
    // Refetch transcripts to show the updated data
    if (onRefetchTranscripts) {
      await onRefetchTranscripts();
    }
  }, [onRefetchTranscripts]);

  return (
    <div className="flex items-center justify-center w-full gap-2">
      <button
        type="button"
        className="pt-button pt-button--secondary pt-button--sm"
        onClick={() => {
          Analytics.trackButtonClick('copy_transcript', 'meeting_details');
          onCopyTranscript();
        }}
        disabled={transcriptCount === 0}
        title={transcriptCount === 0 ? 'No transcript available' : 'Copy transcript'}
      >
        <Copy size={16} />
        <span className="hidden lg:inline">Copy</span>
      </button>

      <button
        type="button"
        className="pt-button pt-button--secondary pt-button--sm"
        onClick={() => {
          Analytics.trackButtonClick('open_recording_folder', 'meeting_details');
          onOpenMeetingFolder();
        }}
        title="Open recording folder"
      >
        <FolderOpen size={16} />
        <span className="hidden lg:inline">Recording</span>
      </button>

      {betaFeatures.importAndRetranscribe && meetingId && meetingFolderPath && (
        <button
          type="button"
          className="pt-button pt-button--secondary pt-button--sm"
          onClick={() => {
            Analytics.trackButtonClick('enhance_transcript', 'meeting_details');
            setShowRetranscribeDialog(true);
          }}
          title="Retranscribe to enhance your recorded audio"
        >
          <RefreshCw size={16} />
          <span className="hidden lg:inline">Enhance</span>
        </button>
      )}

      {betaFeatures.importAndRetranscribe && meetingId && meetingFolderPath && (
        <RetranscribeDialog
          open={showRetranscribeDialog}
          onOpenChange={setShowRetranscribeDialog}
          meetingId={meetingId}
          meetingFolderPath={meetingFolderPath}
          onComplete={handleRetranscribeComplete}
        />
      )}
    </div>
  );
}
