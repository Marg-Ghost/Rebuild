#!/usr/bin/env bash
set -Eeuo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"


if ss -ltnH 'sport = :11434' | grep -q .; then
    echo "Port 11434 ist belegt"
	
    sudo systemctl stop ollama
    sudo docker stop hackathon_test_rebuild-ollama-1
    sudo docker rm hackathon_test_rebuild-ollama-1
    # Warten, bis der Port tatsächlich frei ist
    for i in {1..10}; do
        if ! ss -ltnH 'sport = :11434' | grep -q .; then
            break
        fi
        sleep 1
    done
fi

if ss -ltnH 'sport = :11434' | grep -q .; then
    echo "FEHLER: Port 11434 ist weiterhin belegt:"
    ss -ltnpH 'sport = :11434'
    exit 1
fi

echo "Port 11434 ist frei"

if ss -ltn | grep -q ":8000"; then
	echo "Port 8000 belegt"
	sudo docker stop hackathon-app-1
	sudo docker rm hackathon-app-1
fi	

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
    printf 'SessionMiddlewareSecretKey=%s\nOLLAMA_MODEL=llama3:latest\n' \
        "${session_secret}" > ".env"
    echo "Lokale .env mit zufälligem Session-Schlüssel wurde angelegt."
fi

#if ! grep -Eq '^SessionMiddlewareSecretKey=.+$' ".env"; then
#    echo "Fehler: SessionMiddlewareSecretKey ist in .env nicht gesetzt." >&2
#    exit 1
#fi

if [[ -z "${OLLAMA_MODEL:-}" ]]; then
    OLLAMA_MODEL="llama3:latest"
fi
export OLLAMA_MODEL

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
if printf '%s\n' "${installed_models}" \
    | awk 'NR > 1 { print $1 }' \
    | grep -Fx -- "${OLLAMA_MODEL}" >/dev/null; then
    echo "Modell ${OLLAMA_MODEL} ist bereits vorhanden."
else
    echo "Modell ${OLLAMA_MODEL} fehlt; lade es jetzt herunter ..."
    docker compose exec -T ollama ollama pull "${OLLAMA_MODEL}"
fi

echo "Starte App-Container auf http://0.0.0.0:8000 ..."
docker compose up -d app

echo "Warte auf den Rebuild-Server ..."
app_ready=false
for _ in {1..30}; do
    if docker compose exec -T app python -c \
        "import urllib.request; urllib.request.urlopen('http://0.0.0.0:8000/', timeout=3)" \
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
