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

if [[ -z "${OLLAMA_MODEL:-}" ]]; then
    OLLAMA_MODEL="llama3:latest"
fi
export OLLAMA_MODEL
export OLLAMA_HOST="${OLLAMA_HOST:-http://localhost:11434}"

if [[ -x ".venv/bin/python" ]]; then
    PYTHON_BIN="${PWD}/.venv/bin/python"
elif [[ -f ".venv/Scripts/python.exe" ]]; then
    PYTHON_BIN="${PWD}/.venv/Scripts/python.exe"
elif command -v python3 >/dev/null 2>&1; then
    PYTHON_BIN="$(command -v python3)"
elif command -v python >/dev/null 2>&1; then
    PYTHON_BIN="$(command -v python)"
else
    echo "Fehler: Python 3 ist nicht installiert oder nicht im PATH." >&2
    exit 1
fi

echo "Starte Ollama-Container ..."
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

if docker compose exec -T ollama ollama list \
    | awk 'NR > 1 { print $1 }' \
    | grep -Fxq -- "${OLLAMA_MODEL}"; then
    echo "Modell ${OLLAMA_MODEL} ist bereits vorhanden."
else
    echo "Modell ${OLLAMA_MODEL} fehlt; lade es jetzt herunter ..."
    docker compose exec -T ollama ollama pull "${OLLAMA_MODEL}"
fi

echo "Starte Rebuild-Server auf http://localhost:8000 ..."
exec "${PYTHON_BIN}" server.py
