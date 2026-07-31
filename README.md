# Terminal Right

[English](./README.md) | [简体中文](./README.zh-cn.md)

A lightweight, zero-dependency VS Code extension that opens a terminal inside the **editor area** and positions it in a split view — right, left, top, or bottom of your editor grid.

It's built for running interactive CLI tools (such as `claude`, `aider`, `codex`, or `copilot-cli`) side-by-side with your code, while keeping the default bottom terminal panel free for builds, tests, and other tasks.

---

## Why split the editor

A traditional bottom-docked terminal eats your vertical reading space, making it hard to read long output and code at the same time. Terminal Right splits the editor grid instead, giving you a full-height side-by-side layout:

```text
┌───────────────────────────────┬───────────────────────────────┐
│                               │                               │
│                               │                               │
│      Your Code Editor         │        Terminal Right         │
│         (Left Column)         │        (Right Column)         │
│                               │                               │
│                               │                               │
└───────────────────────────────┴───────────────────────────────┘
```

The split direction is configurable — `right` (default), `left`, `up`, or `down`. New terminal tabs join the same split group instead of spawning duplicate panels.

---

## Features

- **Real editor terminal.** Spawns a native, full-featured terminal directly in the editor area — drag, drop, pin, or group it like any editor tab.
- **Four split directions.** Open the terminal on the right (default), left, top, or bottom with a single setting.
- **First command as tab title.** The first command run in a fresh terminal becomes its tab title (e.g. `claude`, `npm run dev`), so tabs stay identifiable. Requires shell integration.
- **One group, many tabs.** Each click adds a new terminal tab to the existing split group — no duplicate panels, no layout churn.
- **Four ways to launch:**
  1. Keyboard shortcut: `Ctrl+Alt+T` (Windows/Linux) or `Cmd+Alt+T` (macOS).
  2. Status bar: click `$(terminal) Terminal Right` in the bottom-right corner.
  3. Editor tab menu: click the terminal icon at the top-right of the active editor tab.
  4. Command Palette: `Ctrl+Shift+P` → `Terminal Right: Open Terminal in Split View`.
- **Localized.** Follows VS Code's display language (English / 中文).

---

## Settings

Customize under **Terminal Right** in VS Code's settings:

| Setting | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `terminalright.splitDirection` | `string` | `"right"` | Side of the editor where new terminals open: `right`, `left`, `up`, or `down`. |
| `terminalright.useFirstCommandAsTitle` | `boolean` | `true` | Use the first command run in the terminal as the tab title (requires shell integration). |
| `terminalright.autoReveal` | `boolean` | `true` | Automatically reveal the terminal when opening. |
| `terminalright.newTerminalEachTime` | `boolean` | `true` | Create a new terminal tab on each click. If disabled, reopen the existing terminal instead. |

### Behavior notes

- The first click splits the editor in the configured direction. Subsequent clicks add tabs to that same group rather than splitting again.
- To split again, close the existing terminal group first.
- For `left` / `up` / `down`, the terminal briefly appears in the active group before moving into the new split — this is expected, since the tab must be focused to be moved.

---

## Installation

### Via VS Code Marketplace (recommended)
1. Open the **Extensions** view (`Ctrl+Shift+X` / `Cmd+Shift+X`).
2. Search for **Terminal Right** by `werbenhu`.
3. Click **Install**.

### Manual VSIX installation
1. Download the latest `.vsix` from [Releases](https://github.com/werbenhu/terminalright/releases).
2. Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`).
3. Run **Extensions: Install from VSIX...** and pick the file.

---

## Local development

1. Clone and install dependencies:
   ```bash
   git clone https://github.com/werbenhu/terminalright
   cd terminalright
   npm install
   ```
2. Compile:
   ```bash
   npm run compile
   ```
3. Open the folder in VS Code and press `F5` to launch the Extension Development Host.
4. Test with `Ctrl+Alt+T` / `Cmd+Alt+T`, or run **Terminal Right: Open Terminal in Split View** from the Command Palette.
5. Package a `.vsix`:
   ```bash
   npx @vscode/vsce package --no-git-tag-version
   ```