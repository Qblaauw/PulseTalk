"use client";

import { Copy, Save, Loader2, FolderOpen } from 'lucide-react';
import Analytics from '@/lib/analytics';

interface SummaryUpdaterButtonGroupProps {
  isSaving: boolean;
  isDirty: boolean;
  onSave: () => Promise<void>;
  onCopy: () => Promise<void>;
  onFind?: () => void;
  onOpenFolder: () => Promise<void>;
  hasSummary: boolean;
}

export function SummaryUpdaterButtonGroup({
  isSaving,
  isDirty,
  onSave,
  onCopy,
  onOpenFolder,
  hasSummary
}: SummaryUpdaterButtonGroupProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* One save action for edits */}
      <button
        type="button"
        className="pt-button pt-button--secondary pt-button--sm"
        title={isSaving ? 'Saving' : 'Save changes'}
        onClick={() => {
          Analytics.trackButtonClick('save_changes', 'meeting_details');
          onSave();
        }}
        disabled={isSaving || !isDirty}
      >
        {isSaving ? (
          <>
            <Loader2 className="animate-spin" size={16} />
            <span className="hidden lg:inline">Saving…</span>
          </>
        ) : (
          <>
            <Save size={16} />
            <span className="hidden lg:inline">Save</span>
          </>
        )}
      </button>

      <button
        type="button"
        className="pt-button pt-button--secondary pt-button--sm"
        title="Copy summary"
        onClick={() => {
          Analytics.trackButtonClick('copy_summary', 'meeting_details');
          onCopy();
        }}
        disabled={!hasSummary}
      >
        <Copy size={16} />
        <span className="hidden lg:inline">Copy</span>
      </button>

      <button
        type="button"
        className="pt-button pt-button--secondary pt-button--sm"
        title="Open recording folder"
        onClick={() => {
          Analytics.trackButtonClick('open_recording_folder', 'meeting_details');
          onOpenFolder();
        }}
      >
        <FolderOpen size={16} />
        <span className="hidden lg:inline">Folder</span>
      </button>
    </div>
  );
}
