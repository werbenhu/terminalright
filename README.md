# Terminal Right ▶️

**在 VS Code 右侧一键打开终端面板。**

点击编辑器右上角的终端图标按钮，立即将终端面板移到右侧并打开。

## 功能

- 🎯 编辑器右上角（解锁组按钮旁边）添加终端图标
- ⚡ 一键点击，终端面板自动移到右侧并打开
- 📌 自动复用已有终端，不重复创建
- ⚙️ 支持配置：自动显示 / 每次新建终端

## 使用

1. 安装后，编辑器右上角会出现一个终端图标 `▶`
2. 点击图标，终端面板立即移到右侧并打开
3. 或使用命令面板 `Ctrl+Shift+P`，输入 `Terminal Right`

## 配置

| 设置 | 默认 | 说明 |
|------|------|------|
| `terminalright.autoReveal` | `true` | 自动显示终端面板 |
| `terminalright.createNewTerminal` | `false` | 每次点击是否创建新终端 |

## 截图

![Terminal Right](icon.png)

## 开发

```bash
git clone https://github.com/werbenhu/terminalright
cd terminalright
npm install
npm run compile
```

按 `F5` 启动扩展开发调试。
