# Versioning and releases

Raftaar uses [Semantic Versioning](https://semver.org/): **MAJOR.MINOR.PATCH**, e.g. `1.4.2`.

The version is the **git tag** (`v1.4.2`). GitHub Actions builds the Docker image from that tag. The versions in
`backend/pom.xml` and `frontend/package.json` are kept in step by `scripts/release.sh`, and the app shows the
running version at the bottom of Settings and in `GET /api/health`.

## What each number means for this app

Raftaar isn't a library, so "breaking" means **breaking for the person running it**: anything that needs them to
do something by hand when upgrading, or that they can't undo by going back to the previous image.

| Bump | When | Examples |
|---|---|---|
| **MAJOR** `2.0.0` | Upgrading needs manual action, or can't be rolled back by switching the image back | An environment variable renamed or removed, or its meaning changed · a database migration that rewrites or deletes data · the minimum PostgreSQL version goes up · a feature removed · where data is stored changes (e.g. the `./data` folders) |
| **MINOR** `1.5.0` | New things, and everything that worked before still works with the same `.env` | A new feature or screen · a new **optional** setting with a safe default · an additive migration (new table or column) · a new integration |
| **PATCH** `1.4.3` | Fixes only; nothing new to learn or configure | A mileage calculation bug · a UI bug · a performance fix · a dependency security update · wording |

When unsure, choose the bigger bump. Major version numbers are free.

### Database migrations decide a lot

Flyway migrations (`backend/src/main/resources/db/migration/V*.sql`) only run forward. When a release adds a
migration, its image upgrades the database on start, and the previous image will then **refuse to start** (Flyway
sees a newer schema than it knows).

- A migration that **only adds** (new table, nullable column, index): MINOR. Rolling back means restoring a backup
  of `./data/db` taken before the upgrade, which the release notes should say.
- A migration that **changes or removes** existing data or columns: MAJOR, with an **Upgrade:** note.
- Never edit a migration that has been released. Add a new one.

### 0.x: trying it in production

`0.x` releases are for running the app for real before promising anything: any `0.MINOR` release may break things,
so bump `0.MINOR` for new features or breaking changes and `0.MINOR.PATCH` for fixes. CI doesn't publish a bare `:0`
tag for that reason. Once a `0.x` release has run without surprises, release **1.0.0**; from then on the table above
applies.

## Image tags

| You push | Image tags published | Use it when |
|---|---|---|
| tag `v1.4.2` | `1.4.2`, `1.4`, `1`, `latest` | normal releases |
| tag `v1.5.0-rc.1` | `1.5.0-rc.1` only | trying a release before it's final; pre-releases never move `latest`, `1.5` or `1` |
| commit on `main` | `edge`, `sha-<7 chars>` | testing the newest code |
| pull request | nothing (built and tested only) | |

Choose what the server follows with `APP_VERSION` in `.env`:

- `1.4.2`: exactly this version. Upgrades only when you change it. **Recommended**, because you choose when the
  database migrates, right after a backup.
- `1.4`: gets patch releases (fixes only) on the next `docker compose pull`.
- `1`: also gets new features, never breaking changes.
- `latest` / `edge`: not recommended for the real server.

## Cutting a release

1. **Record changes as you go.** In every change that someone running the app would notice, add a line under
   `## [Unreleased]` in `CHANGELOG.md`, under *Added*, *Changed*, *Fixed*, *Removed* or *Security*. Anything that
   needs manual action gets an **Upgrade:** line.
2. **Pick the number.** Read the Unreleased section against the table above. The biggest change decides.
3. **Release:**
   ```sh
   ./scripts/release.sh 0.2.0
   git push origin main v0.2.0
   ```
   The script checks you're on a clean, up-to-date `main`, moves the Unreleased notes under `## [0.2.0] - date`,
   sets the version in `pom.xml` and `package.json`, commits and tags.
4. **GitHub Actions** (`.github/workflows/docker.yml`) runs the tests, builds the image for amd64 and arm64, pushes
   it to `ghcr.io/<owner>/raftaar`, and creates a GitHub Release with that version's changelog.
5. **Upgrade the server:**
   ```sh
   # in the folder with compose.yaml and .env
   docker compose stop app
   cp -a data/db data/db-before-0.2.0       # a copy of the database, in case you need to roll back
   # set APP_VERSION=0.2.0 in .env
   docker compose pull && docker compose up -d
   ```
   Rolling back: set `APP_VERSION` to the old version. If the new version ran a migration, put the copy back first
   (`docker compose down`, swap `data/db` for `data/db-before-…`, `docker compose up -d`).

A release that turns out broken is never re-tagged. Fix it and release the next PATCH.

### Pre-releases

To try a version on the server before it's final: `./scripts/release.sh 0.3.0-rc.1`, push the tag, set
`APP_VERSION=0.3.0-rc.1`. When it's good, release `0.3.0` from the same commit.

## One-time setup on GitHub

1. Create the repository and push `main`. The workflow needs no secrets: it publishes with the built-in
   `GITHUB_TOKEN`.
2. After the first image is published, open the package on GitHub (your profile → Packages → raftaar). It starts
   **private**: either make it public, or on the server run `docker login ghcr.io -u <user>` with a personal access
   token that has the `read:packages` scope.
3. In `.env` on the server, set `APP_IMAGE=ghcr.io/<your-user>/raftaar` (lowercase).

You can still build on the server without GitHub: `docker compose up -d --build` builds this checkout and tags it as
`APP_IMAGE:APP_VERSION`.

## Upgrading PostgreSQL

The database container's major version (`POSTGRES_VERSION`) can't simply be changed: a newer PostgreSQL won't open an
older one's data folder. To move to a new major version:

1. `docker compose exec db pg_dump -U raftaar raftaar > raftaar.sql` (keep this file safe).
2. `docker compose down`, then `mv data/db data/db-old` (keep it until the new one works).
3. Set the new `POSTGRES_VERSION` in `.env` and `docker compose up -d db`.
4. `docker compose exec -T db psql -U raftaar raftaar < raftaar.sql`, then `docker compose up -d`.

If a release ever raises the minimum PostgreSQL version, that release is MAJOR and links to these steps.
