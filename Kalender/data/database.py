import sqlite3
from datetime import date as current_date, time as current_time
from pathlib import Path

DB_PATH = Path(__file__).resolve().with_name("kalender.db")
conn = sqlite3.connect(DB_PATH)
conn.row_factory = sqlite3.Row
conn.execute("PRAGMA foreign_keys = ON")
cursor = conn.cursor()


def init_db():
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            task_date TEXT NOT NULL,
            task_time TEXT,
            importance INTEGER NOT NULL,
            task_type TEXT NOT NULL,
            content TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    """)
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_user_tasks
        ON tasks (user_id, task_date)
    """)
    conn.commit()


def save_date(usr, date):
    if not usr:
        raise ValueError("Benutzer fehlt")
    try:
        task_date = current_date.fromisoformat(date.date).isoformat()
        task_time = current_time.fromisoformat(date.time).strftime("%H:%M") if date.time else None
        importance = int(date.importance)
    except (TypeError, ValueError) as error:
        raise ValueError("Ungültige Kalenderdaten") from error
    if importance < 1 or importance > 4:
        raise ValueError("Wichtigkeit muss zwischen 1 und 4 liegen")
    if date.task_type not in {"work", "private"}:
        raise ValueError("Typ muss work oder private sein")

    cursor.execute(
        "INSERT OR IGNORE INTO users (username, email, password_hash) VALUES (?, ?, ?)",
        (usr, f"{usr}@calendar.invalid", ""),
    )
    cursor.execute("SELECT id FROM users WHERE username = ?", (usr,))
    user_id = cursor.fetchone()["id"]
    cursor.execute("""
        INSERT INTO tasks (user_id, task_date, task_time, importance, task_type, content)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (user_id, task_date, task_time, importance, date.task_type, date.content or None))
    conn.commit()
    return cursor.lastrowid


def get_data(usr, month, year=None):
    if not usr:
        return []
    year = year or current_date.today().year
    month_start = current_date(year, month, 1)
    next_month = current_date(year + (month == 12), month % 12 + 1, 1)

    cursor.execute("SELECT id FROM users WHERE username = ?", (usr,))
    user = cursor.fetchone()
    if user is None:
        return []
    cursor.execute("""
        SELECT id, task_date, task_time, importance, task_type, content
        FROM tasks
        WHERE user_id = ? AND task_date >= ? AND task_date < ?
        ORDER BY task_date, task_time, id
    """, (user["id"], month_start.isoformat(), next_month.isoformat()))
    return [dict(row) for row in cursor.fetchall()]


init_db()