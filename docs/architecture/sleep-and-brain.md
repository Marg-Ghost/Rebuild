# Schlaf und Brain

## Komponentenfluss

1. `/sleep-checkup` liefert das Schlaf-Formular aus.
2. `web/main.js` sendet die Einschätzung an `POST /api/sleep-checkup`.
3. `server.py` prüft die Session und Eingaben und delegiert die Berechnung und Speicherung an `data/user/db_interaction.py` sowie Schlaf-Funktionen aus `core/input_vector.py`.
4. `GET /api/brain/summary` liest die nutzerbezogene Historie.
5. `/brain` und `web/brain.js` stellen Schlafstunden, späte Nächte, Qualität und Verlauf dar.

Die Schlafreferenzwerte liegen in `data/ai_konstanten/health.db`. Schlaf wird außerdem in der Rebuild-Punkteberechnung und in der lokalen Belastungs-/Erholungsformel berücksichtigt. Diese Werte sind App-Orientierung und keine medizinische Diagnose.

## Zuständigkeiten

- HTML: `web/pages/checkups/sleep_checkup.html`, `web/pages/main/brain.html`
- Browserdarstellung: `web/brain.js`, `web/main.js`
- API und Sessionprüfung: `server.py`
- Datenzugriff: `data/user/db_interaction.py`
- Rechen-/Referenzlogik: `core/input_vector.py`, `data/ai_konstanten/health.db`
