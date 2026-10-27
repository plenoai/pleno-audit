# Contributing to Pleno Audit

Thank you for your interest in contributing to Pleno Audit!

## Getting Started

1. Fork the repository
2. Clone your fork
3. Enable Corepack (`corepack enable`) and install dependencies: `pnpm install --frozen-lockfile`.
   The root `packageManager` field pins the pnpm version used locally, by Dependabot, and in CI.
4. Create a branch for your changes

## Development

```bash
# Install dependencies
pnpm install

# Run development server
pnpm dev

# Run tests
pnpm test

# Run linting
pnpm lint
```

## Pull Request Process

1. Create a branch from `main`
2. Make your changes
3. Ensure tests pass: `pnpm test`
4. Ensure linting passes: `pnpm lint`
5. Submit a pull request to `main`

For Dependabot lockfile mismatches and superseded updates, follow the
[dependency update procedure](docs/dependency-updates.md).

## Commit Messages

We use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` new feature
- `fix:` bug fix
- `docs:` documentation
- `chore:` maintenance
- `refactor:` code refactoring
- `test:` adding tests

## Code of Conduct

- Be respectful and inclusive
- Focus on constructive feedback
- Help others learn and grow

## Security

For security vulnerabilities, please see [SECURITY.md](.github/SECURITY.md).

## License

By contributing, you agree that your contributions will be licensed under the AGPL-3.0-or-later license.
