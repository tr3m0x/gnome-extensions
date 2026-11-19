// Colour rules for Claude Usage, generated from the shared theme palette.
// The ✻ logo and plan badge always keep Claude's brand orange (p.claude).
export default p => `
.cu-pill {
    background-color: ${p.bg};
    border: 1px solid ${p.border};
    border-radius: ${p.r};
}
.cu-button:hover .cu-pill,
.cu-button:checked .cu-pill {
    background-color: ${p.bgHover};
    border-color: ${p.borderHover};
}
.cu-logo, .cu-menu-logo { color: ${p.claude}; }
.cu-plan {
    color: ${p.claude};
    border: 1px solid ${p.a(p.claude, 0.5)};
}

.cu-tag, .cu-reset, .cu-msg, .cu-block-sub, .cu-break-val { color: ${p.muted}; }
.cu-sep { background-color: ${p.a(p.text, 0.18)}; }

.cu-track { background-color: ${p.a(p.text, 0.12)}; }
.cu-fill.cu-ok   { background-color: ${p.ok}; }
.cu-fill.cu-warn { background-color: ${p.warn}; }
.cu-fill.cu-crit { background-color: ${p.crit}; }
.cu-ok   { color: ${p.ok}; }
.cu-warn { color: ${p.warn}; }
.cu-crit { color: ${p.crit}; }

.cu-menu-title, .cu-block-title { color: ${p.text}; }
.cu-break-title { color: ${p.subtext}; }
.cu-break-name  { color: ${p.subtext}; }
.cu-status      { color: ${p.dim}; }
`;
