# IdleFlow

IdleFlow is a shell-independent idle policy manager for niri/Wayland. Its
desktop application uses **Tauri v2 + React**; a Rust daemon owns the policy and
supervises `swayidle`.

It starts in observe-only mode and does not replace an existing idle owner until
the user explicitly selects **接管当前策略**.

## Components

- `idled`: Rust user daemon and swayidle supervisor.
- `idlectl`: D-Bus CLI (`status`, `inhibit`, `take-over`, `rollback`, etc.).
- `apps/desktop`: Tauri v2 + React desktop application.

## Install

IdleFlow targets Arch Linux–style Wayland desktops. Install the build and
runtime dependencies first:

```bash
sudo pacman -S --needed base-devel rust nodejs npm webkit2gtk-4.1 gtk3 librsvg swayidle swaylock
```

QuickShell may replace `swaylock` as the primary lock backend, but at least one
of `qs` or `swaylock` must be available.

Clone and install:

```bash
git clone https://github.com/ZChenW/IdleFlow.git
cd IdleFlow
./install.sh
```

The installer uses the committed npm and Cargo lockfiles, builds from source,
and writes only user-owned files under `~/.local` and
`~/.config/systemd/user`. It does not edit `/etc` or silently take over the
current idle policy. After installation, open `idle-control-desktop` or run:

```bash
idlectl status
```

See [architecture and safety invariants](docs/architecture.md).
