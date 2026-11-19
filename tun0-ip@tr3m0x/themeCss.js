// Colour rules for tun0 IP, generated from the shared theme palette
export default p => `
.tun-pill {
    background-color: ${p.bg};
    border: 1px solid ${p.border};
    border-radius: ${p.r};
}
.tun-button:hover .tun-pill,
.tun-button:checked .tun-pill {
    background-color: ${p.bgHover};
    border-color: ${p.borderHover};
}
.tun-icon  { color: ${p.ok}; }
.tun-label { color: ${p.text}; }
.tun-down .tun-icon, .tun-down .tun-label { color: ${p.dim}; }
`;
