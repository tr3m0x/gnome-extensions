#!/usr/bin/env bash
# Install / update the extensions into ~/.local/share/gnome-shell/extensions
#
#   ./install.sh                     install all extensions
#   ./install.sh sysmon launcher     install only the ones you name
#   ./install.sh --free-shortcut ... also free Super+Space for the launcher
#                                    (moves GNOME's layout switching off it)
#   ./install.sh --list              list the available extensions
set -euo pipefail
cd "$(dirname "$0")"
DEST_ROOT="$HOME/.local/share/gnome-shell/extensions"
FREE_SHORTCUT=0
NAMES=()

for arg in "$@"; do
    case "$arg" in
        --free-shortcut) FREE_SHORTCUT=1 ;;
        --list) for d in *@tr3m0x; do echo "${d%@*}"; done; exit 0 ;;
        -h|--help) sed -n '2,9p' "$0"; exit 0 ;;
        *) NAMES+=("$arg") ;;
    esac
done
if [ ${#NAMES[@]} -eq 0 ]; then
    for d in *@tr3m0x; do NAMES+=("${d%@*}"); done
fi

for name in "${NAMES[@]}"; do
    uuid="${name%@tr3m0x}@tr3m0x"
    if [ ! -d "$uuid" ]; then
        echo "Unknown extension: $name  (try --list)" >&2
        exit 1
    fi
    dest="$DEST_ROOT/$uuid"
    mkdir -p "$dest"
    cp -r "$uuid"/. "$dest"/
    rm -f "$dest/README.md"
    [ -d "$dest/schemas" ] && glib-compile-schemas "$dest/schemas"
    gnome-extensions enable "$uuid" 2>/dev/null || \
        gsettings set org.gnome.shell enabled-extensions \
            "$(gsettings get org.gnome.shell enabled-extensions | sed "s/]$/, '$uuid']/; s/^@as \[, /[/")"
    echo "✓ $uuid"
done

if [ "$FREE_SHORTCUT" = 1 ]; then
    gsettings set org.gnome.desktop.wm.keybindings switch-input-source "['XF86Keyboard']"
    gsettings set org.gnome.desktop.wm.keybindings switch-input-source-backward "['<Shift>XF86Keyboard']"
    gsettings set org.freedesktop.ibus.general.hotkey triggers "@as []" 2>/dev/null || true
    echo "✓ Super+Space freed (layout switching moved to XF86Keyboard)"
fi

echo "On Wayland: log out and back in to load new or updated extensions."
