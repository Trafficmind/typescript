# Contributing to Trafficmind TypeScript SDK

Thank you for your interest in contributing! This document covers everything you need to get started.

## Table of Contents

- [Development Setup](#development-setup)
- [Running Tests](#running-tests)
- [Code Style](#code-style)
- [Commit Style](#commit-style)
- [Pull Request Process](#pull-request-process)
- [Reporting Bugs](#reporting-bugs)
- [Security Vulnerabilities](#security-vulnerabilities)

---

## Development Setup

**Requirements:** Node.js 18+, npm

```bash
git clone https://github.com/trafficmind/typescript.git
cd typescript
npm install
```

---

## Running Tests

```bash
# Build + run all tests
npm test

# Type check without emitting files
npx tsc --noEmit

# Build ESM only
npm run build:esm

# Build CJS only
npm run build:cjs

# Full build (ESM + CJS)
npm run build
```

All checks must pass before submitting a PR. The CI pipeline runs the full suite
on Node.js 18, 20, and 22.

---

## Code Style

- Use **TypeScript strict mode** — do not disable strict checks or add `@ts-ignore` without a clear comment explaining why.
- All public API surface must be fully typed — avoid `any`.
- Use `readonly` for class properties that are not modified after construction.
- Keep classes `final` in spirit — avoid deep inheritance hierarchies.
- Private methods and fields should use the `#` prefix (native private, not `private` keyword).
- Import type-only symbols with `import type` — required by `verbatimModuleSyntax`.

---

## Commit Style

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short summary>
```

**Types:** `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`

**Examples:**

```
feat(retry): add jitter to exponential backoff
fix(client): correct Retry-After header parsing for float values
docs(readme): add OpenTelemetry integration example
test(dns): add edge case for empty paginate response
```

Commits power the automated changelog via `release-please` — please use the correct type.

---

## Pull Request Process

1. **Fork** the repository and create a branch from `main`.
2. **Write tests** for any new behaviour — all existing tests must continue to pass.
3. **Run all checks** locally: `npm test && npx tsc --noEmit`.
4. **Open a PR** against `main` with a clear description of what changed and why.
5. Reference any related issues with `Closes #<issue>` in the PR body.
6. A maintainer will review within a few business days.

**Breaking changes** must be discussed in an issue before implementation.
All breaking changes require a major version bump and a migration note in the PR.

---

## Reporting Bugs

Use the [Bug Report](https://github.com/trafficmind/typescript/issues/new?template=bug_report.yml) issue template.

Please include:
- Node.js version and OS
- SDK version (`npm list trafficmind-typescript-sdk`)
- Minimal reproducible code snippet
- Expected vs. actual behaviour

---

## Security Vulnerabilities

**Do not open a public issue for security vulnerabilities.**
Please follow the process described in [SECURITY.md](SECURITY.md).