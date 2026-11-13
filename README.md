# Raftaar

Self-hosted log for your vehicles: fill-ups and mileage, services and reminders, upgrades and accessories,
and papers (insurance, PUC, RC, road tax, licence) with expiry alerts. It can pull trips from
[GeoPulse](https://github.com/tess1o/geopulse) and fuel payments from [Hisaab](https://github.com/rithask/hisaab).

- **Backend:** Java 25, Spring Boot 4.1, PostgreSQL, Flyway (`backend/`)
- **Frontend:** React + TypeScript + Vite + Tailwind, mobile-first (`frontend/`)
- **Notifications:** [Apprise](https://github.com/caronc/apprise) CLI, bundled in the image; channels are managed in Settings

## Run with Docker

```sh
mkdir raftaar && cd raftaar
curl -LO https://raw.githubusercontent.com/rithask/raftaar/main/compose.yaml
curl -L -o .env https://raw.githubusercontent.com/rithask/raftaar/main/.env.example
# edit .env: set APP_PASSWORD and POSTGRES_PASSWORD (and pin APP_VERSION)
docker compose up -d
```

Open http://localhost:8080 and sign in as `admin`. Everything is configured in `.env`; `compose.yaml` never needs
editing. From a checkout you can also build the image yourself: `docker compose up -d --build`.

**Your data stays in folders next to `compose.yaml`**, created on first start:

| Folder | What's in it |
|---|---|
| `./data/files` | vehicle photos and document scans |
| `./data/db` | the PostgreSQL database |

Back up by copying `./data` while the app is stopped (`docker compose stop`). Set `PUID`/`PGID` in `.env` to your own
user (`id`) so the files in `./data/files` belong to you.

## Run locally

Prerequisites: JDK 25, Node 20+, PostgreSQL with a `raftaar` database (`createdb raftaar`), and for
notifications the Apprise CLI (`pipx install apprise==2.1.0`).

```sh
cd backend
APP_PASSWORD=choose-a-password PORT=8090 ./mvnw spring-boot:run    # 8090, so it doesn't clash with Hisaab on 8080

cd frontend
npm install && npm run dev                                         # http://localhost:5174, proxies /api to 8090
```

## How mileage works

Mileage is measured only between two **full tanks**: the distance between them divided by all the fuel put in
since the first one (partial fills included). Mark a fill-up "I missed logging one before this" and that stretch is
skipped instead of showing a wrong figure. Of price, volume and total paid, any two give the third.

## Configuration

Every setting, with what it does, is in [`.env.example`](.env.example). Only `APP_PASSWORD` and `POSTGRES_PASSWORD`
are required; GeoPulse, Hisaab, the pump lookup and notifications are all optional. Notification channels are easiest
to add in Settings → Notifications.

## Fuel prices

There's no free official API for Indian fuel prices. Raftaar learns the price per state from your fill-ups, you
can set one in Settings, and `FUEL_PRICE_URL` can point at a source you trust.

## Tests

```sh
cd backend && ./mvnw test
cd frontend && npm run build   # type-check and build
```

## Releases

Pushing a tag `vX.Y.Z` makes GitHub Actions test the code, build the image for amd64 and arm64, publish it to
`ghcr.io/rithask/raftaar` and create a GitHub Release from [`CHANGELOG.md`](CHANGELOG.md):

```sh
./scripts/release.sh 0.1.0
git push origin main v0.1.0
```

What each kind of version bump means, and how to upgrade a server, is in [docs/versioning.md](docs/versioning.md).
