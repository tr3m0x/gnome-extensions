// Shared colour logic for all tr3m0x extensions.
// Pure JS (no St / Gtk imports) so both the shell side and prefs can use it.

export const THEME_SCHEMA = 'org.gnome.shell.extensions.tr3m0x-theme';

// Dark presets. Roles:
//   base    pill / panel background      crust   deeper background (inputs)
//   surface hover / selection            text, subtext, muted, dim  text levels
//   blue purple green yellow red         named colours (icons, status, accents)
export const PRESETS = {
    'catppuccin-mocha': {
        name: 'Catppuccin Mocha',
        base: '#1e1e2e', crust: '#11111b', surface: '#313244',
        text: '#cdd6f4', subtext: '#a6adc8', muted: '#7f849c', dim: '#585b70',
        blue: '#89b4fa', purple: '#cba6f7', green: '#a6e3a1', yellow: '#f9e2af', red: '#f38ba8',
    },
    'tokyo-night': {
        name: 'Tokyo Night',
        base: '#1a1b26', crust: '#16161e', surface: '#292e42',
        text: '#c0caf5', subtext: '#a9b1d6', muted: '#737aa2', dim: '#545c7e',
        blue: '#7aa2f7', purple: '#bb9af7', green: '#9ece6a', yellow: '#e0af68', red: '#f7768e',
    },
    'gruvbox': {
        name: 'Gruvbox Dark',
        base: '#282828', crust: '#1d2021', surface: '#3c3836',
        text: '#ebdbb2', subtext: '#d5c4a1', muted: '#a89984', dim: '#665c54',
        blue: '#83a598', purple: '#d3869b', green: '#b8bb26', yellow: '#fabd2f', red: '#fb4934',
    },
    'nord': {
        name: 'Nord',
        base: '#2e3440', crust: '#242933', surface: '#3b4252',
        text: '#eceff4', subtext: '#d8dee9', muted: '#8892a6', dim: '#4c566a',
        blue: '#88c0d0', purple: '#b48ead', green: '#a3be8c', yellow: '#ebcb8b', red: '#bf616a',
    },
    'dracula': {
        name: 'Dracula',
        base: '#282a36', crust: '#21222c', surface: '#44475a',
        text: '#f8f8f2', subtext: '#d6d6e0', muted: '#6272a4', dim: '#4d5170',
        blue: '#8be9fd', purple: '#bd93f9', green: '#50fa7b', yellow: '#f1fa8c', red: '#ff5555',
    },
    'rose-pine': {
        name: 'Rosé Pine',
        base: '#191724', crust: '#13111e', surface: '#26233a',
        text: '#e0def4', subtext: '#c4c0de', muted: '#908caa', dim: '#524f67',
        blue: '#9ccfd8', purple: '#c4a7e7', green: '#56b6a0', yellow: '#f6c177', red: '#eb6f92',
    },
};

// GNOME (libadwaita) accent colours, org.gnome.desktop.interface accent-color
export const GNOME_ACCENTS = {
    blue: '#3584e4', teal: '#2190a4', green: '#3a944a', yellow: '#c88800', orange: '#ed5b00',
    red: '#e62d42', pink: '#d56199', purple: '#9141ac', slate: '#6f8396',
};

// Claude brand colour: always the same regardless of theme
export const CLAUDE_ORANGE = '#d97757';

function parse(hex) {
    let h = String(hex).trim().replace('#', '');
    if (h.length === 3)
        h = h.split('').map(c => c + c).join('');
    const n = parseInt(h.slice(0, 6), 16);
    if (Number.isNaN(n))
        return [0, 0, 0];
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const toHex = rgb => `#${rgb.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`;

export function rgba(hex, alpha) {
    const [r, g, b] = parse(hex);
    return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha)).toFixed(3)})`;
}

// Blend a towards b by t (0..1)
export function mix(a, b, t) {
    const A = parse(a), B = parse(b);
    return toHex(A.map((v, i) => v + (B[i] - v) * t));
}

// Build the final palette from the shared settings.
// `settings` = Gio.Settings for THEME_SCHEMA, `gnomeAccent` = name from desktop interface (or null)
export function buildPalette(settings, gnomeAccent = null) {
    const p = {...(PRESETS[settings.get_string('preset')] ?? PRESETS['catppuccin-mocha'])};

    const accentKey = settings.get_string('accent');
    if (accentKey === 'gnome')
        p.accent = GNOME_ACCENTS[gnomeAccent] ?? p.purple;
    else if (accentKey === 'custom')
        p.accent = settings.get_string('custom-accent') || p.purple;
    else
        p.accent = p[accentKey] ?? p.purple;
    p.accentHover = mix(p.accent, '#ffffff', 0.25);
    // readable text on top of the accent (dark text on light accents, light on dark)
    const [r, g, b] = parse(p.accent);
    p.onAccent = (0.299 * r + 0.587 * g + 0.114 * b) > 140 ? p.crust : '#ffffff';

    const bgKey = settings.get_string('background');
    p.bgSolid = bgKey === 'black' ? '#000000'
        : bgKey === 'custom' ? (settings.get_string('custom-background') || p.base)
            : p.base;
    p.bgOpacity = settings.get_double('background-opacity');
    p.borderOpacity = settings.get_double('border-opacity');
    p.radius = settings.get_int('radius');

    // status colours
    p.ok = p.green;
    p.warn = p.yellow;
    p.crit = p.red;
    p.claude = CLAUDE_ORANGE;

    // convenience
    p.a = rgba;
    p.bg = rgba(p.bgSolid, p.bgOpacity);
    p.bgHover = rgba(mix(p.bgSolid, p.surface, 0.6), Math.max(p.bgOpacity, 0.95));
    p.border = rgba(p.accent, p.borderOpacity);
    p.borderHover = rgba(p.accent, Math.min(1, p.borderOpacity * 2 + 0.1));
    p.r = `${p.radius}px`;
    p.rSmall = `${Math.min(p.radius, 10)}px`;
    return p;
}
