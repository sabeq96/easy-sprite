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

## Find your way around

- [docs/architecture.md](docs/architecture.md): how the app fits together, and the folder map
  (§2) for finding where something lives.
- [docs/conventions.md](docs/conventions.md): where code belongs and the code style. Most of the
  layering rules are enforced by `npm run lint`, so the linter will tell you when a file imports
  from the wrong place.
- [docs/shortcuts.md](docs/shortcuts.md): the keymap. Update it if you add or change a shortcut.

## Before you open a PR

```bash
npm run lint
npm run build           # type-checks the app and tests
npm run test:coverage   # unit + browser tests, with the coverage floor CI enforces
```

These are exactly what CI runs on every PR. While you work, `npm test` (unit only) and
`npm run test:watch` are quicker.

- **Add or update tests** for what you change. Tests live under `tests/`, mirroring `src/`:
  `tests/unit/` for code that doesn't touch React, the DOM or a canvas, `tests/browser/` for
  anything that does. [conventions.md §11](docs/conventions.md#11-testing) has the details. A bug
  fix should come with a test that fails without it.
- **Keep PRs focused.** Several small PRs are easier to review than one large one.
- **If you changed the UI, include a screenshot.**
- **Give the PR a [Conventional Commits](https://www.conventionalcommits.org/) title.** See
  below.

### PR titles

PRs are squash-merged, so the PR title becomes the commit on `main`. Releases are automated from
those titles: they decide the next version number and become the changelog entry. A check on
every PR makes sure the title has the right format. Your individual commit messages don't matter.

```
<type>: <what changed, written for users>
```

| Type | Use it for | Release |
| --- | --- | --- |
| `feat` | something new a user can do | minor version, listed under Features |
| `fix` | a bug fix a user would notice | patch version, listed under Bug Fixes |
| `perf` | faster or lighter, same behavior | patch version, listed under Performance |
| `docs`, `refactor`, `test`, `build`, `ci`, `chore` | everything else | no release on its own |

Examples: `feat: add a line tool`, `fix: paint bucket ignores locked layers`,
`docs: explain onion skin settings`. A scope is optional: `fix(export): keep transparent pixels`.

Add `!` after the type (`feat!: …`) for a breaking change, such as removing a feature or changing
a shortcut people rely on. Don't worry about getting it perfect; the maintainer can fix the title
before merging.

### Don't lose anyone's sprites

Users' work lives only in their browser's IndexedDB, so changes to stored data need extra care:

- Never edit an existing `db.version(n)` block in `src/db/db.ts`. Add a new version with an
  `.upgrade()` that migrates existing data, plus a test for the upgrade.
- If you change the backup format, bump `BACKUP_FORMAT_VERSION` and make sure older backups still
  import.
- Title these PRs `feat:` (or `feat!:` if older data can no longer be read), even for a small
  change, so the release that ships the new data format gets its own version and a changelog
  entry.

If you're unsure whether your change touches stored data, ask in the PR. That's what review is
for.

## Code of conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md). Be kind. We're all here
to make pixels.

## License

By contributing, you agree that your contributions will be licensed under the
[MIT License](LICENSE).
