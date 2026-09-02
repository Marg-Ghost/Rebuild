from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse
from starlette.middleware.sessions import SessionMiddleware

app = FastAPI()

BASE_DIR = Path(__file__).resolve().parent
WEB_DIR = BASE_DIR / "web"

app.add_middleware(
    SessionMiddleware,
    secret_key="super-geheimes-secret-fuer-hackerthon",
    max_age=60 * 60 * 24,
)


@app.get("/")
async def index_page():
    return FileResponse(str(WEB_DIR / "pages" / "index.html"))


@app.get("/checkup")
async def checkup_page():
    return FileResponse(str(WEB_DIR / "pages" / "chekup.html"))


@app.post("/login")
async def login(request: Request):
    data = await request.json()
    user_id = data.get("user_id")

    if not user_id:
        raise HTTPException(status_code=400 , detail="user_id fehlt")

    request.session["usr"] = str(user_id)
    return {"ok": True, "usr": request.session["usr"]}


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


@app.post("/api/checkup")
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
