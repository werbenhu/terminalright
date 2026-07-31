/**
 * Tab titles keep only the first command of a shell line so chains like
 * `cd foo && npm run dev` become `cd foo`.
 *
 * Split points (outside quotes):
 * - chains: `&&`, `||`, whitespace-bounded bare `&` (cmd.exe; not PowerShell `& path`)
 * - pipes / lists: `|`, `;`, newlines
 * - redirections: `>`, `>>`, `<`, `<<`, `&>`, `2>&1`, `2>/dev/null`, …
 *
 * Operators inside single or double quotes are ignored. Inside double quotes,
 * bash-style `\` and PowerShell-style `` ` `` escape the next character.
 */
export function firstCommandTitle(commandLine: string): string {
	const n = commandLine.length;
	let i = 0;
	let inSingle = false;
	let inDouble = false;

	while (i < n) {
		const c = commandLine[i];
		const next = i + 1 < n ? commandLine[i + 1] : '';

		if (inDouble && (c === '\\' || c === '`') && i + 1 < n) {
			i += 2;
			continue;
		}

		if (!inDouble && c === "'") {
			inSingle = !inSingle;
			i++;
			continue;
		}
		if (!inSingle && c === '"') {
			inDouble = !inDouble;
			i++;
			continue;
		}

		if (inSingle || inDouble) {
			i++;
			continue;
		}

		// --- outside quotes ---

		if (c === '\r' || c === '\n') {
			return commandLine.slice(0, i).trim();
		}

		if (c === '&' && next === '&') {
			return commandLine.slice(0, i).trim();
		}

		// bash `&>` / `&>>` redirect (check before bare `&`)
		if (c === '&' && next === '>') {
			return commandLine.slice(0, i).trim();
		}

		// cmd.exe chaining: `a & b`. Leave PowerShell call operator `& path` alone
		// (no whitespace before `&` at the start of a token).
		if (c === '&') {
			const prevWs = i > 0 && isWhitespace(commandLine[i - 1]);
			const nextWs = next === '' || isWhitespace(next);
			if (prevWs && nextWs) {
				return commandLine.slice(0, i).trim();
			}
			i++;
			continue;
		}

		if (c === '|' || c === ';') {
			return commandLine.slice(0, i).trim();
		}

		if (c === '<' || c === '>') {
			const start = redirectStartIndex(commandLine, i);
			return commandLine.slice(0, start).trim();
		}

		i++;
	}

	return commandLine.trim();
}

function isWhitespace(c: string): boolean {
	return c === ' ' || c === '\t' || c === '\r' || c === '\n';
}

/**
 * If `>` / `<` at `opIndex` is preceded by an fd number (e.g. `2>&1`), return
 * the index of that digit sequence; otherwise return `opIndex`. Digits are only
 * absorbed when they form their own token (start of string or after whitespace).
 */
function redirectStartIndex(commandLine: string, opIndex: number): number {
	let j = opIndex - 1;
	while (j >= 0 && commandLine[j] >= '0' && commandLine[j] <= '9') {
		j--;
	}
	if (j === opIndex - 1) {
		return opIndex;
	}
	// Digits found; include them only when not glued to a word (e.g. not `file2>`)
	if (j < 0 || isWhitespace(commandLine[j])) {
		return j + 1;
	}
	return opIndex;
}
