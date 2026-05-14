# Terminal Right ▶️

**One-click to open terminal in the right panel of VS Code.** [中文](./README.md)

---

## Features

- 🎯 **Editor title bar icon** — appears next to the lock group button
- ⚡ **One-click** — terminal panel moves to the right and opens a new terminal
- 🔄 **Multi-tab support** — each click creates a new terminal tab
- 🌐 **Multi-language** — follows VS Code's display language

## Usage

1. After install, a terminal icon `▶` appears in the top-right corner of the editor
2. Click the icon to instantly move the terminal panel to the right side
3. Click multiple times to create multiple terminal tabs
4. Or use `Ctrl+Shift+P` and type `Terminal Right`

## Configuration

| Setting | Default | Description |
|---------|:-------:|-------------|
| `terminalright.autoReveal` | `true` | Auto-reveal terminal panel on open |
| `terminalright.newTerminalEachTime` | `true` | Create new terminal tab each click |

## Development

```bash
git clone https://github.com/werbenhu/terminalright
cd terminalright
npm install
npm run compile
```

Press `F5` to start debugging.

## License

[MIT](./LICENSE)
