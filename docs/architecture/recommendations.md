# Empfehlungen

## Zwei Empfehlungspfade

Die Übersicht fragt `/api/dashboard/recommendation` ab. Die Empfehlungen-Seite nutzt `/api/recommendations`, `web/recommendations.js` und die Kalenderdaten zur Suche nach einem freien 30-Minuten-Fenster. Beide Pfade können eine priorisierte Anfrage an die LLM-Queue stellen.

Für Aktivitätsvorschläge bildet der Server einen Kontext aus dem Profilhobby und dem nächsten freien Kalenderfenster. Ollama kann bis zu drei Vorschläge mit Begründung und einem optionalen `estimated_health_score_delta` liefern. Die Aktivitätsdauer der Empfehlung ist im aktuellen Servercode fest auf 30 Minuten gesetzt.

Ist die Modellanfrage nicht verfügbar oder liefert sie keine verwendbaren Aktivitäten, kann der `/api/recommendations`-Endpunkt Hobbys direkt als Vorschläge zurückgeben. Dieser Fallback bewertet nicht, ob ein Hobby körperliche Bewegung beinhaltet. Darum kann beispielsweise Klavierspielen auftauchen. Der Fallback liefert kein Punktdelta.

## Anzeige der Wirkung

`web/recommendations.js` lädt den aktuellen Punktewert und berechnet die Prozentdarstellung mit einer Sigmoidfunktion. Ein geschätzter Prozentbeitrag wird nur angezeigt, wenn Ollama ein Punktdelta geliefert hat; dann wird die Differenz der Sigmoidwerte vor und nach diesem Delta gebildet. Das ist eine Schätzung aus dem LLM-Output, nicht die eigentliche Rebuild-Punkteberechnung.

Die Empfehlungskarten sind Alternativen für dasselbe freie Fenster. Die UI zeigt daher bei jeder Karte dieselbe Fensterzeit und 30 Minuten an. Bei mehreren Vorschlägen wächst die grüne Karte in der Höhe.
