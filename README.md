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

**Size:** every extension has its own **Size** setting (0.6× to 1.6×). Change it from right-click → *Size* (Larger / Smaller / Reset) or from Settings. It applies instantly.


## Theme (shared by all extensions)
Every extension's **Settings → Theme** tab edits the **same** colours, so they always match. Changes apply instantly, with no logout.

- **Presets:** Catppuccin Mocha, Tokyo Night, Gruvbox Dark, Nord, Dracula, Rosé Pine
- **Accent:** a preset colour, **follow GNOME's accent** (Settings → Appearance), or any custom colour. It's used for borders, the active workspace and the launcher selection.
- **Pill background:** from the preset, pure black, or custom, with adjustable opacity
- **Border strength** and **corner radius** (999 = round pill, 0 = square)
- The Claude ✻ always keeps Claude's orange.

How it works: each extension's `themeCss.js` turns the palette into CSS, and `shared/theme.js` loads it into the shell and reloads it whenever the theme changes. GNOME Shell's CSS has no variables, so this is how live colours are done.

## Install
```sh
git clone <repo-url> gnome-extensions && cd gnome-extensions
./install.sh                         # all of them
./install.sh sysmon claude-usage     # only some
./install.sh --free-shortcut launcher   # launcher + take Super+Space from layout switching
./install.sh --list
./install.sh --no-enable             # only copy files (updating mid-session)
```
On Wayland, **log out and back in** after installing or updating.

## Requirements
- GNOME Shell 50
- [JetBrainsMono Nerd Font](https://www.nerdfonts.com/) for the sysmon icons. You can also turn icons off in its settings.
- Claude Code logged in, for claude-usage

## Layout
```
shared/               # copied into every extension by install.sh
├── palette.js        # presets + colour maths (no shell imports)
├── theme.js          # loads the generated CSS into GNOME Shell, live
├── themePrefs.js     # the "Theme" settings tab
└── org.gnome.shell.extensions.tr3m0x-theme.gschema.xml

<name>@tr3m0x/
├── extension.js      # the extension
├── prefs.js          # settings window (if it has one)
├── stylesheet.css    # layout only (sizes, spacing, fonts)
├── themeCss.js       # colour rules, built from the shared palette
├── schemas/          # settings keys (compiled by install.sh)
└── README.md         # details for that extension
```

Each extension has its own README with details. Always install with `./install.sh`, because it adds the shared theme files that the extensions need.
