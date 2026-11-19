import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import {addThemePage} from './themePrefs.js';

export default class LauncherPrefs extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        const page = new Adw.PreferencesPage({title: 'General', icon_name: 'preferences-system-symbolic'});
        window.add(page);

        const group = new Adw.PreferencesGroup({
            title: 'Launcher',
            description: 'Shortcut: Super+Space (key "toggle-launcher" in the schema)',
        });
        page.add(group);
        const max = new Adw.SpinRow({
            title: 'Results shown',
            adjustment: new Gtk.Adjustment({lower: 3, upper: 15, step_increment: 1}),
        });
        settings.bind('max-results', max, 'value', Gio.SettingsBindFlags.DEFAULT);
        group.add(max);

        addThemePage(window, this);
    }
}
