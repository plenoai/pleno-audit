import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";

const root = new URL("../../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");
const manifest = JSON.parse(read("package.json"));
const lockfile = read("pnpm-lock.yaml");

test("Changesets 3 uses a supported, pinned pnpm version", () => {
  assert.match(manifest.packageManager, /^pnpm@\d+\.\d+\.\d+$/);
  const major = Number(manifest.packageManager.split("@")[1].split(".")[0]);
  assert.ok(major >= 10, "Changesets 3 requires pnpm >=10");
  assert.match(manifest.devDependencies["@changesets/cli"], /^\^3\./);
  assert.ok(lockfile.includes(
    `      '@changesets/cli':\n        specifier: ${manifest.devDependencies["@changesets/cli"]}\n        version: 3.`,
  ), "the lockfile must resolve the requested Changesets major");
});

test("the frozen lockfile preserves every security override", () => {
  const block = lockfile.match(/^overrides:\n((?:[ \t].*\n|\n)*)/m)?.[1];
  assert.ok(block, "security overrides must be recorded in the lockfile");
  for (const [name, range] of Object.entries(manifest.pnpm.overrides)) {
    assert.ok(block.includes(`  ${name}: '${range}'\n`), `${name} override differs from package.json`);
  }
});

const workflows = readdirSync(new URL(".github/workflows/", root))
  .filter((name) => /\.ya?ml$/.test(name));

for (const name of workflows) {
  const source = read(`.github/workflows/${name}`);
  if (!source.includes("pnpm/action-setup@")) continue;

  test(`${name} uses the repository pnpm pin and frozen installs`, () => {
    const setupSteps = [...source.matchAll(
      /^      - uses: pnpm\/action-setup@[^\n]+\n((?:(?!      - )[^\n]*\n)*)/gm,
    )];
    assert.ok(setupSteps.length > 0);
    for (const [, step] of setupSteps) {
      assert.doesNotMatch(step, /^\s+version:/m, "read packageManager instead of overriding it");
    }
    assert.match(source, /run: pnpm install --frozen-lockfile/);
    assert.doesNotMatch(source, /--no-frozen-lockfile/);
  });
}
