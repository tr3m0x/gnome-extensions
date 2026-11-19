# gnome-extensions

My GNOME Shell 50 top-bar extensions, all styled to match (black, Catppuccin Mocha).

| Extension | What it does | Default spot |
|---|---|---|
| [**sysmon**](sysmon@tr3m0x/) | CPU, RAM and disk in a rounded pill with Nerd Font icons and colour-coded load | top left |
| [**claude-usage**](claude-usage@tr3m0x/) | Claude 5-hour and weekly limits, with bars, reset countdown and a per-app breakdown | top right |
| [**workspaces**](workspaces@tr3m0x/) | Rounded workspace bar: click or scroll to switch, right-click to rename, window dots | top left |
| [**launcher**](launcher@tr3m0x/) | Omarchy-style app search that opens in the middle of the screen on **Super+Space** | n/a (overlay) |
| [**tun0-ip**](tun0-ip@tr3m0x/) | VPN `tunN` IP in the top bar: click to copy, scroll to switch, right-click for the list | top right |

sysmon, claude-usage and workspaces can be moved at any time: right-click → *Move to*, or open their Settings.

## Install
```sh
git clone <repo-url> gnome-extensions && cd gnome-extensions
./install.sh                         # all of them
./install.sh sysmon claude-usage     # only some
./install.sh --free-shortcut launcher   # launcher + take Super+Space from layout switching
./install.sh --list
```
On Wayland, **log out and back in** after installing or updating.

## Requirements
- GNOME Shell 50
- [JetBrainsMono Nerd Font](https://www.nerdfonts.com/) for the sysmon icons. You can also turn icons off in its settings.
- Claude Code logged in, for claude-usage

## Layout
```
<name>@tr3m0x/
├── extension.js      # the extension
├── prefs.js          # settings window (if it has one)
├── stylesheet.css    # look and feel
├── schemas/          # settings keys (compiled by install.sh)
└── README.md         # details for that extension
```

Each extension has its own README with details.
