// Colour rules for tun0 IP, generated from the shared theme palette
export default (p, s = 1) => {
    const px = v => `${Math.round(v * s * 10) / 10}px`;
    return `
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

/* size */
.tun-pill { font-size: ${s}em; padding: 0 ${px(12)}; spacing: ${px(7)}; }
.tun-icon { icon-size: ${px(14)}; }
`;
};
