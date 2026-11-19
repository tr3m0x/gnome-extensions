# gnome-launcher

An Omarchy-style app launcher for GNOME Shell 50. Press **Super+Space** and a search bar opens in the middle of the screen: black, with Catppuccin Mocha accents.

```
        ╭──────────────────────────────────────────╮
        │ ╭──────────────────────────────────────╮ │
        │ │   fire▏                             │ │
        │ ╰──────────────────────────────────────╯ │
        │ ▌🦊 Firefox                     running  │
        │    Browse the web                        │
        ╰──────────────────────────────────────────╯
```

## Features
- **Fuzzy search** across app names, descriptions, keywords, commands and IDs. `frfx` finds Firefox.
- With nothing typed, it shows your **most-used apps** first.
- A **running** badge marks apps that are already open.
- Built into GNOME Shell: no extra packages, no daemon, and it works on Wayland.

## Keys
| Key | Action |
|---|---|
| `Super+Space` | Open or close the launcher |
| `↑` `↓`, `Tab`, `Ctrl+J/K`, `Ctrl+N/P` | Move through the results |
| `Enter` | Launch the app, or focus it if it's already running |
| `Ctrl+Enter` | Always open a new window |
| `Esc` or click outside | Close |

## Install
From the repo root:
```sh
./install.sh --free-shortcut launcher   # leave out the flag to keep GNOME's Super+Space layout switching
```
On Wayland, log out and back in afterwards.

### Hide the dock too (optional)
```sh
gnome-extensions disable ubuntu-dock@ubuntu.com
```

## Customize
- **Look:** **Settings → Theme**, shared with the other extensions (open it from the Extensions app).
- **Shortcut:**
  ```sh
  gsettings --schemadir ~/.local/share/gnome-shell/extensions/launcher@tr3m0x/schemas \
    set org.gnome.shell.extensions.launcher toggle-launcher "['<Super>r']"
  ```
- **Number of results:** the `max-results` key in the same schema (3 to 15, default 8).

## Colours
Colours come from the shared theme: open **Settings → Theme**. It applies to all tr3m0x extensions at once. See the main README.
