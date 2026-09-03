"use client"

import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"
import { AudioLines, ClipboardCheck, FolderOpen, History, LockKeyhole, Mic2, PictureInPicture2, Sparkles } from "lucide-react"
import { useRouter } from "next/navigation"
import { KeyboardEvent, useEffect, useState } from "react"
import { Switch } from '@/components/ui/switch'
import { captureDictationShortcut, shortcutParts } from '@/lib/dictationShortcut'

type ShortcutStatus = {
  enabled: boolean
  shortcut?: string | null
  message?: string | null
}

export function DictationSettings() {
  const router = useRouter()
  const [status, setStatus] = useState<ShortcutStatus | null>(null)
  const [overlayEnabled, setOverlayEnabled] = useState<boolean | null>(null)
  const [savingOverlay, setSavingOverlay] = useState(false)
  const [openingDiagnostics, setOpeningDiagnostics] = useState(false)
  const [diagnosticsError, setDiagnosticsError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [capturing, setCapturing] = useState(false)
  const [candidate, setCandidate] = useState<string | null>(null)
  const [shortcutMessage, setShortcutMessage] = useState<string | null>(null)
  const [savingShortcut, setSavingShortcut] = useState(false)

  useEffect(() => {
    let disposed = false
    let shortcutRevision = 0
    let stopListening: (() => void) | undefined

    const synchronizeShortcut = async () => {
      stopListening = await listen<ShortcutStatus>('dictation-shortcut-changed', event => {
        shortcutRevision += 1
        if (!disposed) setStatus(event.payload)
      })
      if (disposed) {
        stopListening()
        return
      }

      const queryRevision = shortcutRevision
      try {
        const initialStatus = await invoke<ShortcutStatus>('dictation_get_shortcut_status')
        if (!disposed && shortcutRevision === queryRevision) setStatus(initialStatus)
      } catch (cause) {
        if (!disposed && shortcutRevision === queryRevision) setError(String(cause))
      }
    }

    synchronizeShortcut().catch(cause => {
      if (!disposed) setError(String(cause))
    })
    invoke<boolean>('dictation_get_overlay_enabled')
      .then(setOverlayEnabled)
      .catch(cause => setError(String(cause)))

    return () => {
      disposed = true
      stopListening?.()
    }
  }, [])

  const captureShortcut = (event: KeyboardEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    const result = captureDictationShortcut(event)
    if (!result.ok && result.cancelled) {
      setCapturing(false)
      setCandidate(null)
      setShortcutMessage(null)
      return
    }
    if (!result.ok) {
      setShortcutMessage(result.reason)
      return
    }
    setCandidate(result.shortcut)
    setCapturing(false)
    setShortcutMessage(null)
  }

  const saveShortcut = async () => {
    if (!candidate) return
    setSavingShortcut(true)
    setShortcutMessage(null)
    try {
      const next = await invoke<ShortcutStatus>('dictation_set_shortcut', { shortcut: candidate })
      setStatus(next)
      setCandidate(null)
      setShortcutMessage(`Shortcut changed to ${next.shortcut ?? candidate}.`)
    } catch (cause) {
      setShortcutMessage(`Could not change the shortcut. ${String(cause)}`)
    } finally {
      setSavingShortcut(false)
    }
  }

  const toggleOverlay = async (enabled: boolean) => {
    const previous = overlayEnabled
    setOverlayEnabled(enabled)
    setSavingOverlay(true)
    setError(null)
    try {
      await invoke('dictation_set_overlay_enabled', { enabled })
    } catch (cause) {
      setOverlayEnabled(previous)
      setError(`Could not update the floating overlay: ${String(cause)}`)
    } finally {
      setSavingOverlay(false)
    }
  }

  const openDiagnostics = async () => {
    setOpeningDiagnostics(true)
    setDiagnosticsError(null)
    try {
      await invoke('open_diagnostics_folder')
    } catch (cause) {
      setDiagnosticsError(`Could not open diagnostics: ${String(cause)}`)
    } finally {
      setOpeningDiagnostics(false)
    }
  }

  return (
    <div className="space-y-4 pt-6 text-[var(--pt-text)]">
      <section className="border border-[var(--pt-border)] bg-[var(--pt-surface)] p-6 shadow-[0_1px_2px_rgba(var(--pt-text-rgb),.025)] [border-radius:3px]">
        <div className="flex items-start gap-4">
          <div className="grid h-11 w-11 shrink-0 place-items-center border border-[var(--pt-border)] bg-[var(--pt-surface-alt)] text-[var(--pt-accent)] [border-radius:3px]">
            <AudioLines className="h-[18px] w-[18px]" />
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-medium">Hold-to-talk activation</h2>
                <span className={`h-2 w-2 rounded-full ${status?.enabled ? 'bg-[var(--pt-success)]' : 'bg-[var(--pt-warning)]'}`} aria-label={status?.enabled ? 'Shortcut active' : 'Shortcut unavailable'} />
              </div>
              {!capturing && (
                <button type="button" onClick={() => { setCapturing(true); setCandidate(null); setShortcutMessage(null) }} className="pt-button min-h-10 !border-[var(--pt-border-strong)] !bg-[var(--pt-surface)] px-3 text-sm !text-[var(--pt-text)] hover:!bg-[var(--pt-surface-hover)]">
                  Change shortcut
                </button>
              )}
            </div>
            <p className="mt-1 max-w-2xl text-sm text-[var(--pt-text-secondary)]">Hold while speaking and release when finished. PulseTalq records only while the shortcut is held.</p>

            <div className="mt-5 border-l-2 border-[var(--pt-accent)] bg-[var(--pt-surface-dark)] p-4 text-[var(--pt-text-inverse)] [border-radius:3px]">
              <p className="text-xs font-semibold tracking-[0.08em] text-[var(--pt-text-inverse-muted)]">ACTIVE COMMAND</p>
              <ShortcutChips shortcut={status?.shortcut} inverse />
              {capturing && (
                <button type="button" autoFocus onKeyDown={captureShortcut} onBlur={() => setCapturing(false)} className="mt-3 min-h-11 w-full border border-[var(--pt-accent)] bg-transparent px-3 text-left text-sm font-medium outline-none [border-radius:3px] focus:shadow-[0_0_0_3px_rgba(var(--pt-accent-rgb),.22)]">
                  Press your new combination. Escape cancels.
                </button>
              )}
            </div>

            {candidate && (
              <div className="mt-3 border border-[var(--pt-border)] bg-[var(--pt-surface-alt)] p-3 [border-radius:3px]">
                <p className="text-xs font-semibold tracking-[0.08em] text-[var(--pt-text-tertiary)]">PROPOSED COMMAND</p>
                <ShortcutChips shortcut={candidate} />
              </div>
            )}

            {candidate && !capturing && (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button type="button" onClick={saveShortcut} disabled={savingShortcut} aria-busy={savingShortcut} className="pt-button min-h-10 px-4 text-sm disabled:cursor-wait disabled:opacity-60">
                  {savingShortcut ? 'Saving…' : 'Save shortcut'}
                </button>
                <button type="button" onClick={() => { setCandidate(null); setShortcutMessage(null) }} disabled={savingShortcut} className="pt-button min-h-10 !bg-transparent px-3 text-sm !text-[var(--pt-text-secondary)] hover:!bg-[var(--pt-surface-alt)] hover:!shadow-none">Cancel</button>
              </div>
            )}
            {!status?.enabled && !candidate && <p className="mt-3 text-sm text-[var(--pt-warning)]">{status?.message ?? 'Checking shortcut availability…'}</p>}
            {status?.enabled && status.message && <p className="mt-3 text-sm text-[var(--pt-warning)]" role="status">{status.message}</p>}
            {shortcutMessage && <p className={`mt-3 text-sm ${shortcutMessage.startsWith('Shortcut changed') ? 'text-[var(--pt-success)]' : shortcutMessage.startsWith('Could not') ? 'text-[var(--pt-error)]' : 'text-[var(--pt-warning)]'}`} role="status">{shortcutMessage}</p>}
            {error && <p className="mt-3 text-sm text-[var(--pt-error)]" role="alert">{error}</p>}
            <p className="mt-3 text-xs text-[var(--pt-text-tertiary)]">Use at least one modifier with a letter, number, function key, or Space. PulseTalq keeps the current shortcut if the new combination is unavailable.</p>
          </div>
        </div>
      </section>

      <section className="border border-[var(--pt-border)] bg-[var(--pt-surface)] p-6 shadow-[0_1px_2px_rgba(var(--pt-text-rgb),.025)] [border-radius:3px]">
        <div className="flex items-start gap-4">
          <div className="grid h-11 w-11 shrink-0 place-items-center border border-[var(--pt-border)] bg-[var(--pt-surface-alt)] text-[var(--pt-accent)] [border-radius:3px]">
            <PictureInPicture2 className="h-[18px] w-[18px]" />
          </div>
          <div className="min-w-0 flex-1">
            <label htmlFor="dictation-overlay-toggle" className="font-medium">Floating dictation overlay</label>
            <p className="mt-1 text-sm leading-6 text-[var(--pt-text-secondary)]">Keep a small microphone above other windows. It follows the pointer between screens and expands while PulseTalq listens and pastes into the active text field.</p>
          </div>
          <Switch
            id="dictation-overlay-toggle"
            checked={overlayEnabled ?? true}
            disabled={overlayEnabled === null || savingOverlay}
            onCheckedChange={toggleOverlay}
            aria-label="Show floating dictation overlay"
          />
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <SettingCard
          icon={Mic2}
          title="Local transcription"
          description="Uses the transcription provider and model selected in the Transcription tab. Audio stays on this machine when a local model is selected."
        />
        <SettingCard
          icon={Sparkles}
          title="Local cleanup"
          description="Repairs spacing and removes English hesitation fillers locally. If cleanup exceeds 150 ms or returns an error, PulseTalq pastes the exact raw transcript."
        />
        <SettingCard
          icon={ClipboardCheck}
          title="Paste at the original cursor"
          description="Replaces selected text or inserts at the caret, then restores all clipboard formats after the target has consumed the paste."
        />
        <SettingCard
          icon={LockKeyhole}
          title="Target protection"
          description="PulseTalq refuses to paste if focus moved, the original window closed, or the target runs at a higher Windows integrity level."
        />
        <section className="border border-[var(--pt-border)] bg-[var(--pt-surface)] p-5 [border-radius:3px]">
          <History className="h-[18px] w-[18px] text-[var(--pt-accent)]" />
          <h3 className="mt-3 font-medium">Recovery history</h3>
          <p className="mt-1 text-sm leading-6 text-[var(--pt-text-secondary)]">Every transcript is saved before paste, including failed deliveries.</p>
          <button
            onClick={() => router.push('/dictation-history')}
            className="pt-button mt-4 min-h-10 !border-[var(--pt-border-strong)] !bg-[var(--pt-surface)] px-3 text-sm !text-[var(--pt-text)] hover:!bg-[var(--pt-surface-hover)]"
          >
            Open dictation history
          </button>
        </section>
        <section className="border border-[var(--pt-border)] bg-[var(--pt-surface)] p-5 [border-radius:3px]">
          <FolderOpen className="h-[18px] w-[18px] text-[var(--pt-accent)]" />
          <h3 className="mt-3 font-medium">Diagnostics</h3>
          <p className="mt-1 text-sm leading-6 text-[var(--pt-text-secondary)]">Open the privacy-filtered support logs. PulseTalq keeps one active 1 MB file and four rotated archives.</p>
          <button
            onClick={openDiagnostics}
            disabled={openingDiagnostics}
            aria-busy={openingDiagnostics}
            className="pt-button mt-4 min-h-10 !border-[var(--pt-border-strong)] !bg-[var(--pt-surface)] px-3 text-sm !text-[var(--pt-text)] hover:!bg-[var(--pt-surface-hover)] disabled:cursor-wait disabled:opacity-60"
          >
            {openingDiagnostics ? 'Opening…' : 'Open diagnostics folder'}
          </button>
          {diagnosticsError && <p className="mt-3 text-sm text-[var(--pt-error)]" role="alert">{diagnosticsError}</p>}
        </section>
      </div>
    </div>
  )
}

function SettingCard({ icon: Icon, title, description }: { icon: typeof Mic2; title: string; description: string }) {
  return (
    <section className="border border-[var(--pt-border)] bg-[var(--pt-surface)] p-5 [border-radius:3px]">
      <Icon className="h-[18px] w-[18px] text-[var(--pt-accent)]" />
      <h3 className="mt-3 font-medium">{title}</h3>
      <p className="mt-1 text-sm leading-6 text-[var(--pt-text-secondary)]">{description}</p>
    </section>
  )
}

function ShortcutChips({ shortcut, inverse = false }: { shortcut?: string | null; inverse?: boolean }) {
  const parts = shortcutParts(shortcut)
  if (parts.length === 0) return <p className="mt-2 text-sm text-[var(--pt-text-inverse-muted)]">Waiting for shortcut status…</p>
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5" aria-label={`Shortcut ${parts.join(' plus ')}`}>
      {parts.map((part, index) => (
        <span key={`${part}-${index}`} className={`inline-flex min-h-8 items-center border px-2.5 text-xs font-semibold [border-radius:2px] ${inverse ? 'border-white/25 bg-white/10 text-white' : 'border-[var(--pt-border-strong)] bg-[var(--pt-surface-alt)]'}`}>
          {part}
        </span>
      ))}
    </div>
  )
}
