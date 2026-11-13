# Changelog

Everything someone running Raftaar would notice, newest first. Versions follow [Semantic Versioning](https://semver.org/);
see [docs/versioning.md](docs/versioning.md) for what each kind of change means and how to cut a release.

## [Unreleased]

### Changed

- The pump and state lookups are off until you set their URL: `OVERPASS_URL` names the fuel pump,
  `NOMINATIM_URL` finds the state. Before, they used the public OpenStreetMap servers unless turned off.
  **Upgrade:** to keep the lookups, set `OVERPASS_URL=https://overpass-api.de/api/interpreter` and
  `NOMINATIM_URL=https://nominatim.openstreetmap.org` (or your own instances) in `.env`.

- Pump and state lookups go to each OpenStreetMap service one at a time, at least a second apart, and lookups
  for the same area share one request, so a sync with many stops doesn't flood the public servers.

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
