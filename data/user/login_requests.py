import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().with_name("user.db")


def init_db() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT,
                email TEXT NOT NULL,
                phone TEXT,
                password TEXT NOT NULL
            )
            """
        )

        columns = {row[1] for row in conn.execute("PRAGMA table_info(users)")}
        for column, definition in {
            "username": "TEXT",
            "email": "TEXT",
            "phone": "TEXT",
            "password": "TEXT",
        }.items():
            if column not in columns:
                conn.execute(f"ALTER TABLE users ADD COLUMN {column} {definition}")

        conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON users(email)")
        conn.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS users_phone_idx ON users(phone) WHERE phone IS NOT NULL"
        )
        conn.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS users_username_idx ON users(username) WHERE username IS NOT NULL"
        )


init_db()


def login_user(identifier: str, password: str, method: str) -> int:
    column = {"username": "username", "email": "email", "phone": "phone"}.get(method)
    if column is None:
        return 1

    with sqlite3.connect(DB_PATH) as conn:
        user = conn.execute(
            f"SELECT id FROM users WHERE {column}=? AND password=?",
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
                "INSERT INTO users (username, email, password, phone) VALUES (?, ?, ?, ?)",
                (username or None, email, password, phone or None),
            )
    except sqlite3.IntegrityError:
        return 1

    return 0