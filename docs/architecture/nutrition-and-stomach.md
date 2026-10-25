# Ernährung und Stomach

## Komponentenfluss

Nach einem abgeschlossenen Schlaf-Check-in kann der Browser bis zu fünf Essen-/Bewegungs-Check-ins pro Tag absenden. Die Ernährungswerte kommen aus `/api/checkup/catalog` oder werden über `/api/checkup/resolve` einem Katalogeintrag zugeordnet. `server.py` speichert die aufgelösten Werte asynchron über `data/user/db_interaction.py`.

Für jeden Ernährungseintrag erstellt `core/input_vector.py` einen Merkmalsvektor und wertet ihn mit dem Ernährungsnetz aus `core/ai/ai.py` aus. Falls das Netz keinen Wert liefert, wird der gespeicherte Katalog-Score aus `data/ai_konstanten/health.db` verwendet. Die Impact-Tabelle übersetzt den Score in einen Beitrag zum Rebuild-Punktewert.

`/api/food/summary` liefert Tageswerte und Verlauf. `/stomach` und `web/food.js` stellen diese als Food-/Ernährungsübersicht dar.

## Grenzen

Ollama kann beim Auflösen von Freitext helfen, ist aber nicht der eigentliche Rechenweg des Ernährungsscores. Unbekannte Katalogeinträge werden nicht automatisch als trainierte Fakten behandelt. Score und Impacts sind interne Modellwerte, keine Ernährungsberatung.
