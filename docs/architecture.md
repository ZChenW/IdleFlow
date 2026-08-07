# Architecture and acceptance boundary

## Ownership

`idled` is the only policy owner after explicit takeover. `idlectl` and the
Tauri v2 + React desktop client are D-Bus clients. QuickShell and Waybar remain
status/launch surfaces; they do not maintain a second policy while IdleFlow
is active.

## Public seams

- `~/.config/idle-control/config.toml`: canonical AC/battery policy.
- `dev.chakew.IdleControl1`: status, save, enable, inhibit, takeover, rollback,
  lock, and suspend operations.
- `idlectl`: scriptable client for the same D-Bus operations.
- Tauri commands: a thin typed adapter for the React application.

## Safety invariants

- First launch is observe-only (`enabled = false`).
- Standard Wayland idle inhibitors are always respected.
- Automatic suspend calls the configured locker and requires confirmation
  before invoking `systemctl suspend`.
- A dedicated `swayidle -w before-sleep` guard remains active while manual
  timeout inhibition is enabled, so lid, power-key, and manual sleep requests
  still wait for lock confirmation.
- QuickShell lock IPC is preferred; `swaylock -f` is the fallback.
- Takeover is explicit. A failed takeover disables the new owner, removes the
  ownership marker, and asks `desktop-shell` to restore the prior owner.
- Rollback stops managed swayidle, reenables the QuickShell policy, removes the
  ownership marker, and starts the saved desktop-shell mode.
- No `/etc` file or privileged helper is used in v1.

## Default profiles

| Power source | Lock | Display off | Suspend |
| --- | ---: | ---: | ---: |
| Battery | 10 min | 15 min | 30 min |
| AC | 15 min | 30 min | 2 h |

Brightness dimming and inferred audio/fullscreen inhibition are deliberately
out of scope for v1.
