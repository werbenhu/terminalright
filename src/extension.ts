import * as vscode from 'vscode';

let terminalRightPanel: vscode.Terminal | undefined;

export function activate(context: vscode.ExtensionContext) {
    // 注册命令：在右侧打开终端
    const openCmd = vscode.commands.registerCommand(
        'terminalright.openInRightPanel',
        openTerminalInRightPanel
    );
    context.subscriptions.push(openCmd);

    // 注册命令：切换终端面板位置到右侧
    const positionCmd = vscode.commands.registerCommand(
        'terminalright.setPanelRight',
        () => {
            vscode.commands.executeCommand('workbench.action.positionPanel', 'right');
        }
    );
    context.subscriptions.push(positionCmd);
}

async function openTerminalInRightPanel() {
    const config = vscode.workspace.getConfiguration('terminalright');
    const autoReveal = config.get<boolean>('autoReveal', true);
    const createNew = config.get<boolean>('createNewTerminal', false);

    try {
        // 1. 确保终端面板位置在右侧
        await vscode.commands.executeCommand('workbench.action.positionPanel', 'right');

        // 2. 获取或创建终端
        if (createNew || !terminalRightPanel) {
            terminalRightPanel = vscode.window.createTerminal({
                name: 'Terminal Right',
                iconPath: new vscode.ThemeIcon('terminal')
            });
        }

        // 3. 显示终端
        if (terminalRightPanel) {
            terminalRightPanel.show(autoReveal);
        }

        // 4. 如果终端面板没自动出现，强制聚焦
        if (autoReveal) {
            await vscode.commands.executeCommand('workbench.action.terminal.focus');
        }
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`Terminal Right 错误: ${msg}`);
    }
}

export function deactivate() {
    if (terminalRightPanel) {
        terminalRightPanel.dispose();
        terminalRightPanel = undefined;
    }
}
