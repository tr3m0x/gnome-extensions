import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import Meta from 'gi://Meta';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as ModalDialog from 'resource:///org/gnome/shell/ui/modalDialog.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import {ThemeManager} from './theme.js';
import themeCss from './themeCss.js';

const SCROLL_COOLDOWN_MS = 200;
const MAX_DOTS = 3;

// Workspace names live in GNOME's own setting, so other tools see them too
const wmPrefs = () => new Gio.Settings({schema_id: 'org.gnome.desktop.wm.preferences'});

function getNames(prefs) {
    return prefs.get_strv('workspace-names');
}

function setName(prefs, index, name) {
    const names = getNames(prefs);
    while (names.length <= index)
        names.push('');
    names[index] = name;
    while (names.length && !names[names.length - 1])
        names.pop();
    prefs.set_strv('workspace-names', names);
}

// Real app windows on a workspace (skip desktop icons, sticky windows, etc.)
function appWindows(ws) {
    return ws.list_windows().filter(w =>
        !w.skip_taskbar &&
        !w.is_on_all_workspaces() &&
        w.get_window_type() === Meta.WindowType.NORMAL);
}

// ── Rename dialog ─────────────────────────────────────────────────────────────
const RenameDialog = GObject.registerClass(
class RenameDialog extends ModalDialog.ModalDialog {
    _init(index, current, onSave) {
        super._init({styleClass: 'ws-rename-dialog'});
        this._onSave = onSave;

        const box = new St.BoxLayout({orientation: Clutter.Orientation.VERTICAL, style_class: 'ws-rename-box'});
        box.add_child(new St.Label({style_class: 'ws-rename-title', text: `Rename workspace ${index + 1}`}));
        box.add_child(new St.Label({style_class: 'ws-rename-hint', text: 'Leave empty to remove the name'}));
        this._entry = new St.Entry({style_class: 'ws-rename-entry', text: current, can_focus: true, hint_text: 'e.g. web, code, htb'});
        box.add_child(this._entry);
        this.contentLayout.add_child(box);

        this._entry.clutter_text.connect('activate', () => this._save());
        this.setButtons([
            {label: 'Cancel', action: () => this.close(), key: Clutter.KEY_Escape},
            {label: 'Save', action: () => this._save(), default: true},
        ]);
        this.setInitialKeyFocus(this._entry.clutter_text);
        this._entry.clutter_text.set_selection(0, -1);
    }

    _save() {
        this._onSave(this._entry.text.trim());
        this.close();
    }
});

// ── Panel indicator ──────────────────────────────────────────────────────────
const WorkspacesIndicator = GObject.registerClass(
class WorkspacesIndicator extends PanelMenu.Button {
    _init(ext) {
        super._init(0.0, 'Workspaces', false);
        this._ext = ext;
        this._settings = ext.getSettings();
        this._wmPrefs = wmPrefs();
        this._wsm = global.workspace_manager;
        this._wsSignals = [];
        this._lastScroll = 0;
        this.add_style_class_name('ws-button');

        this._pill = new St.BoxLayout({style_class: 'ws-pill', y_align: Clutter.ActorAlign.CENTER});
        this.add_child(this._pill);

        this._signals = [
            [this._wsm, this._wsm.connect('active-workspace-changed', () => this._refresh())],
            [this._wsm, this._wsm.connect('notify::n-workspaces', () => this._rebuild())],
            [this._wsm, this._wsm.connect('workspaces-reordered', () => this._rebuild())],
            [this._wmPrefs, this._wmPrefs.connect('changed::workspace-names', () => this._refresh())],
            [global.display, global.display.connect('window-created', () => this._queueRefresh())],
            [global.display, global.display.connect('notify::focus-window', () => this._refresh())],
            ...['show-names', 'show-empty', 'show-dots'].map(k =>
                [this._settings, this._settings.connect(`changed::${k}`, () => this._refresh())]),
        ];

        // GNOME 50: PanelMenu.Button opens its menu through a press gesture on the
        // whole button, which would swallow clicks on the workspace chips. Turn it
        // off — each chip has its own left/right click gestures instead.
        this._clickGesture?.set_enabled(false);

        this._rebuild();
    }

    // Scroll anywhere on the bar = switch workspace
    vfunc_event(event) {
        if (event.type() === Clutter.EventType.SCROLL) {
            this._onScroll(event);
            return Clutter.EVENT_STOP;
        }
        return Clutter.EVENT_PROPAGATE;
    }

    _onScroll(event) {
        let step = 0;
        const dir = event.get_scroll_direction();
        if (dir === Clutter.ScrollDirection.UP || dir === Clutter.ScrollDirection.LEFT)
            step = -1;
        else if (dir === Clutter.ScrollDirection.DOWN || dir === Clutter.ScrollDirection.RIGHT)
            step = 1;
        else if (dir === Clutter.ScrollDirection.SMOOTH) {
            const [dx, dy] = event.get_scroll_delta();
            const d = Math.abs(dy) >= Math.abs(dx) ? dy : dx;
            if (Math.abs(d) < 0.3)
                return;
            step = d > 0 ? 1 : -1;
        }
        if (!step)
            return;
        const now = GLib.get_monotonic_time() / 1000;
        if (now - this._lastScroll < SCROLL_COOLDOWN_MS)
            return;
        this._lastScroll = now;

        const n = this._wsm.get_n_workspaces();
        let i = this._wsm.get_active_workspace_index() + step;
        if (this._settings.get_boolean('scroll-wrap'))
            i = (i + n) % n;
        else
            i = Math.max(0, Math.min(n - 1, i));
        this._activate(i);
    }

    _activate(i) {
        const ws = this._wsm.get_workspace_by_index(i);
        ws?.activate(global.get_current_time());
    }

    // (Re)create one button per workspace and watch each workspace's windows
    _rebuild() {
        this._wsSignals.forEach(([ws, id]) => ws.disconnect(id));
        this._wsSignals = [];
        this._pill.destroy_all_children();
        this._buttons = [];

        const n = this._wsm.get_n_workspaces();
        for (let i = 0; i < n; i++) {
            const ws = this._wsm.get_workspace_by_index(i);
            this._wsSignals.push(
                [ws, ws.connect('window-added', () => this._queueRefresh())],
                [ws, ws.connect('window-removed', () => this._queueRefresh())]);

            const btn = new St.BoxLayout({
                style_class: 'ws-ws',
                reactive: true,
                track_hover: true,
                y_align: Clutter.ActorAlign.CENTER,
            });
            // centred inside the chip: a single digit is narrower than the chip's
            // min-width, and left-aligned it made the active pill lopsided
            const box = new St.BoxLayout({
                style_class: 'ws-ws-box',
                x_expand: true,
                x_align: Clutter.ActorAlign.CENTER,
                y_align: Clutter.ActorAlign.CENTER,
            });
            const num = new St.Label({
                style_class: 'ws-num',
                text: `${i + 1}`,
                x_align: Clutter.ActorAlign.CENTER,
                y_align: Clutter.ActorAlign.CENTER,
            });
            const name = new St.Label({style_class: 'ws-name', y_align: Clutter.ActorAlign.CENTER});
            const dots = new St.Label({style_class: 'ws-dots', y_align: Clutter.ActorAlign.CENTER});
            box.add_child(num);
            box.add_child(name);
            box.add_child(dots);
            btn.add_child(box);

            // Left click: switch (or Overview on the active one)
            const leftClick = new Clutter.ClickGesture({required_button: Clutter.BUTTON_PRIMARY});
            leftClick.connect('recognize', () => {
                if (i === this._wsm.get_active_workspace_index() &&
                    this._settings.get_boolean('active-toggles-overview'))
                    Main.overview.toggle();
                else
                    this._activate(i);
            });
            btn.add_action(leftClick);

            // Right click: menu for this workspace
            const rightClick = new Clutter.ClickGesture({required_button: Clutter.BUTTON_SECONDARY});
            rightClick.set_recognize_on_press(true);
            rightClick.connect('recognize', () => {
                this._buildMenu(i);
                this.menu.toggle();
            });
            btn.add_action(rightClick);

            this._pill.add_child(btn);
            this._buttons.push({btn, name, dots});
        }
        this._refresh();
    }

    _queueRefresh() {
        if (this._refreshId)
            return;
        this._refreshId = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            this._refreshId = 0;
            this._refresh();
            return GLib.SOURCE_REMOVE;
        });
    }

    _refresh() {
        if (!this._buttons)
            return;
        const active = this._wsm.get_active_workspace_index();
        const names = getNames(this._wmPrefs);
        const showNames = this._settings.get_boolean('show-names');
        const showEmpty = this._settings.get_boolean('show-empty');
        const showDots = this._settings.get_boolean('show-dots');

        this._buttons.forEach(({btn, name, dots}, i) => {
            const ws = this._wsm.get_workspace_by_index(i);
            const count = ws ? appWindows(ws).length : 0;
            const isActive = i === active;

            btn.style_class = 'ws-ws' + (isActive ? ' ws-active' : count ? ' ws-occupied' : ' ws-empty');
            btn.visible = isActive || count > 0 || showEmpty;

            const label = names[i] ?? '';
            name.text = label;
            name.visible = showNames && label !== '';

            dots.text = '•'.repeat(Math.min(count, MAX_DOTS));
            dots.visible = showDots && count > 0;
        });
    }

    _buildMenu(index) {
        this.menu.removeAll();
        const current = getNames(this._wmPrefs)[index] ?? '';

        const header = new PopupMenu.PopupMenuItem(
            current ? `Workspace ${index + 1}  ·  ${current}` : `Workspace ${index + 1}`, {reactive: false});
        header.label.add_style_class_name('ws-menu-title');
        this.menu.addMenuItem(header);

        this.menu.addAction('Rename…', () => {
            new RenameDialog(index, current, n => setName(this._wmPrefs, index, n)).open();
        });
        if (current)
            this.menu.addAction('Clear name', () => setName(this._wmPrefs, index, ''));
        if (index !== this._wsm.get_active_workspace_index())
            this.menu.addAction('Go to workspace', () => this._activate(index));

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        const move = new PopupMenu.PopupSubMenuMenuItem('Move bar to');
        for (const [box, label] of [['left', 'Left'], ['center', 'Center'], ['right', 'Right']])
            move.menu.addAction(label, () => this._settings.set_string('panel-box', box));
        move.menu.addAction('◀ Shift left', () =>
            this._settings.set_int('panel-index', Math.max(0, this._settings.get_int('panel-index') - 1)));
        move.menu.addAction('Shift right ▶', () =>
            this._settings.set_int('panel-index', Math.min(20, this._settings.get_int('panel-index') + 1)));
        this.menu.addMenuItem(move);

        const sizeMenu = new PopupMenu.PopupSubMenuMenuItem('Size');
        const bump = d => this._settings.set_double('scale',
            Math.round(Math.min(1.6, Math.max(0.6, this._settings.get_double('scale') + d)) * 100) / 100);
        sizeMenu.menu.addAction('Larger  (+10%)', () => bump(0.1));
        sizeMenu.menu.addAction('Smaller  (−10%)', () => bump(-0.1));
        sizeMenu.menu.addAction('Reset  (100%)', () => this._settings.reset('scale'));
        this.menu.addMenuItem(sizeMenu);
        this.menu.addAction('Settings…', () => this._ext.openPreferences());
    }

    destroy() {
        if (this._refreshId) {
            GLib.source_remove(this._refreshId);
            this._refreshId = 0;
        }
        this._signals?.forEach(([obj, id]) => obj.disconnect(id));
        this._wsSignals?.forEach(([ws, id]) => ws.disconnect(id));
        this._signals = this._wsSignals = null;
        this._buttons = null;
        super.destroy();
    }
});

export default class WorkspacesExtension extends Extension {
    enable() {
        this._theme = new ThemeManager(this, themeCss);
        this._theme.enable();
        this._settings = this.getSettings();
        this._posIds = ['panel-box', 'panel-index'].map(k =>
            this._settings.connect(`changed::${k}`, () => this._place()));
        this._place();
    }

    _place() {
        this._indicator?.destroy();
        Main.panel.statusArea[this.uuid]?.destroy(); // leftover from a racing enable
        this._indicator = new WorkspacesIndicator(this);
        Main.panel.addToStatusArea(this.uuid, this._indicator,
            this._settings.get_int('panel-index'),
            this._settings.get_string('panel-box'));
    }

    disable() {
        this._theme?.destroy();
        this._theme = null;
        this._posIds?.forEach(id => this._settings.disconnect(id));
        this._posIds = null;
        this._indicator?.destroy();
        this._indicator = null;
        this._settings = null;
    }
}
