use std::{
    sync::{
        atomic::{AtomicBool, Ordering},
        Mutex, RwLock,
    },
    time::Duration,
};
use tauri::{AppHandle, Manager, Monitor, PhysicalPosition, PhysicalSize, WebviewWindow};
use tauri_plugin_store::StoreExt;

const PREFERENCE_STORE: &str = "preferences.json";
const ENABLED_KEY: &str = "dictation_overlay_enabled";
const COMPACT_SIZE: (u32, u32) = (72, 28);
const EXPANDED_SIZE: (u32, u32) = (320, 104);
const BOTTOM_MARGIN: i32 = 16;
const MONITOR_POLL_INTERVAL: Duration = Duration::from_millis(200);

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
struct MonitorBounds {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
}

impl MonitorBounds {
    const fn new(x: i32, y: i32, width: u32, height: u32) -> Self {
        Self {
            x,
            y,
            width,
            height,
        }
    }

    fn from_monitor(monitor: &Monitor) -> Self {
        Self::new(
            monitor.position().x,
            monitor.position().y,
            monitor.size().width,
            monitor.size().height,
        )
    }

    fn contains(self, cursor_x: f64, cursor_y: f64) -> bool {
        cursor_x >= self.x as f64
            && cursor_x < self.x as f64 + self.width as f64
            && cursor_y >= self.y as f64
            && cursor_y < self.y as f64 + self.height as f64
    }
}

pub struct DictationOverlayState {
    enabled: RwLock<bool>,
    placement: Mutex<OverlayPlacement>,
    follower_started: AtomicBool,
}

#[derive(Debug, Default)]
struct OverlayPlacement {
    expanded: bool,
    cursor_monitor: Option<MonitorBounds>,
}

impl DictationOverlayState {
    pub fn new() -> Self {
        Self {
            enabled: RwLock::new(true),
            placement: Mutex::new(OverlayPlacement::default()),
            follower_started: AtomicBool::new(false),
        }
    }

    pub fn enabled(&self) -> bool {
        self.enabled.read().map(|value| *value).unwrap_or(true)
    }

    fn set_enabled(&self, enabled: bool) {
        if let Ok(mut value) = self.enabled.write() {
            *value = enabled;
        }
    }

    fn expanded(&self) -> bool {
        self.placement
            .lock()
            .map(|placement| placement.expanded)
            .unwrap_or(false)
    }

    fn set_expanded(&self, expanded: bool) {
        if let Ok(mut placement) = self.placement.lock() {
            placement.expanded = expanded;
        }
    }

    fn start_follower(&self) -> bool {
        !self.follower_started.swap(true, Ordering::AcqRel)
    }
}

impl Default for DictationOverlayState {
    fn default() -> Self {
        Self::new()
    }
}

pub fn initialize_overlay(app: &AppHandle) {
    let enabled = app
        .store(PREFERENCE_STORE)
        .ok()
        .and_then(|store| store.get(ENABLED_KEY))
        .and_then(|value| value.as_bool())
        .unwrap_or(true);
    app.state::<DictationOverlayState>().set_enabled(enabled);
    app.state::<DictationOverlayState>().set_expanded(false);

    if enabled {
        if let Err(error) = position_on_cursor_monitor(app, true) {
            log::warn!("dictation_overlay_initialize_failed error={error}");
            if let Err(fallback_error) = resize_and_position(app, false) {
                log::warn!("dictation_overlay_initialize_fallback_failed error={fallback_error}");
            }
        }
        show_if_enabled(app);
    } else if let Some(overlay) = app.get_webview_window("dictation-overlay") {
        let _ = overlay.hide();
    }
    start_monitor_follower(app);
}

pub fn set_enabled(app: &AppHandle, enabled: bool) -> Result<(), String> {
    let store = app
        .store(PREFERENCE_STORE)
        .map_err(|error| format!("Could not open overlay preferences: {error}"))?;
    store.set(ENABLED_KEY, serde_json::Value::Bool(enabled));
    store
        .save()
        .map_err(|error| format!("Could not save overlay preference: {error}"))?;
    app.state::<DictationOverlayState>().set_enabled(enabled);

    let overlay = overlay_window(app)?;
    if enabled {
        let expanded = app.state::<DictationOverlayState>().expanded();
        if let Err(error) = position_on_cursor_monitor(app, true) {
            log::warn!("dictation_overlay_enable_cursor_monitor_failed error={error}");
            resize_and_position(app, expanded)?;
        }
        overlay
            .show()
            .map_err(|error| format!("Could not show dictation overlay: {error}"))?;
    } else {
        overlay
            .hide()
            .map_err(|error| format!("Could not hide dictation overlay: {error}"))?;
    }
    log::info!("dictation_overlay_preference_changed enabled={enabled}");
    Ok(())
}

pub fn set_expanded(app: &AppHandle, expanded: bool) -> Result<(), String> {
    let state = app.state::<DictationOverlayState>();
    state.set_expanded(expanded);
    if !state.enabled() {
        return Ok(());
    }
    position_on_cursor_monitor(app, true).or_else(|_| resize_and_position(app, expanded))
}

pub fn prepare_for_activation(app: &AppHandle) {
    let state = app.state::<DictationOverlayState>();
    if !state.enabled() {
        return;
    }
    state.set_expanded(true);
    if let Err(error) = position_on_cursor_monitor(app, true) {
        log::warn!("dictation_overlay_cursor_monitor_failed error={error}");
        if let Err(fallback_error) = resize_and_position(app, true) {
            log::warn!("dictation_overlay_activation_fallback_failed error={fallback_error}");
        }
    }
    show_if_enabled(app);
}

pub fn show_if_enabled(app: &AppHandle) {
    let Some(overlay) = app.get_webview_window("dictation-overlay") else {
        log::error!("dictation_overlay_missing code=internal");
        return;
    };
    if app.state::<DictationOverlayState>().enabled() {
        if let Err(error) = overlay.show() {
            log::warn!("dictation_overlay_show_failed error={error}");
        }
    } else if let Err(error) = overlay.hide() {
        log::warn!("dictation_overlay_hide_failed error={error}");
    }
}

fn resize_and_position(app: &AppHandle, expanded: bool) -> Result<(), String> {
    let overlay = overlay_window(app)?;
    let monitor = overlay
        .current_monitor()
        .map_err(|error| format!("Could not read overlay monitor: {error}"))?
        .ok_or_else(|| "No monitor is available for the dictation overlay.".to_string())?;
    resize_and_position_on_monitor(&overlay, &monitor, expanded)
}

fn start_monitor_follower(app: &AppHandle) {
    if !app.state::<DictationOverlayState>().start_follower() {
        return;
    }

    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        let mut interval = tokio::time::interval(MONITOR_POLL_INTERVAL);
        let mut warning_sent = false;
        interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
        loop {
            interval.tick().await;
            let enabled = app.state::<DictationOverlayState>().enabled();
            if !enabled {
                record_monitor_follow_result(&mut warning_sent, false, false);
                continue;
            }
            let succeeded = position_on_cursor_monitor(&app, false).is_ok();
            if record_monitor_follow_result(&mut warning_sent, true, succeeded) {
                log::warn!("dictation_overlay_monitor_follow_failed code=monitor_unavailable");
            }
        }
    });
}

fn record_monitor_follow_result(warning_sent: &mut bool, enabled: bool, succeeded: bool) -> bool {
    if !enabled || succeeded {
        *warning_sent = false;
        return false;
    }
    if *warning_sent {
        return false;
    }
    *warning_sent = true;
    true
}

fn position_on_cursor_monitor(app: &AppHandle, force: bool) -> Result<(), String> {
    let cursor = app
        .cursor_position()
        .map_err(|error| format!("Could not read cursor position: {error}"))?;
    let monitors = app
        .available_monitors()
        .map_err(|error| format!("Could not enumerate monitors: {error}"))?;
    let monitor_bounds = monitors
        .iter()
        .map(MonitorBounds::from_monitor)
        .collect::<Vec<_>>();
    let selected_bounds = monitor_for_cursor(&monitor_bounds, cursor.x, cursor.y)
        .ok_or_else(|| "The cursor is not inside an available monitor.".to_string())?;
    let state = app.state::<DictationOverlayState>();
    let monitor_index = monitor_bounds
        .iter()
        .position(|bounds| *bounds == selected_bounds)
        .ok_or_else(|| "The cursor monitor is no longer available.".to_string())?;
    let mut placement = state
        .placement
        .lock()
        .map_err(|_| "The dictation overlay placement state is unavailable.".to_string())?;
    if !force && monitor_transition(placement.cursor_monitor, Some(selected_bounds)).is_none() {
        return Ok(());
    }

    let overlay = overlay_window(app)?;
    resize_and_position_on_monitor(&overlay, &monitors[monitor_index], placement.expanded)?;
    placement.cursor_monitor = Some(selected_bounds);
    log::info!(
        "dictation_overlay_monitor_selected source=cursor x={} y={} width={} height={}",
        selected_bounds.x,
        selected_bounds.y,
        selected_bounds.width,
        selected_bounds.height
    );
    Ok(())
}

fn resize_and_position_on_monitor(
    overlay: &WebviewWindow,
    monitor: &Monitor,
    expanded: bool,
) -> Result<(), String> {
    let logical_size = if expanded {
        EXPANDED_SIZE
    } else {
        COMPACT_SIZE
    };
    let scale = monitor.scale_factor();
    let size = PhysicalSize::new(
        (logical_size.0 as f64 * scale).round() as u32,
        (logical_size.1 as f64 * scale).round() as u32,
    );
    overlay
        .set_size(size)
        .map_err(|error| format!("Could not resize dictation overlay: {error}"))?;
    position_for_monitor(overlay, monitor, size)
}

fn position_for_monitor(
    overlay: &WebviewWindow,
    monitor: &Monitor,
    size: PhysicalSize<u32>,
) -> Result<(), String> {
    let work_area = monitor.work_area();
    let scale = monitor.scale_factor();
    let bottom_margin = (BOTTOM_MARGIN as f64 * scale).round() as i32;
    let x = work_area.position.x + (work_area.size.width.saturating_sub(size.width) / 2) as i32;
    let y =
        work_area.position.y + work_area.size.height as i32 - size.height as i32 - bottom_margin;
    overlay
        .set_position(PhysicalPosition::new(x, y))
        .map_err(|error| format!("Could not position dictation overlay: {error}"))
}

fn monitor_for_cursor(
    monitors: &[MonitorBounds],
    cursor_x: f64,
    cursor_y: f64,
) -> Option<MonitorBounds> {
    monitors
        .iter()
        .copied()
        .find(|monitor| monitor.contains(cursor_x, cursor_y))
}

fn monitor_transition(
    previous: Option<MonitorBounds>,
    current: Option<MonitorBounds>,
) -> Option<MonitorBounds> {
    current.filter(|monitor| Some(*monitor) != previous)
}

fn overlay_window(app: &AppHandle) -> Result<WebviewWindow, String> {
    app.get_webview_window("dictation-overlay")
        .ok_or_else(|| "The dictation overlay window is unavailable.".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn compact_overlay_is_only_large_enough_for_the_voice_cursor() {
        assert_eq!(COMPACT_SIZE, (72, 28));
        assert!(EXPANDED_SIZE.0 > COMPACT_SIZE.0);
        assert!(EXPANDED_SIZE.1 > COMPACT_SIZE.1);
    }

    #[test]
    fn cursor_monitor_selection_supports_negative_desktop_coordinates() {
        let monitors = [
            MonitorBounds::new(-1920, -180, 1920, 1080),
            MonitorBounds::new(0, 0, 2560, 1440),
        ];

        assert_eq!(
            monitor_for_cursor(&monitors, -640.0, 400.0),
            Some(monitors[0])
        );
        assert_eq!(
            monitor_for_cursor(&monitors, 1400.0, 900.0),
            Some(monitors[1])
        );
        assert_eq!(monitor_for_cursor(&monitors, -640.0, 900.0), None);
    }

    #[test]
    fn cursor_monitor_selection_uses_half_open_monitor_boundaries() {
        let monitors = [
            MonitorBounds::new(-1920, 0, 1920, 1080),
            MonitorBounds::new(0, 0, 1920, 1080),
        ];

        assert_eq!(
            monitor_for_cursor(&monitors, -0.01, 400.0),
            Some(monitors[0])
        );
        assert_eq!(monitor_for_cursor(&monitors, 0.0, 400.0), Some(monitors[1]));
        assert_eq!(
            monitor_for_cursor(&monitors, 1919.99, 1079.99),
            Some(monitors[1])
        );
        assert_eq!(monitor_for_cursor(&monitors, 1920.0, 1080.0), None);
    }

    #[test]
    fn monitor_transition_suppresses_pointer_moves_within_the_same_monitor() {
        let primary = MonitorBounds::new(0, 0, 1920, 1080);
        let secondary = MonitorBounds::new(1920, 0, 2560, 1440);

        assert_eq!(monitor_transition(None, Some(primary)), Some(primary));
        assert_eq!(monitor_transition(Some(primary), Some(primary)), None);
        assert_eq!(
            monitor_transition(Some(primary), Some(secondary)),
            Some(secondary)
        );
        assert_eq!(monitor_transition(Some(primary), None), None);
    }

    #[test]
    fn monitor_follow_warning_is_edge_triggered_and_rearms_after_recovery() {
        let mut warning_sent = false;

        assert!(record_monitor_follow_result(&mut warning_sent, true, false));
        assert!(!record_monitor_follow_result(
            &mut warning_sent,
            true,
            false
        ));
        assert!(!record_monitor_follow_result(&mut warning_sent, true, true));
        assert!(record_monitor_follow_result(&mut warning_sent, true, false));
        assert!(!record_monitor_follow_result(
            &mut warning_sent,
            false,
            false
        ));
        assert!(record_monitor_follow_result(&mut warning_sent, true, false));
    }
}
