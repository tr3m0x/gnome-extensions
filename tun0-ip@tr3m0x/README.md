# gnome-tun-ip

GNOME Shell 50 extension that shows your VPN (`tun0`, `tun1`, …) IPv4 address in the top bar. It's handy in labs and pentests when you need your `LHOST`.

## Features
- Watches all active `tunN` interfaces and refreshes every 3 seconds.
- **Left-click**: copies the IP that's showing to the clipboard.
- **Scroll**: switches between the active tuns.
- **Right-click**: lists every active tun with its IP. Picking one shows it and copies it.
- When no tun is up, it shows `tun: down`, dimmed.

## Install
From the repo root:
```sh
./install.sh tun0-ip
```

## Configure
In `extension.js`, edit `IFACE_RE` to watch other interfaces, for example `/^(tun|wg)\d+$/` to add WireGuard, and `INTERVAL_S` to change how often it refreshes.
