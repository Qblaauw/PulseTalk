use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;
use std::sync::{Mutex, RwLock};
use tauri::{AppHandle, Emitter, Manager, Runtime};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut};
use tauri_plugin_store::StoreExt;

const PREFERENCE_STORE: &str = "preferences.json";
const SHORTCUT_KEY: &str = "dictation_shortcut";
pub(crate) const DEFAULT_SHORTCUTS: &[&str] = &["Ctrl+Shift+Space", "Ctrl+Alt+D", "Ctrl+Shift+F10"];

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DictationShortcutStatus {
    pub enabled: bool,
    pub shortcut: Option<String>,
    pub message: Option<String>,
}

#[derive(Debug, Clone)]
struct ShortcutRuntime {
    status: DictationShortcutStatus,
    registration: Option<String>,
}

pub struct DictationShortcutStatusState {
    runtime: RwLock<ShortcutRuntime>,
    replacement: Mutex<()>,
}

impl DictationShortcutStatusState {
    pub fn new() -> Self {
        Self {
            runtime: RwLock::new(ShortcutRuntime {
                status: DictationShortcutStatus {
                    enabled: false,
                    shortcut: None,
                    message: Some("PulseTalq is registering a hold-to-talk shortcut.".into()),
                },
                registration: None,
            }),
            replacement: Mutex::new(()),
        }
    }

    pub fn registered(&self, shortcut: &str) {
        match ValidatedShortcut::parse(shortcut) {
            Ok(shortcut) => self.registered_shortcut(&shortcut, None),
            Err(_) => {
                if let Ok(mut runtime) = self.runtime.write() {
                    runtime.status = DictationShortcutStatus {
                        enabled: true,
                        shortcut: Some(shortcut.to_owned()),
                        message: None,
                    };
                    runtime.registration = Some(shortcut.to_owned());
                }
            }
        }
    }

    pub fn unavailable(&self) {
        if let Ok(mut runtime) = self.runtime.write() {
            runtime.status = DictationShortcutStatus {
                enabled: false,
                shortcut: None,
                message: Some(
                    "All PulseTalq shortcut choices are currently used by other applications."
                        .into(),
                ),
            };
            runtime.registration = None;
        }
    }

    pub fn get(&self) -> DictationShortcutStatus {
        self.runtime
            .read()
            .map(|runtime| runtime.status.clone())
            .unwrap_or(DictationShortcutStatus {
                enabled: false,
                shortcut: None,
                message: Some("Shortcut status is temporarily unavailable.".into()),
            })
    }

    pub fn initialize<R: Runtime>(app: &AppHandle<R>) -> DictationShortcutStatus {
        let status = app.state::<Self>();
        let mut registry = TauriShortcutRegistry { app };
        let preferences = TauriShortcutPreferences { app };
        let result =
            initialize_shortcut_with(&status, &mut registry, &preferences, DEFAULT_SHORTCUTS);

        if result.enabled {
            log::info!(
                target: "pulsetalk::dictation",
                "dictation_shortcut_registered shortcut={}",
                result.shortcut.as_deref().unwrap_or("unknown")
            );
        } else {
            log::error!(
                target: "pulsetalk::dictation",
                "dictation_activation_disabled code=shortcut_unavailable candidate_count={}",
                DEFAULT_SHORTCUTS.len()
            );
        }
        result
    }

    pub fn replace<R: Runtime>(
        app: &AppHandle<R>,
        shortcut: &str,
    ) -> Result<DictationShortcutStatus, String> {
        let status = app.state::<Self>();
        let mut registry = TauriShortcutRegistry { app };
        let mut preferences = TauriShortcutPreferences { app };
        let result = replace_shortcut_with(&status, &mut registry, &mut preferences, shortcut)?;

        if let Some(bus) = app.try_state::<super::ActivationBus>() {
            bus.publish(ActivationEvent::Stopped);
        }
        if let Err(error) = app.emit("dictation-shortcut-changed", result.clone()) {
            log::warn!(
                target: "pulsetalk::dictation",
                "dictation_shortcut_event_failed error={error}"
            );
        }

        log::info!(
            target: "pulsetalk::dictation",
            "dictation_shortcut_changed shortcut={}",
            result.shortcut.as_deref().unwrap_or("unknown")
        );
        Ok(result)
    }

    fn registration(&self) -> Option<String> {
        self.runtime
            .read()
            .ok()
            .and_then(|runtime| runtime.registration.clone())
    }

    fn registered_shortcut(&self, shortcut: &ValidatedShortcut, message: Option<String>) {
        if let Ok(mut runtime) = self.runtime.write() {
            runtime.status = DictationShortcutStatus {
                enabled: true,
                shortcut: Some(shortcut.display.clone()),
                message,
            };
            runtime.registration = Some(shortcut.registration.clone());
        }
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
    use super::DEFAULT_SHORTCUT;
    use std::str::FromStr;
    use tauri_plugin_global_shortcut::Shortcut;

    #[test]
    fn default_shortcut_is_accepted_by_global_shortcut_parser() {
        assert!(Shortcut::from_str(DEFAULT_SHORTCUT).is_ok());
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
    use std::cell::RefCell;
    use std::collections::BTreeSet as TestSet;
    use std::rc::Rc;

    #[derive(Default)]
    struct FakeRegistry {
        registered: TestSet<String>,
        fail_register: TestSet<String>,
        fail_unregister: TestSet<String>,
        operations: Rc<RefCell<Vec<String>>>,
    }

    impl ShortcutRegistry for FakeRegistry {
        fn register(&mut self, shortcut: &str) -> Result<(), String> {
            self.operations
                .borrow_mut()
                .push(format!("register:{shortcut}"));
            if self.fail_register.contains(shortcut) {
                return Err("shortcut is already registered".into());
            }
            self.registered.insert(shortcut.to_owned());
            Ok(())
        }

        fn unregister(&mut self, shortcut: &str) -> Result<(), String> {
            self.operations
                .borrow_mut()
                .push(format!("unregister:{shortcut}"));
            if self.fail_unregister.contains(shortcut) {
                return Err("shortcut could not be released".into());
            }
            self.registered.remove(shortcut);
            Ok(())
        }
    }

    struct FakePreferences {
        saved: Option<String>,
        fail_load: bool,
        fail_save: bool,
        operations: Rc<RefCell<Vec<String>>>,
    }

    impl FakePreferences {
        fn new(saved: Option<&str>, operations: Rc<RefCell<Vec<String>>>) -> Self {
            Self {
                saved: saved.map(str::to_owned),
                fail_load: false,
                fail_save: false,
                operations,
            }
        }
    }

    impl ShortcutPreferenceStore for FakePreferences {
        fn load(&self) -> Result<Option<String>, String> {
            if self.fail_load {
                Err("preferences are unavailable".into())
            } else {
                Ok(self.saved.clone())
            }
        }

        fn save(&mut self, shortcut: Option<&str>) -> Result<(), String> {
            self.operations
                .borrow_mut()
                .push(format!("save:{}", shortcut.unwrap_or("<none>")));
            if self.fail_save {
                return Err("preferences are read-only".into());
            }
            self.saved = shortcut.map(str::to_owned);
            Ok(())
        }
    }

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

    #[test]
    fn ctrl_alt_d_replaces_and_persists_before_releasing_the_old_shortcut() {
        let operations = Rc::new(RefCell::new(Vec::new()));
        let old = "control+shift+Space";
        let candidate = "control+alt+KeyD";
        let mut registry = FakeRegistry {
            registered: TestSet::from([old.to_owned()]),
            operations: operations.clone(),
            ..Default::default()
        };
        let mut preferences = FakePreferences::new(Some(old), operations.clone());
        let status = DictationShortcutStatusState::new();
        status.registered("Ctrl+Shift+Space");

        let result =
            replace_shortcut_with(&status, &mut registry, &mut preferences, "Ctrl+Alt+D").unwrap();

        assert_eq!(result.shortcut.as_deref(), Some("Ctrl+Alt+D"));
        assert_eq!(preferences.saved.as_deref(), Some(candidate));
        assert_eq!(registry.registered, TestSet::from([candidate.to_owned()]));
        assert_eq!(
            operations.borrow().as_slice(),
            [
                "register:control+alt+KeyD",
                "save:control+alt+KeyD",
                "unregister:control+shift+Space",
            ]
        );
    }

    #[test]
    fn a_bare_key_is_rejected_without_touching_the_active_shortcut() {
        let operations = Rc::new(RefCell::new(Vec::new()));
        let old = "control+shift+Space";
        let mut registry = FakeRegistry {
            registered: TestSet::from([old.to_owned()]),
            operations: operations.clone(),
            ..Default::default()
        };
        let mut preferences = FakePreferences::new(Some(old), operations.clone());
        let status = DictationShortcutStatusState::new();
        status.registered("Ctrl+Shift+Space");

        let error =
            replace_shortcut_with(&status, &mut registry, &mut preferences, "D").unwrap_err();

        assert!(error.contains("modifier"));
        assert_eq!(status.get().shortcut.as_deref(), Some("Ctrl+Shift+Space"));
        assert_eq!(registry.registered, TestSet::from([old.to_owned()]));
        assert!(operations.borrow().is_empty());
    }

    #[test]
    fn a_modifier_code_cannot_be_used_as_the_main_key() {
        for requested in ["Ctrl+ShiftLeft", "Alt+ControlLeft"] {
            let operations = Rc::new(RefCell::new(Vec::new()));
            let mut registry = FakeRegistry {
                operations: operations.clone(),
                ..Default::default()
            };
            let mut preferences = FakePreferences::new(None, operations.clone());
            let status = DictationShortcutStatusState::new();

            let error = replace_shortcut_with(&status, &mut registry, &mut preferences, requested)
                .unwrap_err();

            assert!(error.contains("modifier cannot be the main key"));
            assert!(operations.borrow().is_empty());
        }
    }

    #[test]
    fn registration_conflict_retains_the_previous_shortcut() {
        let operations = Rc::new(RefCell::new(Vec::new()));
        let old = "control+shift+Space";
        let candidate = "control+alt+KeyD";
        let mut registry = FakeRegistry {
            registered: TestSet::from([old.to_owned()]),
            fail_register: TestSet::from([candidate.to_owned()]),
            operations: operations.clone(),
            ..Default::default()
        };
        let mut preferences = FakePreferences::new(Some(old), operations.clone());
        let status = DictationShortcutStatusState::new();
        status.registered("Ctrl+Shift+Space");

        let error = replace_shortcut_with(&status, &mut registry, &mut preferences, "Ctrl+Alt+D")
            .unwrap_err();

        assert!(error.contains("already in use"));
        assert_eq!(status.get().shortcut.as_deref(), Some("Ctrl+Shift+Space"));
        assert_eq!(preferences.saved.as_deref(), Some(old));
        assert_eq!(registry.registered, TestSet::from([old.to_owned()]));
    }

    #[test]
    fn persistence_failure_unregisters_the_candidate_and_retains_the_previous_shortcut() {
        let operations = Rc::new(RefCell::new(Vec::new()));
        let old = "control+shift+Space";
        let mut registry = FakeRegistry {
            registered: TestSet::from([old.to_owned()]),
            operations: operations.clone(),
            ..Default::default()
        };
        let mut preferences = FakePreferences::new(Some(old), operations.clone());
        preferences.fail_save = true;
        let status = DictationShortcutStatusState::new();
        status.registered("Ctrl+Shift+Space");

        let error = replace_shortcut_with(&status, &mut registry, &mut preferences, "Ctrl+Alt+D")
            .unwrap_err();

        assert!(error.contains("could not save"));
        assert_eq!(status.get().shortcut.as_deref(), Some("Ctrl+Shift+Space"));
        assert_eq!(preferences.saved.as_deref(), Some(old));
        assert_eq!(registry.registered, TestSet::from([old.to_owned()]));
        assert_eq!(
            operations.borrow().as_slice(),
            [
                "register:control+alt+KeyD",
                "save:control+alt+KeyD",
                "unregister:control+alt+KeyD",
            ]
        );
    }

    #[test]
    fn startup_uses_the_saved_shortcut_then_falls_back_when_it_is_unavailable() {
        let operations = Rc::new(RefCell::new(Vec::new()));
        let saved = "control+alt+KeyD";
        let fallback = "control+shift+Space";
        let mut registry = FakeRegistry {
            fail_register: TestSet::from([saved.to_owned()]),
            operations: operations.clone(),
            ..Default::default()
        };
        let preferences = FakePreferences::new(Some(saved), operations.clone());
        let status = DictationShortcutStatusState::new();

        let result =
            initialize_shortcut_with(&status, &mut registry, &preferences, DEFAULT_SHORTCUTS);

        assert_eq!(result.shortcut.as_deref(), Some("Ctrl+Shift+Space"));
        assert_eq!(registry.registered, TestSet::from([fallback.to_owned()]));
        assert_eq!(
            operations.borrow().as_slice(),
            ["register:control+alt+KeyD", "register:control+shift+Space",]
        );
    }

    #[test]
    fn startup_prefers_the_persisted_shortcut() {
        let operations = Rc::new(RefCell::new(Vec::new()));
        let saved = "control+alt+KeyD";
        let mut registry = FakeRegistry {
            operations: operations.clone(),
            ..Default::default()
        };
        let preferences = FakePreferences::new(Some(saved), operations.clone());
        let status = DictationShortcutStatusState::new();

        let result =
            initialize_shortcut_with(&status, &mut registry, &preferences, DEFAULT_SHORTCUTS);

        assert_eq!(result.shortcut.as_deref(), Some("Ctrl+Alt+D"));
        assert_eq!(registry.registered, TestSet::from([saved.to_owned()]));
        assert_eq!(
            operations.borrow().as_slice(),
            ["register:control+alt+KeyD"]
        );
    }

    #[test]
    fn failure_to_release_the_old_shortcut_rolls_back_preference_and_candidate() {
        let operations = Rc::new(RefCell::new(Vec::new()));
        let old = "control+shift+Space";
        let candidate = "control+alt+KeyD";
        let mut registry = FakeRegistry {
            registered: TestSet::from([old.to_owned()]),
            fail_unregister: TestSet::from([old.to_owned()]),
            operations: operations.clone(),
            ..Default::default()
        };
        let mut preferences = FakePreferences::new(Some(old), operations.clone());
        let status = DictationShortcutStatusState::new();
        status.registered("Ctrl+Shift+Space");

        let error = replace_shortcut_with(&status, &mut registry, &mut preferences, "Ctrl+Alt+D")
            .unwrap_err();

        assert!(error.contains("change was cancelled"));
        assert_eq!(status.get().shortcut.as_deref(), Some("Ctrl+Shift+Space"));
        assert_eq!(preferences.saved.as_deref(), Some(old));
        assert_eq!(registry.registered, TestSet::from([old.to_owned()]));
        assert_eq!(
            operations.borrow().as_slice(),
            [
                "register:control+alt+KeyD",
                "save:control+alt+KeyD",
                "unregister:control+shift+Space",
                "save:control+shift+Space",
                "unregister:control+alt+KeyD",
            ]
        );
        assert!(!registry.registered.contains(candidate));
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct ValidatedShortcut {
    registration: String,
    display: String,
}

impl ValidatedShortcut {
    fn parse(value: &str) -> Result<Self, String> {
        let value = value.trim();
        if value.is_empty() {
            return Err("Enter a shortcut with at least one modifier and one key.".into());
        }
        let main_key = value.rsplit('+').next().unwrap_or(value).trim();
        if is_modifier_code(main_key) {
            return Err(
                "A modifier cannot be the main key. Add a letter, number, or function key.".into(),
            );
        }

        let shortcut: Shortcut = value.parse().map_err(|_| {
            "Enter a valid shortcut with modifiers first, such as Ctrl+Alt+D.".to_string()
        })?;
        if shortcut.mods.is_empty() {
            return Err(
                "The hold-to-talk shortcut needs at least one modifier, such as Ctrl or Alt."
                    .into(),
            );
        }

        let mut registration = Vec::new();
        let mut display = Vec::new();
        if shortcut.mods.contains(Modifiers::CONTROL) {
            registration.push("control".to_string());
            display.push("Ctrl".to_string());
        }
        if shortcut.mods.contains(Modifiers::ALT) {
            registration.push("alt".to_string());
            display.push("Alt".to_string());
        }
        if shortcut.mods.contains(Modifiers::SHIFT) {
            registration.push("shift".to_string());
            display.push("Shift".to_string());
        }
        if shortcut.mods.contains(Modifiers::SUPER) {
            registration.push("super".to_string());
            #[cfg(target_os = "macos")]
            display.push("Cmd".to_string());
            #[cfg(not(target_os = "macos"))]
            display.push("Win".to_string());
        }

        registration.push(shortcut.key.to_string());
        display.push(display_key(shortcut.key));
        Ok(Self {
            registration: registration.join("+"),
            display: display.join("+"),
        })
    }
}

fn is_modifier_code(value: &str) -> bool {
    matches!(
        value.to_ascii_uppercase().as_str(),
        "CONTROLLEFT"
            | "CONTROLRIGHT"
            | "ALTLEFT"
            | "ALTRIGHT"
            | "SHIFTLEFT"
            | "SHIFTRIGHT"
            | "METALEFT"
            | "METARIGHT"
    )
}

fn display_key(key: Code) -> String {
    let key = key.to_string();
    if let Some(letter) = key.strip_prefix("Key") {
        return letter.to_string();
    }
    if let Some(digit) = key.strip_prefix("Digit") {
        return digit.to_string();
    }
    match key.as_str() {
        "ArrowUp" => "Up".into(),
        "ArrowDown" => "Down".into(),
        "ArrowLeft" => "Left".into(),
        "ArrowRight" => "Right".into(),
        "Backquote" => "`".into(),
        "Backslash" => "\\".into(),
        "BracketLeft" => "[".into(),
        "BracketRight" => "]".into(),
        "Comma" => ",".into(),
        "Equal" => "=".into(),
        "Minus" => "-".into(),
        "Period" => ".".into(),
        "Quote" => "'".into(),
        "Semicolon" => ";".into(),
        "Slash" => "/".into(),
        _ => key,
    }
}

trait ShortcutRegistry {
    fn register(&mut self, shortcut: &str) -> Result<(), String>;
    fn unregister(&mut self, shortcut: &str) -> Result<(), String>;
}

trait ShortcutPreferenceStore {
    fn load(&self) -> Result<Option<String>, String>;
    fn save(&mut self, shortcut: Option<&str>) -> Result<(), String>;
}

struct TauriShortcutRegistry<'a, R: Runtime> {
    app: &'a AppHandle<R>,
}

impl<R: Runtime> ShortcutRegistry for TauriShortcutRegistry<'_, R> {
    fn register(&mut self, shortcut: &str) -> Result<(), String> {
        self.app
            .global_shortcut()
            .register(shortcut)
            .map_err(|error| error.to_string())
    }

    fn unregister(&mut self, shortcut: &str) -> Result<(), String> {
        self.app
            .global_shortcut()
            .unregister(shortcut)
            .map_err(|error| error.to_string())
    }
}

struct TauriShortcutPreferences<'a, R: Runtime> {
    app: &'a AppHandle<R>,
}

impl<R: Runtime> ShortcutPreferenceStore for TauriShortcutPreferences<'_, R> {
    fn load(&self) -> Result<Option<String>, String> {
        let store = self
            .app
            .store(PREFERENCE_STORE)
            .map_err(|error| error.to_string())?;
        Ok(store
            .get(SHORTCUT_KEY)
            .and_then(|value| value.as_str().map(str::to_owned)))
    }

    fn save(&mut self, shortcut: Option<&str>) -> Result<(), String> {
        let store = self
            .app
            .store(PREFERENCE_STORE)
            .map_err(|error| error.to_string())?;
        let previous = store.get(SHORTCUT_KEY);
        match shortcut {
            Some(shortcut) => store.set(SHORTCUT_KEY, serde_json::Value::String(shortcut.into())),
            None => {
                store.delete(SHORTCUT_KEY);
            }
        }

        if let Err(error) = store.save() {
            match previous {
                Some(value) => store.set(SHORTCUT_KEY, value),
                None => {
                    store.delete(SHORTCUT_KEY);
                }
            }
            return Err(error.to_string());
        }
        Ok(())
    }
}

fn replace_shortcut_with<R: ShortcutRegistry, P: ShortcutPreferenceStore>(
    status: &DictationShortcutStatusState,
    registry: &mut R,
    preferences: &mut P,
    requested: &str,
) -> Result<DictationShortcutStatus, String> {
    let _replacement = status
        .replacement
        .lock()
        .map_err(|_| "Shortcut changes are temporarily unavailable.".to_string())?;
    let candidate = ValidatedShortcut::parse(requested)?;
    let previous_registration = status.registration();
    let previous_preference = preferences.load().map_err(|error| {
        format!(
            "PulseTalq could not read the saved shortcut. Your current shortcut is still active: {error}"
        )
    })?;

    if previous_registration.as_deref() == Some(candidate.registration.as_str()) {
        preferences
            .save(Some(&candidate.registration))
            .map_err(|error| {
                format!(
                    "PulseTalq could not save that shortcut. Your previous shortcut is still active: {error}"
                )
            })?;
        status.registered_shortcut(&candidate, None);
        return Ok(status.get());
    }

    registry
        .register(&candidate.registration)
        .map_err(|error| {
            format!("That shortcut is already in use. Choose another combination: {error}")
        })?;

    if let Err(error) = preferences.save(Some(&candidate.registration)) {
        let cleanup = registry.unregister(&candidate.registration).err();
        return Err(match cleanup {
            Some(cleanup) => format!(
                "PulseTalq could not save that shortcut. Your previous shortcut is still active: {error}. The unused candidate also could not be released: {cleanup}"
            ),
            None => format!(
                "PulseTalq could not save that shortcut. Your previous shortcut is still active: {error}"
            ),
        });
    }

    if let Some(previous) = previous_registration.as_deref() {
        if let Err(error) = registry.unregister(previous) {
            let preference_rollback = preferences.save(previous_preference.as_deref()).err();
            let candidate_cleanup = registry.unregister(&candidate.registration).err();
            let mut message = format!(
                "PulseTalq could not release the previous shortcut, so the change was cancelled: {error}"
            );
            if let Some(error) = preference_rollback {
                message.push_str(&format!(
                    ". The saved preference could not be restored: {error}"
                ));
            }
            if let Some(error) = candidate_cleanup {
                message.push_str(&format!(". The candidate could not be released: {error}"));
            }
            return Err(message);
        }
    }

    status.registered_shortcut(&candidate, None);
    Ok(status.get())
}

fn initialize_shortcut_with<R: ShortcutRegistry, P: ShortcutPreferenceStore>(
    status: &DictationShortcutStatusState,
    registry: &mut R,
    preferences: &P,
    defaults: &[&str],
) -> DictationShortcutStatus {
    let _replacement = match status.replacement.lock() {
        Ok(replacement) => replacement,
        Err(_) => {
            status.unavailable();
            return status.get();
        }
    };

    let mut warning = None;
    let saved = match preferences.load() {
        Ok(saved) => saved,
        Err(error) => {
            warning = Some(format!(
                "PulseTalq could not read the saved shortcut. A default shortcut is active: {error}"
            ));
            None
        }
    };
    let mut candidates = Vec::new();
    if let Some(saved) = saved.as_deref() {
        match ValidatedShortcut::parse(saved) {
            Ok(saved) => candidates.push(saved),
            Err(error) => {
                warning = Some(format!(
                    "The saved shortcut is invalid. A default shortcut is active: {error}"
                ));
            }
        }
    }
    for default in defaults {
        if let Ok(default) = ValidatedShortcut::parse(default) {
            if !candidates
                .iter()
                .any(|candidate| candidate.registration == default.registration)
            {
                candidates.push(default);
            }
        }
    }

    for (index, candidate) in candidates.iter().enumerate() {
        match registry.register(&candidate.registration) {
            Ok(()) => {
                let fallback_message = if index > 0 && saved.is_some() {
                    Some(format!(
                        "Your saved shortcut is unavailable. PulseTalq is using {} for this session.",
                        candidate.display
                    ))
                } else {
                    warning.clone()
                };
                status.registered_shortcut(candidate, fallback_message);
                return status.get();
            }
            Err(error) => log::warn!(
                target: "pulsetalk::dictation",
                "dictation_shortcut_registration_failed code=shortcut_unavailable shortcut={} error={}",
                candidate.display,
                error
            ),
        }
    }

    status.unavailable();
    status.get()
}
