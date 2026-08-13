# IdleFlow

IdleFlow is an idle policy manager for niri/Wayland. Its desktop application
uses Tauri and React; a Rust daemon owns the policy and supervises `swayidle`.

It starts in observe-only mode and does not replace an existing idle owner until
the user explicitly selects **接管当前策略**.

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

The installer builds the audited source in [`source`](source), uses the
committed npm and Cargo lockfiles, and writes only user-owned files under `~/.local` and
`~/.config/systemd/user`. It does not edit `/etc` or silently take over the
current idle policy. After installation, open `idle-control-desktop` or run:

```bash
idlectl status
```
