// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{AppHandle, Manager, Runtime};

#[tauri::command]
fn minimize_window<R: Runtime>(_app: AppHandle<R>, window: tauri::Window<R>) {
    window.minimize().unwrap_or(());
}

#[tauri::command]
fn toggle_maximize_window<R: Runtime>(_app: AppHandle<R>, window: tauri::Window<R>) {
    if window.is_maximized().unwrap_or(false) {
        window.unmaximize().unwrap_or(());
    } else {
        window.maximize().unwrap_or(());
    }
}

#[tauri::command]
fn close_window<R: Runtime>(_app: AppHandle<R>, window: tauri::Window<R>) {
    window.close().unwrap_or(());
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            minimize_window,
            toggle_maximize_window,
            close_window
        ])
        .run(tauri::generate_context!())
        .expect("error while running PohuMusic Tauri application");
}
