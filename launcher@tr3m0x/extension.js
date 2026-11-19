import GLib from 'gi://GLib';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import {ThemeManager} from './theme.js';
import themeCss from './themeCss.js';

const PANEL_WIDTH = 640;
const ICON_SIZE = 32;

// ── Fuzzy scoring ────────────────────────────────────────────────────────────
function subsequenceScore(q, s) {
    let i = 0, gaps = 0, last = -1;
    for (let j = 0; j < s.length && i < q.length; j++) {
        if (s[j] === q[i]) {
            if (last >= 0)
                gaps += j - last - 1;
            last = j;
            i++;
        }
    }
    return i === q.length ? Math.max(1, 100 - gaps * 4) : 0;
}

function scoreApp(q, app) {
    const name = (app.get_name() || '').toLowerCase();
    if (name === q) return 1000;
    if (name.startsWith(q)) return 800;
    if (name.split(/[\s\-_.]+/).some(w => w.startsWith(q))) return 600;
    if (name.includes(q)) return 400;

    const info = app.get_app_info();
    const extra = [
        info?.get_generic_name?.() ?? '',
        info?.get_executable?.() ?? '',
        ...(info?.get_keywords?.() ?? []),
        app.get_id() ?? '',
    ].join(' ').toLowerCase();
    if (extra.includes(q)) return 250;

    return subsequenceScore(q, name);
}

// ── Launcher overlay ─────────────────────────────────────────────────────────
class Launcher {
    constructor(settings) {
        this._settings = settings;
        this._appSystem = Shell.AppSystem.get_default();
        this._usage = Shell.AppUsage.get_default();
        this._grab = null;
        this._results = [];
        this._rows = [];
        this._sel = 0;

        // Full-screen dim backdrop: click outside the panel closes
        this._backdrop = new St.Widget({
            style_class: 'launcher-backdrop',
            reactive: true,
            visible: false,
            layout_manager: new Clutter.FixedLayout(),
        });
        this._backdrop.connect('button-press-event', (_a, ev) => {
            const [x, y] = ev.get_coords();
            const [px, py] = this._panel.get_transformed_position();
            const [pw, ph] = this._panel.get_transformed_size();
            if (x < px || x > px + pw || y < py || y > py + ph) {
                this.close();
                return Clutter.EVENT_STOP;
            }
            // Inside the panel: let the click through. Stopping it here would cancel
            // the result rows' click gestures (GNOME 50) — that's why only Enter worked.
            return Clutter.EVENT_PROPAGATE;
        });

        this._panel = new St.BoxLayout({
            style_class: 'launcher-panel',
            orientation: Clutter.Orientation.VERTICAL,
            width: PANEL_WIDTH,
        });
        this._backdrop.add_child(this._panel);

        // Search bar
        const bar = new St.BoxLayout({style_class: 'launcher-bar'});
        bar.add_child(new St.Icon({icon_name: 'system-search-symbolic', style_class: 'launcher-search-icon'}));
        this._entry = new St.Entry({
            style_class: 'launcher-entry',
            hint_text: 'Search apps…',
            can_focus: true,
            x_expand: true,
        });
        bar.add_child(this._entry);
        this._panel.add_child(bar);

        this._list = new St.BoxLayout({
            style_class: 'launcher-list',
            orientation: Clutter.Orientation.VERTICAL,
        });
        this._panel.add_child(this._list);

        this._empty = new St.Label({style_class: 'launcher-empty', text: 'No matching apps', visible: false});
        this._panel.add_child(this._empty);

        const text = this._entry.clutter_text;
        text.connect('text-changed', () => this._search());
        text.connect('key-press-event', (_a, ev) => this._onKey(ev));

        Main.layoutManager.addTopChrome(this._backdrop);
    }

    get isOpen() {
        return this._backdrop.visible;
    }

    toggle() {
        this.isOpen ? this.close() : this.open();
    }

    open() {
        if (Main.overview.visible)
            Main.overview.hide();

        const mon = Main.layoutManager.currentMonitor ?? Main.layoutManager.primaryMonitor;
        this._backdrop.set_position(mon.x, mon.y);
        this._backdrop.set_size(mon.width, mon.height);
        const width = Math.min(Math.round(PANEL_WIDTH * this._settings.get_double('scale')), mon.width - 32);
        this._panel.width = width;
        this._panel.set_position(Math.round((mon.width - width) / 2), Math.round(mon.height * 0.22));

        this._forceNew = false;
        this._entry.text = '';
        this._search();

        this._backdrop.opacity = 0;
        this._backdrop.show();
        this._backdrop.ease({opacity: 255, duration: 120, mode: Clutter.AnimationMode.EASE_OUT_QUAD});

        this._grab = Main.pushModal(this._backdrop, {actionMode: Shell.ActionMode.SYSTEM_MODAL});
        // GNOME 50 dropped Grab.get_seat_state(); only check when the API exists
        const seatState = this._grab?.get_seat_state?.() ?? this._grab?.seat_state;
        if (seatState !== undefined && (seatState & Clutter.GrabState.KEYBOARD) === 0) {
            // another grab is active (e.g. a menu) — bail out cleanly
            this.close();
            return;
        }
        // Focus the search field now, and again once GNOME has finished handling the
        // Super+Space press (otherwise the shell can steal the key focus back).
        this._focusEntry();
        this._clearFocusTimers();
        this._focusIdle = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            this._focusIdle = 0;
            this._focusEntry();
            return GLib.SOURCE_REMOVE;
        });
        this._focusTimeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 80, () => {
            this._focusTimeout = 0;
            this._focusEntry();
            return GLib.SOURCE_REMOVE;
        });
    }

    _focusEntry() {
        if (!this.isOpen)
            return;
        global.stage.set_key_focus(this._entry.clutter_text);
        this._entry.clutter_text.set_cursor_visible(true);
    }

    _clearFocusTimers() {
        if (this._focusIdle)
            GLib.source_remove(this._focusIdle);
        if (this._focusTimeout)
            GLib.source_remove(this._focusTimeout);
        this._focusIdle = this._focusTimeout = 0;
    }

    close() {
        this._clearFocusTimers();
        if (this._grab) {
            Main.popModal(this._grab);
            this._grab = null;
        }
        this._backdrop.hide();
    }

    _search() {
        const q = this._entry.text.trim().toLowerCase();
        const max = this._settings.get_int('max-results');
        let apps;

        if (!q) {
            apps = this._usage.get_most_used().filter(a => a.get_app_info()?.should_show());
            if (apps.length < max) {
                const seen = new Set(apps.map(a => a.get_id()));
                const rest = this._appSystem.get_installed()
                    .filter(i => i.should_show() && !seen.has(i.get_id()))
                    .map(i => this._appSystem.lookup_app(i.get_id()))
                    .filter(Boolean)
                    .sort((a, b) => a.get_name().localeCompare(b.get_name()));
                apps = apps.concat(rest);
            }
        } else {
            apps = this._appSystem.get_installed()
                .filter(i => i.should_show())
                .map(i => this._appSystem.lookup_app(i.get_id()))
                .filter(Boolean)
                .map(app => ({app, score: scoreApp(q, app)}))
                .filter(r => r.score > 0)
                .sort((a, b) => b.score - a.score ||
                    this._usage.compare(a.app.get_id(), b.app.get_id()) ||
                    a.app.get_name().localeCompare(b.app.get_name()))
                .map(r => r.app);
        }

        this._results = apps.slice(0, max);
        this._renderRows();
        this._select(0);
    }

    _renderRows() {
        this._list.destroy_all_children();
        this._rows = this._results.map((app, i) => {
            const row = new St.BoxLayout({
                style_class: 'launcher-row',
                x_expand: true,
                reactive: true,
                track_hover: true,
            });
            const box = new St.BoxLayout({style_class: 'launcher-row-box', x_expand: true});
            box.add_child(app.create_icon_texture(Math.round(ICON_SIZE * this._settings.get_double('scale'))));

            const texts = new St.BoxLayout({
                orientation: Clutter.Orientation.VERTICAL,
                y_align: Clutter.ActorAlign.CENTER,
                x_expand: true,
            });
            texts.add_child(new St.Label({style_class: 'launcher-name', text: app.get_name()}));
            const desc = app.get_description();
            if (desc)
                texts.add_child(new St.Label({style_class: 'launcher-desc', text: desc}));
            box.add_child(texts);

            if (app.get_state() === Shell.AppState.RUNNING)
                box.add_child(new St.Label({style_class: 'launcher-badge', text: 'running', y_align: Clutter.ActorAlign.CENTER}));

            row.add_child(box);
            const click = new Clutter.ClickGesture({required_button: Clutter.BUTTON_PRIMARY});
            click.connect('recognize', () => {
                this._forceNew = false;
                this._launch(i);
            });
            row.add_action(click);
            row.connect('notify::hover', () => row.hover && this._select(i));
            this._list.add_child(row);
            return row;
        });
        this._empty.visible = this._results.length === 0;
    }

    _select(i) {
        if (!this._rows.length)
            return;
        this._sel = (i + this._rows.length) % this._rows.length;
        this._rows.forEach((r, j) =>
            j === this._sel ? r.add_style_pseudo_class('selected') : r.remove_style_pseudo_class('selected'));
    }

    _onKey(ev) {
        const sym = ev.get_key_symbol();
        const state = ev.get_state();
        const ctrl = (state & Clutter.ModifierType.CONTROL_MASK) !== 0;
        const superKey = (state & (Clutter.ModifierType.SUPER_MASK | Clutter.ModifierType.MOD4_MASK)) !== 0;
        this._forceNew = ctrl;
        switch (sym) {
        case Clutter.KEY_space:
            if (superKey) { // Super+Space again closes it
                this.close();
                return Clutter.EVENT_STOP;
            }
            break;
        case Clutter.KEY_Return:
            this._launch(this._sel);
            return Clutter.EVENT_STOP;
        case Clutter.KEY_Escape:
            this.close();
            return Clutter.EVENT_STOP;
        case Clutter.KEY_Down:
        case Clutter.KEY_Tab:
            this._select(this._sel + 1);
            return Clutter.EVENT_STOP;
        case Clutter.KEY_Up:
        case Clutter.KEY_ISO_Left_Tab:
            this._select(this._sel - 1);
            return Clutter.EVENT_STOP;
        case Clutter.KEY_j:
        case Clutter.KEY_n:
            if (ctrl) {
                this._select(this._sel + 1);
                return Clutter.EVENT_STOP;
            }
            break;
        case Clutter.KEY_k:
        case Clutter.KEY_p:
            if (ctrl) {
                this._select(this._sel - 1);
                return Clutter.EVENT_STOP;
            }
            break;
        case Clutter.KEY_KP_Enter:
            this._launch(this._sel);
            return Clutter.EVENT_STOP;
        }
        return Clutter.EVENT_PROPAGATE;
    }

    _launch(i) {
        const app = this._results[i];
        this.close();
        // Enter: launch, or focus if already running.  Ctrl+Enter: always a new window.
        if (!app)
            return;
        if (this._forceNew && app.can_open_new_window())
            app.open_new_window(-1);
        else
            app.activate();
    }

    destroy() {
        this.close();
        Main.layoutManager.removeChrome(this._backdrop);
        this._backdrop.destroy();
    }
}

export default class LauncherExtension extends Extension {
    enable() {
        this._theme = new ThemeManager(this, themeCss);
        this._theme.enable();
        this._settings = this.getSettings();
        this._launcher = new Launcher(this._settings);
        Main.wm.addKeybinding('toggle-launcher', this._settings,
            Meta.KeyBindingFlags.IGNORE_AUTOREPEAT,
            Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW,
            () => this._launcher.toggle());
    }

    disable() {
        this._theme?.destroy();
        this._theme = null;
        Main.wm.removeKeybinding('toggle-launcher');
        this._launcher?.destroy();
        this._launcher = null;
        this._settings = null;
    }
}
