// Shell-side theme loader shared by all tr3m0x extensions.
// Each extension passes a cssFn(palette) → string with its colour rules; this
// writes it to a cache file and (re)loads it into the shell theme whenever the
// shared theme settings or GNOME's accent colour change — no relogin needed.

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import St from 'gi://St';

import {THEME_SCHEMA, buildPalette} from './palette.js';

const CACHE_DIR = GLib.build_filenamev([GLib.get_user_cache_dir(), 'tr3m0x-theme']);
const encoder = new TextEncoder();

export class ThemeManager {
    constructor(ext, cssFn) {
        this._ext = ext;
        this._cssFn = cssFn;
        this._file = null;
        this._counter = 0;
        this._ids = [];
    }

    enable() {
        this._settings = this._ext.getSettings(THEME_SCHEMA);
        this._ids.push([this._settings, this._settings.connect('changed', () => this._queue())]);

        try {
            this._iface = new Gio.Settings({schema_id: 'org.gnome.desktop.interface'});
            if (this._iface.settings_schema.has_key('accent-color'))
                this._ids.push([this._iface, this._iface.connect('changed::accent-color', () => this._queue())]);
            else
                this._iface = null;
        } catch (e) {
            this._iface = null;
        }

        // The shell swaps its whole theme object on theme reloads, dropping our sheet.
        // Only re-add it when it is really gone: loading a sheet itself emits 'changed',
        // so reacting blindly would loop forever (and make the whole shell lag).
        const ctx = St.ThemeContext.get_for_stage(global.stage);
        this._ids.push([ctx, ctx.connect('changed', () => {
            if (this._file && !this._isLoaded()) {
                this._file = null;   // that theme object is gone, nothing to unload
                this._lastCss = null;
                this._queue();
            }
        })]);

        GLib.mkdir_with_parents(CACHE_DIR, 0o755);
        this._apply();
    }

    get palette() {
        return buildPalette(this._settings, this._iface?.get_string('accent-color') ?? null);
    }

    _queue() {
        if (this._idle)
            return;
        this._idle = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            this._idle = 0;
            this._apply();
            return GLib.SOURCE_REMOVE;
        });
    }

    _isLoaded() {
        const theme = St.ThemeContext.get_for_stage(global.stage).get_theme();
        return theme.get_custom_stylesheets().some(f => f.equal(this._file));
    }

    _apply() {
        let css;
        try {
            css = this._cssFn(this.palette);
        } catch (e) {
            logError(e, `${this._ext.uuid}: theme css`);
            return;
        }
        // nothing changed (e.g. an unrelated setting) → don't touch the shell theme
        if (css === this._lastCss && this._file && this._isLoaded())
            return;
        this._lastCss = css;
        // a fresh file name each time, so St never serves a cached sheet
        const path = GLib.build_filenamev([CACHE_DIR, `${this._ext.uuid}-${this._counter++}.css`]);
        const file = Gio.File.new_for_path(path);
        try {
            file.replace_contents(encoder.encode(css), null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null);
        } catch (e) {
            logError(e, `${this._ext.uuid}: writing theme css`);
            return;
        }
        this._unload();
        St.ThemeContext.get_for_stage(global.stage).get_theme().load_stylesheet(file);
        this._file = file;
    }

    _unload() {
        if (!this._file)
            return;
        try {
            St.ThemeContext.get_for_stage(global.stage).get_theme().unload_stylesheet(this._file);
        } catch (e) {}
        try {
            this._file.delete(null);
        } catch (e) {}
        this._file = null;
    }

    destroy() {
        if (this._idle) {
            GLib.source_remove(this._idle);
            this._idle = 0;
        }
        this._ids.forEach(([obj, id]) => obj.disconnect(id));
        this._ids = [];
        this._unload();
        this._settings = null;
        this._iface = null;
    }
}
