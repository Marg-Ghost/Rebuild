# Konto, Anmeldung und DEA

## Bausteine

- **Oberfläche:** `web/pages/login/root.html`, `web/pages/login/register_info.html`, `web/auth.js` und `web/main.js`.
- **HTTP-Schicht:** `/login`, `/register`, `/register_info`, `/register_checkup` sowie geschützte Seiten in `server.py`.
- **Validierung:** `input_validator.py` enthält `DeterministischerEndlicherAutomat`.
- **Identität und Persistenz:** `SessionMiddleware` in `server.py` und SQLite-Funktionen in `data/user/db_interaction.py`.

## Ablauf

1. Der Browser sendet Login- oder Registrierungsdaten als JSON an FastAPI.
2. `DeterministischerEndlicherAutomat.is_valid_email` prüft E-Mail-Adressen mit expliziten DFA-Zuständen (`start`, lokaler Teil, `@`, Domain, Punkt und 2–3 Buchstaben TLD). `match`/`case` wählt die Zustandsübergänge. Die Klasse enthält zusätzlich allgemeine Hilfsprüfungen für Pflichtfelder und Längen; diese Helfer sind keine eigenen DEA-Automaten.
3. `server.py` prüft Feldgrenzen und Passwortlänge und wendet eine pro Prozess geführte Rate-Limit-Queue auf Login und Registrierung an.
4. Passwort-Hashing und Nutzeranlage erfolgen in den Datenbankfunktionen. Bei erfolgreichem Login wird der Nutzername in einem signierten Session-Cookie gespeichert.
5. Geschützte Endpunkte lesen den Nutzer aus `request.session`; der Browser hält kein Login-Token in `localStorage`.

## Sicherheits- und Architekturgrenzen

- Die Session wird mit `SessionMiddlewareSecretKey` signiert; `SESSION_HTTPS_ONLY` steuert das Secure-Attribut.
- Mutierende Requests mit `Origin` oder `Referer` werden in `same_origin_for_mutations` auf denselben Host geprüft.
- Rate-Limits liegen im Prozessspeicher und werden nicht zwischen mehreren Uvicorn-Workern geteilt.
- Der DFA ist eine bewusst einfache Syntaxprüfung. Er verifiziert weder die Existenz einer Domain noch die Zustellbarkeit der Adresse.
- Datenbankzugriffe und E-Mail-Eindeutigkeitsregeln sind in `data/user/db_interaction.py` implementiert, nicht in der DEA-Klasse.
