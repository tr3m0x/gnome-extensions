import GLib from 'gi://GLib';
import Soup from 'gi://Soup?version=3.0';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import {ThemeManager} from './theme.js';
import themeCss from './themeCss.js';

// Reads the Claude Code login (~/.claude/.credentials.json) and asks Anthropic's
// usage endpoint for the 5-hour / weekly limits. The token is only ever sent to
// api.anthropic.com and is never refreshed or modified here — Claude Code does that.
const USAGE_URL = 'https://api.anthropic.com/api/oauth/usage';
const CREDS = GLib.build_filenamev([GLib.get_home_dir(), '.claude', '.credentials.json']);
const PANEL_BAR_W = 40;   // px (logical)
const MENU_BAR_W = 260;
const TICK_S = 30;        // countdown refresh, no network

const decoder = new TextDecoder();

function readToken() {
    try {
        const [ok, bytes] = GLib.file_get_contents(CREDS);
        if (!ok)
            return {error: 'no-login'};
        const c = JSON.parse(decoder.decode(bytes)).claudeAiOauth;
        if (!c?.accessToken)
            return {error: 'no-login'};
        if (c.expiresAt && c.expiresAt < Date.now())
            return {error: 'expired', plan: c.subscriptionType};
        return {token: c.accessToken, plan: c.subscriptionType};
    } catch (e) {
        return {error: 'no-login'};
    }
}

function fmtLeft(iso) {
    if (!iso)
        return '';
    let m = Math.max(0, Math.round((new Date(iso) - Date.now()) / 60000));
    const d = Math.floor(m / 1440); m -= d * 1440;
    const h = Math.floor(m / 60); m -= h * 60;
    if (d) return `${d}d ${h}h`;
    if (h) return `${h}h ${String(m).padStart(2, '0')}m`;
    return `${m}m`;
}

function fmtWhen(iso) {
    if (!iso)
        return '';
    const dt = GLib.DateTime.new_from_iso8601(iso, null)?.to_local();
    if (!dt)
        return '';
    const sameDay = dt.format('%F') === GLib.DateTime.new_now_local().format('%F');
    return sameDay ? dt.format('today %H:%M') : dt.format('%a %d %b, %H:%M');
}

function level(pct) {
    return pct >= 80 ? 'cu-crit' : pct >= 50 ? 'cu-warn' : 'cu-ok';
}

function scale() {
    return St.ThemeContext.get_for_stage(global.stage).scale_factor;
}

// A rounded track with a coloured fill
function makeBar(widthPx, extraClass) {
    const track = new St.Widget({
        style_class: `cu-track ${extraClass}`,
        width: widthPx * scale(),
        y_align: Clutter.ActorAlign.CENTER,
        layout_manager: new Clutter.FixedLayout(),
    });
    const fill = new St.Widget({style_class: 'cu-fill cu-ok'});
    track.add_child(fill);
    track._fill = fill;
    track._w = widthPx;
    return track;
}

function setBar(track, pct) {
    const w = Math.round(track._w * scale() * Math.min(100, Math.max(0, pct)) / 100);
    track._fill.set_width(w);
    track._fill.visible = w > 0;
    track._fill.style_class = `cu-fill ${level(pct)}`;
}

const UsageIndicator = GObject.registerClass(
class UsageIndicator extends PanelMenu.Button {
    _init(ext) {
        super._init(0.5, 'Claude Usage', false);
        this._ext = ext;
        this._settings = ext.getSettings();
        this._session = new Soup.Session({timeout: 15, user_agent: 'claude-usage-gnome/1.0'});
        this._data = null;
        this._error = null;
        this._fetchedAt = 0;
        this.add_style_class_name('cu-button');

        // ── Panel pill:  ✻  5h 28% ▰▰▱ 2h13m │ 7d 14% ▰▱▱
        const pill = new St.BoxLayout({style_class: 'cu-pill', y_align: Clutter.ActorAlign.CENTER});
        pill.add_child(new St.Label({style_class: 'cu-logo', text: '✻', y_align: Clutter.ActorAlign.CENTER}));

        const seg = (tag) => {
            const box = new St.BoxLayout({style_class: 'cu-seg'});
            const t = new St.Label({style_class: 'cu-tag', text: tag, y_align: Clutter.ActorAlign.CENTER});
            const v = new St.Label({style_class: 'cu-val', text: '--', y_align: Clutter.ActorAlign.CENTER});
            const bar = makeBar(PANEL_BAR_W, 'cu-track-panel');
            box.add_child(t);
            box.add_child(v);
            box.add_child(bar);
            pill.add_child(box);
            return {box, v, bar};
        };
        this._p5 = seg('5h');
        this._pReset = new St.Label({style_class: 'cu-reset', y_align: Clutter.ActorAlign.CENTER});
        this._p5.box.add_child(this._pReset);
        this._pSep = new St.Widget({style_class: 'cu-sep', y_expand: true});
        pill.add_child(this._pSep);
        this._p7 = seg('7d');
        this._pMsg = new St.Label({style_class: 'cu-msg', y_align: Clutter.ActorAlign.CENTER, visible: false});
        pill.add_child(this._pMsg);
        this.add_child(pill);

        this._buildMenu();
        this.menu.connect('open-state-changed', (_m, open) => {
            if (open && Date.now() - this._fetchedAt > 60_000)
                this._fetch();
        });

        this._settingsIds = [
            this._settings.connect('changed::interval', () => this._startTimers()),
            ...['show-bars', 'show-reset', 'show-weekly'].map(k =>
                this._settings.connect(`changed::${k}`, () => this._render())),
        ];

        this._render();
        this._fetch();
        this._startTimers();
    }

    // ── Dropdown card ────────────────────────────────────────────────────────
    _buildMenu() {
        this.menu.box.add_style_class_name('cu-menu');

        const header = new PopupMenu.PopupBaseMenuItem({reactive: false});
        const hbox = new St.BoxLayout({x_expand: true});
        hbox.add_child(new St.Label({style_class: 'cu-menu-logo', text: '✻'}));
        hbox.add_child(new St.Label({style_class: 'cu-menu-title', text: 'Claude usage', x_expand: true, y_align: Clutter.ActorAlign.CENTER}));
        this._mPlan = new St.Label({style_class: 'cu-plan', y_align: Clutter.ActorAlign.CENTER});
        hbox.add_child(this._mPlan);
        header.add_child(hbox);
        this.menu.addMenuItem(header);

        const block = (title) => {
            const item = new PopupMenu.PopupBaseMenuItem({reactive: false});
            const v = new St.BoxLayout({orientation: Clutter.Orientation.VERTICAL, x_expand: true, style_class: 'cu-block'});
            const top = new St.BoxLayout({x_expand: true});
            top.add_child(new St.Label({style_class: 'cu-block-title', text: title, x_expand: true}));
            const pct = new St.Label({style_class: 'cu-block-pct'});
            top.add_child(pct);
            const bar = makeBar(MENU_BAR_W, 'cu-track-menu');
            const sub = new St.Label({style_class: 'cu-block-sub'});
            v.add_child(top);
            v.add_child(bar);
            v.add_child(sub);
            item.add_child(v);
            this.menu.addMenuItem(item);
            return {pct, bar, sub};
        };
        this._m5 = block('Current session (5h)');
        this._m7 = block('Weekly limit');

        const bd = new PopupMenu.PopupBaseMenuItem({reactive: false});
        this._mBreak = new St.BoxLayout({orientation: Clutter.Orientation.VERTICAL, x_expand: true, style_class: 'cu-break'});
        bd.add_child(this._mBreak);
        this.menu.addMenuItem(bd);

        this._mStatus = new PopupMenu.PopupMenuItem('', {reactive: false});
        this._mStatus.label.add_style_class_name('cu-status');
        this.menu.addMenuItem(this._mStatus);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.menu.addAction('Refresh now', () => this._fetch());

        const move = new PopupMenu.PopupSubMenuMenuItem('Move to');
        for (const [box, name] of [['left', 'Left'], ['center', 'Center'], ['right', 'Right']])
            move.menu.addAction(name, () => this._settings.set_string('panel-box', box));
        move.menu.addAction('◀ Shift left', () =>
            this._settings.set_int('panel-index', Math.max(0, this._settings.get_int('panel-index') - 1)));
        move.menu.addAction('Shift right ▶', () =>
            this._settings.set_int('panel-index', Math.min(20, this._settings.get_int('panel-index') + 1)));
        this.menu.addMenuItem(move);
        this.menu.addAction('Settings…', () => this._ext.openPreferences());
    }

    _startTimers() {
        this._stopTimers();
        this._pollId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT,
            this._settings.get_int('interval') * 60, () => {
                this._fetch();
                return GLib.SOURCE_CONTINUE;
            });
        this._tickId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, TICK_S, () => {
            this._render();
            return GLib.SOURCE_CONTINUE;
        });
    }

    _stopTimers() {
        if (this._pollId) GLib.source_remove(this._pollId);
        if (this._tickId) GLib.source_remove(this._tickId);
        this._pollId = this._tickId = 0;
    }

    _fetch() {
        const cred = readToken();
        this._plan = cred.plan ?? this._plan;
        if (cred.error) {
            this._error = cred.error;
            this._render();
            return;
        }
        const msg = Soup.Message.new('GET', USAGE_URL);
        msg.request_headers.append('Authorization', `Bearer ${cred.token}`);
        msg.request_headers.append('anthropic-beta', 'oauth-2025-04-20');
        msg.request_headers.append('Accept', 'application/json');

        this._session.send_and_read_async(msg, GLib.PRIORITY_DEFAULT, null, (sess, res) => {
            if (!this._pSep) // destroyed meanwhile
                return;
            try {
                const bytes = sess.send_and_read_finish(res);
                const status = msg.get_status();
                if (status === 401 || status === 403) {
                    this._error = 'expired';
                } else if (status !== 200) {
                    this._error = `http-${status}`;
                } else {
                    this._data = JSON.parse(decoder.decode(bytes.get_data()));
                    this._error = null;
                    this._fetchedAt = Date.now();
                }
            } catch (e) {
                this._error = 'offline';
            }
            this._render();
        });
    }

    _render() {
        if (!this._pSep)
            return;
        const s = this._settings;
        const d = this._data;
        const f = d?.five_hour, w = d?.seven_day;
        const showBars = s.get_boolean('show-bars');
        const showWeekly = s.get_boolean('show-weekly');

        // Panel
        const hasData = !!(f || w);
        this._pMsg.visible = !hasData;
        this._p5.box.visible = hasData;
        this._p7.box.visible = hasData && showWeekly;
        this._pSep.visible = hasData && showWeekly;
        if (!hasData) {
            this._pMsg.text = {
                'no-login': 'not logged in',
                'expired': 'open Claude Code',
                'offline': 'offline',
            }[this._error] ?? (this._error ? 'error' : '…');
        }

        const paint = (p, data) => {
            const pct = Math.round(data?.utilization ?? 0);
            p.v.text = data ? `${pct}%` : '--';
            p.v.style_class = `cu-val ${level(pct)}`;
            p.bar.visible = showBars;
            setBar(p.bar, pct);
        };
        paint(this._p5, f);
        paint(this._p7, w);
        this._pReset.visible = s.get_boolean('show-reset') && !!f?.resets_at;
        this._pReset.text = fmtLeft(f?.resets_at);

        // Stale data (kept after an error) is dimmed
        this.opacity = this._error && hasData ? 170 : 255;

        // Menu
        this._mPlan.text = this._plan ? this._plan.toUpperCase() : '';
        const block = (m, data, kind) => {
            const pct = Math.round(data?.utilization ?? 0);
            m.pct.text = data ? `${pct}%` : '--';
            m.pct.style_class = `cu-block-pct ${level(pct)}`;
            setBar(m.bar, pct);
            m.sub.text = data?.resets_at
                ? `Resets in ${fmtLeft(data.resets_at)}  ·  ${fmtWhen(data.resets_at)}`
                : kind === '5h' ? 'No active session' : '';
        };
        block(this._m5, f, '5h');
        block(this._m7, w, '7d');

        this._mBreak.destroy_all_children();
        const rows = d?.seven_day_breakdown?.rows?.filter(r => r.percent > 0) ?? [];
        if (rows.length) {
            this._mBreak.add_child(new St.Label({style_class: 'cu-break-title', text: 'This week by app'}));
            for (const r of rows) {
                const line = new St.BoxLayout({x_expand: true});
                line.add_child(new St.Label({style_class: 'cu-break-name', text: r.display_name, x_expand: true}));
                line.add_child(new St.Label({style_class: 'cu-break-val', text: `${r.percent}%  ·  ${r.percent_of_limit}% of limit`}));
                this._mBreak.add_child(line);
            }
        }
        this._mBreak.get_parent().visible = rows.length > 0;

        const ago = this._fetchedAt ? Math.round((Date.now() - this._fetchedAt) / 60000) : null;
        const err = {
            'no-login': 'Not logged in to Claude Code',
            'expired': 'Login token expired: open Claude Code to refresh it',
            'offline': 'Network error, showing last known values',
        }[this._error] ?? (this._error ? `Error (${this._error})` : null);
        this._mStatus.label.text = err ?? (ago === null ? 'Loading…' : `Updated ${ago === 0 ? 'just now' : `${ago} min ago`}`);
    }

    destroy() {
        this._stopTimers();
        this._settingsIds?.forEach(id => this._settings.disconnect(id));
        this._settingsIds = null;
        this._session?.abort();
        this._session = null;
        this._pSep = null;
        super.destroy();
    }
});

export default class ClaudeUsageExtension extends Extension {
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
        this._indicator = new UsageIndicator(this);
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
