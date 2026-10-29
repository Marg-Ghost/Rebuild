# Sleep and Brain

## Component flow

1. `/sleep-checkup` serves the sleep form.
2. `web/main.js` sends the assessment to `POST /api/sleep-checkup`.
3. `server.py` checks the session and inputs, then delegates calculation and storage to `data/user/db_interaction.py` and sleep functions in `core/input_vector.py`.
4. `GET /api/brain/summary` reads the user's history.
5. `/brain` and `web/brain.js` display sleep hours, late nights, quality, and history.

Sleep reference values are stored in `data/ai_konstanten/health.db`. Sleep is also included in the Rebuild point calculation and the local workload/recovery formula. These are app guidance values, not a medical diagnosis.

## Responsibilities

- HTML: `web/pages/checkups/sleep_checkup.html`, `web/pages/main/brain.html`
- Browser rendering: `web/brain.js`, `web/main.js`
- API and session checks: `server.py`
- Data access: `data/user/db_interaction.py`
- Calculation and reference logic: `core/input_vector.py`, `data/ai_konstanten/health.db`
