import * as assert from 'assert';
import {
	TAB_TITLE_CLOSE_RESERVE,
	TAB_TITLE_MIN_UNITS,
	firstCommandTitle,
	padTabTitle,
	stripTabTitlePad,
} from './commandTitle';

const cases: Array<{ input: string; expected: string; note?: string }> = [
	// chains
	{ input: 'cd foo && npm run dev', expected: 'cd foo' },
	{ input: 'a || b', expected: 'a' },
	{ input: 'a | b', expected: 'a' },
	{ input: 'a; b', expected: 'a' },
	{ input: 'a\nb', expected: 'a' },
	{ input: '  npm test  ', expected: 'npm test' },
	{ input: '', expected: '' },
	{ input: '   ', expected: '' },

	// cmd.exe bare & (whitespace-bounded)
	{ input: 'cd foo & npm start', expected: 'cd foo' },
	{ input: 'a & b', expected: 'a' },

	// PowerShell call operator — do not split
	{ input: "& 'C:\\Path\\app.exe'", expected: "& 'C:\\Path\\app.exe'" },
	{ input: '& ./script.ps1 -x', expected: '& ./script.ps1 -x' },

	// redirections
	{ input: 'npm run build 2>&1', expected: 'npm run build' },
	{ input: 'cmd 2>/dev/null', expected: 'cmd' },
	{ input: 'cmd 1>out', expected: 'cmd' },
	{ input: 'cmd > out.txt', expected: 'cmd' },
	{ input: 'cmd >> out.txt', expected: 'cmd' },
	{ input: 'cmd < in.txt', expected: 'cmd' },
	{ input: 'cmd &>/dev/null', expected: 'cmd' },
	{ input: 'cmd 2>>err.log', expected: 'cmd' },
	// digits glued to a word are not an fd
	{ input: 'echo hi2>file', expected: 'echo hi2' },

	// quotes protect operators
	{ input: 'echo "a && b" && npm test', expected: 'echo "a && b"' },
	{ input: "echo 'a | b' | cat", expected: "echo 'a | b'" },
	{ input: 'curl -d "<xml>hi</xml>"', expected: 'curl -d "<xml>hi</xml>"' },
	{ input: 'git commit -m "fix > bar"', expected: 'git commit -m "fix > bar"' },
	{ input: 'echo "a \\" && b" && c', expected: 'echo "a \\" && b"' },

	// combined
	{ input: 'npm run build 2>&1 && deploy', expected: 'npm run build' },
	{ input: 'echo "x" | wc -l', expected: 'echo "x"' },
];

let failed = 0;
for (const { input, expected, note } of cases) {
	const actual = firstCommandTitle(input);
	try {
		assert.strictEqual(actual, expected, note ?? JSON.stringify(input));
		console.log(`  ok  ${JSON.stringify(input)} -> ${JSON.stringify(actual)}`);
	} catch (err) {
		failed++;
		console.error(`  FAIL ${JSON.stringify(input)}`);
		console.error(`       expected ${JSON.stringify(expected)}`);
		console.error(`       actual   ${JSON.stringify(actual)}`);
		if (err instanceof Error && err.message) {
			console.error(`       ${err.message}`);
		}
	}
}

function nbspCount(title: string): number {
	return [...title].filter(ch => ch === '\u00A0').length;
}

function expectedPads(core: string): { nbsps: number; left: number; right: number } {
	if (!core) {
		return { nbsps: 0, left: 0, right: 0 };
	}
	const extra = Math.max(0, TAB_TITLE_MIN_UNITS - [...core].length);
	const total = extra + TAB_TITLE_CLOSE_RESERVE;
	let left = Math.floor(total / 2);
	let right = total - left;
	if (right < TAB_TITLE_CLOSE_RESERVE) {
		const shift = TAB_TITLE_CLOSE_RESERVE - right;
		left -= shift;
		right += shift;
	}
	return { nbsps: left + right, left, right };
}

function sidePads(title: string, core: string): { left: number; right: number } {
	const i = title.indexOf(core);
	return {
		left: nbspCount(title.slice(0, i)),
		right: nbspCount(title.slice(i + core.length)),
	};
}

const padCases: Array<{ input: string; core: string }> = [
	{ input: 'x', core: 'x' },
	{ input: 'g', core: 'g' },
	{ input: 'h', core: 'h' },
	{ input: 'cd', core: 'cd' },
	{ input: 'claude', core: 'claude' },
	{ input: 'npm run dev', core: 'npm run dev' },
	{ input: '  x  ', core: 'x' },
	{ input: '', core: '' },
	{ input: '   ', core: '' },
];

for (const { input, core } of padCases) {
	const actual = padTabTitle(input);
	const expected = expectedPads(core);
	try {
		assert.strictEqual(stripTabTitlePad(actual), core, `strip ${JSON.stringify(input)}`);
		assert.strictEqual(nbspCount(actual), expected.nbsps, `nbsp ${JSON.stringify(input)}`);
		if (core) {
			const sides = sidePads(actual, core);
			assert.strictEqual(sides.left, expected.left, `left ${JSON.stringify(input)}`);
			assert.strictEqual(sides.right, expected.right, `right ${JSON.stringify(input)}`);
			assert.ok(sides.right >= TAB_TITLE_CLOSE_RESERVE, `close reserve ${JSON.stringify(input)}`);
			assert.ok(actual.startsWith('\u200B') && actual.endsWith('\u200B'), `zwsp ${JSON.stringify(input)}`);
			assert.strictEqual(padTabTitle(actual), actual, `idempotent ${JSON.stringify(input)}`);
		} else {
			assert.strictEqual(actual, '');
		}
		console.log(`  ok  pad ${JSON.stringify(input)} -> ${core || '(empty)'} L${expected.left}/R${expected.right}`);
	} catch (err) {
		failed++;
		console.error(`  FAIL pad ${JSON.stringify(input)}`);
		if (err instanceof Error && err.message) {
			console.error(`       ${err.message}`);
		}
	}
}

// rename trim() must not eat padding on either side
{
	const padded = padTabTitle('x');
	try {
		assert.strictEqual(padded.trim(), padded, 'trim keeps close-button pad');
		assert.ok(stripTabTitlePad(padded.trim()).length < padded.length);
		assert.ok(sidePads(padded, 'x').left > 0, 'short title is centered');
		console.log('  ok  pad survives String.trim() and centers short titles');
	} catch (err) {
		failed++;
		console.error('  FAIL pad survives String.trim() and centers short titles');
		if (err instanceof Error && err.message) {
			console.error(`       ${err.message}`);
		}
	}
}

if (failed > 0) {
	console.error(`\n${failed} test(s) failed`);
	process.exit(1);
}
console.log(`\n${cases.length + padCases.length + 1} test(s) passed`);
