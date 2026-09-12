from pathlib import Path
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
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
        return FileResponse(str(WEB_DIR / "pages" / "root.html"))
    except Exception as e:
        raise HTTPException(status_code=404, detail="custom. Page not found")

@app.get("/login")
async def login_page():
    try:
        return FileResponse(str(WEB_DIR / "pages" / "login.html"))
    except Exception as e:
        raise HTTPException(status_code=404, detail="custom. Page not found")

@app.get("/home")
async def home_page():
    try:
        return FileResponse(str(WEB_DIR / "pages" / "index.html"))
    except Exception as e:
        raise HTTPException(status_code=404, detail="custom. Page not found")

@app.get("/checkup_first")
async def checkup_first_page():
    try:
        return FileResponse(str(WEB_DIR / "pages" / "checkup_first.html"))
    except Exception as e:
        raise HTTPException(status_code=404, detail="custom. Page not found")

@app.post("/register_checkup")
async def register_checkup(request: Request):
    import data.user.login_requests as login_requests
    user_id = request.session.get("user_id")
    usr = request.session.get("usr")

    if user_id is None and not usr:
        raise HTTPException(status_code=401, detail="nicht eingeloggt")

    if user_id is None:
        user_id = login_requests.get_user_id(usr)
        if user_id is None:
            raise HTTPException(status_code=404, detail="User nicht gefunden")
        request.session["user_id"] = user_id

    return {"db": "complete" if login_requests.has_checkup_for_user(user_id) else "empty"}

    
# Linked PAges 
@app.get("/ai")
async def ai_page():
    return FileResponse(str(WEB_DIR / "pages" / "ai.html"))
@app.get("/tasks")
async def tasks_page():
    return FileResponse(str(WEB_DIR / "pages" / "tasks.html"))
@app.get("/checkup")
async def checkup_page():
    return FileResponse(str(WEB_DIR / "pages" / "chekup.html"))

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

    import data.user.login_requests as login_requests
    result = login_requests.login_user(identifier, password, method)
    if result != 0:
        raise HTTPException(status_code=401, detail="Login-Daten sind falsch")

    user_id = login_requests.get_user_id(identifier, method)
    #if user_id is None:
    #    raise HTTPException(status_code=404, detail="User nicht gefunden")

    request.session["usr"] = identifier
    request.session["user_id"] = user_id
    return {"ok": True, "usr": identifier}

@app.post("/register")
async def register(request: Request):
    data = await request.json()
    username = str(data.get("username") or "").strip()
    email = str(data.get("email") or "").strip()
    phone = str(data.get("phone") or "").strip()
    password = str(data.get("password") or "")

    if not email:
        raise HTTPException(status_code=400, detail="E-Mail fehlt")
    if not password:
        raise HTTPException(status_code=400, detail="Passwort fehlt")

    import data.user.login_requests as login_requests
    result = login_requests.register_user(email, password, phone or None, username or None)
    if result != 0:
        raise HTTPException(status_code=400, detail="E-Mail, Telefonnummer oder Benutzername ist bereits registriert")

    return {"ok": True, "username": username or None, "email": email, "phone": phone or None}

# register checkup data
app.get("/api/checkup_register")
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


@app.post("/api/checkup_data")
async def save_checkup_data(request: Request):
    import data.user.login_requests as login_requests
    usr = request.session.get("usr")
    user_id = request.session.get("user_id")

    if not usr:
        raise HTTPException(status_code=401, detail="nicht eingeloggt")

    data = await request.json()
    if user_id is None:
        user_id = login_requests.get_user_id(usr)

    if user_id is None or not login_requests.save_checkup_for_user(user_id, data):
        raise HTTPException(status_code=404, detail="User nicht gefunden")

    return {
        "ok": True,
        "usr": usr,
        "received": data,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
