// Colour rules for the Launcher, generated from the shared theme palette
export default (p, s = 1) => {
    const px = v => `${Math.round(v * s * 10) / 10}px`;
    return `
.launcher-backdrop { background-color: rgba(0, 0, 0, 0.35); }

.launcher-panel {
    background-color: ${p.a(p.bgSolid, Math.max(p.bgOpacity, 0.94))};
    border: 1px solid ${p.a(p.accent, Math.max(p.borderOpacity, 0.2))};
    border-radius: ${Math.min(p.radius, 16)}px;
}

.launcher-bar {
    background-color: ${p.crust};
    border: 1px solid ${p.a(p.accent, Math.max(p.borderOpacity * 0.8, 0.15))};
    border-radius: ${p.rSmall};
}
.launcher-search-icon { color: ${p.accent}; }

.launcher-entry,
.launcher-entry:focus,
.launcher-entry:hover {
    color: ${p.text};
    caret-color: ${p.text};
    selection-background-color: ${p.accent};
    selected-color: ${p.onAccent};
}
.launcher-entry .hint-text { color: ${p.dim}; }

.launcher-row { border-radius: ${p.rSmall}; }
.launcher-row:selected {
    background-color: ${p.a(p.accent, 0.16)};
    border-color: ${p.a(p.accent, 0.4)};
}
.launcher-name { color: ${p.text}; }
.launcher-row:selected .launcher-name { color: ${p.accent}; }
.launcher-desc { color: ${p.muted}; }

.launcher-badge {
    color: ${p.ok};
    border: 1px solid ${p.a(p.ok, 0.4)};
}
.launcher-empty { color: ${p.dim}; }

/* size */
.launcher-panel { font-size: ${s}em; padding: ${px(12)}; }
.launcher-bar   { padding: ${px(4)} ${px(12)}; spacing: ${px(10)}; }
.launcher-search-icon { icon-size: ${px(18)}; }
.launcher-entry, .launcher-entry:focus, .launcher-entry:hover { font-size: ${15 * s}pt; padding: ${px(8)} 0; }
.launcher-row   { padding: ${px(7)} ${px(10)}; }
.launcher-row-box { spacing: ${px(12)}; }
`;
};
