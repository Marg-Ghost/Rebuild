# Overview and Scores

## Overview

`/home` serves `web/pages/main/index.html`. `web/index.js` loads `/api/get_health_data/index`, `/api/daily-checkup/status`, and `/api/me` in parallel, updates history and progress, and then requests `/api/dashboard/recommendation`. Long-running check-in scoring is refreshed through status polling.

## Rebuild points

`data/user/db_interaction.py` provides today's check-in values and history. When a check-in is saved, `server.py` calls the scoring logic in `core/input_vector.py`, which combines sleep, nutrition, and activity. Food and activity are scored by the networks in `core/ai/ai.py`; reference vectors, catalog scores, and impacts come from `data/ai_konstanten/health.db`. If weights are unavailable, the logic can fall back to the catalog score.

The dashboard value is the average of today's saved Rebuild points. It is not an Ollama output or a medically validated diagnosis. The Recommendations page also maps this point value to a percentage using a sigmoid function (`web/recommendations.js`).

## Workload and recovery score

The separate `/api/efficiency-score` endpoint loads and saves this assessment. `data/user/health_score.py` calculates it locally: sleep is weighted at 40%, self-reported stress at 30%, and self-reported workload at 30%. Inputs and results are stored per user in `efficiency_scores`.

The form appears near the bottom of the Recommendations page. `web/recommendations.js` loads the latest value and submits changes; the calculation does not require an LLM request. This is a rough self-assessment, not a validated test.
