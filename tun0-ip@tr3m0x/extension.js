import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

// Interfaces to watch: tun0, tun1, tun2, ...  (e.g. /^(tun|wg)\d+$/ to add WireGuard)
const IFACE_RE = /^tun\d+$/;
const INTERVAL_S = 3;
const SCROLL_COOLDOWN_MS = 200;

const TunIndicator = GObject.registerClass(
class TunIndicator extends PanelMenu.Button {
    _init() {
        super._init(0.0, 'tun IP', false);
        this._tuns = [];        // [{iface, ip}] sorted by name
        this._selected = null;  // iface name the user picked
        this._lastScroll = 0;
        this._listKey = '';

        const box = new St.BoxLayout({style_class: 'panel-status-menu-box'});
        box.add_child(new St.Icon({
            icon_name: 'network-vpn-symbolic',
            style_class: 'system-status-icon',
        }));
        this._label = new St.Label({
            text: 'tun: …',
            y_align: Clutter.ActorAlign.CENTER,
        });
        box.add_child(this._label);
        this.add_child(box);

        this._refresh();
        this._timer = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, INTERVAL_S, () => {
            this._refresh();
            return GLib.SOURCE_CONTINUE;
        });
    }

    // Left click = copy, right/middle click = menu, scroll = cycle tuns
    vfunc_event(event) {
        const type = event.type();
        if (type === Clutter.EventType.BUTTON_PRESS) {
            if (event.get_button() === Clutter.BUTTON_PRIMARY) {
                this.menu.close();
                this._copy();
            } else {
                this.menu.toggle();
            }
            return Clutter.EVENT_STOP;
        }
        if (type === Clutter.EventType.TOUCH_BEGIN) {
            this._copy();
            return Clutter.EVENT_STOP;
        }
        if (type === Clutter.EventType.SCROLL) {
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
        if (!step || this._tuns.length < 2)
            return;

        const now = GLib.get_monotonic_time() / 1000;
        if (now - this._lastScroll < SCROLL_COOLDOWN_MS)
            return;
        this._lastScroll = now;

        let i = this._tuns.findIndex(t => t.iface === this._current()?.iface);
        i = (i + step + this._tuns.length) % this._tuns.length;
        this._selected = this._tuns[i].iface;
        this._updateLabel();
    }

    _refresh() {
        let proc;
        try {
            proc = Gio.Subprocess.new(['ip', '-4', '-o', 'addr', 'show'],
                Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_SILENCE);
        } catch (e) {
            this._setTuns([]);
            return;
        }
        proc.communicate_utf8_async(null, null, (p, res) => {
            let tuns = [];
            try {
                const [, out] = p.communicate_utf8_finish(res);
                const seen = new Set();
                for (const line of (out || '').split('\n')) {
                    // "26: tun0    inet 192.168.146.167/18 brd ..."
                    const m = line.match(/^\d+:\s+(\S+?)\s+inet\s+(\d+\.\d+\.\d+\.\d+)/);
                    if (m && IFACE_RE.test(m[1]) && !seen.has(m[1])) {
                        seen.add(m[1]);
                        tuns.push({iface: m[1], ip: m[2]});
                    }
                }
                tuns.sort((a, b) => a.iface.localeCompare(b.iface, undefined, {numeric: true}));
            } catch (e) {
                tuns = [];
            }
            this._setTuns(tuns);
        });
    }

    _setTuns(tuns) {
        if (!this._label)
            return;
        this._tuns = tuns;
        const key = tuns.map(t => `${t.iface}=${t.ip}`).join(',');
        if (key !== this._listKey) {
            this._listKey = key;
            this._rebuildMenu();
        }
        this._updateLabel();
    }

    // Selected tun if still up, else the first active one
    _current() {
        return this._tuns.find(t => t.iface === this._selected) ?? this._tuns[0] ?? null;
    }

    _updateLabel() {
        const cur = this._current();
        if (!cur) {
            this._label.text = 'tun: down';
            this.opacity = 128;
        } else {
            this._label.text = this._tuns.length > 1
                ? `${cur.iface} ${cur.ip}  ${this._tuns.indexOf(cur) + 1}/${this._tuns.length}`
                : cur.ip;
            this.opacity = 255;
        }
        this._menuItems?.forEach((item, iface) =>
            item.setOrnament(cur?.iface === iface ? PopupMenu.Ornament.CHECK : PopupMenu.Ornament.NONE));
    }

    _rebuildMenu() {
        this.menu.removeAll();
        this._menuItems = new Map();
        if (!this._tuns.length) {
            const item = new PopupMenu.PopupMenuItem('No active tun interfaces', {reactive: false});
            this.menu.addMenuItem(item);
            return;
        }
        for (const t of this._tuns) {
            const item = new PopupMenu.PopupMenuItem(`${t.iface}    ${t.ip}`);
            item.connect('activate', () => {
                this._selected = t.iface;
                this._updateLabel();
                this._copy();
            });
            this._menuItems.set(t.iface, item);
            this.menu.addMenuItem(item);
        }
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        const hint = new PopupMenu.PopupMenuItem('Left-click: copy · Scroll: switch', {reactive: false});
        this.menu.addMenuItem(hint);
    }

    _copy() {
        const cur = this._current();
        if (!cur)
            return;
        const cb = St.Clipboard.get_default();
        cb.set_text(St.ClipboardType.CLIPBOARD, cur.ip);
        cb.set_text(St.ClipboardType.PRIMARY, cur.ip);
        Main.notify(`${cur.iface} IP`, `${cur.ip} copied to clipboard`);
    }

    destroy() {
        if (this._timer) {
            GLib.source_remove(this._timer);
            this._timer = null;
        }
        this._label = null;
        this._menuItems = null;
        super.destroy();
    }
});

export default class TunIpExtension extends Extension {
    enable() {
        this._indicator = new TunIndicator();
        Main.panel.addToStatusArea(this.uuid, this._indicator, 0, 'right');
    }

    disable() {
        this._indicator?.destroy();
        this._indicator = null;
    }
}
