# Calendar

## Local tasks

`/kalender` serves `web/pages/kalender/kalender.html`. `Kalender/web/kalender.js` calls `/api/kalender/get` to load tasks and `/api/kalender/add` to save them. `server.py` checks the session, validates inputs, and delegates to `Kalender/date.py` and `Kalender/data/database.py`.

The calendar database stores user-scoped tasks and optional time ranges. The UI shows monthly views and supports adding tasks and switching months; the current API does not support editing or deleting tasks.

## Google iCal connection

`POST /api/calendar/connect-google` accepts a private iCal address. `Kalender/google_calendar.py` checks the host, scheme, and DNS targets, downloads the feed with size and event limits, parses events, and stores the source and imported events. This is a one-time import each time the endpoint is called; no background sync runs. `GET /api/calendar/google/status` returns whether a source is stored and when it was last imported.

Imported events are also considered when searching for free time slots for activity recommendations. Only tasks and events already stored in Rebuild are considered. This flow does not use Google OAuth; it imports through a private iCal URL.
