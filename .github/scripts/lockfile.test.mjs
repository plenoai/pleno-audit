import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

const manifest = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));

function pnpm(cwd, args) {
  const result = spawnSync('pnpm', args, { cwd, encoding: 'utf8' });
  assert.ifError(result.error);
  return { status: result.status, output: result.stdout + result.stderr };
}

test('lockfile generation uses the pinned CI pnpm version', () => {
  const result = pnpm(new URL('../..', import.meta.url), ['--version']);
  assert.equal(result.status, 0, result.output);
  assert.equal(`pnpm@${result.output.trim()}`, manifest.packageManager);
});

test('repair restores override consistency without installing dependencies', async (t) => {
  const cwd = mkdtempSync(join(tmpdir(), 'pnpm-lockfile-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const fixture = {
    name: 'lockfile-regression',
    private: true,
    packageManager: manifest.packageManager,
    scripts: { 'deps:lockfile': manifest.scripts['deps:lockfile'] },
    pnpm: { overrides: { ...manifest.pnpm.overrides } },
  };
  const writeManifest = () => writeFileSync(join(cwd, 'package.json'), JSON.stringify(fixture));
  const repair = () => pnpm(cwd, ['run', 'deps:lockfile', '--offline']);
  const frozen = () => pnpm(cwd, ['install', '--frozen-lockfile', '--ignore-scripts', '--offline']);
  writeManifest();
  const generated = repair();
  assert.equal(generated.status, 0, generated.output);
  const baseline = readFileSync(join(cwd, 'pnpm-lock.yaml'), 'utf8');
  const valid = frozen();
  assert.equal(valid.status, 0, valid.output);

  const overrides = manifest.pnpm.overrides;
  const cases = Object.keys(overrides).flatMap((name) => [
    [`changed ${name}`, { ...overrides, [name]: '0.0.0' }],
    [`missing ${name}`, Object.fromEntries(Object.entries(overrides).filter(([key]) => key !== name))],
  ]);
  cases.push(['extra override', { ...overrides, 'lockfile-test-extra': '1.0.0' }]);

  for (const [name, changedOverrides] of cases) {
    await t.test(name, () => {
      // Model a generated branch whose manifest and lockfile have drifted.
      fixture.pnpm.overrides = changedOverrides;
      writeManifest();
      writeFileSync(join(cwd, 'pnpm-lock.yaml'), baseline);
      const mismatch = frozen();
      assert.notEqual(mismatch.status, 0, mismatch.output);
      assert.match(mismatch.output, /ERR_PNPM_LOCKFILE_CONFIG_MISMATCH/);

      const repaired = repair();
      assert.equal(repaired.status, 0, repaired.output);
      const installed = frozen();
      assert.equal(installed.status, 0, installed.output);
    });
  }
});
