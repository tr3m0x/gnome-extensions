// Colour rules for Workspaces, generated from the shared theme palette
export default p => `
.ws-pill {
    background-color: ${p.bg};
    border: 1px solid ${p.border};
    border-radius: ${p.r};
}
.ws-button:hover .ws-pill,
.ws-button:checked .ws-pill { border-color: ${p.borderHover}; }

.ws-ws { border-radius: ${p.r}; }
.ws-ws:hover { background-color: ${p.a(p.text, 0.10)}; }

.ws-empty .ws-num, .ws-empty .ws-name { color: ${p.dim}; }
.ws-occupied .ws-num  { color: ${p.text}; }
.ws-occupied .ws-name { color: ${p.subtext}; }
.ws-occupied .ws-dots { color: ${p.muted}; }

.ws-active { background-color: ${p.accent}; }
.ws-active:hover { background-color: ${p.accentHover}; }
.ws-active .ws-num, .ws-active .ws-name, .ws-active .ws-dots { color: ${p.onAccent}; }

.ws-menu-title { color: ${p.accent}; }
.ws-rename-hint { color: ${p.muted}; }
`;
