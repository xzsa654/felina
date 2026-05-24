mod commands;
mod paths;
pub mod tokens;

use tauri::{
    image::Image,
    menu::{MenuBuilder, MenuItemBuilder},
    tray::TrayIconBuilder,
    Manager, WindowEvent,
};

fn show_window(window: &tauri::WebviewWindow) {
    #[cfg(target_os = "macos")]
    {
        #[allow(deprecated)]
        unsafe {
            use cocoa::appkit::{NSApp, NSApplication, NSApplicationActivationPolicy};
            NSApp().setActivationPolicy_(
                NSApplicationActivationPolicy::NSApplicationActivationPolicyRegular,
            );
            NSApp().activateIgnoringOtherApps_(cocoa::base::YES);
        }
    }
    let _ = window.show();
    let _ = window.set_focus();
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .manage({
            crate::commands::tokens::TokenState::new()
                .expect("failed to init token state")
        })
        .setup(|app| {
            // Build tray menu
            let show = MenuItemBuilder::with_id("show", "Show Felina").build(app)?;
            let quit = MenuItemBuilder::with_id("quit", "Quit").build(app)?;
            let menu = MenuBuilder::new(app).item(&show).separator().item(&quit).build()?;

            // Create tray icon
            let icon = Image::from_path("icons/32x32.png")
                .or_else(|_| Image::from_bytes(include_bytes!("../icons/32x32.png")))
                .expect("failed to load tray icon");

            TrayIconBuilder::new()
                .icon(icon)
                .menu(&menu)
                .tooltip("Felina")
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            show_window(&window);
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let tauri::tray::TrayIconEvent::Click { .. } = event {
                        if let Some(window) = tray.app_handle().get_webview_window("main") {
                            show_window(&window);
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            // Hide window instead of closing — keeps app in tray
            if let WindowEvent::CloseRequested { api, .. } = event {
                let _ = window.hide();
                api.prevent_close();
                // Remove from Dock and Cmd+Tab on macOS
                #[cfg(target_os = "macos")]
                {
                    #[allow(deprecated)]
                    unsafe {
                        use cocoa::appkit::{NSApp, NSApplication, NSApplicationActivationPolicy};
                        NSApp().setActivationPolicy_(
                            NSApplicationActivationPolicy::NSApplicationActivationPolicyAccessory,
                        );
                    }
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            // Settings
            commands::settings::read_settings,
            commands::settings::write_settings,
            // Projects
            commands::projects::list_projects,
            // Memory
            commands::memory::list_memory_files,
            commands::memory::read_memory_file,
            commands::memory::write_memory_file,
            commands::memory::delete_memory_file,
            // Agents (AGENT.md subsystem retained; multi-agent skill rewrite
            // does NOT touch subagent definitions — see design.md decision 7).
            commands::skills::list_agents,
            commands::skills::write_agent,
            commands::skills::delete_agent,
            // Multi-agent skills foundation: canonical storage.
            commands::canonical_skills::canonical_skills_list,
            commands::canonical_skills::canonical_skills_read,
            commands::canonical_skills::canonical_skills_read_raw,
            commands::canonical_skills::canonical_skills_write,
            commands::canonical_skills::canonical_skills_write_raw,
            commands::canonical_skills::canonical_skills_delete,
            commands::canonical_skills::skill_targets_set,
            commands::canonical_skills::skill_prune_orphans_scan,
            commands::canonical_skills::skill_prune_orphans_apply,
            // Fan-out push.
            commands::fan_out::skill_sync_one,
            commands::fan_out::skill_sync_all,
            commands::fan_out::skill_target_dir_resolve,
            // Initial skill import.
            commands::skill_import::skill_import_scan_quick,
            commands::skill_import::skill_import_scan,
            commands::skill_import::skill_import_apply,
            // Settings → Agent Paths.
            commands::agent_paths::agent_paths_get,
            commands::agent_paths::agent_paths_set,
            // Known Projects.
            commands::known_projects::known_projects_list,
            commands::known_projects::known_projects_add,
            commands::known_projects::known_projects_remove,
            // Maintenance
            commands::maintenance::get_disk_usage,
            commands::maintenance::cleanup_directory,
            // Token Analytics
            commands::tokens::get_token_analytics,
            commands::tokens::get_model_breakdown,
            commands::tokens::get_cache_efficiency,
            commands::tokens::get_available_agents,
            commands::tokens::refresh_token_data,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
