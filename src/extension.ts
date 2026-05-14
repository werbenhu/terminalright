import * as vscode from 'vscode';

let terminalCounter = 0;
const ownTerminals = new Set<vscode.Terminal>();

export function activate(context: vscode.ExtensionContext) {
	const openCmd = vscode.commands.registerCommand(
		'terminalright.openInRightPanel',
		openTerminalInRightPanel
	);
	context.subscriptions.push(openCmd);

	context.subscriptions.push(
		vscode.window.onDidCloseTerminal(t => ownTerminals.delete(t))
	);

	const statusBarItem = vscode.window.createStatusBarItem(
		vscode.StatusBarAlignment.Right,
		100
	);
	statusBarItem.command = 'terminalright.openInRightPanel';
	statusBarItem.text = '$(terminal) Terminal Right';
	statusBarItem.tooltip = vscode.l10n.t('Open terminal on right side');
	statusBarItem.show();
	context.subscriptions.push(statusBarItem);
}

function findOwnTerminalColumn(): vscode.ViewColumn | undefined {
	const liveNames = new Set(
		[...ownTerminals].filter(t => t.exitStatus === undefined).map(t => t.name)
	);
	if (liveNames.size === 0) {
		return undefined;
	}
	for (const group of vscode.window.tabGroups.all) {
		for (const tab of group.tabs) {
			if (tab.input instanceof vscode.TabInputTerminal && liveNames.has(tab.label)) {
				return group.viewColumn;
			}
		}
	}
	return undefined;
}

async function openTerminalInRightPanel() {
	const config = vscode.workspace.getConfiguration('terminalright');
	const autoReveal = config.get<boolean>('autoReveal', true);
	const newTerminalEachTime = config.get<boolean>('newTerminalEachTime', true);

	try {
		const existingColumn = findOwnTerminalColumn();
		const location: vscode.TerminalEditorLocationOptions = {
			viewColumn: existingColumn ?? vscode.ViewColumn.Beside
		};

		let terminal: vscode.Terminal;

		if (newTerminalEachTime) {
			terminalCounter++;
			terminal = vscode.window.createTerminal({
				name: `${vscode.l10n.t('Terminal Right')} #${terminalCounter}`,
				iconPath: new vscode.ThemeIcon('terminal'),
				location
			});
		} else {
			const existing = [...ownTerminals].find(t => t.exitStatus === undefined);
			if (existing) {
				existing.show(autoReveal);
				return;
			}
			terminal = vscode.window.createTerminal({
				name: vscode.l10n.t('Terminal Right'),
				iconPath: new vscode.ThemeIcon('terminal'),
				location
			});
		}

		ownTerminals.add(terminal);
		terminal.show(autoReveal);

	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		vscode.window.showErrorMessage(`${vscode.l10n.t('Terminal Right error')}: ${msg}`);
	}
}

export function deactivate() {}
