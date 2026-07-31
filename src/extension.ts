import * as vscode from 'vscode';

let terminalCounter = 0;
const ownTerminals = new Set<vscode.Terminal>();
const awaitingFirstCommand = new Set<vscode.Terminal>();

/**
 * Stable handle stored next to each terminal we own. `Terminal.name` can be
 * renamed by the "first command as title" feature, and `tab.label` may be
 * shared by multiple terminals in reuse mode, so neither is a reliable key.
 * The creation name never changes and lets us find a terminal's tab again.
 */
interface OwnTerminal {
	terminal: vscode.Terminal;
	creationName: string;
}
const ownTerminalInfo = new Map<vscode.Terminal, OwnTerminal>();

type SplitDirection = 'right' | 'left' | 'up' | 'down';

const moveCommands: Record<Exclude<SplitDirection, 'right'>, string> = {
	left: 'workbench.action.moveEditorToLeftGroup',
	up: 'workbench.action.moveEditorToAboveGroup',
	down: 'workbench.action.moveEditorToBelowGroup'
};

export function activate(context: vscode.ExtensionContext) {
	const openCmd = vscode.commands.registerCommand(
		'terminalright.openInRightPanel',
		openTerminalInRightPanel
	);
	context.subscriptions.push(openCmd);

	context.subscriptions.push(
		vscode.window.onDidCloseTerminal(t => {
			ownTerminals.delete(t);
			ownTerminalInfo.delete(t);
			awaitingFirstCommand.delete(t);
		})
	);

	// Terminal shell execution events require a recent VS Code with shell
	// integration; skip the feature silently when the API is unavailable.
	if (typeof vscode.window.onDidStartTerminalShellExecution === 'function') {
		context.subscriptions.push(
			vscode.window.onDidStartTerminalShellExecution(e => {
				void onFirstCommandStarted(e.terminal, e.execution.commandLine.value);
			})
		);
	}

	const statusBarItem = vscode.window.createStatusBarItem(
		vscode.StatusBarAlignment.Right,
		100
	);
	statusBarItem.command = 'terminalright.openInRightPanel';
	statusBarItem.text = '$(terminal) Terminal Right';
	statusBarItem.tooltip = vscode.l10n.t('Open terminal in a split view');
	statusBarItem.show();
	context.subscriptions.push(statusBarItem);
}

function findOwnTerminalColumn(): vscode.ViewColumn | undefined {
	const liveNames = new Set(
		[...ownTerminals]
			.filter(t => t.exitStatus === undefined && ownTerminalInfo.has(t))
			.map(t => ownTerminalInfo.get(t)!.creationName)
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

async function waitForActiveTerminalTab(name: string, timeoutMs = 2000): Promise<boolean> {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		const tab = vscode.window.tabGroups.activeTabGroup.activeTab;
		if (tab && tab.input instanceof vscode.TabInputTerminal && tab.label === name) {
			return true;
		}
		await new Promise(resolve => setTimeout(resolve, 50));
	}
	return false;
}

async function onFirstCommandStarted(terminal: vscode.Terminal, commandLine: string) {
	if (!awaitingFirstCommand.has(terminal)) {
		return;
	}
	awaitingFirstCommand.delete(terminal);

	const config = vscode.workspace.getConfiguration('terminalright');
	if (!config.get<boolean>('useFirstCommandAsTitle', true)) {
		return;
	}

	const title = commandLine.trim();
	if (!title) {
		return;
	}

	// renameWithArg acts on the active terminal. The user usually just typed
	// into this terminal so focus is already here; but with several fresh
	// terminals open focus can sit elsewhere. In that case we pull focus back
	// before renaming so the right tab gets the new title, then hand focus
	// back to where the user had it.
	const previousActive = vscode.window.activeTerminal;
	if (previousActive !== terminal) {
		terminal.show(false);
		// Give VS Code a tick to settle the active-terminal change before the
		// rename command resolves its target.
		await new Promise(resolve => setTimeout(resolve, 50));
	}
	try {
		await vscode.commands.executeCommand(
			'workbench.action.terminal.renameWithArg',
			{ name: title }
		);
	} catch {
		// Renaming is best-effort; ignore failures.
	}
	if (previousActive && previousActive !== terminal && previousActive.exitStatus === undefined) {
		previousActive.show(false);
	}
}

async function openTerminalInRightPanel() {
	const config = vscode.workspace.getConfiguration('terminalright');
	const autoReveal = config.get<boolean>('autoReveal', true);
	const newTerminalEachTime = config.get<boolean>('newTerminalEachTime', true);
	const direction = config.get<SplitDirection>('splitDirection', 'right');

	try {
		const existingColumn = findOwnTerminalColumn();

		// Reuse mode: if a live owned terminal already exists, just reveal it.
		// Respecting splitDirection here would spawn fresh panels every click,
		// which contradicts "reuse" — so we keep the existing column.
		if (!newTerminalEachTime && existingColumn !== undefined) {
			const existing = [...ownTerminals].find(t => t.exitStatus === undefined);
			if (existing) {
				existing.show(autoReveal);
				return;
			}
		}

		let location: vscode.TerminalEditorLocationOptions;
		if (existingColumn !== undefined) {
			location = { viewColumn: existingColumn };
		} else if (direction === 'right') {
			location = { viewColumn: vscode.ViewColumn.Beside };
		} else {
			// Left/up/down have no ViewColumn of their own: open in the active
			// group first, then move the tab into a fresh split.
			location = { viewColumn: vscode.ViewColumn.Active };
		}

		let terminal: vscode.Terminal;
		let creationName: string;

		if (newTerminalEachTime) {
			terminalCounter++;
			creationName = `${vscode.l10n.t('Terminal Right')} #${terminalCounter}`;
			terminal = vscode.window.createTerminal({
				name: creationName,
				iconPath: new vscode.ThemeIcon('terminal'),
				location
			});
		} else {
			creationName = vscode.l10n.t('Terminal Right');
			terminal = vscode.window.createTerminal({
				name: creationName,
				iconPath: new vscode.ThemeIcon('terminal'),
				location
			});
		}

		ownTerminals.add(terminal);
		ownTerminalInfo.set(terminal, { terminal, creationName });
		awaitingFirstCommand.add(terminal);

		if (existingColumn === undefined && direction !== 'right') {
			// The move command targets the active tab, so the terminal must be
			// focused regardless of the autoReveal setting. Match by the stable
			// creationName: the tab may not yet carry terminal.name reliably
			// right after createTerminal.
			terminal.show(false);
			if (await waitForActiveTerminalTab(creationName)) {
				await vscode.commands.executeCommand(moveCommands[direction]);
			}
		} else {
			terminal.show(autoReveal);
		}

	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		vscode.window.showErrorMessage(`${vscode.l10n.t('Terminal Right error')}: ${msg}`);
	}
}

export function deactivate() {}
