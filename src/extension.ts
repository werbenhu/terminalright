import * as vscode from 'vscode';
import { firstCommandTitle, padTabTitle, stripTabTitlePad } from './commandTitle';

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
	const bare = stripTabTitlePad(name);
	for (const base of ownedBaseTitles()) {
		if (bare === base || bare.startsWith(`${base} #`)) {
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
	const match = /#(\d+)$/.exec(stripTabTitlePad(name));
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

/** Collect editor groups that currently host at least one terminal tab. */
function editorGroupsWithTerminals(): vscode.TabGroup[] {
	return vscode.window.tabGroups.all.filter(group =>
		group.tabs.some(tab => tab.input instanceof vscode.TabInputTerminal)
	);
}

/**
 * Map tab labels in a column to live `Terminal` instances.
 * After a restart VS Code often resets custom titles to the shell name
 * (e.g. `powershell`), so label === terminal.name is the reliable link.
 */
function terminalsInColumn(column: vscode.ViewColumn): vscode.Terminal[] {
	const labels = new Set<string>();
	for (const group of vscode.window.tabGroups.all) {
		if (group.viewColumn !== column) {
			continue;
		}
		for (const tab of group.tabs) {
			if (tab.input instanceof vscode.TabInputTerminal) {
				labels.add(stripTabTitlePad(tab.label));
			}
		}
	}
	if (labels.size === 0) {
		return [];
	}
	return vscode.window.terminals.filter(
		t => t.exitStatus === undefined && labels.has(stripTabTitlePad(t.name))
	);
}

function claimTerminalsInColumn(column: vscode.ViewColumn): void {
	const claimed = terminalsInColumn(column);
	for (const terminal of claimed) {
		claimOwnedTerminal(terminal);
	}
	if (claimed.length > 0) {
		lastOwnViewColumn = column;
	}
}

/**
 * After a window reload, VS Code restores editor terminals but usually resets
 * their title to the shell name (`powershell`, `bash`, …). Name-based ownership
 * therefore fails. We reclaim by:
 *  1. creation name / current name when still recognizable
 *  2. last persisted editor column (any terminal tabs there are ours)
 *  3. any existing editor-area terminal group (join it rather than split again)
 */
function recoverOwnedTerminals(direction: SplitDirection = 'right'): void {
	const savedNames = new Set(
		(extensionContext?.workspaceState.get<string[]>(STATE_OWNED_CREATION_NAMES, []) ?? [])
			.map(stripTabTitlePad)
	);

	for (const terminal of vscode.window.terminals) {
		if (terminal.exitStatus !== undefined) {
			continue;
		}
		const creationName = getCreationName(terminal);
		if (
			isOwnedTerminalName(terminal.name) ||
			isOwnedTerminalName(creationName) ||
			(creationName !== undefined && savedNames.has(stripTabTitlePad(creationName)))
		) {
			claimOwnedTerminal(terminal);
		}
	}

	// Prefer the column we last owned if it still has terminal tabs — titles
	// may all be shell defaults after restore, so claim by location.
	const savedColumn =
		extensionContext?.workspaceState.get<number>(STATE_LAST_OWN_COLUMN) ??
		lastOwnViewColumn;
	if (savedColumn !== undefined) {
		const groups = editorGroupsWithTerminals();
		if (groups.some(g => g.viewColumn === savedColumn)) {
			claimTerminalsInColumn(savedColumn);
		}
	}

	// Still nothing claimed: pick an existing editor terminal group so the
	// next open joins it as a sibling tab instead of ViewColumn.Beside.
	if (![...ownTerminals].some(t => t.exitStatus === undefined)) {
		const column = pickEditorTerminalColumn(direction, savedColumn);
		if (column !== undefined) {
			claimTerminalsInColumn(column);
		}
	}

	findOwnTerminalColumn(direction);
	if (lastOwnViewColumn === undefined && savedColumn !== undefined) {
		lastOwnViewColumn = savedColumn;
	}
}

/**
 * Choose which editor group to treat as "our" terminal host when ownership
 * cannot be established by name (typical after restart).
 */
function pickEditorTerminalColumn(
	direction: SplitDirection,
	preferred?: vscode.ViewColumn
): vscode.ViewColumn | undefined {
	const groups = editorGroupsWithTerminals();
	if (groups.length === 0) {
		return undefined;
	}

	// Tabs that still carry our title win.
	for (const group of groups) {
		if (group.tabs.some(
			tab => tab.input instanceof vscode.TabInputTerminal && isOwnedTerminalName(tab.label)
		)) {
			return group.viewColumn;
		}
	}

	if (preferred !== undefined && groups.some(g => g.viewColumn === preferred)) {
		return preferred;
	}

	// Directional heuristic: right → rightmost terminal group, left → leftmost.
	const sorted = [...groups].sort((a, b) => a.viewColumn - b.viewColumn);
	if (direction === 'left') {
		return sorted[0].viewColumn;
	}
	// right / up / down: prefer the rightmost existing terminal group so a
	// side-by-side layout keeps accumulating tabs on the terminal side.
	return sorted[sorted.length - 1].viewColumn;
}

function persistOwnedState(): void {
	if (!extensionContext) {
		return;
	}
	const creationNames = [
		...new Set(
			[...ownTerminals]
				.filter(t => t.exitStatus === undefined)
				.map(t => stripTabTitlePad(getCreationName(t) ?? t.name))
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
		vscode.window.onDidOpenTerminal(() => {
			// VS Code may restore editor terminals after activate (often with a
			// reset shell title). Re-scan so the next click can join them.
			recoverOwnedTerminals();
			persistOwnedState();
		})
	);

	context.subscriptions.push(
		vscode.window.onDidCloseTerminal(t => {
			ownTerminals.delete(t);
			awaitingFirstCommand.delete(t);
			if (![...ownTerminals].some(x => x.exitStatus === undefined)) {
				// Only clear the column if no editor terminal tabs remain there.
				const column = lastOwnViewColumn;
				if (
					column === undefined ||
					!editorGroupsWithTerminals().some(g => g.viewColumn === column)
				) {
					lastOwnViewColumn = undefined;
				}
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
	}

/**
 * Find the editor group already hosting one of our terminals, so a new
 * terminal joins it as a sibling tab instead of spawning another split.
 *
 * Prefer `lastOwnViewColumn` when it still contains a live owned tab. Fall
 * back to scanning all groups by `tab.label` vs each terminal's current
 * `name` (labels follow renames / shell-default restore titles).
 */
function findOwnTerminalColumn(direction: SplitDirection = 'right'): vscode.ViewColumn | undefined {
	const live = [...ownTerminals].filter(t => t.exitStatus === undefined);
	const liveNames = new Set(live.map(t => stripTabTitlePad(t.name)));

	// 1) Last known column still has a terminal tab we own (by name match).
	if (lastOwnViewColumn !== undefined && liveNames.size > 0) {
		for (const group of vscode.window.tabGroups.all) {
			if (group.viewColumn !== lastOwnViewColumn) {
				continue;
			}
			for (const tab of group.tabs) {
				if (tab.input instanceof vscode.TabInputTerminal && liveNames.has(stripTabTitlePad(tab.label))) {
					return lastOwnViewColumn;
				}
			}
		}
		// After restart, titles become `powershell` but the tab is still in our
		// column — accept any terminal tab in that column if we own that terminal.
		if (terminalsInColumn(lastOwnViewColumn).some(t => ownTerminals.has(t))) {
			return lastOwnViewColumn;
		}
		// Column still has editor terminals at all (claimed by location).
		if (editorGroupsWithTerminals().some(g => g.viewColumn === lastOwnViewColumn)) {
			return lastOwnViewColumn;
		}
	}

	// 2) Scan all groups for tabs matching live owned terminal names.
	if (liveNames.size > 0) {
		for (const group of vscode.window.tabGroups.all) {
			for (const tab of group.tabs) {
				if (tab.input instanceof vscode.TabInputTerminal && liveNames.has(stripTabTitlePad(tab.label))) {
					lastOwnViewColumn = group.viewColumn;
					return group.viewColumn;
				}
			}
		}
	}

	// 3) Tabs that still show our branded title (even if not yet in ownTerminals).
	for (const group of vscode.window.tabGroups.all) {
		for (const tab of group.tabs) {
			if (tab.input instanceof vscode.TabInputTerminal && isOwnedTerminalName(tab.label)) {
				lastOwnViewColumn = group.viewColumn;
				return group.viewColumn;
			}
		}
	}

	// 4) Any editor-area terminal group (restart → shell default titles).
	const picked = pickEditorTerminalColumn(direction, lastOwnViewColumn);
	if (picked !== undefined) {
		lastOwnViewColumn = picked;
		return picked;
	}

	if (live.length === 0) {
		lastOwnViewColumn = undefined;
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
		if (
			tab &&
			tab.input instanceof vscode.TabInputTerminal &&
			stripTabTitlePad(tab.label) === stripTabTitlePad(name)
		) {
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
	const title = padTabTitle(firstCommandTitle(commandLine));
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
		// Reclaim terminals restored by VS Code after a reload/restart. Titles
		// are often reset to the shell name (`powershell`); join by editor group.
		recoverOwnedTerminals(direction);

		const existingColumn = findOwnTerminalColumn(direction);

		// Reuse mode: if a live owned terminal already exists, just reveal it.
		// Respecting splitDirection here would spawn fresh panels every click,
		// which contradicts "reuse" — so we keep the existing column.
		if (!newTerminalEachTime && existingColumn !== undefined) {
			const inColumn = terminalsInColumn(existingColumn);
			const existing =
				inColumn.find(t => ownTerminals.has(t)) ??
				[...ownTerminals].find(t => t.exitStatus === undefined) ??
				inColumn[0];
			if (existing) {
				existing.show(autoReveal);
				claimOwnedTerminal(existing);
				rememberOwnColumn(existingColumn);
				return;
			}
		}

		let location: vscode.TerminalEditorLocationOptions;
		if (existingColumn !== undefined) {
			// Open as a sibling tab in the existing terminal editor group.
			location = { viewColumn: existingColumn, preserveFocus: !autoReveal };
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
			creationName = padTabTitle(`${vscode.l10n.t('Terminal Right')} #${terminalCounter}`);
			terminal = vscode.window.createTerminal({
				name: creationName,
				iconPath: new vscode.ThemeIcon('terminal'),
				location
			});
		} else {
			creationName = padTabTitle(vscode.l10n.t('Terminal Right'));
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
				// Give the editor grid a tick to register the new terminal tab
				// before we snapshot its column.
				await new Promise(resolve => setTimeout(resolve, 50));
				rememberOwnColumn(findOwnTerminalColumn(direction));
			}
		}

	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		vscode.window.showErrorMessage(`${vscode.l10n.t('Terminal Right error')}: ${msg}`);
	}
}

export function deactivate() {}
