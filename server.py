from pathlib import Path
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware

app = FastAPI()

BASE_DIR = Path(__file__).resolve().parent
WEB_DIR = BASE_DIR / "web"

app.mount("/assets", StaticFiles(directory=WEB_DIR / "assets"), name="assets")

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
async def index_page():
    try:
        return FileResponse(str(WEB_DIR / "pages" / "login.html"))
    except Exception as e:
        raise HTTPException(status_code=404, detail="custom. Page not found")

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

@app.get("/main.js")
async def main_script():
    return FileResponse(str(WEB_DIR / "main.js"), media_type="application/javascript")

@app.get("/styles.css")
async def styles():
    return FileResponse(str(WEB_DIR / "styles.css"), media_type="text/css")

# user spesific api reqests
# user getter
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

    request.session["usr"] = identifier
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
    usr = request.session.get("usr")

    if not usr:
        raise HTTPException(status_code=401, detail="nicht eingeloggt")

    data = await request.json()
    return {
        "ok": True,
        "usr": usr,
        "received": data,
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
