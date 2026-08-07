#!/usr/bin/bash

set -euo pipefail

project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
prefix="${IDLE_CONTROL_PREFIX:-$HOME/.local}"

required_commands=(busctl cargo install npm swayidle systemctl)
missing_commands=()
for required_command in "${required_commands[@]}"; do
    if ! command -v "$required_command" >/dev/null 2>&1; then
        missing_commands+=("$required_command")
    fi
done

if ((${#missing_commands[@]})); then
    printf 'Missing required commands: %s\n' "${missing_commands[*]}" >&2
    exit 1
fi

if ! command -v qs >/dev/null 2>&1 && ! command -v swaylock >/dev/null 2>&1; then
    printf '%s\n' 'Install QuickShell (qs) or swaylock before installing IdleFlow.' >&2
    exit 1
fi

npm --prefix "$project_dir/apps/desktop/frontend" ci --prefer-offline --no-audit --no-fund
npm --prefix "$project_dir/apps/desktop/frontend" run build
cargo build --manifest-path "$project_dir/Cargo.toml" --release --locked \
    -p idled -p idlectl -p idle-control-desktop

install -Dm755 "$project_dir/target/release/idled" "$prefix/bin/idled"
install -Dm755 "$project_dir/target/release/idlectl" "$prefix/bin/idlectl"
install -Dm755 \
    "$project_dir/target/release/idle-control-desktop" \
    "$prefix/bin/idle-control-desktop"
install -Dm644 \
    "$project_dir/assets/idled.service" \
    "$HOME/.config/systemd/user/idled.service"
install -Dm644 \
    "$project_dir/assets/idle-control.desktop" \
    "$HOME/.local/share/applications/idle-control.desktop"
install -Dm644 \
    "$project_dir/assets/dev.chakew.IdleControl1.service" \
    "$HOME/.local/share/dbus-1/services/dev.chakew.IdleControl1.service"
install -Dm644 \
    "$project_dir/apps/desktop/src-tauri/icons/128x128.png" \
    "$HOME/.local/share/icons/hicolor/128x128/apps/idle-control.png"

systemctl --user daemon-reload
systemctl --user disable idled.service >/dev/null 2>&1 || true
busctl --user call \
    org.freedesktop.DBus \
    /org/freedesktop/DBus \
    org.freedesktop.DBus \
    ReloadConfig >/dev/null 2>&1 || true
systemctl --user restart idled.service

printf '%s\n' \
    "IdleFlow installed." \
    "Launch: idle-control-desktop" \
    "Inspect: idlectl status"
