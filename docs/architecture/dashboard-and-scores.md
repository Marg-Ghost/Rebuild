# Overview and Scores

## Overview

`/home` serves `web/pages/main/index.html`. `web/index.js` loads `/api/get_health_data/index`, `/api/daily-checkup/status`, and `/api/me` in parallel, updates history and progress, and then requests `/api/dashboard/recommendation`. Long-running check-in scoring is refreshed through status polling.

## Rebuild points

`data/user/db_interaction.py` provides today's check-in values and history. When a check-in is saved, `server.py` calls the scoring logic in `core/input_vector.py`, which combines sleep, nutrition, and activity. Food and activity are scored by the networks in `core/ai/ai.py`; reference vectors, catalog scores, and impacts come from `data/ai_konstanten/health.db`. If weights are unavailable, the logic can fall back to the catalog score.

The dashboard value is the average of today's saved Rebuild points. It is not an Ollama output or a medically validated diagnosis. The Recommendations page has a separate, self-rating-based efficiency estimate.

## Dynamic efficiency estimate

`/api/efficiency` stores each stress and workload submission, together with available health inputs, in the user-scoped `efficiency_logs` table. The deterministic calculation is in `data/user/efficiency.py`: sleep duration and timing produce a 0–100 sleep score; that score is averaged equally with the available food and activity scores (also 0–100). Stress adds 0.3 points per rating point, up to 3 points. Missing food or activity scores are omitted from the average. Workload does not affect efficiency. The score loses a fixed 10 points per hour, and the countdown estimates when it falls below 20%.

The endpoint returns the current decayed score, decay rate, time remaining above the 20% threshold, and recent saved snapshots. `web/recommendations.js` renders a one-second countdown and an SVG chart of saved check-ins. This is a heuristic based on existing check-in scores and a stress self-rating, not a measurement of actual focus or productivity. The older `efficiency_scores` table remains in place for legacy records.
