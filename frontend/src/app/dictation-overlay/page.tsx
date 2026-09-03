'use client'

import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { Mic } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

type DictationPhase =
  | 'idle'
  | 'listening'
  | 'transcribing'
  | 'cleaning'
  | 'delivering'
  | 'completed'
  | 'failed'
  | 'cancelled'

type DictationState = {
  phase: DictationPhase
  message?: string | null
}

type ShortcutStatus = {
  enabled: boolean
  shortcut?: string | null
  message?: string | null
}

const phaseCopy: Record<DictationPhase, string> = {
  idle: 'Dictate',
  listening: 'Listening · release to paste',
  transcribing: 'Transcribing locally',
  cleaning: 'Polishing locally',
  delivering: 'Pasting at your cursor',
  completed: 'Pasted',
  failed: 'Saved to dictation history',
  cancelled: 'Ready',
}

export default function DictationOverlay() {
  const [state, setState] = useState<DictationState>({ phase: 'idle' })
  const [hovered, setHovered] = useState(false)
  const [shortcut, setShortcut] = useState<ShortcutStatus | null>(null)
  const collapseTimer = useRef<number | null>(null)
  const resizeQueue = useRef<Promise<void>>(Promise.resolve())

  useEffect(() => {
    document.documentElement.style.background = 'transparent'
    document.body.style.background = 'transparent'
    return () => {
      if (collapseTimer.current !== null) window.clearTimeout(collapseTimer.current)
      document.documentElement.style.background = ''
      document.body.style.background = ''
    }
  }, [])

  const keepExpanded = () => {
    if (collapseTimer.current !== null) {
      window.clearTimeout(collapseTimer.current)
      collapseTimer.current = null
    }
    setHovered(true)
  }

  const scheduleCollapse = () => {
    if (collapseTimer.current !== null) window.clearTimeout(collapseTimer.current)
    collapseTimer.current = window.setTimeout(() => {
      collapseTimer.current = null
      setHovered(false)
    }, 180)
  }

  useEffect(() => {
    let disposed = false
    let shortcutChanged = false
    const unlisten = listen<DictationState>('dictation-state', event => {
      if (!disposed) setState(event.payload)
    })
    const unlistenShortcut = listen<ShortcutStatus>('dictation-shortcut-changed', event => {
      shortcutChanged = true
      if (!disposed) setShortcut(event.payload)
    })
    void unlistenShortcut
      .then(() => invoke<ShortcutStatus>('dictation_get_shortcut_status'))
      .then(status => {
        if (!disposed && !shortcutChanged) setShortcut(status)
      })
      .catch(error => console.error('dictation_overlay_shortcut_load_failed', error))
    return () => {
      disposed = true
      void unlisten.then(dispose => dispose())
      void unlistenShortcut.then(dispose => dispose())
    }
  }, [])

  useEffect(() => {
    if (state.phase !== 'completed' && state.phase !== 'failed') return
    const delay = state.phase === 'completed' ? 900 : 3000
    const timer = window.setTimeout(() => setState({ phase: 'idle' }), delay)
    return () => window.clearTimeout(timer)
  }, [state.phase])

  const active = state.phase !== 'idle' && state.phase !== 'cancelled'
  const expanded = hovered || active

  useEffect(() => {
    resizeQueue.current = resizeQueue.current
      .catch(() => undefined)
      .then(() => invoke('dictation_set_overlay_expanded', { expanded }))
      .then(() => undefined)
      .catch(error => console.error('dictation_overlay_resize_failed', error))
  }, [expanded])

  const label = useMemo(() => {
    const shortcutLabel = shortcut === null
      ? 'Loading shortcut…'
      : shortcut.enabled && shortcut.shortcut
        ? shortcut.shortcut
        : shortcut.message ?? 'Shortcut unavailable'
    if (state.phase === 'idle' || state.phase === 'cancelled') {
      return `${phaseCopy[state.phase]} ${shortcutLabel}`
    }
    if (state.phase === 'failed' && state.message) return phaseCopy.failed
    return phaseCopy[state.phase]
  }, [shortcut, state])

  return (
    <main
      className={`dictation-floater ${expanded ? 'dictation-expanded' : 'dictation-compact'} dictation-${state.phase}`}
      aria-label={label}
      aria-live="polite"
      onPointerEnter={keepExpanded}
      onPointerLeave={scheduleCollapse}
    >
      <div className="dictation-handle" aria-hidden="true" />
      <div className="dictation-bubble">
        {active && (
          <span className="dictation-mini-wave" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        )}
        <span className="dictation-label">{label}</span>
      </div>
      <div className="dictation-voice-cursor" aria-hidden="true">
        <Mic className="dictation-mic" strokeWidth={2.15} />
      </div>
    </main>
  )
}
