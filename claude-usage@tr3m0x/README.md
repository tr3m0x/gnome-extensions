# gnome-claude-usage

Your Claude plan limits, the **5-hour session** and the **weekly** limit, in the GNOME Shell top bar. It's a black rounded pill with a Claude-orange accent, mini progress bars and a reset countdown.

```
╭──────────────────────────────────────────────╮
│ ✻  5h 28% ▰▰▱▱ 2h 13m  │  7d 14% ▰▱▱▱       │
╰──────────────────────────────────────────────╯
```

## Features
- **5h and weekly usage** with colour-coded bars: green below 50%, yellow from 50%, red from 80%.
- **Reset countdown** in the panel. It updates locally every 30 s, with no extra requests.
- **Details card** on click: both limits with exact reset times, your plan badge, and the weekly usage broken down by app (Claude Code, Chats, …).
- **Movable:** right-click → *Move to* → Left / Center / Right, or shift it one slot at a time. Default: top right.
- **Settings window:** position, which parts to show, refresh interval (default 5 min).
- **Offline-friendly:** after a failed refresh it keeps the last values and dims them.

## How it works
It reads the OAuth token that **Claude Code** stores in `~/.claude/.credentials.json` and calls Anthropic's usage endpoint:

```
GET https://api.anthropic.com/api/oauth/usage
Authorization: Bearer <token>
anthropic-beta: oauth-2025-04-20
```

- The token is only ever sent to `api.anthropic.com`.
- The extension **never refreshes or writes** the token. Claude Code does that whenever you use it. If the token has expired, the pill shows *"open Claude Code"*.
- This endpoint is undocumented and may change.

## Requirements
- GNOME Shell 50
- Claude Code, logged in with a Claude subscription (Pro or Max)

## Install
From the repo root:
```sh
./install.sh claude-usage
```
On Wayland, log out and back in afterwards.

## Customize
To change the look, edit `claude-usage@tr3m0x/stylesheet.css`. Each colour is labelled there.
