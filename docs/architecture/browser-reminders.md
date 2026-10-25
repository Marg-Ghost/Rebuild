# Browser-Erinnerungen

## Ablauf im Browser

`web/reminders.js` wird auf Übersicht, Empfehlungen, Kalender und KI-Assistent geladen. Das Script ergänzt eine Schaltfläche in der Nutzerleiste. Erst nach Klick fragt der Browser nach Notification-Berechtigung; Python und die Datenbank sind am Timer nicht beteiligt.

Nach Zustimmung speichert der Browser Start, nächsten Termin und Ablaufzeit in `localStorage`. Ein JavaScript-Timer prüft alle 30 Sekunden, ob eine Erinnerung fällig ist. Die Benachrichtigung kommt alle zwei Stunden und die Aktivierung endet nach zehn Stunden. Die lokale Speicherbasis hält den Zustand beim Navigieren zwischen den unterstützten Rebuild-Seiten aufrecht.

## Grenzen

- Die Benachrichtigung funktioniert nur, wenn eine Rebuild-Seite geöffnet bleibt und der Browser Notification API unterstützt.
- Bei geschlossenem Browser oder geschlossener Seite läuft kein Timer und wird keine Push-Nachricht zugestellt.
- Benötigt eine sichere Browser-Umgebung (HTTPS oder localhost) sowie die Erlaubnis des Nutzers.
- Die aktuelle Aktivierung wird lokal im Browser gespeichert, nicht pro Benutzer in Python oder SQLite.
