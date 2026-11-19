// Colour rules for SysMon, generated from the shared theme palette
export default p => `
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
`;
