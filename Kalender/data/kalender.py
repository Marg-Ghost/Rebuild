import sqlite3

conn = sqlite3.connect("kalender.db")
cursor = conn.cursor()

def init_db():
    # 1. Tabelle für die Benutzer
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL
        )
    """)

    # 2. Tabelle für die Termine / Tasks
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            task_date TEXT NOT NULL,      -- Format: YYYY-MM-DD
            task_time TEXT,               -- Format: HH:MM
            importance INTEGER NOT NULL,  -- Wert 1 bis 4
            task_type TEXT NOT NULL,      -- 'work' oder 'private'
            content TEXT,                 -- Beschreibungstext
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    """)

    # Index für schnelle Abfragen pro User und Datum
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_user_tasks 
        ON tasks (user_id, task_date)
    """)

    conn.commit()

# Datenbank initialisieren
init_db()