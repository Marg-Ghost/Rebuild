# Opty: LLM, RAG, Prioritätsqueue und Datenbank

## Komponenten

- Oberfläche und Gesprächszustand im offenen Tab: `llm-support/llm.html`, `llm-support/llm.js`.
- HTTP-Endpunkte und Sessionprüfung: `POST /api/llm/chat`, `POST /api/llm/conversation/clear` in `server.py`.
- Queue und Ollama-Client: `llm-support/llm_communication.py` (`LlmRequestQueue`).
- Kontextaufbereitung und Vektorsuche: `llm-support/vectordb.py`.
- Nutzerdaten und persönliche Zusammenfassungen: `data/user/db_interaction.py`.
- Allgemeine persistente Referenzen: Chroma-Verzeichnis `chroma_data/` und Collection `GhostReferenceV1`.

## Anfrageablauf

1. Der Browser sendet Nachricht, sichtbaren Gesprächsverlauf und Session-Cookie an `/api/llm/chat`.
2. `server.py` validiert Anzahl, Rollen und Länge der Nachrichten und übergibt eine nutzergebundene Anfrage an die Queue.
3. Die Queue sortiert nach Priorität und stabiler Einfügereihenfolge: Nutzeranfrage (0), Empfehlung (1), Check-up (2), Zusammenfassung (3), Systemanfrage (4). Ein Worker verarbeitet die Requests nacheinander.
4. Für normale Chats erstellt `vectordb.build_rag_context` einen Systemkontext aus dem Profil, Check-ins, Health-Verlauf, Effizienz-Scores, heutigen Kalenderdaten, persönlichen Erinnerungen und den ähnlichsten allgemeinen Chroma-Referenzen.
5. Die Queue sendet Kontext, Gesprächsverlauf und Nutzernachricht an den konfigurierten Ollama-Client. Die Modelladresse und das Modell kommen aus `OLLAMA_HOST` und `OLLAMA_MODEL` beziehungsweise deren Auswahlfunktionen.

## Daten- und Speichergrenzen

Die Chroma-Collection enthält den allgemeinen Referenzkorpus; sie ist keine persönliche Vektordatenbank pro Nutzer. Persönliche Zusammenfassungen werden in `llm_problem_memory` in der Nutzerdatenbank gespeichert und beim Kontextaufbau nur für den angemeldeten Nutzernamen abgefragt. Profil-, Health- und Kalenderdaten kommen ebenfalls aus nutzerbezogenen Datenbankabfragen.

Der sichtbare Chatverlauf liegt im Frontend-Zustand des geöffneten Browser-Tabs. Beim Speichern und Leeren sendet die UI den Verlauf an den Clear-Endpunkt; die Queue erstellt daraus eine Zusammenfassung und speichert diese nutzerbezogen. Das Modell kann ausfallen; Chat und generative Empfehlung sind dann nicht verfügbar oder verwenden den jeweils implementierten Fallback.
