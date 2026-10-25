# Aktivität

## Komponentenfluss

Aktivitätseinträge werden zusammen mit den täglichen Check-ins erfasst. `server.py` validiert Name und Dauer, löst den Namen gegen den Aktivitätskatalog auf und speichert den Eintrag in `data/user/user.db`. `/api/activity/summary` stellt Tageswerte und Verlauf bereit; `/activity` und `web/activity.js` rendern die Darstellung.

`core/input_vector.py` baut einen Vektor aus dem Aktivitätskatalog und ruft das Aktivitätsnetz aus `core/ai/ai.py` auf. Wenn kein Modellwert verfügbar ist, wird der Score des Katalogeintrags genutzt. `activity_impact` aus `data/ai_konstanten/health.db` bildet den Modellscore auf Rebuild-Punkte ab.

Die Dauer gewichtet den Impact logarithmisch relativ zu 30 Minuten: `log1p(minuten / 30) / log(2)`. Das ist ein interner Gewichtungsfaktor, keine direkte Messung von Fitness oder Kalorien.

## Abgrenzung zu Empfehlungen

Gespeicherte Aktivitäten verwenden die erfasste Dauer. Automatische Empfehlungen sind getrennt: Sie schlagen Alternativen für ein festes freies 30-Minuten-Fenster vor. Ein lokaler Fallback kann Hobbynamen übernehmen, ohne deren Fitnessbezug zu bewerten.
