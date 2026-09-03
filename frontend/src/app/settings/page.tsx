'use client';

import React, { useEffect, useState } from 'react';
import { ArrowLeft, Settings2, Mic, Database as DatabaseIcon, SparkleIcon, FlaskConical, AudioLines } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { invoke } from '@tauri-apps/api/core';
import { TranscriptSettings } from '@/components/TranscriptSettings';
import { RecordingSettings } from '@/components/RecordingSettings';
import { PreferenceSettings } from '@/components/PreferenceSettings';
import { SummaryModelSettings } from '@/components/SummaryModelSettings';
import { BetaSettings } from '@/components/BetaSettings';
import { DictationSettings } from '@/components/DictationSettings';
import { useConfig } from '@/contexts/ConfigContext';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

const TABS = [
  { value: 'general', label: 'General', icon: Settings2 },
  { value: 'dictation', label: 'Dictation', icon: AudioLines },
  { value: 'recording', label: 'Recordings', icon: Mic },
  { value: 'Transcriptionmodels', label: 'Transcription', icon: DatabaseIcon },
  { value: 'summaryModels', label: 'Summary', icon: SparkleIcon },
  { value: 'beta', label: 'Beta', icon: FlaskConical }
] as const;

export default function SettingsPage() {
  const router = useRouter();
  const { transcriptModelConfig, setTranscriptModelConfig } = useConfig();
  const [activeTab, setActiveTab] = useState('general');

  useEffect(() => {
    const loadTranscriptConfig = async () => {
      try {
        const config = await invoke('api_get_transcript_config') as any;
        if (config) {
          setTranscriptModelConfig({
            provider: config.provider || 'localWhisper',
            model: config.model || 'large-v3',
            apiKey: config.apiKey || null
          });
        }
      } catch (error) {
        console.error('Failed to load transcript config:', error);
      }
    };
    loadTranscriptConfig();
  }, [setTranscriptModelConfig]);

  return (
    <main className="flex h-screen flex-col bg-[var(--pt-bg)] text-[var(--pt-text)]">
      <header className="sticky top-0 z-10 border-b border-[var(--pt-border)] bg-[var(--pt-bg)]">
        <div className="mx-auto flex w-full max-w-6xl items-end justify-between gap-6 px-6 py-5 md:px-8">
          <div>
            <button
              type="button"
              onClick={() => router.back()}
              className="pt-focus-ring mb-4 inline-flex min-h-10 items-center gap-2 text-sm font-medium text-[var(--pt-text-secondary)] transition-colors hover:text-[var(--pt-text)]"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back
            </button>
            <h1 className="text-[30px] font-medium leading-[1.1] tracking-[-0.04em]">Settings</h1>
            <p className="mt-2 max-w-2xl text-sm text-[var(--pt-text-secondary)]">Control how PulseTalq captures, processes, and returns your words.</p>
          </div>
          <div className="hidden border-l-2 border-[var(--pt-accent)] pl-3 text-right sm:block">
            <p className="text-sm font-medium">Local by default</p>
            <p className="mt-1 text-xs text-[var(--pt-text-tertiary)]">Preferences stay on this device.</p>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-6xl px-6 pb-10 pt-6 md:px-8">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="h-auto w-full justify-start gap-0 overflow-x-auto border-b border-[var(--pt-border-strong)] bg-transparent p-0 [border-radius:0]">
              {TABS.map(tab => {
                const Icon = tab.icon;
                return (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="pt-focus-ring relative min-h-11 shrink-0 gap-2 border-0 bg-transparent px-4 py-3 text-sm font-medium text-[var(--pt-text-tertiary)] shadow-none [border-radius:0] hover:bg-[var(--pt-surface-alt)] hover:text-[var(--pt-text)] data-[state=active]:bg-[var(--pt-surface)] data-[state=active]:text-[var(--pt-text)] data-[state=active]:shadow-none after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-transparent data-[state=active]:after:bg-[var(--pt-accent)]"
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    {tab.label}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            <div className="mt-5 border-t border-[var(--pt-border)]">
              <TabsContent value="general" className="mt-0"><PreferenceSettings /></TabsContent>
              <TabsContent value="dictation" className="mt-0"><DictationSettings /></TabsContent>
              <TabsContent value="recording" className="mt-0"><RecordingSettings /></TabsContent>
              <TabsContent value="Transcriptionmodels" className="mt-0">
                <TranscriptSettings transcriptModelConfig={transcriptModelConfig} setTranscriptModelConfig={setTranscriptModelConfig} />
              </TabsContent>
              <TabsContent value="summaryModels" className="mt-0"><SummaryModelSettings /></TabsContent>
              <TabsContent value="beta" className="mt-0"><BetaSettings /></TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    </main>
  );
}
