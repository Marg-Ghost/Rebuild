import sqlite3
from contextlib import closing
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
        CREATE TABLE IF NOT EXISTS google_calendar_sources (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL UNIQUE,
            ics_url TEXT NOT NULL,
            last_synced TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
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
            is_google_event INTEGER NOT NULL DEFAULT 0,
            google_event_id TEXT,
            google_source_id INTEGER,
            task_end_at TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    """)
    task_columns = {row["name"] for row in conn.execute("PRAGMA table_info(tasks)")}
    for column, definition in (
        ("is_google_event", "INTEGER NOT NULL DEFAULT 0"),
        ("google_event_id", "TEXT"),
        ("google_source_id", "INTEGER"),
        ("task_end_at", "TEXT"),
    ):
        if column not in task_columns:
            cursor.execute(f'ALTER TABLE tasks ADD COLUMN "{column}" {definition}')
    cursor.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS idx_google_task_identity
        ON tasks (user_id, google_event_id)
        WHERE google_event_id IS NOT NULL
    """)
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_user_tasks
        ON tasks (user_id, task_date)
    """)
    conn.commit()


def _connect():
    connection = sqlite3.connect(DB_PATH, timeout=10)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def _get_or_create_user_id(connection, username):
    connection.execute(
        "INSERT OR IGNORE INTO users (username, email, password_hash) VALUES (?, ?, ?)",
        (username, f"{username}@calendar.invalid", ""),
    )
    user = connection.execute(
        "SELECT id FROM users WHERE username = ?", (username,)
    ).fetchone()
    if user is None:
        raise RuntimeError("Kalenderkonto konnte nicht geladen werden")
    return user["id"]


def save_date(usr, date):
    if not usr:
        raise ValueError("Benutzer fehlt")
    try:
        task_date = current_date.fromisoformat(date.date).isoformat()
        task_time = current_time.fromisoformat(date.time).strftime("%H:%M") if date.time else None
        importance = int(date.importance)
    except (TypeError, ValueError) as error:
        raise ValueError("Ungültige Kalenderdaten") from error
    if importance < 1 or importance > 5:
        raise ValueError("Wichtigkeit muss zwischen 1 und 5 liegen")
    if date.task_type not in {"work", "private"}:
        raise ValueError("Typ muss work oder private sein")

    user_id = _get_or_create_user_id(conn, usr)
    cursor.execute("""
        INSERT INTO tasks (user_id, task_date, task_time, importance, task_type, content)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (user_id, task_date, task_time, importance, date.task_type, date.content or None))
    conn.commit()
    return cursor.lastrowid


def sync_google_calendar_events(username, ics_url, events):
    if not username:
        raise ValueError("Benutzer fehlt")

    with closing(_connect()) as connection, connection:
        user_id = _get_or_create_user_id(connection, username)
        connection.execute(
            """
            INSERT INTO google_calendar_sources (user_id, ics_url, last_synced)
            VALUES (?, ?, NULL)
            ON CONFLICT(user_id) DO UPDATE SET ics_url=excluded.ics_url
            """,
            (user_id, ics_url),
        )
        source = connection.execute(
            "SELECT id FROM google_calendar_sources WHERE user_id=?",
            (user_id,),
        ).fetchone()
        source_id = source["id"]

        event_ids = [event["google_event_id"] for event in events]
        if event_ids:
            placeholders = ",".join("?" for _ in event_ids)
            connection.execute(
                f"""
                DELETE FROM tasks
                WHERE user_id=? AND google_source_id=?
                  AND google_event_id NOT IN ({placeholders})
                """,
                (user_id, source_id, *event_ids),
            )
        else:
            connection.execute(
                "DELETE FROM tasks WHERE user_id=? AND google_source_id=?",
                (user_id, source_id),
            )

        for event in events:
            connection.execute(
                """
                INSERT INTO tasks (
                    user_id, task_date, task_time, task_end_at, importance, task_type,
                    content, is_google_event, google_event_id, google_source_id
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
                ON CONFLICT(user_id, google_event_id) WHERE google_event_id IS NOT NULL
                DO UPDATE SET
                    task_date=excluded.task_date,
                    task_time=excluded.task_time,
                    task_end_at=excluded.task_end_at,
                    importance=excluded.importance,
                    task_type=excluded.task_type,
                    content=excluded.content,
                    google_source_id=excluded.google_source_id
                """,
                (
                    user_id,
                    event["task_date"],
                    event["task_time"],
                    event["task_end_at"],
                    event["importance"],
                    event["task_type"],
                    event["content"],
                    event["google_event_id"],
                    source_id,
                ),
            )
        connection.execute(
            """
            UPDATE google_calendar_sources
            SET last_synced=CURRENT_TIMESTAMP
            WHERE id=?
            """,
            (source_id,),
        )
    return len(events)


def get_google_calendar_source(username):
    if not username:
        return None
    with closing(_connect()) as connection:
        user = connection.execute(
            "SELECT id FROM users WHERE username=?",
            (username,),
        ).fetchone()
        if user is None:
            return None
        source = connection.execute(
            """
            SELECT id, last_synced FROM google_calendar_sources
            WHERE user_id=?
            """,
            (user["id"],),
        ).fetchone()
    return dict(source) if source else None


def get_data(usr, month, year=None):
    if not usr:
        return []
    year = year or current_date.today().year
    month_start = current_date(year, month, 1)
    next_month = current_date(year + (month == 12), month % 12 + 1, 1)

    user = conn.execute("SELECT id FROM users WHERE username = ?", (usr,)).fetchone()
    if user is None:
        return []
    cursor.execute("""
        SELECT id, task_date, task_time, task_end_at, importance, task_type, content,
               is_google_event
        FROM tasks
        WHERE user_id = ? AND task_date >= ? AND task_date < ?
        ORDER BY task_date, task_time, id
    """, (user["id"], month_start.isoformat(), next_month.isoformat()))
    return [dict(row) for row in cursor.fetchall()]


init_db()