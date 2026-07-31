import * as assert from 'assert';
import { firstCommandTitle } from './commandTitle';

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

if (failed > 0) {
	console.error(`\n${failed} test(s) failed`);
	process.exit(1);
}
console.log(`\n${cases.length} test(s) passed`);
