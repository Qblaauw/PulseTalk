export type ShortcutKeyboardEvent = {
  key: string
  code: string
  ctrlKey?: boolean
  altKey?: boolean
  shiftKey?: boolean
  metaKey?: boolean
}

export type ShortcutCaptureResult =
  | { ok: true; shortcut: string }
  | { ok: false; reason: string; cancelled?: never }
  | { ok: false; cancelled: true; reason?: never }

const MODIFIER_CODES = new Set([
  'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight',
  'ShiftLeft', 'ShiftRight', 'MetaLeft', 'MetaRight',
])

export function captureDictationShortcut(event: ShortcutKeyboardEvent): ShortcutCaptureResult {
  if (event.key === 'Escape') return { ok: false, cancelled: true }
  if (MODIFIER_CODES.has(event.code)) {
    return { ok: false, reason: 'Add a letter, number, function key, or Space.' }
  }

  const modifiers = [
    event.ctrlKey ? 'Ctrl' : null,
    event.altKey ? 'Alt' : null,
    event.shiftKey ? 'Shift' : null,
    event.metaKey ? 'Win' : null,
  ].filter((part): part is string => Boolean(part))

  if (modifiers.length === 0) {
    return { ok: false, reason: 'Add Ctrl, Alt, Shift, or Win.' }
  }

  const key = displayKey(event.code)
  if (!key) return { ok: false, reason: 'Choose a letter, number, function key, or Space.' }
  return { ok: true, shortcut: [...modifiers, key].join('+') }
}

export function shortcutParts(shortcut?: string | null): string[] {
  return shortcut?.split('+').map(part => part.trim()).filter(Boolean) ?? []
}

function displayKey(code: string): string | null {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3)
  if (/^Digit[0-9]$/.test(code)) return code.slice(5)
  if (/^F([1-9]|1[0-9]|2[0-4])$/.test(code)) return code

  return code === 'Space' ? 'Space' : null
}
