# Kalender

## Lokale Aufgaben

`/kalender` liefert `web/pages/kalender/kalender.html`. `Kalender/web/kalender.js` ruft `/api/kalender/get` zum Laden und `/api/kalender/add` zum Speichern auf. `server.py` prüft die Session, validiert Eingaben und delegiert an `Kalender/date.py` sowie `Kalender/data/database.py`.

Die Kalenderdatenbank speichert nutzergebundene Aufgaben und optionale Zeitbereiche. Die UI zeigt Monatsansichten und ermöglicht Hinzufügen und Monatswechsel; die aktuelle API bietet kein Bearbeiten oder Löschen.

## Google-iCal-Verbindung

`POST /api/calendar/connect-google` nimmt eine iCal-Privatadresse entgegen. `Kalender/google_calendar.py` prüft Host, Schema und DNS-Ziele, lädt den Feed mit Größen- und Eventgrenzen, parst Termine und speichert die Quelle beziehungsweise importierten Ereignisse. `GET /api/calendar/google/status` liefert den Verbindungsstatus.

Die importierten Termine werden auch bei der Suche nach freien Zeitfenstern für Aktivitätsempfehlungen berücksichtigt. Google OAuth wird in diesem Ablauf nicht verwendet; die Verbindung erfolgt über eine private iCal-URL.
