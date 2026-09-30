# Contributing to Easy Sprite

Thanks for stopping by! Easy Sprite is an off-hours project, so replies may take a few days, but
every issue and PR gets read.

## Ways to help

- **Report a bug:** [open an issue](https://github.com/sabeq96/easy-sprite/issues/new/choose) and
  describe what happened. A screenshot helps a lot.
- **Suggest a feature:** ideas of any size are welcome.
- **Send a PR:** small fixes can go straight to a PR. For bigger changes, open an issue first so
  we can agree on the approach before you spend your evenings on it.

Looking for a place to start? Check issues labelled
[`good first issue`](https://github.com/sabeq96/easy-sprite/labels/good%20first%20issue).

## Development setup

You'll need Node 22 (the version CI uses).

```bash
git clone git@github.com:sabeq96/easy-sprite.git
cd easy-sprite
npm install
npm run dev
```

The browser tests run in Chromium via Playwright. Install it once with
`npx playwright install chromium`.

## Before you open a PR

```bash
npm run lint
npm run build      # type-checks the app and tests
npm run test:all   # unit + browser tests
```

CI runs the same checks on every PR.

- Read [docs/conventions.md](docs/conventions.md). It explains where code belongs and the code
  style the project follows. [docs/architecture.md](docs/architecture.md) covers the bigger picture.
- Add or update tests for what you change.
- Keep PRs focused. Several small PRs are easier to review than one large one.
- If you changed the UI, include a screenshot.

## Code of conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md). Be kind. We're all here
to make pixels.

## License

By contributing, you agree that your contributions will be licensed under the
[MIT License](LICENSE).
