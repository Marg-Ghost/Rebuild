from fastapi import FASTAPI, Response, HTTPException
import uvicorn

app = FASTAPI()

#constants
WEB_DIR = "/web/"


app.post("/")
async def init_page():
    try:
        web_page = WEB_DIR + "index.html"
    except:
        raise HTTPException(status_code = "404")
    return FileResponse(str(web_page))

# difine a new profile
def login

# checkups
app.post("/checkup{usr_session_id}")