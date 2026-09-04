'use client';

import { Loader2 } from 'lucide-react';

interface StatusOverlaysProps {
  isProcessing: boolean;
  isSaving: boolean;
}

function StatusOverlay({ show, message }: { show: boolean; message: string }) {
  if (!show) return null;
  return (
    <div
      className="pointer-events-none fixed bottom-6 right-0 z-10 flex justify-center px-6"
      style={{ left: 'var(--pt-shell-sidebar, 0px)' }}
      role="status"
      aria-live="polite"
    >
      <div className="pt-card pt-card--glass pointer-events-auto flex items-center gap-2.5 rounded-full px-4 py-2 shadow-[var(--pt-shadow-md)]">
        <Loader2 size={15} className="animate-spin text-[var(--pt-accent)]" aria-hidden="true" />
        <span className="text-[13px] font-medium text-[var(--pt-text)]">{message}</span>
      </div>
    </div>
  );
}

export function StatusOverlays({ isProcessing, isSaving }: StatusOverlaysProps) {
  return (
    <>
      <StatusOverlay show={isProcessing} message="Finishing transcription on this device" />
      <StatusOverlay show={isSaving} message="Saving to this device" />
    </>
  );
}
