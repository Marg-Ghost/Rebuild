#!/usr/bin/env bash
set -Eeuo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

if ! command -v docker >/dev/null 2>&1; then
    echo "Fehler: Docker ist nicht installiert oder nicht im PATH." >&2
    exit 1
fi
if ! docker compose version >/dev/null 2>&1; then
    echo "Fehler: Docker Compose ist nicht verfügbar." >&2
    exit 1
fi

if [[ ! -f ".env" ]]; then
    if command -v openssl >/dev/null 2>&1; then
        session_secret="$(openssl rand -hex 32)"
    elif command -v od >/dev/null 2>&1; then
        session_secret="$(od -An -N32 -tx1 /dev/urandom | tr -d ' \n')"
    else
        echo "Fehler: Kein Generator für den initialen Session-Schlüssel gefunden." >&2
        exit 1
    fi
    printf 'SessionMiddlewareSecretKey=%s\n' "${session_secret}" > ".env"
    echo "Lokale .env mit zufälligem Session-Schlüssel wurde angelegt."
fi

if [[ -z "${OLLAMA_MODEL:-}" ]]; then
    OLLAMA_MODEL="$(sed -n 's/^OLLAMA_MODEL=//p' .env | tail -n 1)"
fi
if [[ -z "${OLLAMA_MODEL:-}" ]]; then
    if ! command -v python3 >/dev/null 2>&1; then
        echo "Fehler: python3 wird für die hardwarebasierte Modellauswahl benötigt." >&2
        exit 1
    fi
    OLLAMA_MODEL="$(python3 -c 'from llm.ollama_config import select_ollama_model; print(select_ollama_model())')"
fi
OLLAMA_NUM_PARALLEL="${OLLAMA_NUM_PARALLEL:-1}"
OLLAMA_CONTEXT_LENGTH="${OLLAMA_CONTEXT_LENGTH:-4096}"
if [[ -z "${OLLAMA_KEEP_ALIVE:-}" ]]; then
    OLLAMA_KEEP_ALIVE="$(sed -n 's/^OLLAMA_KEEP_ALIVE=//p' .env | tail -n 1)"
fi
OLLAMA_KEEP_ALIVE="${OLLAMA_KEEP_ALIVE:--1}"
export OLLAMA_MODEL OLLAMA_NUM_PARALLEL OLLAMA_CONTEXT_LENGTH OLLAMA_KEEP_ALIVE
echo "Verwende Ollama-Modell ${OLLAMA_MODEL}; Keep-Alive: ${OLLAMA_KEEP_ALIVE}."

echo "Baue das App-Image und starte Ollama ..."
docker compose build app
docker compose up -d ollama

echo "Warte auf Ollama ..."
ollama_ready=false
for _ in {1..60}; do
    if docker compose exec -T ollama ollama list >/dev/null 2>&1; then
        ollama_ready=true
        break
    fi
    sleep 2
done
if [[ "${ollama_ready}" != true ]]; then
    echo "Fehler: Ollama ist nach 120 Sekunden nicht bereit." >&2
    docker compose logs --tail=50 ollama >&2 || true
    exit 1
fi

installed_models="$(docker compose exec -T ollama ollama list)"
if printf '%s\n' "${installed_models}" | awk 'NR > 1 { print $1 }' | grep -Fx -- "${OLLAMA_MODEL}" >/dev/null; then
    echo "Modell ${OLLAMA_MODEL} ist bereits vorhanden."
else
    echo "Modell ${OLLAMA_MODEL} fehlt; lade es jetzt herunter ..."
    docker compose exec -T ollama ollama pull "${OLLAMA_MODEL}"
fi

echo "Lade das Modell vor und halte es im Speicher ..."
docker compose exec -T ollama ollama run "${OLLAMA_MODEL}" ""
docker compose exec -T ollama ollama ps

echo "Starte App-Container auf http://0.0.0.0:8000 ..."
docker compose up -d app

echo "Warte auf den Rebuild-Server ..."
app_ready=false
for _ in {1..30}; do
    if docker compose exec -T app python -c \
        "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/', timeout=3)" \
        >/dev/null 2>&1; then
        app_ready=true
        break
    fi
    sleep 2
done
if [[ "${app_ready}" != true ]]; then
    echo "Fehler: Der App-Server ist nach 60 Sekunden nicht bereit." >&2
    docker compose logs --tail=80 app >&2 || true
    exit 1
fi

docker compose ps
