# gnome-sysmon

A clean system monitor for the GNOME Shell top bar: CPU, RAM and disk in a rounded Catppuccin Mocha pill, with Nerd Font icons.

```
╭───────────────────────────────────────────────╮
│   12%  │  󰍛 3.6 / 22 Gi  │  󰋊 51G free        │
╰───────────────────────────────────────────────╯
```

## Features
- **CPU** usage, **RAM** used / total, and **disk** free (or used / total) for any mount point.
- **Colour-coded load:** values turn yellow above 70% and red above 90%.
- **Movable:** right-click → *Move to* → Left / Center / Right, or shift it one slot at a time. It moves instantly.
- **Settings window:** position, which items to show, icons or words, disk mount point and display, refresh interval.
- **Left-click** shows exact numbers with percentages.
- Lightweight: reads `/proc/stat`, `/proc/meminfo` and `statfs`, with no external commands.

## Requirements
- GNOME Shell 50
- A Nerd Font for the icons (default: **JetBrainsMono Nerd Font**). Without one, turn **Icons** off in Settings to show `CPU / RAM / DISK` text instead.

## Install
From the repo root:
```sh
./install.sh sysmon
```
On Wayland, log out and back in afterwards.

## Customize
All the styling is in `sysmon@tr3m0x/stylesheet.css`: pill colours, icon colours, warning colours and spacing.
To change the icons, edit the `ICONS` map at the top of `extension.js`.

## Files
| File | Purpose |
|---|---|
| `extension.js` | Panel indicator, stats, menu |
| `prefs.js` | Settings window (libadwaita) |
| `stylesheet.css` | Look and feel |
| `schemas/*.gschema.xml` | Settings keys (compiled by `install.sh`) |
