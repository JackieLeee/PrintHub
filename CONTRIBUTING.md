# Contributing

Thanks for your interest in PrintHub.

## Setup

```bash
pnpm install
pnpm dev
```

## Before a pull request

1. Create a branch from `main`.
2. Run `pnpm build` and, when touching ESC/POS parsing, `pnpm --filter @virt-printer/escpos test`.
3. Keep changes focused; match existing code style.
4. Update README if behavior or usage changes.

## Commits

Use conventional commits when possible: `feat`, `fix`, `docs`, `refactor`, `chore`.

## Questions

Open a GitHub issue for bugs, ideas, or questions.
