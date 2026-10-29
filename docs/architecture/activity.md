# Activity

## Component flow

Activity entries are recorded with daily check-ins. `server.py` validates the name and duration, matches the name against the activity catalog, and stores the entry in `data/user/user.db`. `/api/activity/summary` provides daily values and history; `/activity` and `web/activity.js` render them.

`core/input_vector.py` builds a vector from the activity catalog and calls the activity network in `core/ai/ai.py`. If no model value is available, it uses the catalog entry's score. `activity_impact` in `data/ai_konstanten/health.db` maps the model score to Rebuild points.

Duration weights the impact logarithmically relative to 30 minutes: `log1p(minutes / 30) / log(2)`. This is an internal weighting factor, not a direct measure of fitness or calories.

## How recommendations differ

Logged activities use the duration entered by the user. Automatic recommendations are separate: they suggest alternatives for a fixed, free 30-minute slot. A local fallback may use hobby names without evaluating whether they involve fitness.
