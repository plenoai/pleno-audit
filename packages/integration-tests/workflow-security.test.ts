/**
 * GitHub Actions workflow security regression tests.
 *
 * The sisakulint scan previously reported self-hosted runner usage and a
 * cache-poisoning risk on externally triggered workflows. Keep those
 * properties covered so the workflows are not weakened again.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const workflowsDirectory = fileURLToPath(
  new URL("../../.github/workflows/", import.meta.url),
);

const workflowNames = readdirSync(workflowsDirectory)
  .filter((name) => name.endsWith(".yml") || name.endsWith(".yaml"))
  .sort();

function readWorkflow(name: string): string {
  return readFileSync(join(workflowsDirectory, name), "utf8");
}

// Triggers that let a run start outside a trusted push to the default branch.
const externalTrigger =
  /^\s*(workflow_dispatch|schedule|repository_dispatch|pull_request_target|workflow_run):/m;

// Any dependency cache written by an externally triggered run can later be
// restored by pull requests, so reject every cache mechanism, not just one.
const cachePatterns = [
  /uses:\s*actions\/cache(?:\/[^@\s]+)?@/,
  /^\s*cache:\s*\S+/m,
  /^\s*cache-dependency-path:\s*\S+/m,
  /^\s*enable-cache:\s*(?!false\b)\S+/m,
];

describe("GitHub Actions workflow security", () => {
  it.each(workflowNames)("%s only uses GitHub-hosted runners", (name) => {
    const source = readWorkflow(name);

    expect(source).not.toMatch(/self-hosted/i);

    const runnerLabels = [...source.matchAll(/^\s*runs-on:\s*(.+)$/gm)].map(
      ([, label]) => label.trim(),
    );
    expect(runnerLabels.length).toBeGreaterThan(0);
    for (const label of runnerLabels) {
      expect(label).toMatch(/^ubuntu-/);
    }
  });

  it.each(workflowNames)(
    "%s does not enable dependency caching on externally triggered workflows",
    (name) => {
      const source = readWorkflow(name);

      if (!externalTrigger.test(source)) {
        return;
      }

      for (const pattern of cachePatterns) {
        expect(source).not.toMatch(pattern);
      }
    },
  );
});
