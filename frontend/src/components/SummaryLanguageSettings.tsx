'use client';

import { useState } from 'react';
import { Globe, Pin } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { LanguagePickerPopover } from '@/components/LanguagePickerPopover';
import { useRecentLanguages } from '@/hooks/useRecentLanguages';
import { labelForCode } from '@/lib/summary-languages';

export function SummaryLanguageSettings() {
  const { recents, pinned, addRecent, removeRecent, setPinned } = useRecentLanguages();
  const [pickerOpen, setPickerOpen] = useState(false);

  const togglePin = (code: string) => {
    setPinned(pinned === code ? null : code);
  };

  return (
    <section className="relative border border-[var(--pt-border)] bg-[var(--pt-surface)] p-6 [border-radius:3px]">
      <div className="flex items-center gap-2 mb-2">
        <Globe size={18} className="text-[var(--pt-accent)]" />
        <h3 className="text-lg font-medium text-[var(--pt-text)]">Summary language</h3>
      </div>
      <p className="mb-4 text-sm text-[var(--pt-text-secondary)]">
        Pin one language as the default for new meetings. Unpinned languages remain as
        quick-switch options in the summary generator. Auto uses the dominant transcript language.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {recents.map((code) => {
          const isPinned = pinned === code;
          return (
            <span
              key={code}
              className={`inline-flex items-center overflow-hidden border text-sm [border-radius:3px] ${
                isPinned
                  ? 'border-[var(--pt-accent)] bg-[var(--pt-accent-wash)] text-[var(--pt-text)]'
                  : 'border-[var(--pt-border)] bg-[var(--pt-surface-alt)] text-[var(--pt-text)]'
              }`}
            >
              <button
                type="button"
                aria-label={isPinned ? `Unpin ${labelForCode(code)} as default` : `Pin ${labelForCode(code)} as default`}
                aria-pressed={isPinned}
                title={isPinned ? 'Click to unset as default' : 'Click to set as default'}
                onClick={() => togglePin(code)}
                className={`flex items-center gap-1.5 pl-3 pr-2 py-1 hover:brightness-95 active:brightness-90 ${
                  isPinned ? 'text-[var(--pt-text)]' : 'text-[var(--pt-text-secondary)]'
                }`}
              >
                <Pin
                  size={14}
                  className={isPinned ? 'text-[var(--pt-accent)]' : 'text-[var(--pt-text-tertiary)]'}
                  fill={isPinned ? 'currentColor' : 'none'}
                />
                {labelForCode(code)}
              </button>
              <button
                type="button"
                aria-label={`Remove ${labelForCode(code)}`}
                onClick={() => removeRecent(code)}
                className={`py-1 pl-0.5 pr-2.5 leading-none ${isPinned ? 'text-[var(--pt-accent-active)] hover:text-[var(--pt-error)]' : 'text-[var(--pt-text-tertiary)] hover:text-[var(--pt-text)]'}`}
              >
                ×
              </button>
            </span>
          );
        })}

        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              disabled={recents.length >= 5}
              className="pt-focus-ring inline-flex items-center gap-1 border border-dashed border-[var(--pt-border-strong)] px-3 py-1 text-sm text-[var(--pt-text-secondary)] [border-radius:3px] hover:border-[var(--pt-border-hover)] hover:text-[var(--pt-text)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              ＋ Add language
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-0 border-0 shadow-none bg-transparent">
            <LanguagePickerPopover
              mode="settings"
              value={null}
              onChange={(code) => {
                if (code) addRecent(code);
                setPickerOpen(false);
              }}
              onClose={() => setPickerOpen(false)}
            />
          </PopoverContent>
        </Popover>
      </div>

      <p className="mt-3 text-xs text-[var(--pt-text-tertiary)]">
        {pinned
          ? `Default: ${labelForCode(pinned)} - click it again to unset. Max 5 quick-switch options.`
          : 'Click any language to set it as your default. Max 5 quick-switch options.'}
      </p>
    </section>
  );
}
