# workspaces

A rounded workspace bar for the GNOME Shell top bar, styled to match sysmon and claude-usage.

```
╭──────────────────────────────────╮
│ ( 1 web •• )  2 code •  3   4   5 │
╰──────────────────────────────────╯
```

- The **active** workspace is a filled blue chip.
- Workspaces **with windows** are bright, with one dot per window (up to 3).
- **Empty** workspaces are dimmed. They can also be hidden in Settings.

## Use
| Action | Result |
|---|---|
| Click a workspace | Switch to it |
| Click the active workspace | Toggle the Overview (can be turned off) |
| Scroll on the bar | Previous / next workspace |
| Right-click a workspace | **Rename…**, Clear name, Go to, Move bar to ▸, Settings… |

Names are stored in GNOME's own `org.gnome.desktop.wm.preferences workspace-names`, so other tools see them too.

## Settings
Position (area and order), show names, show empty workspaces, window dots, scroll wrap-around, click-active-for-Overview, and editing all workspace names in one place.

## Install
From the repo root:
```sh
./install.sh workspaces
```
On Wayland, log out and back in afterwards. If you used **Space Bar** before, disable it so you don't get two bars:
```sh
gnome-extensions disable space-bar@luchrioh
```
