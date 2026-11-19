import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import {addThemePage} from './themePrefs.js';

const BOXES = ['left', 'center', 'right'];

export default class ClaudeUsagePrefs extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        const page = new Adw.PreferencesPage({title: 'General', icon_name: 'preferences-system-symbolic'});
        window.add(page);

        const pos = new Adw.PreferencesGroup({title: 'Position & size'});
        page.add(pos);
        const box = new Adw.ComboRow({
            title: 'Panel area',
            model: Gtk.StringList.new(['Left', 'Center', 'Right']),
            selected: Math.max(0, BOXES.indexOf(settings.get_string('panel-box'))),
        });
        box.connect('notify::selected', () => settings.set_string('panel-box', BOXES[box.selected]));
        pos.add(box);
        const index = new Adw.SpinRow({
            title: 'Order in that area',
            subtitle: '0 = first item, higher = further right',
            adjustment: new Gtk.Adjustment({lower: 0, upper: 20, step_increment: 1}),
        });
        settings.bind('panel-index', index, 'value', Gio.SettingsBindFlags.DEFAULT);
        pos.add(index);

        const size = new Adw.SpinRow({
            title: 'Size',
            subtitle: '1.00 = normal · applies instantly',
            digits: 2,
            adjustment: new Gtk.Adjustment({lower: 0.6, upper: 1.6, step_increment: 0.05}),
        });
        settings.bind('scale', size, 'value', Gio.SettingsBindFlags.DEFAULT);
        pos.add(size);

        const show = new Adw.PreferencesGroup({title: 'Panel content'});
        page.add(show);
        for (const [key, title] of [
            ['show-weekly', 'Weekly usage'],
            ['show-bars', 'Mini progress bars'],
            ['show-reset', '5h reset countdown'],
        ]) {
            const row = new Adw.SwitchRow({title});
            settings.bind(key, row, 'active', Gio.SettingsBindFlags.DEFAULT);
            show.add(row);
        }

        const misc = new Adw.PreferencesGroup({
            title: 'Refresh',
            description: 'Reads your Claude Code login (~/.claude/.credentials.json) and queries api.anthropic.com. The token is never modified.',
        });
        page.add(misc);
        const interval = new Adw.SpinRow({
            title: 'Interval (minutes)',
            adjustment: new Gtk.Adjustment({lower: 1, upper: 60, step_increment: 1}),
        });
        settings.bind('interval', interval, 'value', Gio.SettingsBindFlags.DEFAULT);
        misc.add(interval);

        addThemePage(window, this);
    }
}
