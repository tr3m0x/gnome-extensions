import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import {addThemePage} from './themePrefs.js';

const BOXES = ['left', 'center', 'right'];

export default class WorkspacesPrefs extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        const wm = new Gio.Settings({schema_id: 'org.gnome.desktop.wm.preferences'});
        const page = new Adw.PreferencesPage({title: 'General', icon_name: 'preferences-system-symbolic'});
        window.add(page);

        // Position
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

        // Behaviour
        const look = new Adw.PreferencesGroup({title: 'Behaviour'});
        page.add(look);
        for (const [key, title, subtitle] of [
            ['show-names', 'Show names', 'Show the workspace name next to its number'],
            ['show-empty', 'Show empty workspaces', 'Off: only workspaces with windows (and the active one) are shown'],
            ['show-dots', 'Window dots', 'One dot per open window, up to 3'],
            ['scroll-wrap', 'Wrap around when scrolling', ''],
            ['active-toggles-overview', 'Click active workspace for Overview', ''],
        ]) {
            const row = new Adw.SwitchRow({title, subtitle});
            settings.bind(key, row, 'active', Gio.SettingsBindFlags.DEFAULT);
            look.add(row);
        }

        // Names (GNOME's own workspace-names setting)
        const namesGroup = new Adw.PreferencesGroup({
            title: 'Workspace names',
            description: 'Press Enter to save. You can also right-click a workspace → Rename.',
        });
        page.add(namesGroup);
        const n = Math.max(wm.get_int('num-workspaces'), wm.get_strv('workspace-names').length, 1);
        for (let i = 0; i < n; i++) {
            const row = new Adw.EntryRow({title: `Workspace ${i + 1}`, show_apply_button: true});
            row.text = wm.get_strv('workspace-names')[i] ?? '';
            row.connect('apply', () => {
                const names = wm.get_strv('workspace-names');
                while (names.length <= i)
                    names.push('');
                names[i] = row.text.trim();
                while (names.length && !names[names.length - 1])
                    names.pop();
                wm.set_strv('workspace-names', names);
            });
            namesGroup.add(row);
        }

        addThemePage(window, this);
    }
}
