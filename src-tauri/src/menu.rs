use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem, Submenu},
    AppHandle, Wry,
};

pub fn get_menu(handle: &AppHandle) -> tauri::Result<Menu<Wry>> {
    // App Menu
    let app_menu = Submenu::with_items(
        handle,
        "App",
        true,
        &[
            &PredefinedMenuItem::about(handle, None, None)?,
            &PredefinedMenuItem::separator(handle)?,
            &PredefinedMenuItem::services(handle, None)?,
            &PredefinedMenuItem::separator(handle)?,
            &PredefinedMenuItem::hide(handle, None)?,
            &PredefinedMenuItem::hide_others(handle, None)?,
            &PredefinedMenuItem::show_all(handle, None)?,
            &PredefinedMenuItem::separator(handle)?,
            &PredefinedMenuItem::quit(handle, None)?,
        ],
    )?;

    // File Menu
    let new_permanent = MenuItem::with_id(handle, "new_permanent", "New Permanent Note", true, Some("cmdOrCtrl+n"))?;
    let new_fleeting = MenuItem::with_id(handle, "new_fleeting", "New Fleeting Note", true, Some("cmdOrCtrl+shift+n"))?;
    let new_literature = MenuItem::with_id(handle, "new_literature", "New Literature Note", true, Some("cmdOrCtrl+alt+n"))?;
    let new_project = MenuItem::with_id(handle, "new_project", "New Project Note", true, Some("cmdOrCtrl+shift+p"))?;
    let new_canvas = MenuItem::with_id(handle, "new_canvas", "New Canvas", true, Some("cmdOrCtrl+alt+c"))?;
    let new_source = MenuItem::with_id(handle, "new_source", "New Source", true, Some("cmdOrCtrl+alt+s"))?;
    let import_book = MenuItem::with_id(handle, "import_book", "Import Book...", true, Some("cmdOrCtrl+o"))?;
    let open_vault = MenuItem::with_id(handle, "open_vault", "Open Vault...", true, Some("cmdOrCtrl+shift+o"))?;
    let close_window = PredefinedMenuItem::close_window(handle, None)?;
    
    let file_menu = Submenu::with_items(
        handle,
        "File",
        true,
        &[
            &new_permanent,
            &new_fleeting,
            &new_literature,
            &new_project,
            &new_canvas,
            &new_source,
            &PredefinedMenuItem::separator(handle)?,
            &import_book,
            &open_vault,
            &PredefinedMenuItem::separator(handle)?,
            &close_window,
        ],
    )?;

    // Edit Menu
    let find = MenuItem::with_id(handle, "find", "Find", true, Some("cmdOrCtrl+f"))?;
    let find_replace = MenuItem::with_id(handle, "find_replace", "Find and Replace", true, Some("cmdOrCtrl+alt+f"))?;
    
    let edit_menu = Submenu::with_items(
        handle,
        "Edit",
        true,
        &[
            &PredefinedMenuItem::undo(handle, None)?,
            &PredefinedMenuItem::redo(handle, None)?,
            &PredefinedMenuItem::separator(handle)?,
            &PredefinedMenuItem::cut(handle, None)?,
            &PredefinedMenuItem::copy(handle, None)?,
            &PredefinedMenuItem::paste(handle, None)?,
            &PredefinedMenuItem::select_all(handle, None)?,
            &PredefinedMenuItem::separator(handle)?,
            &find,
            &find_replace,
        ],
    )?;

    // View Menu
    let view_dashboard = MenuItem::with_id(handle, "view_dashboard", "Dashboard", true, Some("cmdOrCtrl+1"))?;
    let view_library = MenuItem::with_id(handle, "view_library", "Library", true, Some("cmdOrCtrl+2"))?;
    let view_graph = MenuItem::with_id(handle, "view_graph", "Knowledge Graph", true, Some("cmdOrCtrl+3"))?;
    let view_review = MenuItem::with_id(handle, "view_review", "Review", true, Some("cmdOrCtrl+4"))?;
    let view_tags = MenuItem::with_id(handle, "view_tags", "Tags", true, Some("cmdOrCtrl+5"))?;
    let view_settings = MenuItem::with_id(handle, "view_settings", "Settings", true, Some("cmdOrCtrl+,"))?;
    let toggle_sidebar = MenuItem::with_id(handle, "toggle_sidebar", "Toggle Sidebar", true, Some("cmdOrCtrl+b"))?;
    let toggle_theme = MenuItem::with_id(handle, "toggle_theme", "Toggle Theme", true, Some("cmdOrCtrl+shift+l"))?;
    
    let view_menu = Submenu::with_items(
        handle,
        "View",
        true,
        &[
            &view_dashboard,
            &view_library,
            &view_graph,
            &view_review,
            &view_tags,
            &view_settings,
            &PredefinedMenuItem::separator(handle)?,
            &toggle_sidebar,
            &toggle_theme,
            &PredefinedMenuItem::separator(handle)?,
            &PredefinedMenuItem::fullscreen(handle, None)?,
        ],
    )?;

    // Go Menu
    let go_dashboard = MenuItem::with_id(handle, "go_dashboard", "Dashboard", true, Some("cmdOrCtrl+1"))?;
    let go_library = MenuItem::with_id(handle, "go_library", "Library", true, Some("cmdOrCtrl+2"))?;
    let go_graph = MenuItem::with_id(handle, "go_graph", "Knowledge Graph", true, Some("cmdOrCtrl+3"))?;
    let go_review = MenuItem::with_id(handle, "go_review", "Review", true, Some("cmdOrCtrl+4"))?;
    let go_tags = MenuItem::with_id(handle, "go_tags", "Tags", true, Some("cmdOrCtrl+5"))?;
    let go_boards = MenuItem::with_id(handle, "go_boards", "Boards", true, Some("cmdOrCtrl+6"))?;
    let go_back = MenuItem::with_id(handle, "go_back", "Back", true, Some("cmdOrCtrl+["))?;
    let go_forward = MenuItem::with_id(handle, "go_forward", "Forward", true, Some("cmdOrCtrl+]"))?;
    
    let go_menu = Submenu::with_items(
        handle,
        "Go",
        true,
        &[
            &go_dashboard,
            &go_library,
            &go_graph,
            &go_review,
            &go_tags,
            &go_boards,
            &PredefinedMenuItem::separator(handle)?,
            &go_back,
            &go_forward,
        ],
    )?;

    // Card Menu
    let card_new_permanent = MenuItem::with_id(handle, "card_new_permanent", "New Permanent Note", true, Some("cmdOrCtrl+n"))?;
    let card_new_fleeting = MenuItem::with_id(handle, "card_new_fleeting", "New Fleeting Note", true, Some("cmdOrCtrl+shift+n"))?;
    let card_new_literature = MenuItem::with_id(handle, "card_new_literature", "New Literature Note", true, Some("cmdOrCtrl+alt+n"))?;
    let card_new_project = MenuItem::with_id(handle, "card_new_project", "New Project Note", true, Some("cmdOrCtrl+shift+p"))?;
    let card_delete = MenuItem::with_id(handle, "card_delete", "Delete Card", true, Some("cmdOrCtrl+backspace"))?;
    let card_duplicate = MenuItem::with_id(handle, "card_duplicate", "Duplicate Card", true, Some("cmdOrCtrl+alt+d"))?;
    let card_rename = MenuItem::with_id(handle, "card_rename", "Rename Card", true, Some("cmdOrCtrl+r"))?;
    
    let card_menu = Submenu::with_items(
        handle,
        "Card",
        true,
        &[
            &card_new_permanent,
            &card_new_fleeting,
            &card_new_literature,
            &card_new_project,
            &PredefinedMenuItem::separator(handle)?,
            &card_delete,
            &card_duplicate,
            &card_rename,
        ],
    )?;

    // Window Menu
    let window_close_all = MenuItem::with_id(handle, "window_close_all", "Close All Windows", true, Some("cmdOrCtrl+alt+w"))?;
    
    let window_menu = Submenu::with_items(
        handle,
        "Window",
        true,
        &[
            &PredefinedMenuItem::minimize(handle, None)?,
            &PredefinedMenuItem::maximize(handle, None)?,
            &PredefinedMenuItem::separator(handle)?,
            &close_window,
            &window_close_all,
        ],
    )?;

    // Help Menu
    let help_docs = MenuItem::with_id(handle, "help_docs", "Zentri Help", true, None::<&str>)?;
    let help_shortcuts = MenuItem::with_id(handle, "help_shortcuts", "Keyboard Shortcuts", true, Some("cmdOrCtrl+?"))?;
    let help_about = PredefinedMenuItem::about(handle, None, None)?;
    
    let help_menu = Submenu::with_items(
        handle,
        "Help",
        true,
        &[
            &help_docs,
            &help_shortcuts,
            &PredefinedMenuItem::separator(handle)?,
            &help_about,
        ],
    )?;

    Menu::with_items(
        handle,
        &[
            &app_menu,
            &file_menu,
            &edit_menu,
            &view_menu,
            &go_menu,
            &card_menu,
            &window_menu,
            &help_menu,
        ],
    )
}
