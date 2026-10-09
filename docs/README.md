# Rebuild – Funktionsübersicht

Diese Übersicht beschreibt grob, was die sichtbaren Bereiche der Anwendung tun und wie Browser, Server und Daten zusammenspielen. Sie ist eine Orientierung für Entwicklerinnen und Entwickler, keine vollständige API- oder Datenbankspezifikation.

## Inhaltsverzeichnis

- [Technischer Überblick](#technischer-überblick)
- [Anmeldung und Konto](#anmeldung-und-konto)
- [Übersicht und Tagesfortschritt](#übersicht-und-tagesfortschritt)
- [Check-ins](#check-ins)
- [Schlaf und Brain](#schlaf-und-brain)
- [Ernährung und Stomach](#ernährung-und-stomach)
- [Aktivität](#aktivität)
- [Opty und LLM](#opty-und-llm)
- [Kalender](#kalender)
- [Wichtige Grenzen des aktuellen Umfangs](#wichtige-grenzen-des-aktuellen-umfangs)

## Technischer Überblick

- `server.py` stellt die Seiten und die FastAPI-Endpunkte bereit.
- HTML, CSS und Browser-JavaScript liegen hauptsächlich unter `web/`. Das Kalender-JavaScript liegt unter `Kalender/web/`, die Assistenten-Oberfläche und ihre Logik unter `llm-support/`.
- Datenbankzugriffe für Konten, Check-ins und Verlaufswerte laufen über `data/user/db_interaction.py`. Kalenderaufgaben werden über `Kalender/date.py` und `Kalender/data/database.py` verwaltet.
- Die Browser-Aufrufe verwenden für geschützte Funktionen eine serverseitige Session. Die API prüft den angemeldeten Nutzer, bevor sie persönliche Daten liest oder ändert.
- Das Bewertungsnetz für Ernährung und Aktivität ist in `core/ai/ai.py` implementiert. Die Anwendung kombiniert die Eingaben mit Referenzdaten und den gespeicherten Modellgewichten.
- Opty verwendet Ollama für Textantworten. `llm-support/llm_communication.py` verwaltet die Anfragen; `llm-support/vectordb.py` liefert ergänzenden Kontext aus der Chroma-Vektordatenbank.

### Container starten

Für den Docker-Start werden Docker mit Compose und Bash benötigt. `bash start.sh` erstellt beim ersten Start automatisch eine lokale `.env` mit zufälligem Session-Schlüssel, baut die App mit den Abhängigkeiten aus `requirements.txt`, startet Ollama, prüft `OLLAMA_MODEL` und lädt das Modell nur herunter, wenn es fehlt. Anschließend startet der Rebuild-App-Container.

Compose stellt die App unter `http://localhost:8000` bereit. Ollama ist für lokale Werkzeuge unter `http://localhost:11434` verfügbar; innerhalb des App-Containers wird der Dienst über `http://ollama:11434` angesprochen. Modellgewichte, Nutzerdatenbanken, Referenzdatenbanken und Chroma-Daten bleiben über Volumes bzw. Bind-Mounts erhalten.

## Anmeldung und Konto

Die Login- und Registrierungsoberfläche wird aus `web/pages/login/` ausgeliefert. Der Browser sendet Login- oder Registrierungsdaten an `server.py`; bei erfolgreicher Anmeldung wird der Nutzer in einem signierten Session-Cookie gespeichert. Geschützte Seiten und Endpunkte verwenden diese Session; ein JWT oder `localStorage` wird dafür nicht benötigt. Benutzernamen sind per eindeutigem SQLite-Index abgesichert; Trigger blockieren neue doppelte E-Mail-Adressen und Telefonnummern. Bereits vorhandene Mehrfachzuordnungen bleiben erhalten und sind für den Login per E-Mail/Telefon mehrdeutig; in diesem Fall muss der Benutzername verwendet werden.

Beim Registrieren werden Profilangaben und der erste Checkup schrittweise erfasst. Der Profil-Endpunkt speichert unter anderem Alter, Hobbys, Beruf, ausgewählte Erkrankungen, aktuelle Probleme und primäre Sorgen/Ängste. Die konkrete Speicherung liegt in `data/user/db_interaction.py`.

### Problems
-> Noch muss eine Abfrage der korrekten syntax von email handy etc.
-> die passworter müssen noch gehashed werden!
-> schutz vor sql injections

## Übersicht und Tagesfortschritt

Die Startseite `/home` lädt Tageswerte, Check-in-Status und Verlaufsdaten und stellt sie als Health-Verlauf, Fortschrittsanzeige und nächste Aufgaben dar. Die Browserlogik befindet sich in `web/index.js`.

Die Übersicht zeigt außerdem eine Opty-Empfehlung. Dafür fasst der Server Check-in-, Schlaf-, Health- und Kalenderdaten in einem Kontext zusammen und sendet eine priorisierte Systemanfrage an die LLM-Queue. Ist Ollama nicht erreichbar, kann die Empfehlung nicht erstellt werden; der API-Endpunkt meldet dann einen Fehler.

Der angezeigte Tageswert ist ein interner Rechenwert, kein medizinisch validierter Health-Score: Jeder Check-in startet bei 1.000 Punkten; Schlaf- sowie Essens- und Bewegungs-Impacts verändern ihn. Angezeigt wird der Mittelwert der heutigen Check-ins. Schlaf wird beim ersten Check-in berücksichtigt, bei späteren nicht; zusätzliche Check-ins können den Mittelwert deshalb verschieben. Das Registrierungsprofil fließt derzeit nicht in diese Zahl ein. Der Hinweis am Wert zeigt den Abstand zur Rechenbasis und zum letzten gespeicherten Verlaufstag, aber keine medizinische Einstufung.

Davon getrennt gibt es einen täglichen Belastungs-/Erholungswert von 0 bis 100. Er kombiniert Schlaf (40 %), Stress-Selbsteinschätzung (30 %) und Workload-Selbsteinschätzung (30 %). Stress und Workload werden jeweils von 0 bis 10 eingegeben; Schlaf stammt aus dem Schlaf-Check-in. 80–100 bedeutet niedriges, 50–79 moderates und 0–49 hohes Burnout-Risiko. Dies ist ein transparenter Orientierungswert, kein validierter Test und keine Diagnose. Die Eingaben und Ergebnisse werden nutzerbezogen in `efficiency_scores` gespeichert.

## Check-ins

### Schlaf-Check-in

Der Schlaf-Check-in wird über `/sleep-checkup` geöffnet. Man trägt Schlafstunden und ungefähre Einschlafzeit ein oder markiert, dass man noch nicht geschlafen hat. Der Server zählt späte Nächte der letzten sieben Tage, ermittelt einen möglichen Schlafzeitpunkt-Effekt und speichert den Tagesstatus.

### Ernährung und Bewegung

Nach dem Schlaf-Check-in können bis zu fünf Ernährungs-/Aktivitäts-Check-ins pro Tag gespeichert werden. Die Formulare bieten Referenzeinträge aus dem Katalog an. Freitext kann serverseitig mit Ollama einem vorhandenen Katalogeintrag zugeordnet werden; unbekannte oder nicht sicher zuordenbare Werte werden nicht als Referenzdaten akzeptiert.

Der Server erstellt aus den ausgewählten Einträgen Merkmalsvektoren, lässt Ernährung und Aktivität bewerten und speichert die Scores samt Check-in-Daten pro Nutzer. Der Tagesstatus-Endpunkt liefert den Fortschritt an die Übersicht zurück.

## Schlaf und Brain

`/brain` zeigt Schlafstunden, späte Nächte und einen Verlauf der Schlafqualität. Die Seite lädt ihre Daten über `/api/brain/summary`; die Darstellung des Diagramms liegt in `web/brain.js`.

Der Schlafwert wird aus den eingetragenen Schlafstunden und einem möglichen Effekt später Einschlafzeiten berechnet. Die Historie stammt aus den gespeicherten Schlaf-Check-ins des jeweiligen Nutzers.

## Ernährung und Stomach

`/stomach` zeigt den Ernährungsscore des Tages, die jüngsten Check-ins und einen Verlauf. Die Daten kommen aus `/api/food/summary`; Diagramm und Eintragsliste werden in `web/food.js` aufgebaut.

Der Score basiert auf den erfassten Ernährungseinträgen und dem Bewertungsmodell. Die angezeigte Wirkung auf den Gesamtwert wird zusätzlich über die dafür vorgesehenen Impact-Daten bestimmt.

## Aktivität

`/activity` zeigt analog den Aktivitätsscore, die jüngsten Bewegungs-Check-ins und den Verlauf. Die Seite lädt `/api/activity/summary`; die Darstellung übernimmt `web/activity.js`.

Die Aktivitäten werden über den Referenzkatalog in Merkmale übersetzt und vom Aktivitätsmodell bewertet. Die resultierende Wirkung auf den Gesamtwert kommt aus den Aktivitäts-Impact-Daten.

## Opty und LLM

Die Seite `/llm` bietet einen Chat mit Opty. `llm-support/llm.js` hält den Gesprächsverlauf während der geöffneten Seite im Browser und sendet neue Nachrichten an `/api/llm/chat`.

Der Server reiht Anfragen in `LlmRequestQueue` ein. Nutzernachrichten haben Vorrang vor automatisch erzeugten Systemempfehlungen. `build_rag_context` bündelt für jeden Request das Profil (einschließlich aktueller Probleme und Sorgen), Health-/Check-in-Daten, die letzten Belastungswerte, heutige Kalenderaufgaben und Termine, persönliche Zusammenfassungen sowie passende Chroma-Kontexte, bevor der System-Prompt an Ollama gesendet wird.

Die Chroma-Collection `GhostReferenceV1` wird aus der versionierten allgemeinen Referenzdatei befüllt; die bisherige `Ghost`-Collection wird nicht mehr abgefragt. Persönliche Zusammenfassungen werden in `llm_problem_memory` mit Nutzerkennung gespeichert und nur für dieselbe Kennung geladen; die Health-, Profil- und Kalenderdaten werden ebenfalls anhand des angemeldeten Nutzers abgefragt.

„Gespräch speichern und leeren“ sendet den aktuellen Verlauf an `/api/llm/conversation/clear`. Die Queue erstellt daraus eine Zusammenfassung und speichert sie als persönliches Memory; anschließend wird der sichtbare Gesprächsverlauf geleert. Der Verlauf selbst wird nicht durch diesen Browsercode dauerhaft wiederhergestellt.

Ollama-Modell und Serveradresse werden über `OLLAMA_MODEL` und `OLLAMA_HOST` konfiguriert. Das Startskript `start.sh` startet Ollama und die App als Docker-Container, prüft das Modell und lädt es bei Bedarf herunter.

## Kalender

`/kalender` zeigt eine Monatsansicht mit Aufgaben. Die Browserlogik liegt in `Kalender/web/kalender.js`; sie lädt den Monat über `/api/kalender/get` und kann mit `/api/kalender/add` neue Aufgaben speichern. Aufgaben enthalten Datum, optionale Uhrzeit, Wichtigkeit, Typ und Inhalt.

Die API ist nutzergebunden. Aufgaben werden in der Kalenderdatenbank gespeichert und nach Datum und Uhrzeit sortiert. Die Oberfläche kann Monate wechseln, zum aktuellen Monat zurückkehren und das Formular zum Hinzufügen öffnen. Ein Löschen oder Bearbeiten vorhandener Aufgaben ist in den derzeitigen Kalender-Endpunkten nicht vorgesehen.

## Wichtige Grenzen des aktuellen Umfangs

- Die Chat-Nachrichten bleiben während der Sitzung im Browserzustand; für spätere Nutzung wird beim Leeren nur eine Zusammenfassung als Memory gespeichert.
- Im Kalender sind derzeit Lesen und Hinzufügen beschrieben; Bearbeiten und Löschen sind nicht implementiert.
- Check-ins sind auf einen Schlaf-Check-in und bis zu fünf Ernährungs-/Aktivitäts-Check-ins pro Tag ausgelegt.
- Die LLM-Antwort, automatische Empfehlungen und Freitext-Zuordnung hängen davon ab, dass der konfigurierte Ollama-Dienst und das Modell erreichbar sind.
