import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import {addThemePage} from './themePrefs.js';

const BOXES = ['left', 'center', 'right'];

export default class SysMonPrefs extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        const page = new Adw.PreferencesPage({title: 'General', icon_name: 'preferences-system-symbolic'});
        window.add(page);

        // Position
        const pos = new Adw.PreferencesGroup({title: 'Position'});
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

        // Content
        const show = new Adw.PreferencesGroup({title: 'Show'});
        page.add(show);
        for (const [key, title] of [['show-icons', 'Icons (off = CPU / RAM / DISK words)'], ['show-cpu', 'CPU usage'], ['show-mem', 'Memory used / total'], ['show-disk', 'Disk used / total']]) {
            const row = new Adw.SwitchRow({title});
            settings.bind(key, row, 'active', Gio.SettingsBindFlags.DEFAULT);
            show.add(row);
        }

        const FORMATS = ['free', 'used-total'];
        const fmt = new Adw.ComboRow({
            title: 'Disk display',
            model: Gtk.StringList.new(['Free space (51G free)', 'Used / total (120G / 476G)']),
            selected: Math.max(0, FORMATS.indexOf(settings.get_string('disk-format'))),
        });
        fmt.connect('notify::selected', () => settings.set_string('disk-format', FORMATS[fmt.selected]));
        show.add(fmt);

        const disk = new Adw.EntryRow({title: 'Disk mount point', show_apply_button: true});
        disk.text = settings.get_string('disk-path');
        disk.connect('apply', () => settings.set_string('disk-path', disk.text || '/'));
        show.add(disk);

        // Refresh
        const misc = new Adw.PreferencesGroup({title: 'Refresh'});
        page.add(misc);
        const interval = new Adw.SpinRow({
            title: 'Interval (seconds)',
            adjustment: new Gtk.Adjustment({lower: 1, upper: 60, step_increment: 1}),
        });
        settings.bind('interval', interval, 'value', Gio.SettingsBindFlags.DEFAULT);
        misc.add(interval);

        addThemePage(window, this);
    }
}
