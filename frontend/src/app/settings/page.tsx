'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { invoke } from '@tauri-apps/api/core';
import { getVersion } from '@tauri-apps/api/app';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader, PageBody } from '@/components/AppShell/PageHeader';
import { PrivacyChip } from '@/components/AppShell/StateChips';
import { transcriptionPrivacyState, summaryPrivacyState } from '@/lib/privacy';
import { TranscriptSettings } from '@/components/TranscriptSettings';
import type { TranscriptModelProps } from '@/components/TranscriptSettings';
import { RecordingSettings } from '@/components/RecordingSettings';
import { PreferenceSettings } from '@/components/PreferenceSettings';
import { SummaryModelSettings } from '@/components/SummaryModelSettings';
import { BetaSettings } from '@/components/BetaSettings';
import { DictationSettings } from '@/components/DictationSettings';
import AnalyticsConsentSwitch from '@/components/AnalyticsConsentSwitch';
import { useConfig } from '@/contexts/ConfigContext';
import { useUpdateCheckContext } from '@/components/UpdateCheckProvider';
import { updateService, UpdateInfo } from '@/services/updateService';

// Old tab query values map onto the new anchors so existing links keep working.
const TAB_TO_SECTION: Record<string, string> = {
  general: 'recording',
  dictation: 'dictation',
  recording: 'recording',
  Transcriptionmodels: 'transcription',
  summaryModels: 'summary',
  beta: 'advanced',
};

const SECTIONS = [
  { id: 'dictation', label: 'Dictation' },
  { id: 'recording', label: 'Recording' },
  { id: 'transcription', label: 'Transcription' },
  { id: 'summary', label: 'Summary' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'advanced', label: 'Advanced' },
  { id: 'about', label: 'About' },
];

function jumpTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function SettingsContent() {
  const searchParams = useSearchParams();
  const { transcriptModelConfig, setTranscriptModelConfig, notificationSettings } = useConfig();
  const [summaryProvider, setSummaryProvider] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // Load saved transcript configuration on mount.
  useEffect(() => {
    const loadTranscriptConfig = async () => {
      try {
        const config = await invoke<{ provider?: TranscriptModelProps['provider']; model?: string; apiKey?: string | null } | null>('api_get_transcript_config');
        if (config) {
          setTranscriptModelConfig({
            provider: config.provider || 'localWhisper',
            model: config.model || 'large-v3',
            apiKey: config.apiKey || null,
          });
        }
      } catch (error) {
        console.error('Failed to load transcript config:', error);
      }
    };
    loadTranscriptConfig();
  }, [setTranscriptModelConfig]);

  // Track the summary provider only for the privacy chip; SummaryModelSettings owns the real state.
  useEffect(() => {
    invoke<{ provider?: string } | null>('api_get_model_config')
      .then((config) => setSummaryProvider(config?.provider ?? null))
      .catch(() => setSummaryProvider(null));
  }, []);

  // Deep-link support: /settings#dictation and legacy ?tab= values.
  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    const tabParam = searchParams.get('tab');
    const target = hash || (tabParam ? TAB_TO_SECTION[tabParam] : null);
    if (target) {
      const raf = requestAnimationFrame(() => jumpTo(target));
      if (tabParam === 'beta') setAdvancedOpen(true);
      return () => cancelAnimationFrame(raf);
    }
  }, [searchParams]);

  return (
    <PageBody>
      <PageHeader eyebrow="Settings" title="Make it yours." description="Dictation, recording, transcription, and summary preferences, all in one place." />

      <nav aria-label="Jump to section" className="pt-segmented mt-6 flex-wrap">
        {SECTIONS.map(section => (
          <button
            key={section.id}
            type="button"
            className="pt-segmented__item"
            onClick={() => jumpTo(section.id)}
          >
            {section.label}
          </button>
        ))}
      </nav>

      <div className="mt-10 flex flex-col gap-12">
        <section id="dictation" aria-labelledby="dictation-heading">
          <h2 id="dictation-heading" className="pt-section-title mb-4">Dictation</h2>
          <DictationSettings />
        </section>

        <section id="recording" aria-labelledby="recording-heading">
          <h2 id="recording-heading" className="pt-section-title mb-4">Recording</h2>
          <div className="flex flex-col gap-6">
            <PreferenceSettings hideAnalytics />
            <RecordingSettings />
          </div>
        </section>

        <section id="transcription" aria-labelledby="transcription-heading">
          <div className="mb-4 flex items-center gap-3">
            <h2 id="transcription-heading" className="pt-section-title">Transcription</h2>
            <PrivacyChip state={transcriptionPrivacyState(transcriptModelConfig.provider)} />
          </div>
          <TranscriptSettings
            transcriptModelConfig={transcriptModelConfig}
            setTranscriptModelConfig={setTranscriptModelConfig}
          />
        </section>

        <section id="summary" aria-labelledby="summary-heading">
          <div className="mb-4 flex items-center gap-3">
            <h2 id="summary-heading" className="pt-section-title">Summary</h2>
            <PrivacyChip state={summaryPrivacyState(summaryProvider)} />
          </div>
          <SummaryModelSettings />
        </section>

        {notificationSettings && (
          <section id="notifications" aria-labelledby="notifications-heading">
            <h2 id="notifications-heading" className="pt-section-title mb-4">Notifications</h2>
            <PreferenceSettings onlyNotifications />
          </section>
        )}

        <section id="advanced" aria-labelledby="advanced-heading">
          <h2 id="advanced-heading" className="pt-section-title mb-4">Advanced</h2>
          <AdvancedSection open={advancedOpen} onOpenChange={setAdvancedOpen} />
        </section>

        <section id="about" aria-labelledby="about-heading">
          <h2 id="about-heading" className="pt-section-title mb-4">About</h2>
          <AboutSection />
        </section>
      </div>
    </PageBody>
  );
}

function AdvancedSection({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [openingDiagnostics, setOpeningDiagnostics] = useState(false);

  const openDiagnostics = async () => {
    setOpeningDiagnostics(true);
    try {
      await invoke('open_diagnostics_folder');
    } catch (cause) {
      toast.error(`Could not open diagnostics: ${String(cause)}`);
    } finally {
      setOpeningDiagnostics(false);
    }
  };

  return (
    <details className="pt-card p-0" open={open} onToggle={e => onOpenChange((e.target as HTMLDetailsElement).open)}>
      <summary className="pt-row cursor-pointer select-none font-medium">
        Beta features, diagnostics, and analytics
      </summary>
      <div className="flex flex-col gap-6 border-t border-[var(--pt-border)] p-4">
        <div>
          <h3 className="pt-label mb-2">Beta features</h3>
          <BetaSettings />
        </div>

        <div className="pt-group">
          <div className="pt-row">
            <div className="flex-1">
              <div className="pt-label mb-1">Diagnostics</div>
              <p className="text-sm text-[var(--pt-text-secondary)]">Open the privacy-filtered support logs for troubleshooting.</p>
            </div>
            <button
              type="button"
              className="pt-button pt-button--secondary pt-button--sm"
              onClick={openDiagnostics}
              disabled={openingDiagnostics}
              aria-busy={openingDiagnostics}
            >
              {openingDiagnostics ? 'Opening…' : 'Open diagnostics folder'}
            </button>
          </div>
        </div>

        <div>
          <h3 className="pt-label mb-2">Analytics</h3>
          <AnalyticsConsentSwitch />
        </div>
      </div>
    </details>
  );
}

function AboutSection() {
  const [version, setVersion] = useState('0.4.0');
  const [isChecking, setIsChecking] = useState(false);
  const { showUpdateDialog } = useUpdateCheckContext();

  useEffect(() => {
    getVersion().then(setVersion).catch(() => {});
  }, []);

  const handleCheckForUpdates = async () => {
    setIsChecking(true);
    try {
      const info: UpdateInfo = await updateService.checkForUpdates(true);
      if (info.available) {
        showUpdateDialog();
      } else {
        toast.success('You are running the latest version');
      }
    } catch (error: unknown) {
      toast.error('Failed to check for updates: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsChecking(false);
    }
  };

  const openLink = async (url: string) => {
    try {
      await invoke('open_external_url', { url });
    } catch (error) {
      console.error('Failed to open link:', error);
    }
  };

  return (
    <div className="pt-group">
      <div className="pt-row">
        <div className="flex-1">
          <div className="font-medium text-[var(--pt-text)]">PulseTalq</div>
          <p className="text-sm text-[var(--pt-text-secondary)]">Version {version}</p>
        </div>
        <button
          type="button"
          className="pt-button pt-button--secondary pt-button--sm"
          onClick={handleCheckForUpdates}
          disabled={isChecking}
        >
          {isChecking ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking…
            </>
          ) : (
            <>
              <CheckCircle2 className="h-3.5 w-3.5" /> Check for updates
            </>
          )}
        </button>
      </div>
      <button
        type="button"
        className="pt-row pt-row--interactive w-full text-left"
        onClick={() => openLink('https://github.com/Qblaauw/PulseTalq/blob/main/PRIVACY_POLICY.md')}
      >
        <span className="flex-1 text-sm">Privacy policy</span>
      </button>
      <button
        type="button"
        className="pt-row pt-row--interactive w-full text-left"
        onClick={() => openLink('https://github.com/Qblaauw/PulseTalq/blob/main/LICENSE')}
      >
        <span className="flex-1 text-sm">Licenses</span>
      </button>
      <button
        type="button"
        className="pt-row pt-row--interactive w-full text-left"
        onClick={() => openLink('https://github.com/Qblaauw/PulseTalq/issues')}
      >
        <span className="flex-1 text-sm">Support</span>
      </button>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={null}>
      <SettingsContent />
    </Suspense>
  );
}
