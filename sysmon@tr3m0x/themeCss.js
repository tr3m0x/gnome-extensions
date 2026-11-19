// Colour rules for SysMon, generated from the shared theme palette
export default (p, s = 1) => {
    const px = v => `${Math.round(v * s * 10) / 10}px`;
    return `
.sysmon-pill {
    background-color: ${p.bg};
    border: 1px solid ${p.border};
    border-radius: ${p.r};
}
.sysmon-button:hover .sysmon-pill,
.sysmon-button:active .sysmon-pill,
.sysmon-button:checked .sysmon-pill {
    background-color: ${p.bgHover};
    border-color: ${p.borderHover};
}
.sysmon-cpu  .sysmon-icon, .sysmon-cpu  .sysmon-word { color: ${p.blue}; }
.sysmon-mem  .sysmon-icon, .sysmon-mem  .sysmon-word { color: ${p.purple}; }
.sysmon-disk .sysmon-icon, .sysmon-disk .sysmon-word { color: ${p.green}; }
.sysmon-value { color: ${p.text}; }
.sysmon-unit  { color: ${p.muted}; }
.sysmon-warn  { color: ${p.warn}; }
.sysmon-crit  { color: ${p.crit}; }
.sysmon-sep   { background-color: ${p.a(p.text, 0.18)}; }

/* size */
.sysmon-pill { font-size: ${s}em; padding: 0 ${px(12)}; }
.sysmon-item { spacing: ${px(6)}; }
.sysmon-sep  { margin: ${px(7)} ${px(10)}; }
`;
};
