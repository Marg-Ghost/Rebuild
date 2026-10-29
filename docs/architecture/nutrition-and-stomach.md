# Nutrition and Stomach

## Component flow

After completing a sleep check-in, the browser can submit up to five food/activity check-ins per day. Nutrition values come from `/api/checkup/catalog` or are matched to a catalog entry through `/api/checkup/resolve`. `server.py` asynchronously stores the resolved values through `data/user/db_interaction.py`.

For each food entry, `core/input_vector.py` builds a feature vector and scores it with the nutrition network in `core/ai/ai.py`. If the network does not return a value, the saved catalog score from `data/ai_konstanten/health.db` is used. The impact table maps the score to a contribution to the Rebuild point value.

`/api/food/summary` provides daily values and history. `/stomach` and `web/food.js` display the nutrition overview.

## Limitations

Ollama can help match free text, but it is not the calculation path for the nutrition score itself. Unknown catalog entries are not automatically treated as trained facts. Scores and impacts are internal model values, not nutrition advice.
