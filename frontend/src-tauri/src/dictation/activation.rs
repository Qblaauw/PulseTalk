use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;
use std::sync::RwLock;
use tauri::AppHandle;
use tauri_plugin_store::StoreExt;

pub const DEFAULT_SHORTCUT: &str = "Ctrl+Super";
const PREFERENCE_STORE: &str = "preferences.json";
const SHORTCUT_KEY: &str = "dictation_shortcut";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DictationShortcutStatus {
    pub enabled: bool,
    pub shortcut: Option<String>,
    pub message: Option<String>,
}

pub struct DictationShortcutStatusState(RwLock<DictationShortcutStatus>);

impl DictationShortcutStatusState {
    pub fn new() -> Self {
        Self(RwLock::new(DictationShortcutStatus {
            enabled: false,
            shortcut: None,
            message: Some("PulseTalq is registering a hold-to-talk shortcut.".into()),
        }))
    }

    pub fn registered(&self, shortcut: &str) {
        if let Ok(mut status) = self.0.write() {
            *status = DictationShortcutStatus {
                enabled: true,
                shortcut: Some(shortcut.to_owned()),
                message: None,
            };
        }
    }

    pub fn unavailable(&self) {
        if let Ok(mut status) = self.0.write() {
            *status = DictationShortcutStatus {
                enabled: false,
                shortcut: None,
                message: Some(
                    "All PulseTalq shortcut choices are currently used by other applications."
                        .into(),
                ),
            };
        }
    }

    pub fn get(&self) -> DictationShortcutStatus {
        self.0
            .read()
            .map(|status| status.clone())
            .unwrap_or(DictationShortcutStatus {
                enabled: false,
                shortcut: None,
                message: Some("Shortcut status is temporarily unavailable.".into()),
            })
    }
}

pub fn configured_shortcut<R: tauri::Runtime>(app: &AppHandle<R>) -> Option<String> {
    app.store(PREFERENCE_STORE)
        .ok()
        .and_then(|store| store.get(SHORTCUT_KEY))
        .and_then(|value| value.as_str().map(str::to_owned))
}

#[cfg(test)]
mod shortcut_config_tests {
    use super::{is_modifier_only_shortcut, DEFAULT_SHORTCUT};
    use std::str::FromStr;
    use tauri_plugin_global_shortcut::Shortcut;

    #[test]
    fn default_shortcut_is_accepted_by_modifier_monitor() {
        assert!(is_modifier_only_shortcut(DEFAULT_SHORTCUT));
        assert!(Shortcut::from_str(DEFAULT_SHORTCUT).is_err());
    }

    #[test]
    fn modifier_monitor_accepts_exactly_two_modifiers() {
        assert!(is_modifier_only_shortcut("Ctrl+Super"));
        assert!(is_modifier_only_shortcut("Alt+Shift"));
        assert!(!is_modifier_only_shortcut("Ctrl"));
        assert!(!is_modifier_only_shortcut("Ctrl+Space"));
        assert!(!is_modifier_only_shortcut("Ctrl+Shift+Super"));
    }
}

pub fn is_modifier_only_shortcut(shortcut: &str) -> bool {
    let parts: Vec<_> = shortcut.split('+').map(str::trim).collect();
    parts.len() == 2
        && parts.iter().all(|part| {
            matches!(
                part.to_ascii_uppercase().as_str(),
                "CTRL" | "CONTROL" | "ALT" | "OPTION" | "SHIFT" | "CMD" | "COMMAND" | "SUPER"
            )
        })
}

#[cfg(target_os = "windows")]
#[derive(Clone)]
pub struct WindowsModifierShortcutState {
    shortcut: std::sync::Arc<RwLock<Option<String>>>,
}

#[cfg(target_os = "windows")]
impl WindowsModifierShortcutState {
    pub fn new(bus: super::ActivationBus) -> Self {
        use std::time::Duration;

        let shortcut = std::sync::Arc::new(RwLock::new(None::<String>));
        let monitored = shortcut.clone();
        std::thread::spawn(move || {
            let mut active = false;
            loop {
                let configured = monitored.read().ok().and_then(|value| value.clone());
                let pressed = configured
                    .as_deref()
                    .map(modifier_chord_pressed)
                    .unwrap_or(false);
                if pressed != active {
                    active = pressed;
                    bus.publish(if active {
                        ActivationEvent::Started
                    } else {
                        ActivationEvent::Stopped
                    });
                }
                std::thread::sleep(Duration::from_millis(12));
            }
        });
        Self { shortcut }
    }

    pub fn configure(&self, shortcut: Option<&str>) -> Result<(), String> {
        if shortcut.is_some_and(|value| !is_modifier_only_shortcut(value)) {
            return Err("A two-key shortcut must contain two modifier keys.".into());
        }
        *self
            .shortcut
            .write()
            .map_err(|_| "The Windows shortcut monitor is unavailable.".to_string())? =
            shortcut.map(str::to_owned);
        Ok(())
    }
}

#[cfg(target_os = "windows")]
fn modifier_chord_pressed(shortcut: &str) -> bool {
    shortcut
        .split('+')
        .all(|part| modifier_pressed(part.trim()))
}

#[cfg(target_os = "windows")]
fn modifier_pressed(modifier: &str) -> bool {
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
        GetAsyncKeyState, VK_CONTROL, VK_LWIN, VK_MENU, VK_RWIN, VK_SHIFT,
    };

    let down = |key| unsafe { GetAsyncKeyState(key) < 0 };
    match modifier.to_ascii_uppercase().as_str() {
        "CTRL" | "CONTROL" => down(VK_CONTROL as i32),
        "ALT" | "OPTION" => down(VK_MENU as i32),
        "SHIFT" => down(VK_SHIFT as i32),
        "CMD" | "COMMAND" | "SUPER" => down(VK_LWIN as i32) || down(VK_RWIN as i32),
        _ => false,
    }
}

pub fn save_shortcut<R: tauri::Runtime>(app: &AppHandle<R>, shortcut: &str) -> Result<(), String> {
    let store = app
        .store(PREFERENCE_STORE)
        .map_err(|error| format!("Could not open dictation preferences: {error}"))?;
    store.set(SHORTCUT_KEY, serde_json::Value::String(shortcut.to_owned()));
    store
        .save()
        .map_err(|error| format!("Could not save dictation shortcut: {error}"))
}

impl Default for DictationShortcutStatusState {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub struct KeyCode(pub u16);

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct HoldShortcut {
    keys: BTreeSet<KeyCode>,
}

impl HoldShortcut {
    pub fn new(keys: impl IntoIterator<Item = KeyCode>) -> Result<Self, ShortcutConfigError> {
        let keys: BTreeSet<_> = keys.into_iter().collect();
        if keys.is_empty() {
            return Err(ShortcutConfigError::Empty);
        }
        Ok(Self { keys })
    }

    pub fn keys(&self) -> &BTreeSet<KeyCode> {
        &self.keys
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ShortcutConfigError {
    Empty,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ActivationEvent {
    Started,
    Stopped,
}

pub struct ShortcutTracker {
    shortcut: HoldShortcut,
    pressed: BTreeSet<KeyCode>,
    active: bool,
}

impl ShortcutTracker {
    pub fn new(shortcut: HoldShortcut) -> Self {
        Self {
            shortcut,
            pressed: BTreeSet::new(),
            active: false,
        }
    }

    pub fn key_down(&mut self, key: KeyCode) -> Option<ActivationEvent> {
        self.pressed.insert(key);
        if !self.active && self.shortcut.keys.is_subset(&self.pressed) {
            self.active = true;
            return Some(ActivationEvent::Started);
        }
        None
    }

    pub fn key_up(&mut self, key: KeyCode) -> Option<ActivationEvent> {
        self.pressed.remove(&key);
        if self.active && self.shortcut.keys.contains(&key) {
            self.active = false;
            return Some(ActivationEvent::Stopped);
        }
        None
    }

    pub fn reset(&mut self) -> Option<ActivationEvent> {
        self.pressed.clear();
        if self.active {
            self.active = false;
            Some(ActivationEvent::Stopped)
        } else {
            None
        }
    }

    pub fn is_active(&self) -> bool {
        self.active
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn shortcut() -> HoldShortcut {
        HoldShortcut::new([KeyCode(0x11), KeyCode(0x20)]).unwrap()
    }

    #[test]
    fn starts_once_when_all_keys_are_held() {
        let mut tracker = ShortcutTracker::new(shortcut());

        assert_eq!(tracker.key_down(KeyCode(0x11)), None);
        assert_eq!(
            tracker.key_down(KeyCode(0x20)),
            Some(ActivationEvent::Started)
        );
        assert_eq!(tracker.key_down(KeyCode(0x20)), None);
        assert!(tracker.is_active());
    }

    #[test]
    fn releasing_any_shortcut_key_stops() {
        let mut tracker = ShortcutTracker::new(shortcut());
        tracker.key_down(KeyCode(0x11));
        tracker.key_down(KeyCode(0x20));

        assert_eq!(
            tracker.key_up(KeyCode(0x11)),
            Some(ActivationEvent::Stopped)
        );
        assert!(!tracker.is_active());
    }

    #[test]
    fn unrelated_keys_do_not_interrupt_dictation() {
        let mut tracker = ShortcutTracker::new(shortcut());
        tracker.key_down(KeyCode(0x11));
        tracker.key_down(KeyCode(0x20));

        assert_eq!(tracker.key_down(KeyCode(0x41)), None);
        assert_eq!(tracker.key_up(KeyCode(0x41)), None);
        assert!(tracker.is_active());
    }

    #[test]
    fn reset_stops_a_stuck_active_shortcut() {
        let mut tracker = ShortcutTracker::new(shortcut());
        tracker.key_down(KeyCode(0x11));
        tracker.key_down(KeyCode(0x20));

        assert_eq!(tracker.reset(), Some(ActivationEvent::Stopped));
        assert_eq!(tracker.reset(), None);
    }

    #[test]
    fn empty_shortcut_is_rejected() {
        assert_eq!(
            HoldShortcut::new([]).unwrap_err(),
            ShortcutConfigError::Empty
        );
    }
}
