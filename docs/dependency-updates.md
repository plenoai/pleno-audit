# Dependabot lockfile repair

The root `package.json` is the source of truth for pnpm overrides and the
`packageManager` version. All workflows let `pnpm/action-setup` read that version.
Keep dependency updates on the same pnpm version; do not remove or relax overrides
to make an update install. The overrides on main already match its lockfile.

For a generated branch with `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH` (such as #470):

1. Check out the current PR head in a clean checkout:

   ```bash
   gh pr checkout 470
   corepack enable
   pnpm --version
   ```

   Confirm the version matches the root `packageManager` field. If the PR predates
   the version pin, use the pin from main with `corepack prepare pnpm@9.15.9 --activate`
   before continuing.

2. Regenerate the lockfile from that branch's manifests, preserving the override
   policy. On a branch with the repair script, run:

   ```bash
   pnpm deps:lockfile
   ```

   For an older branch without the script, use the equivalent command:

   ```bash
   pnpm install --lockfile-only --ignore-scripts --no-frozen-lockfile
   ```

   Review the entire diff, including resolved versions. Confirm **every key and
   value** in `package.json`'s `pnpm.overrides` matches the lockfile's top-level
   `overrides`, with no missing or additional entries. Do not merely copy the
   override header: pnpm must also update the dependency graph.

3. Verify the generated file without rewriting it:

   ```bash
   pnpm install --frozen-lockfile
   pnpm test:lockfile # when available on the branch
   ```

   Frozen installation validates override equality as well as workspace manifest
   consistency. The regression tests exercise changed and missing values for each
   manifest override, an extra override, and repair followed by frozen validation.

4. Commit and push the reviewed lockfile to the PR branch. A push triggers a fresh
   CI run. Watch checks on the **new head SHA**:

   ```bash
   gh pr view 470 --json headRefOid
   gh pr checks 470 --watch
   ```

   Require test/coverage, lint, typecheck, build, UI tests, fuzzing, and CodeQL to
   finish successfully on that head before merging. Previous-head results do not
   count. Rerunning an old failed run does not validate a new commit. Keep frozen
   installation enabled in all validation jobs.

5. After the group is repaired and its checks pass, list remaining updates:

   ```bash
   gh pr list --author 'app/dependabot' --state open --limit 100
   ```

   Compare each candidate's package names and **exact target versions** with the
   group PR's reviewed manifest and lockfile diff. Record that comparison before
   closing a superseded PR. Close only when every update in that PR is included
   at the same version in the group; a shared package name, a compatible range,
   or a newer/different version is insufficient. Leave unrelated updates open.

GitHub authentication and permission to push the Dependabot branch, view checks,
and close PRs are needed for the hosted steps. Repository-local checks alone do
not establish that #470's updated head passed CI or that another PR is redundant.
