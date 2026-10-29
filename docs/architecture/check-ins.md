# Check-ins

## Pages and endpoints

- First-time setup: `web/pages/checkups/checkup_first.html`, the registration profile, and `/register_info`.
- Sleep: `/sleep-checkup` and `/api/sleep-checkup`.
- Food and activity: `/checkup`, `/api/checkup/catalog`, `/api/checkup/resolve`, and `/api/checkup_data`.
- Daily status: `/api/daily-checkup/status` and `/api/daily-checkup`.
- Browser logic: `web/main.js` and `web/index.js`.

## Data flow

The browser loads reference values and sends structured form data. `server.py` validates types, counts, and durations, normalizes activities, and matches entries through catalogs. Free-text matching may use an Ollama request; catalog values themselves remain in `health.db`. Scoring and persistence follow.

Daily check-ins run asynchronously: the server creates a job in the user database, starts scoring as a background task, and then updates saved entries and the job status. The status endpoint provides the Overview with counts, sleep status, and processing state. Each day supports one sleep check-in and up to five food/activity check-ins.

## Persistence and limits

Tables and functions for sleep, check-ins, and pending jobs are in `data/user/db_interaction.py`. Scoring uses `core/input_vector.py`, `core/ai/ai.py`, and `data/ai_konstanten/health.db`. Check-in data is scoped to the user. Failed or unmatched free-text entries are not stored as arbitrary reference data.
