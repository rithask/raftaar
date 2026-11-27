# Changelog

Everything someone running Raftaar would notice, newest first. Versions follow [Semantic Versioning](https://semver.org/);
see [docs/versioning.md](docs/versioning.md) for what each kind of change means and how to cut a release.

## [Unreleased]

### Added

- Reminders due by distance say roughly when, at the vehicle's pace: "Due in 1,200 km, around 3 Jan" on the
  reminder, the vehicle page, the garage and in notifications (which also say the km a day it's based on). A date
  is given only from at least two weeks of readings, and only when it comes before the reminder's own due date.
- Search, from the button in the Garage's header: fill-ups (pump, place), services (title, workshop), expenses
  (title, vendor), papers (title, number, provider), reminders, and the notes on any of them. Results come by kind;
  tapping one opens it on its vehicle's page, on the right tab, with its form open.

### Changed

- km a day (on the vehicle page, and behind due-soon warnings) is worked out from at least two weeks of readings
  or trips, instead of a few days, so it isn't thrown off by a single long ride.

### Fixed

- Bottom bar on phones: it no longer shifts sideways and changes size when you switch sections. It's now one
  width whichever section is open, and only the highlight moves.

## [0.8.0] - 2026-11-24

### Added

- The Inbox has a To do | Done switch. Done lists what you've already dealt with, newest first: fill-ups and
  expenses you added (tap one to open its vehicle), ones you dismissed or that left Hisaab, and trips you put on a
  vehicle or marked "Not mine". Anything you dismissed, any trip, and anything added whose fill-up or expense has
  since been deleted can be put back in To do with one tap.
- Undo for everything you do in the Inbox: dismissing, putting trips on a vehicle or "Not mine", adding a fill-up
  or expense (Undo deletes it again), and putting something back in To do; also for taking a trip off a vehicle.
- Every Undo (these, and after a delete) is offered for 5 seconds, with a ring that counts the time down. Do
  several things in a row and their confirmations stack up (up to three), each with its own Undo, and say what
  they're about ("HP Petrol dismissed").

### Fixed

- On a computer, a swipe between tabs that started on a link (a fill-up, a "Needs a look" row) dragged the link
  instead of moving to the next tab.

## [0.7.1] - 2026-11-22

### Fixed

- Bottom bar on phones: the icon of the section you leave no longer jumps sideways once the slide has finished.
- Vehicle page tabs: a tab's label and its dot no longer shift slightly when the tab is chosen or left.

## [0.7.0] - 2026-11-22

### Added

- The vehicle page's tabs slide side by side, like pages on iOS: tap a tab or swipe between them. Each tab keeps
  its own scroll position, and switching no longer stutters or waits for anything to load.
- Logs say what the app is doing: at the normal level, which integrations are set up at startup, sign-ins,
  deletions, settings changes and each sync's result; with `LOG_LEVEL=DEBUG`, each record change, outside call and
  request. A request that takes 2 seconds or more is logged as a warning.

### Changed

- Vehicle photos in lists and cards are sent as small thumbnails (made the first time they're asked for), so the
  garage loads a few KB of images instead of the full photos.
- The Inbox and "Sold or retired" headings look like every other section heading.
- Faster: the garage and the vehicle page each load in one request with far fewer database queries, the app's
  files are sent compressed and kept by the browser, and the inbox no longer reads every fill-up ever recorded.
- The container starts in about half the time (Java's AOT cache, made when the image is built). The image is about
  115 MB bigger for it.
- The database gets a few new indexes for the lookups every page makes. This version upgrades the database when it
  starts, so going back to 0.6.0 afterwards means restoring the copy of `data/db` taken before upgrading.

## [0.6.0] - 2026-11-14

### Added

- Quick add on the vehicle page: a + next to the Fuel button (and next to Add fuel on larger screens) to log a
  service, add an expense, update the odometer, or add a paper or reminder, without finding the right tab first.
- Fill-ups work offline. Saved with no connection (a pump with no signal), a fill-up is kept on the phone, shown as
  "not sent yet", and sent by itself when you're back online; a bar says how many are waiting. The app also opens
  offline, showing what was last seen. Signing out clears what was kept. A fill-up sent twice (a lost reply, a
  double tap) is saved once.
- Reminders that are due or overdue have a Done button in the Upkeep tab. After a quick "Done today at 1,460 km?" it
  logs the service and restarts the countdown, without opening a form; the cost or workshop can be added to the
  service later.

### Changed

- Vehicle page on phones: a shorter photo, and what's due soon as a row of chips instead of a card, so the first
  fill-ups are on the first screen. Once the photo scrolls away, a slim bar keeps the name, back and edit at the
  top, with the tabs just under it.
- Vehicle page on wide screens (1280 px and up): two columns, with the tabs on the left and the numbers and what's
  due soon in a column on the right that stays in view as you scroll.
- The fill-up form is one screen: odometer, the price/litres/paid trio and Full tank up front; the time is "now"
  unless you change it; the vehicle is a line (with Change) when you start from its page; the skipped-fill-up
  switch, the pump and place, and notes are under More details, open by themselves when they have something. On
  phones, Save is a big button at the bottom (just above the keyboard on Android).
- An empty Inbox now says what would fill it: how to connect GeoPulse or Hisaab when neither is (with Open
  Settings), what comes from the connected ones and when they last checked, or that a connection is failing and why.
- Papers are grouped into Needs attention (expired first, then expiring), Valid and No expiry. Expired and expiring
  papers have a Renew button (on the Papers page and a vehicle's Papers tab) that opens the paper with its dates
  moved to the next term and asks for the new certificate; saving updates the paper, so reminders start over for the
  new date.
- Settings is a short list (Connections, Notifications, Fuel prices, Account), each with a one-line summary. On a
  phone each opens on its own page, and back returns to the list; on larger screens the list stays on the left with
  the section beside it.
- Deleting no longer asks "are you sure?". A deleted fill-up, service, reminder, paper, expense, vehicle,
  notification channel or fuel price disappears at once, and the toast offers Undo for 5 seconds before the delete
  is sent. Leaving the page sends it straight away. Toasts on the vehicle page sit above the floating Fuel button.

### Fixed

- A part of the app that fails to show (a tab, a page) now shows a message with Try again in its place, instead of
  blanking the whole app, navigation included.

## [0.5.0] - 2026-11-14

### Added

- Mileage chart: your usual range (the middle half of your tanks) is shaded, and the heading says what it is. A tank
  clearly worse than usual shows as an amber dot.
- Price paid chart on the Fuel tab: what you paid per litre at each fill-up. Where a published price was looked up
  (`FUEL_PRICE_URL`) or entered for that place, it's drawn as a dashed line beside yours.
- Spending by month on the Spend tab: fuel, service and other costs stacked for each of the last twelve months, with
  the monthly average.
- Odometer history: a small chart of your readings over time, and each reading shows how far you rode since the one
  before and how many km a day that was. A reading lower than the one before is shown in amber.

### Changed

- Odometer history dates now include the year, and the button to remove a reading you entered is a small bin icon.

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
