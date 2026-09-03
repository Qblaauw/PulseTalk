export function displayShortcut(shortcut: string | null | undefined) {
  if (!shortcut) return shortcut
  const isWindows = typeof navigator !== 'undefined' && /Windows/i.test(navigator.userAgent)
  return isWindows
    ? shortcut.replace(/\b(?:Cmd|Super)\b/g, 'Win')
    : shortcut.replace(/\bSuper\b/g, 'Cmd')
}
