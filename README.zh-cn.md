# Terminal Right

在 VS Code 右侧打开终端，不影响底部面板。[English](./README.md)

---

## 功能

- 编辑器标题栏添加终端图标（解锁组按钮旁边）
- 每次点击在右侧面板新建一个终端标签
- 多个终端标签共用同一列，不会重复开面板
- 自动跟随 VS Code 语言设置（中文 / English）

## 使用

1. 安装后，编辑器标题栏会出现终端图标
2. 点击图标，终端面板在右侧打开
3. 再次点击，在同一面板新增一个终端标签
4. 或使用命令面板 `Ctrl+Shift+P`，搜索 `Terminal Right`
5. 快捷键：`Ctrl+Alt+T` / `Cmd+Alt+T`

## 配置

| 设置 | 默认 | 说明 |
|------|:----:|------|
| `terminalright.autoReveal` | `true` | 打开时自动显示终端面板 |
| `terminalright.newTerminalEachTime` | `true` | 每次点击新建终端标签 |

## 开发

```bash
git clone https://github.com/werbenhu/terminalright
cd terminalright
npm install
npm run compile
```

按 `F5` 启动扩展调试。

## 许可

[MIT](./LICENSE)
