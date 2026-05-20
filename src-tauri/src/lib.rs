mod commands;
mod paths;

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
        .setup(|app| {
            // Build tray menu
            let show = MenuItemBuilder::with_id("show", "Show Glyphic").build(app)?;
            let quit = MenuItemBuilder::with_id("quit", "Quit").build(app)?;
            let menu = MenuBuilder::new(app).item(&show).separator().item(&quit).build()?;

            // Create tray icon
            let icon = Image::from_path("icons/32x32.png")
                .or_else(|_| Image::from_bytes(include_bytes!("../icons/32x32.png")))
                .expect("failed to load tray icon");

            TrayIconBuilder::new()
                .icon(icon)
                .menu(&menu)
                .tooltip("Glyphic")
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
            // Skills & Agents
            commands::skills::list_skills,
            commands::skills::list_agents,
            commands::skills::write_skill,
            commands::skills::write_agent,
            commands::skills::delete_skill,
            commands::skills::delete_agent,
            // Maintenance
            commands::maintenance::get_disk_usage,
            commands::maintenance::cleanup_directory,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
