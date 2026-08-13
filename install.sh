#!/usr/bin/env bash

set -euo pipefail

readonly repository="ZChenW/IdleFlow"
readonly source_revision="694627e5692e327dbd0793b379e522b05d85cedb"
readonly prefix="$HOME/.local"

fail() {
    printf 'IdleFlow installer: %s\n' "$*" >&2
    exit 1
}

required_commands=(busctl cargo cc curl install npm pkg-config swayidle systemctl tar)
missing_commands=()
for command_name in "${required_commands[@]}"; do
    if ! command -v "$command_name" >/dev/null 2>&1; then
        missing_commands+=("$command_name")
    fi
done

if ((${#missing_commands[@]})); then
    fail "missing required commands: ${missing_commands[*]}"
fi

if ! command -v qs >/dev/null 2>&1 && ! command -v swaylock >/dev/null 2>&1; then
    fail "install QuickShell (qs) or swaylock before installing IdleFlow"
fi

temporary_dir="$(mktemp -d)"
trap 'rm -rf -- "$temporary_dir"' EXIT

archive="$temporary_dir/idleflow-source.tar.gz"
source_dir="$temporary_dir/source"
mkdir -p "$source_dir"

printf 'Fetching IdleFlow source %s...\n' "${source_revision:0:8}"
curl --fail --location --proto '=https' --tlsv1.2 \
    --retry 3 --retry-delay 1 \
    --output "$archive" \
    "https://github.com/${repository}/archive/${source_revision}.tar.gz"
tar -xzf "$archive" --strip-components=1 -C "$source_dir"

npm --prefix "$source_dir/apps/desktop/frontend" ci --no-audit --no-fund
npm --prefix "$source_dir/apps/desktop/frontend" run build
cargo build --manifest-path "$source_dir/Cargo.toml" --release --locked --quiet --jobs 2 \
    -p idled -p idlectl -p idle-control-desktop

install -Dm755 "$source_dir/target/release/idled" "$prefix/bin/idled"
install -Dm755 "$source_dir/target/release/idlectl" "$prefix/bin/idlectl"
install -Dm755 \
    "$source_dir/target/release/idle-control-desktop" \
    "$prefix/bin/idle-control-desktop"
install -Dm644 \
    "$source_dir/assets/idled.service" \
    "$HOME/.config/systemd/user/idled.service"
install -Dm644 \
    "$source_dir/assets/idle-control.desktop" \
    "$HOME/.local/share/applications/idle-control.desktop"
install -Dm644 \
    "$source_dir/assets/dev.chakew.IdleControl1.service" \
    "$HOME/.local/share/dbus-1/services/dev.chakew.IdleControl1.service"
install -Dm644 \
    "$source_dir/apps/desktop/src-tauri/icons/128x128.png" \
    "$HOME/.local/share/icons/hicolor/128x128/apps/idle-control.png"

systemctl --user daemon-reload
systemctl --user enable idled.service >/dev/null
busctl --user call \
    org.freedesktop.DBus \
    /org/freedesktop/DBus \
    org.freedesktop.DBus \
    ReloadConfig >/dev/null 2>&1 || true
systemctl --user restart idled.service

printf '%s\n' \
    "IdleFlow installed." \
    "Launch: $prefix/bin/idle-control-desktop" \
    "Inspect: $prefix/bin/idlectl status"
