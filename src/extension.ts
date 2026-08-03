import * as vscode from 'vscode';
import { firstCommandTitle } from './commandTitle';

let terminalCounter = 0;
const ownTerminals = new Set<vscode.Terminal>();
const awaitingFirstCommand = new Set<vscode.Terminal>();

/**
 * Last editor group we placed an owned terminal into. Preferred over a full
 * tab-label scan so short titles (`cd`, `git`) are less likely to join a
 * foreign group that happens to share a label. Cleared when no live owned
 * terminals remain.
 */
let lastOwnViewColumn: vscode.ViewColumn | undefined;

/** Kept so we can recover owned terminals after a VS Code restart. */
let extensionContext: vscode.ExtensionContext | undefined;

const STATE_OWNED_CREATION_NAMES = 'ownedCreationNames';
const STATE_LAST_OWN_COLUMN = 'lastOwnViewColumn';

type SplitDirection = 'right' | 'left' | 'up' | 'down';

const moveCommands: Record<Exclude<SplitDirection, 'right'>, string> = {
	left: 'workbench.action.moveEditorToLeftGroup',
	up: 'workbench.action.moveEditorToAboveGroup',
	down: 'workbench.action.moveEditorToBelowGroup'
};

/**
 * Localized + historical base titles. After a display-language switch, restored
 * terminals may still carry the old locale's creation name.
 */
function ownedBaseTitles(): string[] {
	const current = vscode.l10n.t('Terminal Right');
	const known = new Set([current, 'Terminal Right', '右侧终端']);
	return [...known];
}

function isOwnedTerminalName(name: string | undefined): boolean {
	if (!name) {
		return false;
	}
	for (const base of ownedBaseTitles()) {
		if (name === base || name.startsWith(`${base} #`)) {
			return true;
		}
	}
	return false;
}

function getCreationName(terminal: vscode.Terminal): string | undefined {
	const opts = terminal.creationOptions as vscode.TerminalOptions | undefined;
	return opts?.name;
}

function bumpCounterFromName(name: string | undefined): void {
	if (!name) {
		return;
	}
	const match = /#(\d+)$/.exec(name);
	if (match) {
		terminalCounter = Math.max(terminalCounter, parseInt(match[1], 10));
	}
}

function claimOwnedTerminal(terminal: vscode.Terminal): void {
	if (terminal.exitStatus !== undefined) {
		return;
	}
	ownTerminals.add(terminal);
	bumpCounterFromName(getCreationName(terminal));
	bumpCounterFromName(terminal.name);
}

/**
 * After a window reload, in-memory `ownTerminals` is empty even though VS Code
 * restored our editor terminals. Reclaim them by creation name / current name
 * (and, as a last resort, by the last known editor column we persisted).
 */
function recoverOwnedTerminals(): void {
	const savedNames = new Set(
		extensionContext?.workspaceState.get<string[]>(STATE_OWNED_CREATION_NAMES, []) ?? []
	);

	for (const terminal of vscode.window.terminals) {
		if (terminal.exitStatus !== undefined) {
			continue;
		}
		const creationName = getCreationName(terminal);
		if (
			isOwnedTerminalName(terminal.name) ||
			isOwnedTerminalName(creationName) ||
			(creationName !== undefined && savedNames.has(creationName))
		) {
			claimOwnedTerminal(terminal);
		}
	}

	// Last resort: terminals renamed via "first command as title" may lose a
	// recognizable name if creationOptions was not restored. Reclaim every
	// live terminal whose tab still sits in the column we last owned.
	if (ownTerminals.size === 0) {
		const savedColumn =
			extensionContext?.workspaceState.get<number>(STATE_LAST_OWN_COLUMN) ??
			lastOwnViewColumn;
		if (savedColumn !== undefined) {
			claimTerminalsInColumn(savedColumn);
		}
	}

	// Refresh lastOwnViewColumn from the live tab grid when possible.
	findOwnTerminalColumn();
	if (lastOwnViewColumn === undefined) {
		const savedColumn = extensionContext?.workspaceState.get<number>(STATE_LAST_OWN_COLUMN);
		if (savedColumn !== undefined) {
			lastOwnViewColumn = savedColumn;
		}
	}
}

/**
 * Claim live terminals that currently appear as editor tabs in `column`.
 * Matching is by tab.label === terminal.name (VS Code keeps them in sync).
 */
function claimTerminalsInColumn(column: vscode.ViewColumn): void {
	const labels = new Set<string>();
	for (const group of vscode.window.tabGroups.all) {
		if (group.viewColumn !== column) {
			continue;
		}
		for (const tab of group.tabs) {
			if (tab.input instanceof vscode.TabInputTerminal) {
				labels.add(tab.label);
			}
		}
	}
	if (labels.size === 0) {
		return;
	}
	for (const terminal of vscode.window.terminals) {
		if (terminal.exitStatus === undefined && labels.has(terminal.name)) {
			claimOwnedTerminal(terminal);
		}
	}
	if (ownTerminals.size > 0) {
		lastOwnViewColumn = column;
	}
}

function persistOwnedState(): void {
	if (!extensionContext) {
		return;
	}
	const creationNames = [
		...new Set(
			[...ownTerminals]
				.filter(t => t.exitStatus === undefined)
				.map(t => getCreationName(t) ?? t.name)
				.filter((n): n is string => !!n)
		)
	];
	void extensionContext.workspaceState.update(STATE_OWNED_CREATION_NAMES, creationNames);
	void extensionContext.workspaceState.update(
		STATE_LAST_OWN_COLUMN,
		lastOwnViewColumn !== undefined ? lastOwnViewColumn : undefined
	);
}

export function activate(context: vscode.ExtensionContext) {
	extensionContext = context;

	// Workspace terminals are usually restored by onStartupFinished; reclaim
	// anything already present, and again whenever a terminal opens (restore
	// can finish after activate in some sessions).
	recoverOwnedTerminals();

	const openCmd = vscode.commands.registerCommand(
		'terminalright.openInRightPanel',
		openTerminalInRightPanel
	);
	context.subscriptions.push(openCmd);

	context.subscriptions.push(
		vscode.window.onDidOpenTerminal(terminal => {
			// VS Code may restore our terminals after activate; claim them so the
			// next click joins their group instead of spawning a second split.
			const creationName = getCreationName(terminal);
			if (
				isOwnedTerminalName(terminal.name) ||
				isOwnedTerminalName(creationName)
			) {
				claimOwnedTerminal(terminal);
				findOwnTerminalColumn();
				persistOwnedState();
			}
		})
	);

	context.subscriptions.push(
		vscode.window.onDidCloseTerminal(t => {
			ownTerminals.delete(t);
			awaitingFirstCommand.delete(t);
			if (![...ownTerminals].some(x => x.exitStatus === undefined)) {
				lastOwnViewColumn = undefined;
			}
			persistOwnedState();
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

/**
 * Find the editor group already hosting one of our terminals, so a new
 * terminal joins it as a sibling tab instead of spawning another split.
 *
 * Prefer `lastOwnViewColumn` when it still contains a live owned tab. Fall
 * back to scanning all groups by `tab.label` vs each terminal's current
 * `name` (labels follow renames from "first command as title"). Names can
 * collide; any group hosting one of ours is still a valid target.
 */
function findOwnTerminalColumn(): vscode.ViewColumn | undefined {
	const liveNames = new Set(
		[...ownTerminals]
			.filter(t => t.exitStatus === undefined)
			.map(t => t.name)
	);
	if (liveNames.size === 0) {
		lastOwnViewColumn = undefined;
		return undefined;
	}

	if (lastOwnViewColumn !== undefined) {
		for (const group of vscode.window.tabGroups.all) {
			if (group.viewColumn !== lastOwnViewColumn) {
				continue;
			}
			for (const tab of group.tabs) {
				if (tab.input instanceof vscode.TabInputTerminal && liveNames.has(tab.label)) {
					return lastOwnViewColumn;
				}
			}
		}
	}

	for (const group of vscode.window.tabGroups.all) {
		for (const tab of group.tabs) {
			if (tab.input instanceof vscode.TabInputTerminal && liveNames.has(tab.label)) {
				lastOwnViewColumn = group.viewColumn;
				return group.viewColumn;
			}
		}
	}
	return undefined;
}

function rememberOwnColumn(column: vscode.ViewColumn | undefined): void {
	if (column !== undefined) {
		lastOwnViewColumn = column;
		persistOwnedState();
	}
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

	// Keep only the first command of the line: chains, pipes and redirections
	// would make an unwieldy tab title (see firstCommandTitle).
	const title = firstCommandTitle(commandLine);
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
		// Reclaim terminals restored by VS Code after a reload/restart so we
		// join their existing editor group instead of opening a second split.
		recoverOwnedTerminals();

		const existingColumn = findOwnTerminalColumn();

		// Reuse mode: if a live owned terminal already exists, just reveal it.
		// Respecting splitDirection here would spawn fresh panels every click,
		// which contradicts "reuse" — so we keep the existing column.
		if (!newTerminalEachTime && existingColumn !== undefined) {
			const existing = [...ownTerminals].find(t => t.exitStatus === undefined);
			if (existing) {
				existing.show(autoReveal);
				rememberOwnColumn(existingColumn);
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
		awaitingFirstCommand.add(terminal);
		persistOwnedState();

		if (existingColumn === undefined && direction !== 'right') {
			// The move command targets the active tab, so the terminal must be
			// focused regardless of the autoReveal setting. Match by the stable
			// creationName: the tab may not yet carry terminal.name reliably
			// right after createTerminal.
			terminal.show(false);
			if (await waitForActiveTerminalTab(creationName)) {
				await vscode.commands.executeCommand(moveCommands[direction]);
				rememberOwnColumn(vscode.window.tabGroups.activeTabGroup.viewColumn);
			}
		} else {
			terminal.show(autoReveal);
			// Prefer the column we asked for; for Beside, resolve after show.
			if (existingColumn !== undefined) {
				rememberOwnColumn(existingColumn);
			} else {
				rememberOwnColumn(findOwnTerminalColumn());
			}
		}

	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		vscode.window.showErrorMessage(`${vscode.l10n.t('Terminal Right error')}: ${msg}`);
	}
}

export function deactivate() {}
