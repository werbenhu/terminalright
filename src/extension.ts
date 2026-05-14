import * as vscode from 'vscode';

let terminalCounter = 0;
let lastActiveTerminal: vscode.Terminal | undefined;

export function activate(context: vscode.ExtensionContext) {
    // 命令：在右侧打开/新建终端
    const openCmd = vscode.commands.registerCommand(
        'terminalright.openInRightPanel',
        openTerminalInRightPanel
    );
    context.subscriptions.push(openCmd);

    // 命令：切换面板到右侧
    const positionCmd = vscode.commands.registerCommand(
        'terminalright.setPanelRight',
        () => vscode.commands.executeCommand('workbench.action.positionPanel', 'right')
    );
    context.subscriptions.push(positionCmd);
}

async function openTerminalInRightPanel() {
    const config = vscode.workspace.getConfiguration('terminalright');
    const autoReveal = config.get<boolean>('autoReveal', true);
    const newTerminalEachTime = config.get<boolean>('newTerminalEachTime', true);

    try {
        // 1. 确保终端面板在右侧
        await vscode.commands.executeCommand('workbench.action.positionPanel', 'right');

        // 2. 创建新终端或复用最后一个
        let terminal: vscode.Terminal;

        if (newTerminalEachTime) {
            // 每次点击新建一个终端（像 Claude Code 新建对话一样）
            terminalCounter++;
            terminal = vscode.window.createTerminal({
                name: `${vscode.l10n.t('Terminal Right')} #${terminalCounter}`,
                iconPath: new vscode.ThemeIcon('terminal')
            });
        } else {
            // 复用模式：如果有上次的终端且还在用，就复用；否则新建
            if (!lastActiveTerminal) {
                terminal = vscode.window.createTerminal({
                    name: 'Terminal Right',
                    iconPath: new vscode.ThemeIcon('terminal')
                });
            } else {
                terminal = lastActiveTerminal;
            }
        }

        // 3. 显示终端
        terminal.show(autoReveal);
        lastActiveTerminal = terminal;

        // 4. 聚焦终端面板
        if (autoReveal) {
            await vscode.commands.executeCommand('workbench.action.terminal.focus');
        }

        // 5. 如果创建了多个终端并且 tab 栏没显示，确保它显示
        if (terminalCounter >= 1) {
            vscode.commands.executeCommand('workbench.action.terminal.showTabs');
        }

    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`${vscode.l10n.t('Terminal Right error')}: ${msg}`);
    }
}

export function deactivate() {
    // 不需要额外清理，VS Code 自动管理终端生命周期
}
