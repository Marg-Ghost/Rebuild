from pathlib import Path
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from starlette.concurrency import run_in_threadpool
from starlette.middleware.sessions import SessionMiddleware

app = FastAPI()

BASE_DIR = Path(__file__).resolve().parent
WEB_DIR = BASE_DIR / "web"

app.mount("/static", StaticFiles(directory=WEB_DIR), name="static")

app.add_middleware(
    SessionMiddleware,
    secret_key="super-geheimes-secret-fuer-hackerthon",
    max_age=60 * 60 * 24,
)

# load Pages
# Main Pages
@app.get("/")
async def index_page():
    try:
        return FileResponse(str(WEB_DIR / "pages" / "login" / "root.html"))
    except Exception as e:
        raise HTTPException(status_code=404, detail="custom. Page not found")

@app.get("/login")
async def login_page():
    try:
        return FileResponse(str(WEB_DIR / "pages" / "login" / "login.html"))
    except Exception as e:
        raise HTTPException(status_code=404, detail="custom. Page not found")

@app.get("/home")
async def load_home():
    try:
        return FileResponse(str(WEB_DIR / "pages" / "main" / "index.html"))
    except Exception as e:
        raise HTTPException(status_code=404, detail="custom. Page not found")

@app.get("/brain")
async def load_brain():
    return FileResponse(str(WEB_DIR / "pages" / "main" / "brain.html"))

@app.get("/stomach")
async def load_stomach():
    return FileResponse(str(WEB_DIR / "pages" / "main" / "stomach.html"))

@app.get("/activity")
async def load_activity():
    return FileResponse(str(WEB_DIR / "pages" / "main" / "activity.html"))

@app.get("/kalender")
async def load_calendar():
    try:
        return FileResponse(str(WEB_DIR / "pages" / "kalender" / "kalender.html"))
    except Exception as e:
        raise HTTPException(status_code=404, detail="custom. Page not found")

@app.get("/checkup_first")
async def checkup_first_page():
    try:
        return FileResponse(str(WEB_DIR / "pages" / "checkups" / "checkup_first.html"))
    except Exception as e:
        raise HTTPException(status_code=404, detail="custom. Page not found")

@app.get("/checkup")
async def daily_checkup_page(request: Request):
    username = request.session.get("usr")
    if not username:
        raise HTTPException(status_code=401, detail="nicht eingeloggt")

    from data.user.db_interaction import get_daily_sleep_checkup
    if get_daily_sleep_checkup(username)["status"] != "complete":
        return FileResponse(str(WEB_DIR / "pages" / "checkups" / "sleep_checkup.html"))
    return FileResponse(str(WEB_DIR / "pages" / "checkups" / "chekup.html"))

@app.get("/sleep-checkup")
async def sleep_checkup_page(request: Request):
    if not request.session.get("usr"):
        raise HTTPException(status_code=401, detail="nicht eingeloggt")
    return FileResponse(str(WEB_DIR / "pages" / "checkups" / "sleep_checkup.html"))

@app.get("/register_info")
async def register_info_page():
    try:
        return FileResponse(str(WEB_DIR / "pages" / "login" / "register_info.html"))
    except Exception as e:
        raise HTTPException(status_code=404, detail="custom. Page not found")

@app.post("/register_info")
async def register_info(request: Request):
    import data.user.db_interaction as db_interaction

    username = request.session.get("usr")
    if not username:
        raise HTTPException(status_code=401, detail="nicht eingeloggt")

    data = await request.json()
    try:
        age = int(data.get("age"))
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="Alter muss eine Zahl sein")

    sickness = data.get("sickness", [])
    if not isinstance(sickness, list) or not all(isinstance(item, str) for item in sickness):
        raise HTTPException(status_code=400, detail="Ungültige Erkrankungen")

    saved = db_interaction.save_profile_for_user(
        username,
        age,
        str(data.get("hobbies") or "").strip(),
        str(data.get("job") or "").strip(),
        sickness,
    )
    if not saved:
        raise HTTPException(status_code=404, detail="User nicht gefunden")
    return {"ok": True}

@app.post("/register_checkup")
async def register_checkup(request: Request):
    import data.user.db_interaction as db_interaction
    username = request.session.get("usr")

    if not username:
        raise HTTPException(status_code=401, detail="nicht eingeloggt")

    return {
        "profile": "complete" if db_interaction.has_profile_for_user(username) else "empty",
        "db": "complete" if db_interaction.has_checkup_for_user(username) else "empty",
    }

# user spesific api reqests
# user getter
#db profiling

#login und register
@app.post("/login")
async def login(request: Request):
    data = await request.json()
    method = data.get("method")
    identifier = str(data.get("identifier") or "").strip()
    password = str(data.get("password") or "")

    if method not in {"username", "email", "phone"}:
        raise HTTPException(status_code=400, detail="method muss username, email oder phone sein")

    if not identifier:
        raise HTTPException(status_code=400, detail="Identifikator fehlt")

    import data.user.db_interaction as db_interaction
    result = db_interaction.login_user(identifier, password, method)
    if result != 0:
        raise HTTPException(status_code=401, detail="Login-Daten sind falsch")

    username = db_interaction.get_username(identifier, method)
    if not username:
        raise HTTPException(status_code=400, detail="User braucht einen Benutzernamen")

    request.session["usr"] = username
    return {"ok": True, "usr": username}

@app.post("/register")
async def register(request: Request):
    data = await request.json()
    username = str(data.get("username") or "").strip()
    email = str(data.get("email") or "").strip()
    phone = str(data.get("phone") or "").strip()
    password = str(data.get("password") or "")

    if not username:
        raise HTTPException(status_code=400, detail="Benutzername fehlt")
    if not email:
        raise HTTPException(status_code=400, detail="E-Mail fehlt")
    if not password:
        raise HTTPException(status_code=400, detail="Passwort fehlt")

    import data.user.db_interaction as db_interaction
    result = db_interaction.register_user(email, password, phone or None, username or None)
    if result != 0:
        raise HTTPException(status_code=400, detail="E-Mail, Telefonnummer oder Benutzername ist bereits registriert")

    return {"ok": True, "username": username or None, "email": email, "phone": phone or None}

# register checkup data
app.get("/checkup_register")
async def checkup_register(request: Request):
    data = await request.json()
    usr = request.session.get("usr")

    #health = 1000 als standartwert
    health = 1000
    sleep = list(data.get("sleep"))
    food = list(data.get("food"))
    act = list(data.get("act"))
    from core.input_vector import all_check
    forge_health = all_check(health, sleep, food, act)

    from data.user.db_interaction import save_checkup_entrie
    save_checkup_entrie(usr,forge_health[0],forge_health[1],forge_health[2],forge_health[3]) #health, sleep, food, act
  
    


# user get db data 
#API endpoints
@app.get("/api/me")
async def get_current_user(request: Request):
    usr = request.session.get("usr")

    if not usr:
        raise HTTPException(status_code=401, detail="nicht eingeloggt")

    return {"usr": usr}


@app.get("/api/checkup")
async def get_checkup_data(request: Request):
    usr = request.session.get("usr")

    if not usr:
        raise HTTPException(status_code=401, detail="nicht eingeloggt")

    return {
        "usr": usr,
        "status": "ok",
        "message": "User aus Session erkannt",
    }


async def resolve_catalog_item_or_error(kind: str, query: str) -> tuple[dict, str]:
    from core.input_vector import get_catalog_item, get_catalog_items

    item = get_catalog_item(kind, query)
    if item:
        return item, "exact"

    candidates = [entry["name"] for entry in get_catalog_items(kind)]
    from llm.ai_ollama import match_catalog_entry
    try:
        matched_name = await run_in_threadpool(
            match_catalog_entry, kind, query, candidates
        )
    except Exception as error:
        raise HTTPException(
            status_code=503,
            detail="Ollama ist nicht erreichbar oder das konfigurierte Modell fehlt.",
        ) from error

    item = get_catalog_item(kind, matched_name) if matched_name else None
    if item is None:
        raise HTTPException(
            status_code=422,
            detail=f"Kein passender {kind}-Eintrag in der Referenzdatenbank gefunden.",
        )
    return item, "ollama"


async def resolve_checkup_entries(kind: str, values: list[str]) -> list[str]:
    resolved = []
    for value in values:
        item, _ = await resolve_catalog_item_or_error(kind, value.strip())
        resolved.append(item["name"])
    return resolved


@app.post("/api/checkup_data")
async def save_checkup_data(request: Request):
    import data.user.db_interaction as db_interaction
    from core.input_vector import all_check
    usr = request.session.get("usr")

    if not usr:
        raise HTTPException(status_code=401, detail="nicht eingeloggt")
    health = 1000.0
    data = await request.json()
    if not isinstance(data, dict):
        raise HTTPException(status_code=400, detail="Ungültige Checkup-Daten")
    try:
        sleep = [
            float(data.get("sleep_hours")),
            float(data.get("sleep_point", 0)),
            int(data.get("sleep_count", 0)),
        ]
        food = data.get("food", [])
        act = data.get("activity", [])
        if (
            not isinstance(food, list)
            or not isinstance(act, list)
            or len(food) > 50
            or len(act) > 50
            or not all(isinstance(item, str) and item.strip() for item in food + act)
            or sleep[2] < 0
            or not 0 <= sleep[0] <= 24
        ):
            raise ValueError
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="Ungültige Checkup-Daten")

    food = await resolve_checkup_entries("food", food)
    act = await resolve_checkup_entries("activity", act)
    result = all_check(health, sleep, food, act)
    if result[2] is None or result[3] is None:
        raise HTTPException(status_code=503, detail="KI-Auswertung fehlgeschlagen; Checkup wurde nicht gespeichert.")
    db_interaction.save_checkup_entrie(
        usr,
        result[0],
        result[1],
        result[2],
        result[3],
        first=True
    )

    return {
        "ok": True,
        "usr": usr,
        "received": data,
        "health": result[0],
        "food_score": result[2],
        "activity_score": result[3],
    }


@app.get("/api/checkup/catalog")
async def get_checkup_catalog(request: Request):
    if not request.session.get("usr"):
        raise HTTPException(status_code=401, detail="nicht eingeloggt")

    from core.input_vector import get_catalog_items
    return {
        "food": get_catalog_items("food"),
        "activity": get_catalog_items("activity"),
    }


@app.post("/api/checkup/resolve")
async def resolve_checkup_item(request: Request):
    if not request.session.get("usr"):
        raise HTTPException(status_code=401, detail="nicht eingeloggt")

    data = await request.json()
    kind = data.get("kind")
    query = str(data.get("query") or "").strip()
    if kind not in {"food", "activity"} or not query:
        raise HTTPException(status_code=400, detail="Katalogtyp oder Suchbegriff fehlt")

    item, match_type = await resolve_catalog_item_or_error(kind, query)
    return {"item": item, "match_type": match_type}


@app.get("/api/daily-checkup/status")
async def get_daily_checkup_status(request: Request):
    username = request.session.get("usr")
    if not username:
        raise HTTPException(status_code=401, detail="nicht eingeloggt")

    import data.user.db_interaction as db_interaction
    return {
        "daily": db_interaction.get_daily_feature_values(username),
        "sleep": db_interaction.get_daily_sleep_checkup(username),
    }


@app.post("/api/daily-checkup")
async def save_daily_checkup(request: Request):
    import data.user.db_interaction as db_interaction
    from core.input_vector import all_check

    username = request.session.get("usr")
    if not username:
        raise HTTPException(status_code=401, detail="nicht eingeloggt")
    if db_interaction.get_daily_sleep_checkup(username)["status"] != "complete":
        raise HTTPException(status_code=409, detail="Bitte zuerst den Schlaf-Check-in abschließen.")

    data = await request.json()
    if not isinstance(data, dict):
        raise HTTPException(status_code=400, detail="Ungültige Checkup-Daten")
    food = data.get("food", [])
    activity = data.get("activity", [])
    if (
        not isinstance(food, list)
        or not isinstance(activity, list)
        or len(food) > 50
        or len(activity) > 50
        or not all(isinstance(item, str) and item.strip() for item in food + activity)
    ):
        raise HTTPException(status_code=400, detail="Ungültige Food- oder Activity-Einträge")

    food = await resolve_checkup_entries("food", food)
    activity = await resolve_checkup_entries("activity", activity)
    result = all_check(1000.0, [0.0, 0.0, 0], food, activity)
    if result[2] is None or result[3] is None:
        raise HTTPException(status_code=503, detail="KI-Gewichte fehlen; Checkup wurde nicht gespeichert.")

    saved = db_interaction.save_checkup_entrie(
        username,
        result[0],
        [0.0, 0.0, 0],
        result[2],
        result[3],
        include_sleep=False,
    )
    if not saved:
        raise HTTPException(status_code=500, detail="Checkup konnte nicht gespeichert werden.")
    return {"ok": True, "food_score": result[2], "activity_score": result[3]}


@app.get("/api/sleep-checkup")
async def get_sleep_checkup(request: Request):
    username = request.session.get("usr")
    if not username:
        raise HTTPException(status_code=401, detail="nicht eingeloggt")
    from data.user.db_interaction import get_daily_sleep_checkup
    return get_daily_sleep_checkup(username)


@app.post("/api/sleep-checkup")
async def save_sleep_checkup(request: Request):
    import data.user.db_interaction as db_interaction
    from core.input_vector import get_sleep_point, sleep_clac

    username = request.session.get("usr")
    if not username:
        raise HTTPException(status_code=401, detail="nicht eingeloggt")

    data = await request.json()
    if not isinstance(data, dict):
        raise HTTPException(status_code=400, detail="Ungültiger Schlaf-Check-in")
    action = data.get("action")
    if action == "not_slept":
        if not db_interaction.mark_sleep_not_yet(username):
            raise HTTPException(status_code=409, detail="Der Schlaf-Check-in ist heute bereits abgeschlossen.")
        return db_interaction.get_daily_sleep_checkup(username)
    if action != "slept":
        raise HTTPException(status_code=400, detail="Ungültiger Schlafstatus")

    try:
        sleep_hours = float(data.get("sleep_hours"))
        sleep_start_time = str(data.get("sleep_start_time") or "")
        sleep_start_hour = int(sleep_start_time.split(":", 1)[0])
        if not 0 <= sleep_hours <= 24 or not 0 <= sleep_start_hour <= 23:
            raise ValueError
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="Schlafstunden oder Einschlafzeit ungültig")

    sleep_state = db_interaction.get_daily_sleep_checkup(username)
    sleep_count = int(sleep_state["started_after_checkup"])
    sleep_point = get_sleep_point(sleep_start_hour)
    sleep_quality = sleep_clac(sleep_hours, sleep_point, sleep_count)
    saved = db_interaction.save_daily_sleep_checkup(
        username, sleep_hours, sleep_point, sleep_quality
    )
    if not saved:
        raise HTTPException(status_code=409, detail="Der Schlaf-Check-in ist heute bereits abgeschlossen.")
    return db_interaction.get_daily_sleep_checkup(username)

# Get the user DATA
@app.get("/api/get_health_data/index")
async def get_index_data(request : Request):
    usr = request.session.get("usr")
    if not usr:
        raise HTTPException(status_code=401, detail="nicht eingeloggt")

    from data.user.db_interaction import get_index_intel
    return  get_index_intel(usr)


@app.get("/api/daily-features")
async def get_daily_features(request: Request):
    username = request.session.get("usr")
    if not username:
        raise HTTPException(status_code=401, detail="nicht eingeloggt")

    from data.user.db_interaction import get_daily_feature_values
    return get_daily_feature_values(username)


@app.get("/api/calendar")
async def get_calendar(request: Request, year: int, month: int):
    username = request.session.get("usr")
    if not username:
        raise HTTPException(status_code=401, detail="nicht eingeloggt")

    from tasks.calendar import list_month_events
    try:
        return list_month_events(username, year, month)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@app.post("/api/calendar", status_code=201)
async def add_calendar_event(request: Request):
    username = request.session.get("usr")
    if not username:
        raise HTTPException(status_code=401, detail="nicht eingeloggt")

    from tasks.calendar import add_event
    try:
        event_id = add_event(username, await request.json())
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    return {"ok": True, "id": event_id}


@app.delete("/api/calendar/{event_id}")
async def delete_calendar_event(event_id: int, request: Request):
    username = request.session.get("usr")
    if not username:
        raise HTTPException(status_code=401, detail="nicht eingeloggt")

    from tasks.calendar import remove_event
    if not remove_event(username, event_id):
        raise HTTPException(status_code=404, detail="Termin nicht gefunden")
    return {"ok": True}


if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
