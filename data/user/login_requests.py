import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().with_name("user.db")


def init_db() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS login (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT,
                email TEXT NOT NULL,
                phone TEXT,
                password TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS checkup (
                user_id INTEGER PRIMARY KEY,
                data TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES login(id)
            )
            """
        )

        columns = {row[1] for row in conn.execute("PRAGMA table_info(login)")}
        for column, definition in {
            "username": "TEXT",
            "email": "TEXT",
            "phone": "TEXT",
            "password": "TEXT",
        }.items():
            if column not in columns:
                conn.execute(f"ALTER TABLE login ADD COLUMN {column} {definition}")

        conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON login(email)")
        conn.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS users_phone_idx ON login(phone) WHERE phone IS NOT NULL"
        )
        conn.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS users_username_idx ON login(username) WHERE username IS NOT NULL"
        )


init_db()


def login_user(identifier: str, password: str, method: str) -> int:
    column = {"username": "username", "email": "email", "phone": "phone"}.get(method)
    if column is None:
        return 1

    with sqlite3.connect(DB_PATH) as conn:
        user = conn.execute(
            f"SELECT id FROM login WHERE {column}=? AND password=?",
            (identifier, password),
        ).fetchone()

    return 0 if user else 1


def register_user(
    email: str,
    password: str,
    phone: str | None = None,
    username: str | None = None,
) -> int:
    try:
        with sqlite3.connect(DB_PATH) as conn:
            conn.execute(
                "INSERT INTO login (username, email, password, phone) VALUES (?, ?, ?, ?)",
                (username or None, email, password, phone or None),
            )
    except sqlite3.IntegrityError:
        return 1

    return 0

def get_all_user() -> list:
    with sqlite3.connect(DB_PATH) as conn:
        all = conn.execute("SELECT * FROM login").fetchall()
    return all


def get_user_id(identifier: str) -> int | None:
    with sqlite3.connect(DB_PATH) as conn:
        user = conn.execute(
            "SELECT id FROM login WHERE username=? OR email=? OR phone=?",
            (identifier, identifier, identifier),
        ).fetchone()
    return user[0] if user else None


def has_checkup_for_user(user_id: int) -> bool:
    with sqlite3.connect(DB_PATH) as conn:
        checkup = conn.execute(
            "SELECT 1 FROM checkup WHERE user_id=?",
            (user_id,),
        ).fetchone()
    return checkup is not None


def save_checkup_for_user(user_id: int, checkup_data: dict) -> bool:
    import json

    with sqlite3.connect(DB_PATH) as conn:
        user = conn.execute(
            "SELECT 1 FROM login WHERE id=?",
            (user_id,),
        ).fetchone()
        if user is None:
            return False

        conn.execute(
            "INSERT OR REPLACE INTO checkup (user_id, data) VALUES (?, ?)",
            (user_id, json.dumps(checkup_data, ensure_ascii=False)),
        )
    return True


def has_checkup(identifier: str) -> bool:
    user_id = get_user_id(identifier)
    if user_id is None:
        return False

    return has_checkup_for_user(user_id)


def save_checkup(identifier: str, checkup_data: dict) -> bool:
    user_id = get_user_id(identifier)
    if user_id is None:
        return False

    return save_checkup_for_user(user_id, checkup_data)