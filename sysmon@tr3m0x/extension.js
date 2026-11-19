import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import {ThemeManager} from './theme.js';
import themeCss from './themeCss.js';

const decoder = new TextDecoder();
const GiB = 1024 ** 3;

// Nerd Font glyphs (JetBrainsMono Nerd Font): nf-oct-cpu, nf-md-memory, nf-md-harddisk
const ICONS = {cpu: '\u{f4bc}', mem: '\u{f035b}', disk: '\u{f02ca}'};
const WORDS = {cpu: 'CPU', mem: 'RAM', disk: 'DISK'};

function readFile(path) {
    try {
        const [ok, bytes] = GLib.file_get_contents(path);
        return ok ? decoder.decode(bytes) : '';
    } catch (e) {
        return '';
    }
}

function fmtG(bytes) {
    const g = bytes / GiB;
    return g >= 10 ? g.toFixed(0) : g.toFixed(1); // 3.6, 22, 476
}

const SysMonIndicator = GObject.registerClass(
class SysMonIndicator extends PanelMenu.Button {
    _init(ext) {
        super._init(0.5, 'SysMon', false);
        this._ext = ext;
        this._settings = ext.getSettings();
        this._prevCpu = null;

        this.add_style_class_name('sysmon-button');

        // [ CPU 12% │ RAM 3.6 / 22Gi │ DISK 51G free ]  — styled in stylesheet.css
        const pill = new St.BoxLayout({style_class: 'sysmon-pill', y_align: Clutter.ActorAlign.CENTER});
        this._items = {};
        this._seps = [];
        ['cpu', 'mem', 'disk'].forEach((key, i) => {
            if (i > 0) {
                const sep = new St.Widget({style_class: 'sysmon-sep', y_expand: true});
                this._seps.push(sep);
                pill.add_child(sep);
            }
            const item = new St.BoxLayout({style_class: `sysmon-item sysmon-${key}`});
            const mk = cls => {
                const l = new St.Label({style_class: cls, y_align: Clutter.ActorAlign.CENTER});
                item.add_child(l);
                return l;
            };
            this._items[key] = {box: item, icon: mk('sysmon-icon'), value: mk('sysmon-value'), unit: mk('sysmon-unit')};
            pill.add_child(item);
        });
        this._label = this._items.cpu.value; // "alive" marker used by _update/destroy
        this.add_child(pill);

        this._buildMenu();
        this._update();
        this._startTimer();

        this._settingsIds = [
            this._settings.connect('changed::interval', () => this._startTimer()),
            ...['show-cpu', 'show-mem', 'show-disk', 'disk-path', 'disk-format', 'show-icons'].map(k =>
                this._settings.connect(`changed::${k}`, () => this._update())),
        ];
    }

    _buildMenu() {
        this._details = new PopupMenu.PopupMenuItem('', {reactive: false});
        this._details.label.add_style_class_name('sysmon-details');
        this.menu.addMenuItem(this._details);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        const move = new PopupMenu.PopupSubMenuMenuItem('Move to');
        for (const [box, name] of [['left', 'Left'], ['center', 'Center'], ['right', 'Right']]) {
            move.menu.addAction(name, () => this._settings.set_string('panel-box', box));
        }
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

    _startTimer() {
        if (this._timer)
            GLib.source_remove(this._timer);
        this._timer = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT,
            this._settings.get_int('interval'), () => {
                this._update();
                return GLib.SOURCE_CONTINUE;
            });
    }

    _cpu() {
        const line = readFile('/proc/stat').split('\n')[0]; // "cpu  user nice system idle iowait irq softirq steal"
        const v = line.trim().split(/\s+/).slice(1, 9).map(Number);
        if (v.length < 4)
            return null;
        const idle = v[3] + (v[4] || 0);
        const total = v.reduce((a, b) => a + b, 0);
        const prev = this._prevCpu;
        this._prevCpu = {idle, total};
        if (!prev || total === prev.total)
            return null;
        return 100 * (1 - (idle - prev.idle) / (total - prev.total));
    }

    _mem() {
        const txt = readFile('/proc/meminfo');
        const get = k => Number((txt.match(new RegExp(`^${k}:\\s+(\\d+)`, 'm')) || [])[1]) * 1024;
        const total = get('MemTotal');
        const avail = get('MemAvailable');
        if (!total)
            return null;
        return {used: total - avail, total};
    }

    _disk() {
        try {
            const info = Gio.File.new_for_path(this._settings.get_string('disk-path'))
                .query_filesystem_info('filesystem::size,filesystem::free', null);
            const total = info.get_attribute_uint64('filesystem::size');
            const free = info.get_attribute_uint64('filesystem::free');
            return total ? {used: total - free, total} : null;
        } catch (e) {
            return null;
        }
    }

    _update() {
        if (!this._label)
            return;
        const s = this._settings;
        const icons = s.get_boolean('show-icons');
        const details = [];

        // Sets icon/word, value, unit, and colors the value by load (>70% yellow, >90% red)
        const set = (key, value, unit, pct) => {
            const it = this._items[key];
            it.icon.text = icons ? ICONS[key] : WORDS[key];
            it.icon.style_class = icons ? 'sysmon-icon' : 'sysmon-word';
            it.value.text = value;
            it.unit.text = unit;
            it.unit.visible = unit !== '';
            it.value.style_class = 'sysmon-value' +
                (pct > 90 ? ' sysmon-crit' : pct > 70 ? ' sysmon-warn' : '');
        };

        const cpu = this._cpu();
        set('cpu', cpu === null ? '--' : `${cpu.toFixed(0)}%`, '', cpu ?? 0);
        if (cpu !== null)
            details.push(`${ICONS.cpu}  CPU     ${cpu.toFixed(1)}%`);

        const mem = this._mem();
        if (mem) {
            const pct = 100 * mem.used / mem.total;
            set('mem', `${fmtG(mem.used)} / ${fmtG(mem.total)}`, 'Gi', pct);
            details.push(`${ICONS.mem}  Memory  ${fmtG(mem.used)} / ${fmtG(mem.total)} GiB  (${pct.toFixed(0)}%)`);
        } else {
            set('mem', '--', '', 0);
        }

        const disk = this._disk();
        if (disk) {
            const free = disk.total - disk.used;
            const pct = 100 * disk.used / disk.total;
            if (s.get_string('disk-format') === 'free')
                set('disk', `${fmtG(free)}G`, 'free', pct);
            else
                set('disk', `${fmtG(disk.used)} / ${fmtG(disk.total)}`, 'G', pct);
            details.push(`${ICONS.disk}  Disk    ${fmtG(disk.used)} / ${fmtG(disk.total)} GiB  (${pct.toFixed(0)}%)  ·  ${fmtG(free)} GiB free on ${s.get_string('disk-path')}`);
        } else {
            set('disk', '--', '', 0);
        }

        // Visibility: hide disabled items and any divider that isn't between two visible items
        const vis = ['cpu', 'mem', 'disk'].map(k => s.get_boolean(`show-${k}`));
        ['cpu', 'mem', 'disk'].forEach((k, i) => (this._items[k].box.visible = vis[i]));
        this._seps[0].visible = vis[0] && (vis[1] || vis[2]);
        this._seps[1].visible = vis[1] && vis[2];
        if (!vis.some(Boolean))
            this._items.cpu.box.visible = true;
        this._details.label.text = details.join('\n');
    }

    destroy() {
        if (this._timer) {
            GLib.source_remove(this._timer);
            this._timer = null;
        }
        this._settingsIds?.forEach(id => this._settings.disconnect(id));
        this._settingsIds = null;
        this._label = null;
        super.destroy();
    }
});

export default class SysMonExtension extends Extension {
    enable() {
        this._theme = new ThemeManager(this, themeCss);
        this._theme.enable();
        this._settings = this.getSettings();
        this._posIds = ['panel-box', 'panel-index'].map(k =>
            this._settings.connect(`changed::${k}`, () => this._place()));
        this._place();
    }

    // (Re)create the indicator at the configured panel position
    _place() {
        this._indicator?.destroy();
        Main.panel.statusArea[this.uuid]?.destroy(); // leftover from a racing enable
        this._indicator = new SysMonIndicator(this);
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
