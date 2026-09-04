/**
 * Shared privacy and sync vocabulary.
 *
 * The approved redesign fixes these labels so every view says the same thing
 * about where data lives and where it is processed. Cloud sync is not built
 * yet, so the only reachable sync state today is `local-only`, but the full
 * set is defined here so later work does not invent new wording.
 */

export type PrivacyState =
  | 'stored-on-device'
  | 'processed-on-device'
  | 'sent-to-provider'
  | 'synced-to-account'
  | 'shared-with-workspace';

export const PRIVACY_LABELS: Record<PrivacyState, string> = {
  'stored-on-device': 'Stored only on this device',
  'processed-on-device': 'Processed on this device',
  'sent-to-provider': 'Sent to a cloud provider',
  'synced-to-account': 'Synced to your account',
  'shared-with-workspace': 'Shared with your workspace',
};

export type SyncState = 'local-only' | 'syncing' | 'synced' | 'offline' | 'needs-attention';

export const SYNC_LABELS: Record<SyncState, string> = {
  'local-only': 'Local only',
  syncing: 'Syncing',
  synced: 'Synced',
  offline: 'Offline',
  'needs-attention': 'Sync needs attention',
};

export const SYNC_TONE: Record<SyncState, 'neutral' | 'info' | 'success' | 'warning' | 'error'> = {
  'local-only': 'neutral',
  syncing: 'info',
  synced: 'success',
  offline: 'warning',
  'needs-attention': 'error',
};

/** Until account sync exists every record is local only. */
export const CURRENT_SYNC_STATE: SyncState = 'local-only';

const LOCAL_TRANSCRIPTION_PROVIDERS = new Set(['localWhisper', 'parakeet']);
const LOCAL_SUMMARY_PROVIDERS = new Set(['ollama', 'builtin-ai']);

export function transcriptionPrivacyState(provider: string | null | undefined): PrivacyState {
  if (!provider || LOCAL_TRANSCRIPTION_PROVIDERS.has(provider)) return 'processed-on-device';
  return 'sent-to-provider';
}

export function summaryPrivacyState(provider: string | null | undefined): PrivacyState {
  if (!provider || LOCAL_SUMMARY_PROVIDERS.has(provider)) return 'processed-on-device';
  return 'sent-to-provider';
}

export function providerDisplayName(provider: string | null | undefined): string {
  switch (provider) {
    case 'localWhisper':
      return 'Whisper on this device';
    case 'parakeet':
      return 'Parakeet on this device';
    case 'ollama':
      return 'Ollama on this device';
    case 'builtin-ai':
      return 'Built-in model on this device';
    case 'deepgram':
      return 'Deepgram';
    case 'elevenLabs':
      return 'ElevenLabs';
    case 'groq':
      return 'Groq';
    case 'openai':
      return 'OpenAI';
    case 'claude':
      return 'Anthropic';
    case 'openrouter':
      return 'OpenRouter';
    case 'custom-openai':
      return 'Custom endpoint';
    default:
      return provider ?? 'Not configured';
  }
}
