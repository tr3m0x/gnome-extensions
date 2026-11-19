import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import {addThemePage} from './themePrefs.js';

export default class TunIpPrefs extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        const page = new Adw.PreferencesPage({title: 'General', icon_name: 'preferences-system-symbolic'});
        window.add(page);
        const group = new Adw.PreferencesGroup({title: 'Size'});
        page.add(group);

        const size = new Adw.SpinRow({
            title: 'Size',
            subtitle: '1.00 = normal · applies instantly',
            digits: 2,
            adjustment: new Gtk.Adjustment({lower: 0.6, upper: 1.6, step_increment: 0.05}),
        });
        settings.bind('scale', size, 'value', Gio.SettingsBindFlags.DEFAULT);
        group.add(size);

        addThemePage(window, this);
    }
}
