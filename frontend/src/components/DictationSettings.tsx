"use client"

import { invoke } from "@tauri-apps/api/core"
import { AudioLines, ClipboardCheck, FolderOpen, History, Keyboard, LockKeyhole, Mic2, PictureInPicture2, Sparkles } from "lucide-react"
import { useRouter } from "next/navigation"
import { type KeyboardEvent, useEffect, useRef, useState } from "react"
import { Switch } from '@/components/ui/switch'
import { displayShortcut } from '@/lib/shortcut'

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
  const [capturingShortcut, setCapturingShortcut] = useState(false)
  const [savingShortcut, setSavingShortcut] = useState(false)
  const [shortcutError, setShortcutError] = useState<string | null>(null)
  const [shortcutPreview, setShortcutPreview] = useState<string | null>(null)
  const heldShortcutKeys = useRef(new Set<string>())
  const shortcutCandidate = useRef<string | null>(null)

  useEffect(() => {
    invoke<ShortcutStatus>('dictation_get_shortcut_status')
      .then(setStatus)
      .catch(cause => setError(String(cause)))
    invoke<boolean>('dictation_get_overlay_enabled')
      .then(setOverlayEnabled)
      .catch(cause => setError(String(cause)))
  }, [])

  const resetShortcutCapture = () => {
    heldShortcutKeys.current.clear()
    shortcutCandidate.current = null
    setShortcutPreview(null)
    setCapturingShortcut(false)
  }

  const shortcutKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Control') return 'Ctrl'
    if (event.key === 'Alt') return 'Alt'
    if (event.key === 'Shift') return 'Shift'
    if (event.key === 'Meta') return 'Cmd'
    if (event.code.startsWith('Key')) return event.code.slice(3)
    if (event.code.startsWith('Digit')) return event.code.slice(5)
    if (event.code === 'Space') return 'Space'
    return event.code || event.key
  }

  const formatHeldShortcut = () => {
    const held = heldShortcutKeys.current
    const modifiers = ['Ctrl', 'Alt', 'Shift', 'Cmd'].filter(key => held.has(key))
    const regularKeys = [...held].filter(key => !modifiers.includes(key))
    return [...modifiers, ...regularKeys].join('+')
  }

  const captureShortcut = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!capturingShortcut) return
    event.preventDefault()
    event.stopPropagation()
    if (event.repeat) return
    if (event.key === 'Escape') {
      resetShortcutCapture()
      return
    }

    const key = shortcutKey(event)
    if (!key) return
    heldShortcutKeys.current.add(key)

    const preview = formatHeldShortcut()
    setShortcutPreview(preview)
    const parts = preview.split('+')
    const modifierCount = parts.filter(part => ['Ctrl', 'Alt', 'Shift', 'Cmd'].includes(part)).length
    const regularKeyCount = parts.length - modifierCount
    shortcutCandidate.current = modifierCount > 0 && regularKeyCount === 1 ? preview : null
    setShortcutError(regularKeyCount > 1 ? 'Use one key together with one or more modifier keys.' : null)
  }

  const releaseShortcut = async (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!capturingShortcut) return
    event.preventDefault()
    event.stopPropagation()

    heldShortcutKeys.current.delete(shortcutKey(event))
    if (heldShortcutKeys.current.size > 0) return

    const nextShortcut = shortcutCandidate.current
    if (!nextShortcut) {
      setShortcutError('Hold Ctrl, Alt, Shift, or Cmd while choosing a key.')
      return
    }

    setSavingShortcut(true)
    setShortcutError(null)
    try {
      const nextStatus = await invoke<ShortcutStatus>('dictation_set_shortcut', { shortcut: nextShortcut })
      setStatus(nextStatus)
      resetShortcutCapture()
    } catch (cause) {
      setShortcutError(String(cause))
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
    <div className="space-y-6 pt-6">
      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
            <AudioLines className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-gray-900">Hold-to-talk activation</h2>
              <span className={`h-2 w-2 rounded-full ${status?.enabled ? 'bg-emerald-400' : 'bg-amber-400'}`} />
            </div>
            <p className="mt-1 text-sm text-gray-600">Hold while speaking and release when finished. PulseTalq records only while the shortcut is held.</p>
            {status?.enabled ? (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShortcutError(null)
                    heldShortcutKeys.current.clear()
                    shortcutCandidate.current = null
                    setShortcutPreview(null)
                    setCapturingShortcut(true)
                  }}
                  onKeyDown={captureShortcut}
                  onKeyUp={releaseShortcut}
                  onBlur={resetShortcutCapture}
                  disabled={savingShortcut}
                  className={`inline-flex min-w-[180px] items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold shadow-sm transition focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${capturingShortcut
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-800'
                    : 'border-gray-300 bg-gray-50 text-gray-800 hover:border-indigo-300 hover:bg-indigo-50/50'
                    }`}
                  aria-label={capturingShortcut ? 'Hold shortcut keys, then release to save' : 'Hold to change dictation shortcut'}
                >
                  <Keyboard className="h-4 w-4" />
                  {capturingShortcut ? (savingShortcut ? 'Saving shortcut…' : displayShortcut(shortcutPreview) ?? 'Hold your shortcut…') : displayShortcut(status.shortcut)}
                </button>
                <span className="text-xs font-medium text-gray-500" role="status">
                  {capturingShortcut ? 'Release to save' : 'Hold to change'}
                </span>
              </div>
            ) : (
              <p className="mt-3 text-sm text-amber-700">{status?.message ?? 'Checking shortcut availability…'}</p>
            )}
            {(error || shortcutError) && <p className="mt-3 text-sm text-red-600">{error ?? shortcutError}</p>}
            <p className="mt-3 text-xs text-gray-500">Hold the keys you want to use together. Release all keys to save. For the most reliable shortcut, use Ctrl with two additional keys.</p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
            <PictureInPicture2 className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <label htmlFor="dictation-overlay-toggle" className="font-semibold text-gray-900">Floating dictation overlay</label>
            <p className="mt-1 text-sm leading-6 text-gray-600">Keep a small microphone above other windows. Hover over it to reveal the active shortcut; it expands automatically while PulseTalq listens and pastes.</p>
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
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <History className="h-5 w-5 text-indigo-600" />
          <h3 className="mt-3 font-semibold text-gray-900">Recovery history</h3>
          <p className="mt-1 text-sm leading-6 text-gray-600">Every transcript is saved before paste, including failed deliveries.</p>
          <button
            onClick={() => router.push('/dictation-history')}
            className="mt-4 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 transition hover:bg-gray-50"
          >
            Open dictation history
          </button>
        </section>
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <FolderOpen className="h-5 w-5 text-indigo-600" />
          <h3 className="mt-3 font-semibold text-gray-900">Diagnostics</h3>
          <p className="mt-1 text-sm leading-6 text-gray-600">Open the privacy-filtered support logs. PulseTalq keeps one active 1 MB file and four rotated archives.</p>
          <button
            onClick={openDiagnostics}
            disabled={openingDiagnostics}
            aria-busy={openingDiagnostics}
            className="mt-4 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 transition hover:bg-gray-50 disabled:cursor-wait disabled:opacity-60"
          >
            {openingDiagnostics ? 'Opening…' : 'Open diagnostics folder'}
          </button>
          {diagnosticsError && <p className="mt-3 text-sm text-red-600" role="alert">{diagnosticsError}</p>}
        </section>
      </div>
    </div>
  )
}

function SettingCard({ icon: Icon, title, description }: { icon: typeof Mic2; title: string; description: string }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <Icon className="h-5 w-5 text-indigo-600" />
      <h3 className="mt-3 font-semibold text-gray-900">{title}</h3>
      <p className="mt-1 text-sm leading-6 text-gray-600">{description}</p>
    </section>
  )
}
