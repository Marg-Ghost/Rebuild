# Check-ins

## Seiten und Endpunkte

- Ersteinrichtung: `web/pages/checkups/checkup_first.html`, Registrierungsprofil und `/register_info`.
- Schlaf: `/sleep-checkup` und `/api/sleep-checkup`.
- Essen und Bewegung: `/checkup`, `/api/checkup/catalog`, `/api/checkup/resolve`, `/api/checkup_data`.
- Tagesstatus: `/api/daily-checkup/status` und `/api/daily-checkup`.
- Browserlogik: `web/main.js` und `web/index.js`.

## Datenfluss

Der Browser lädt Referenzwerte und sendet strukturierte Formulardaten. `server.py` prüft Typen, Mengen und Dauer, normalisiert die Aktivitäten und löst Einträge über Kataloge auf. Freitext-Zuordnung kann eine Ollama-Anfrage verwenden; Katalogwerte selbst bleiben in `health.db`. Anschließend werden Scoring und Persistenz durchgeführt.

Tägliche Check-ins laufen asynchron: Der Server legt einen Job in der Nutzerdatenbank an, startet die Auswertung als Hintergrund-Task und aktualisiert danach gespeicherte Einträge und Jobstatus. Der Status-Endpunkt versorgt die Übersicht mit Anzahl, Schlafstatus und laufender Verarbeitung. Es gibt einen Schlaf-Check-in und bis zu fünf Essens-/Aktivitäts-Check-ins pro Tag.

## Persistenz und Grenzen

Tabellen und Funktionen für Schlaf, Check-ins und ausstehende Jobs liegen in `data/user/db_interaction.py`. Die Auswertung verwendet `core/input_vector.py`, `core/ai/ai.py` und `data/ai_konstanten/health.db`. Check-in-Daten sind nutzergebunden. Fehlgeschlagene oder nicht zuordenbare Freitext-Einträge werden nicht als beliebige Referenzdaten gespeichert.
