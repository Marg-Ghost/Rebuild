# Übersicht und Scores

## Übersicht

`/home` liefert `web/pages/main/index.html`. `web/index.js` lädt parallel `/api/get_health_data/index`, `/api/daily-checkup/status` und `/api/me`, aktualisiert Verlauf und Fortschritt und fragt anschließend `/api/dashboard/recommendation` ab. Lang laufende Check-in-Auswertungen werden über einen Status-Polling-Mechanismus nachgeladen.

## Rebuild-Punkte

`data/user/db_interaction.py` liefert heutige Check-in-Werte und den Verlauf. Beim Speichern eines Check-ins ruft `server.py` die Bewertungslogik in `core/input_vector.py` auf. Sie kombiniert Schlaf, Ernährung und Aktivität. Essen und Aktivität werden über die Netze in `core/ai/ai.py` bewertet; Referenzvektoren, Katalog-Scores und Impacts kommen aus `data/ai_konstanten/health.db`. Wenn Gewichte nicht verfügbar sind, kann die Logik auf den Katalog-Score zurückfallen.

Der Dashboardwert ist der Mittelwert heutiger gespeicherter Rebuild-Punkte, nicht Ollama-Ausgabe und keine medizinisch validierte Diagnose. Die Empfehlungen-Seite bildet diesen Punktewert zusätzlich mit einer Sigmoidfunktion auf Prozent ab (`web/recommendations.js`).

## Belastungs-/Erholungswert

Der separate Endpunkt `/api/efficiency-score` lädt und speichert die Einschätzung. `data/user/health_score.py` rechnet lokal: Schlafkomponente 40 %, Stress-Selbsteinschätzung 30 % und Workload-Selbsteinschätzung 30 %. Eingaben und Ergebnis werden in `efficiency_scores` nutzerbezogen gespeichert.

Die Oberfläche sitzt am unteren Rand der Empfehlungen-Seite. `web/recommendations.js` lädt den letzten Wert und sendet Änderungen; die Berechnung benötigt keine LLM-Anfrage. Der Wert ist eine grobe Selbsteinschätzung, kein validierter Test.
