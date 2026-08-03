# Terminal Right

[English](./README.md) | [简体中文](./README.zh-cn.md)

一个轻量、零依赖的 VS Code 扩展，在**编辑器区域**内打开终端，并按分屏布局放置——支持编辑器网格的右、左、上、下四个方向。

适合让 `claude`、`aider`、`codex`、`copilot-cli` 等交互式命令行工具与源码并排运行，同时让底部默认终端面板保持空闲，用于构建、测试等任务。

---

## 为什么要分屏

传统的底部终端会压缩垂直阅读空间，难以同时看清长输出和代码。Terminal Right 直接切分编辑器网格，提供全高的并排布局：

```text
┌───────────────────────────────┬───────────────────────────────┐
│                               │                               │
│                               │                               │
│           代码编辑器           │        Terminal Right         │
│            （左列）            │           （右列）             │
│                               │                               │
│                               │                               │
└───────────────────────────────┴───────────────────────────────┘
```

分屏方向可配置——`right`（默认）、`left`、`up`、`down`。新终端标签页会加入同一个分屏组，不会重复开面板。

---

## 功能

- **真正的编辑器终端。** 在编辑器区域内生成原生、功能完整的终端，可以像普通编辑器标签页一样拖动、固定、分组。
- **四个分屏方向。** 一个设置即可让终端在右侧（默认）、左侧、上方或下方打开。
- **首命令作为标签页标题。** 新终端中运行的第一条命令会成为标签页标题（如 `claude`、`npm run dev`），方便辨识。需要 shell 集成支持。
- **一个分组，多个标签。** 每次点击都在已有分屏组中新增终端标签页，不会重复开面板、打乱布局。
- **三种启动方式：**
  1. 快捷键：`Ctrl+Alt+T`（Windows/Linux）或 `Cmd+Alt+T`（macOS）。
  2. 编辑器标签页菜单：点击当前编辑器标签页右上角的终端图标。
  3. 命令面板：`Ctrl+Shift+P` → `Terminal Right：在分屏中打开终端`。
- **多语言。** 自动跟随 VS Code 显示语言（中文 / English）。

---

## 设置

在 VS Code 设置的 **Terminal Right** 分类下自定义：

| 设置 | 类型 | 默认值 | 说明 |
| :--- | :--- | :--- | :--- |
| `terminalright.splitDirection` | `string` | `"right"` | 新终端在编辑器中打开的方向：`right`、`left`、`up` 或 `down`。 |
| `terminalright.useFirstCommandAsTitle` | `boolean` | `true` | 将终端中运行的第一条命令作为标签页标题（需要 shell 集成）。 |
| `terminalright.autoReveal` | `boolean` | `true` | 打开时自动显示终端。 |
| `terminalright.newTerminalEachTime` | `boolean` | `true` | 每次点击新建一个终端标签页；关闭后则复用已有终端。 |

### 行为说明

- 第一次点击会按配置方向分屏。之后再次点击会向同一个分屏组里添加标签页，而不是重新分屏。
- 想重新分屏，先关闭已有的终端组。
- 选择 `left` / `up` / `down` 时，终端会先短暂出现在当前活动组，再移动到新分屏——这是预期行为，因为标签页必须先获得焦点才能被移动。

---

## 安装

### 通过 VS Code 扩展市场（推荐）
1. 打开**扩展**视图（`Ctrl+Shift+X` / `Cmd+Shift+X`）。
2. 搜索 `werbenhu` 发布的 **Terminal Right**。
3. 点击**安装**。

### 手动安装 VSIX
1. 从 [Releases](https://github.com/werbenhu/terminalright/releases) 下载最新的 `.vsix` 文件。
2. 打开命令面板（`Ctrl+Shift+P` / `Cmd+Shift+P`）。
3. 选择 **Extensions: Install from VSIX...**，然后选择下载的文件。

---

## 本地开发

1. 克隆仓库并安装依赖：
   ```bash
   git clone https://github.com/werbenhu/terminalright
   cd terminalright
   npm install
   ```
2. 编译：
   ```bash
   npm run compile
   ```
3. 用 VS Code 打开仓库目录，按 `F5` 启动扩展开发宿主。
4. 按 `Ctrl+Alt+T` / `Cmd+Alt+T` 测试，或在命令面板运行 **Terminal Right：在分屏中打开终端**。
5. 打包 `.vsix`：
   ```bash
   npx @vscode/vsce package --no-git-tag-version
   ```
