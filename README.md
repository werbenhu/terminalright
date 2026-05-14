# Terminal Right ▶️

**一键在 VS Code 右侧打开终端面板。** [English](./README.en.md)

---

## 功能

- 🎯 **编辑器右上角**（解锁组按钮旁边）添加终端图标
- ⚡ **点击图标**，终端面板自动移到右侧并打开一个新终端
- 🔄 **多标签支持** — 每次点击新建一个终端（像 Claude Code 新建对话）
- 🌐 **多语言** — 自动跟随 VS Code 语言设置

## 使用

1. 安装后，编辑器右上角会出现一个终端图标 `▶`
2. 点击图标，终端面板立即移到右侧并打开
3. 多次点击会创建多个终端标签，可自由切换
4. 或使用命令面板 `Ctrl+Shift+P`，输入 `Terminal Right`

## 配置

| 设置 | 默认 | 说明 |
|------|:----:|------|
| `terminalright.autoReveal` | `true` | 打开时自动显示终端面板 |
| `terminalright.newTerminalEachTime` | `true` | 每次点击新建终端标签 |

## 开发

```bash
# 克隆
git clone https://github.com/werbenhu/terminalright
cd terminalright

# 安装依赖
npm install

# 编译
npm run compile

# 按 F5 启动扩展开发调试
```

## 许可

[MIT](./LICENSE)
