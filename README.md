# Terminal Right

Open a terminal on the right side of VS Code without touching the bottom panel. [中文](./README.zh-cn.md)

---

## Features

- Terminal icon in the editor title bar (next to the lock group button)
- Each click opens a new terminal tab in the right panel
- Multiple terminal tabs in the same column — no duplicate panels
- Follows VS Code's display language (English / 中文)

## Usage

1. After install, a terminal icon appears in the editor title bar
2. Click it to open a terminal on the right side
3. Click again to add another terminal tab in the same panel
4. Or use `Ctrl+Shift+P` and search for `Terminal Right`
5. Keyboard shortcut: `Ctrl+Alt+T` / `Cmd+Alt+T`

## Configuration

| Setting | Default | Description |
|---------|:-------:|-------------|
| `terminalright.autoReveal` | `true` | Auto-reveal terminal panel on open |
| `terminalright.newTerminalEachTime` | `true` | Create a new terminal tab on each click |

## Development

```bash
git clone https://github.com/werbenhu/terminalright
cd terminalright
npm install
npm run compile
```

Press `F5` to launch the extension in debug mode.

## License

[MIT](./LICENSE)
