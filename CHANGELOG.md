# Changelog

Everything someone running Raftaar would notice, newest first. Versions follow [Semantic Versioning](https://semver.org/);
see [docs/versioning.md](docs/versioning.md) for what each kind of change means and how to cut a release.

## [Unreleased]

## [0.4.0] - 2026-11-14

### Added

- Odometer history. Tap the odometer on a vehicle's page to see every reading it has, newest first, and where each
  came from (a fill-up, a service, an expense, the purchase, or entered by hand). Readings you entered by hand can
  be removed there; the others are changed with their fill-up, service or expense.

## [0.3.2] - 2026-11-13

### Changed

- When a request to Hisaab, GeoPulse or OpenStreetMap breaks off (a reset stream, a dropped connection), the log
  and Settings now say which request it was and what happened, e.g. "Hisaab sync failed: GET https://…/api/v1/
  transactions?limit=200: Received RST_STREAM: Internal error", so it can be found in the other side's logs.
  `LOG_LEVEL=DEBUG` adds the full error chain.

## [0.3.1] - 2026-11-13

### Fixed

- With `APP_PASSWORD` set, the account is now created before the app takes requests. Before, the welcome page was
  open for a moment on first start, so someone else could have created the account first.

### Changed

- Clearer logs. A failure caused by an outside service (down, slow, refusing) is one warning saying what happened,
  e.g. "Hisaab sync failed: Can't connect to http://hisaab:8080"; anything else is logged as an error with its stack
  trace. A failed "Sync now" is now logged too, password sign-ins and sign-outs are logged like provider ones, and a
  missing Apprise is reported at startup. Error messages in the app read the same way.

## [0.3.0] - 2026-11-13

### Changed

- The pump and state lookups are off until you set their URL: `OVERPASS_URL` names the fuel pump,
  `NOMINATIM_URL` finds the state. Before, they used the public OpenStreetMap servers unless turned off.
  **Upgrade:** to keep the lookups, set `OVERPASS_URL=https://overpass-api.de/api/interpreter` and
  `NOMINATIM_URL=https://nominatim.openstreetmap.org` (or your own instances) in `.env`.

- Pump and state lookups go to each OpenStreetMap service one at a time, at least a second apart, and lookups
  for the same area share one request, so a sync with many stops doesn't flood the public servers.

- When an OpenStreetMap service is busy or down (429, 5xx, timeouts), lookups back off: retried after about 1, 2
  and 4 seconds (longer if it sends Retry-After), then that service is paused for 30 s, 1, 2, 4… minutes (up to an
  hour) until it answers again. Fill-ups still save meanwhile, without the pump name or state.

### Removed

- `OSM_LOOKUPS_ENABLED`: leave the URLs unset instead.

## [0.2.0] - 2026-11-13

### Added

- Sign in with an OpenID Connect provider such as Pocket ID (`OIDC_*` in `.env`). The first sign-in asks to link the
  provider account to yours; after that only that account can use it. Settings → Account shows and unlinks it.
- `OIDC_AUTO_REDIRECT` goes straight to the provider from the sign-in page; `PASSWORD_LOGIN=false` hides the
  password form once OIDC is set up.
- A welcome page creates your account the first time Raftaar is opened, with a password or with the provider.
- Settings → Account: change your username and password.
- `RESET_PASSWORD` to get back in if you're locked out.

### Changed

- The account is kept in the database instead of `.env`, so `APP_PASSWORD` is no longer required.
  **Upgrade:** nothing to do. If `APP_PASSWORD` is set, it creates the account on the first start of this version
  (with `APP_USERNAME`, default `admin`); after that both can be removed from `.env`.

## [0.1.0] - 2026-11-13

### Added

- Garage of vehicles (motorcycles, scooters, cars) with photos, odometer and mileage at a glance.
- Fill-ups with automatic price / litres / amount maths, mileage measured between full tanks.
- Service history, reminders by km and/or date, expenses, and papers with expiry alerts.
- GeoPulse: trips to put on a vehicle, and stops at fuel pumps found from GPS.
- Hisaab: fuel payments become fill-ups to confirm.
- Fuel prices by state, learnt from fill-ups or set by hand.
- Notifications through Apprise, set up in Settings.
- Phone-first design with a floating tab bar, and a collapsible sidebar on larger screens.
- Graphite colour theme (light and dark) and the scooter logo.
