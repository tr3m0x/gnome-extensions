// "Theme" page for the settings window of every tr3m0x extension.
// All extensions share the same settings, so changing it here changes all of them.

import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';

import {THEME_SCHEMA, PRESETS} from './palette.js';

const PRESET_IDS = Object.keys(PRESETS);
const ACCENTS = [
    ['gnome', 'Follow GNOME accent (Settings → Appearance)'],
    ['purple', 'Purple'], ['blue', 'Blue'], ['green', 'Green'],
    ['yellow', 'Yellow'], ['red', 'Red'], ['custom', 'Custom…'],
];
const BACKGROUNDS = [['preset', 'From preset'], ['black', 'Pure black'], ['custom', 'Custom…']];

function comboRow(settings, key, title, items, subtitle = '') {
    const row = new Adw.ComboRow({
        title, subtitle,
        model: Gtk.StringList.new(items.map(([, label]) => label)),
        selected: Math.max(0, items.findIndex(([id]) => id === settings.get_string(key))),
    });
    row.connect('notify::selected', () => settings.set_string(key, items[row.selected][0]));
    return row;
}

function colorRow(settings, key, title) {
    const row = new Adw.ActionRow({title});
    const btn = new Gtk.ColorDialogButton({
        dialog: new Gtk.ColorDialog({with_alpha: false}),
        valign: Gtk.Align.CENTER,
    });
    const rgba = new Gdk.RGBA();
    rgba.parse(settings.get_string(key));
    btn.rgba = rgba;
    btn.connect('notify::rgba', () => {
        const c = btn.rgba;
        const hex = '#' + [c.red, c.green, c.blue]
            .map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
        settings.set_string(key, hex);
    });
    row.add_suffix(btn);
    row.activatable_widget = btn;
    return row;
}

function scaleRow(settings, key, title, lower, upper, step, digits = 2) {
    const row = new Adw.SpinRow({
        title, digits,
        adjustment: new Gtk.Adjustment({lower, upper, step_increment: step}),
    });
    settings.bind(key, row, 'value', Gio.SettingsBindFlags.DEFAULT);
    return row;
}

export function addThemePage(window, prefs) {
    const settings = prefs.getSettings(THEME_SCHEMA);
    const page = new Adw.PreferencesPage({title: 'Theme', icon_name: 'applications-graphics-symbolic'});
    window.add(page);

    const colors = new Adw.PreferencesGroup({
        title: 'Colours',
        description: 'Shared by all tr3m0x extensions: change it here and every one updates instantly.',
    });
    page.add(colors);
    colors.add(comboRow(settings, 'preset', 'Preset',
        PRESET_IDS.map(id => [id, PRESETS[id].name])));

    colors.add(comboRow(settings, 'accent', 'Accent colour', ACCENTS,
        'Borders, active workspace, launcher selection'));
    const accentColor = colorRow(settings, 'custom-accent', 'Custom accent');
    colors.add(accentColor);

    colors.add(comboRow(settings, 'background', 'Pill background', BACKGROUNDS));
    const bgColor = colorRow(settings, 'custom-background', 'Custom background');
    colors.add(bgColor);

    const sync = () => {
        accentColor.visible = settings.get_string('accent') === 'custom';
        bgColor.visible = settings.get_string('background') === 'custom';
    };
    settings.connect('changed::accent', sync);
    settings.connect('changed::background', sync);
    sync();

    const shape = new Adw.PreferencesGroup({title: 'Shape'});
    page.add(shape);
    shape.add(scaleRow(settings, 'background-opacity', 'Background opacity', 0, 1, 0.05));
    shape.add(scaleRow(settings, 'border-opacity', 'Border strength', 0, 1, 0.05));
    const radius = scaleRow(settings, 'radius', 'Corner radius (px)', 0, 999, 1, 0);
    radius.subtitle = '999 = fully round pill, 0 = square';
    shape.add(radius);

    const reset = new Adw.PreferencesGroup();
    page.add(reset);
    const resetRow = new Adw.ButtonRow({title: 'Reset theme to defaults'});
    resetRow.connect('activated', () => {
        for (const k of settings.settings_schema.list_keys())
            settings.reset(k);
    });
    reset.add(resetRow);
    return page;
}
