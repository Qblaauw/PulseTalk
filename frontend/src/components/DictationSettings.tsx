"use client"

import { invoke } from "@tauri-apps/api/core"
import { AudioLines, History, PictureInPicture2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Switch } from '@/components/ui/switch'

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
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    invoke<ShortcutStatus>('dictation_get_shortcut_status')
      .then(setStatus)
      .catch(cause => setError(String(cause)))
    invoke<boolean>('dictation_get_overlay_enabled')
      .then(setOverlayEnabled)
      .catch(cause => setError(String(cause)))
  }, [])

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

  return (
    <div className="pt-group">
      <div className="pt-row">
        <AudioLines className="h-5 w-5 shrink-0 text-[var(--pt-text-secondary)]" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="font-medium text-[var(--pt-text)]">Hold-to-talk shortcut</div>
          <p className="text-sm text-[var(--pt-text-secondary)]">Hold while speaking, release when finished.</p>
          {error && <p className="mt-1 text-sm text-[var(--pt-error)]">{error}</p>}
        </div>
        {status?.enabled ? (
          <kbd className="pt-kbd">{status.shortcut}</kbd>
        ) : (
          <span className="text-sm text-[var(--pt-warning)]">{status?.message ?? 'Checking…'}</span>
        )}
      </div>

      <div className="pt-row">
        <PictureInPicture2 className="h-5 w-5 shrink-0 text-[var(--pt-text-secondary)]" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <label htmlFor="dictation-overlay-toggle" className="font-medium text-[var(--pt-text)]">Floating overlay</label>
          <p className="text-sm text-[var(--pt-text-secondary)]">Shows a small microphone above other windows while listening.</p>
        </div>
        <Switch
          id="dictation-overlay-toggle"
          checked={overlayEnabled ?? true}
          disabled={overlayEnabled === null || savingOverlay}
          onCheckedChange={toggleOverlay}
          aria-label="Show floating dictation overlay"
        />
      </div>

      <div className="pt-row">
        <History className="h-5 w-5 shrink-0 text-[var(--pt-text-secondary)]" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="font-medium text-[var(--pt-text)]">Recovery history</div>
          <p className="text-sm text-[var(--pt-text-secondary)]">Every transcript is saved before paste, including failed deliveries.</p>
        </div>
        <button
          onClick={() => router.push('/library?filter=dictations')}
          className="pt-button pt-button--secondary pt-button--sm"
        >
          Open Library
        </button>
      </div>
    </div>
  )
}
