# Contributing to Pleno Audit

Thank you for your interest in contributing to Pleno Audit!

## Getting Started

Use Node.js 22.13 or newer on the 22.x, 24.x, or 26+ release lines and
pnpm 10.34.5 (pinned in `package.json`). Enable Corepack with `corepack enable`
to use the pinned pnpm version. Changesets 3 requires pnpm 10 or newer.

1. Fork the repository
2. Clone your fork
3. Install dependencies: `pnpm install`
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
