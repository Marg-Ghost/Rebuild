import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().with_name("user.db")


def init_db() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("DROP TABLE IF EXISTS checkup")
        conn.execute("DROP INDEX IF EXISTS users_email_idx")
        conn.execute("DROP INDEX IF EXISTS users_phone_idx")
        conn.execute("DROP INDEX IF EXISTS users_username_idx")
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS login (
                "id" TEXT,
                "username" TEXT,
                "email" TEXT,
                "phone" TEXT,
                "password" TEXT
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS profile (
                "username" TEXT,
                "gen_profile" TEXT,
                "health_float" TEXT,
                "health_curve" TEXT,
                "sleep_curve" TEXT,
                "food_curve" TEXT,
                "act_curve" TEXT
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS daily_checkup (
                "username" TEXT PRIMARY KEY,
                "checkup_date" TEXT NOT NULL,
                "checkup_count" INTEGER NOT NULL,
                "health_sum" REAL NOT NULL,
                "sleep_sum" TEXT NOT NULL,
                "food_sum" REAL NOT NULL,
                "act_sum" REAL NOT NULL,
                "sleep_count" INTEGER NOT NULL DEFAULT 0,
                "food_count" INTEGER NOT NULL DEFAULT 0,
                "act_count" INTEGER NOT NULL DEFAULT 0
            )
            """
        )
        daily_columns = {
            row[1] for row in conn.execute("PRAGMA table_info(daily_checkup)")
        }
        for column in ("sleep_count", "food_count", "act_count"):
            if column not in daily_columns:
                conn.execute(
                    f'ALTER TABLE daily_checkup ADD COLUMN "{column}" INTEGER NOT NULL DEFAULT 0'
                )
        conn.execute(
            """
            UPDATE daily_checkup
            SET sleep_count=checkup_count, food_count=checkup_count, act_count=checkup_count
            WHERE sleep_count=0 AND food_count=0 AND act_count=0 AND checkup_count > 0
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS daily_sleep_checkup (
                username TEXT NOT NULL,
                checkup_date TEXT NOT NULL,
                started_after_checkup INTEGER NOT NULL DEFAULT 0,
                completed INTEGER NOT NULL DEFAULT 0,
                sleep_hours REAL,
                sleep_point REAL,
                sleep_count INTEGER,
                sleep_quality REAL,
                PRIMARY KEY (username, checkup_date)
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS calendar_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL,
                title TEXT NOT NULL,
                description TEXT,
                start_at TEXT NOT NULL,
                end_at TEXT,
                priority INTEGER NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
                status TEXT NOT NULL DEFAULT 'open',
                all_day INTEGER NOT NULL DEFAULT 0 CHECK (all_day IN (0, 1)),
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS calendar_events_user_date_idx
            ON calendar_events(username, start_at)
            """
        )


init_db()


# login logic
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
            profile_username = username or email
            conn.execute(
                "INSERT INTO login (id, username, email, phone, password) VALUES (?, ?, ?, ?, ?)",
                (profile_username, username or None, email, phone or None, password),
            )
            conn.execute(
                "INSERT INTO profile (username) VALUES (?)",
                (profile_username,),
            )
    except sqlite3.IntegrityError:
        return 1

    return 0

def get_all_user() -> list:
    with sqlite3.connect(DB_PATH) as conn:
        all = conn.execute("SELECT * FROM login").fetchall()
    return all


def get_user_id(identifier: str, method: str | None = None) -> str | None:
    with sqlite3.connect(DB_PATH) as conn:
        column = {"username": "username", "email": "email", "phone": "phone"}.get(method)
        if column is not None:
            user = conn.execute(
                f"SELECT id FROM login WHERE {column}=?",
                (identifier,),
            ).fetchone()
        elif "@" in identifier:
            user = conn.execute(
                "SELECT id FROM login WHERE email=?",
                (identifier,),
            ).fetchone()
        elif "+" in identifier or identifier.isdigit():
            user = conn.execute(
                "SELECT id FROM login WHERE phone=?",
                (identifier,),
            ).fetchone()
        else:
            user = conn.execute(
                "SELECT id FROM login WHERE username=?",
                (identifier,),
            ).fetchone()
    return user[0] if user else None


def get_username(identifier: str, method: str) -> str | None:
    column = {"username": "username", "email": "email", "phone": "phone"}.get(method)
    if column is None:
        return None

    with sqlite3.connect(DB_PATH) as conn:
        user = conn.execute(
            f"SELECT username FROM login WHERE {column}=?",
            (identifier,),
        ).fetchone()
    return user[0] if user and user[0] else None


def has_checkup_for_user(username: str) -> bool:
    with sqlite3.connect(DB_PATH) as conn:
        checkup = conn.execute(
                        """
                        SELECT health_float
                        FROM profile
                        WHERE username=?
                            AND health_float IS NOT NULL
                            AND health_float <> ''
                        """,
            (username,),
        ).fetchone()
    return checkup is not None


def has_profile_for_user(username: str) -> bool:
    with sqlite3.connect(DB_PATH) as conn:
        profile = conn.execute(
            """
            SELECT 1
            FROM profile
            WHERE username=?
              AND gen_profile IS NOT NULL
            """,
            (username,),
        ).fetchone()
    return profile is not None


def save_profile_for_user(username: str, age: int, hobbies: str | None, job: str | None, sickness: list[str]) -> bool:
    import json

    with sqlite3.connect(DB_PATH) as conn:
        profile_data = json.dumps(
            {
                "age": age,
                "hobbies": hobbies or None,
                "job": job or None,
                "sickness": sickness,
            },
            ensure_ascii=False,
        )

        updated = conn.execute(
            "UPDATE profile SET gen_profile=? WHERE username=?",
            (profile_data, username),
        )
        if updated.rowcount == 0:
            conn.execute(
                "INSERT INTO profile (username, gen_profile) VALUES (?, ?)",
                (username, profile_data),
            )
    return True

def has_checkup(username: str) -> bool:
    return has_checkup_for_user(username)

# interaction with user acc health data

def save_checkup_for_user(username: str, checkup_data: dict) -> bool:
    import json

    with sqlite3.connect(DB_PATH) as conn:
        user = conn.execute(
            "SELECT username FROM login WHERE username=?",
            (username,),
        ).fetchone()
        if user is None:
            return False

        conn.execute(
            "UPDATE profile SET health_float=? WHERE username=?",
            (json.dumps(checkup_data, ensure_ascii=False), username),
        )
    return True

def save_checkup(username: str, checkup_data: dict) -> bool:
    if not username:
        return False

    return save_checkup_for_user(username, checkup_data)

def get_health_int(usr: str) -> str | None:
    try:
        with sqlite3.connect(DB_PATH) as conn:
            health = conn.execute(
                "SELECT health_float FROM profile WHERE username=?",
                (usr,),
            ).fetchone()
            return health[0] if health else None
    except sqlite3.Error:
        return None

def save_checkup_entrie(
    user: str,
    health: float,
    sleep: list,
    food: float,
    act: float,
    first=False,
    include_sleep=True,
    include_food=True,
    include_activity=True,
):
    import json
    import datetime
    today = datetime.date.today().isoformat()

    with sqlite3.connect(DB_PATH) as conn:
        daily = conn.execute(
            """
                 SELECT checkup_date, checkup_count, health_sum, sleep_sum, food_sum, act_sum,
                     sleep_count, food_count, act_count
            FROM daily_checkup
            WHERE username=?
            """,
            (user,),
        ).fetchone()

        if daily is not None and daily[0] != today:
            old_date = daily[0]
            count = daily[1]
            health_sum = daily[2]
            sleep_sum = json.loads(daily[3])
            food_sum = daily[4]
            act_sum = daily[5]
            sleep_count = daily[6]
            food_count = daily[7]
            act_count = daily[8]
            averages = {
                "health": health_sum / count if count else 0.0,
                "sleep": [value / sleep_count for value in sleep_sum] if sleep_count else [0.0, 0.0, 0.0],
                "food": food_sum / food_count if food_count else 0.0,
                "act": act_sum / act_count if act_count else 0.0,
            }
            profile = conn.execute(
                "SELECT health_curve,sleep_curve,food_curve,act_curve FROM profile WHERE username=?",
                (user,),
            ).fetchone()
            if profile is None:
                return False

            curves = [json.loads(value) if value else {} for value in profile]
            curves[0][old_date] = averages["health"]
            curves[1][old_date] = averages["sleep"]
            curves[2][old_date] = averages["food"]
            curves[3][old_date] = averages["act"]
            conn.execute(
                """
                UPDATE profile
                SET health_float=?, health_curve=?, sleep_curve=?, food_curve=?, act_curve=?
                WHERE username=?
                """,
                (
                    str(averages["health"]),
                    json.dumps(curves[0]),
                    json.dumps(curves[1]),
                    json.dumps(curves[2]),
                    json.dumps(curves[3]),
                    user,
                ),
            )
            daily = None

        if daily is None:
            count = 0
            health_sum = 0.0
            sleep_sum = [0.0, 0.0, 0.0]
            food_sum = 0.0
            act_sum = 0.0
            sleep_count = 0
            food_count = 0
            act_count = 0
        else:
            count = daily[1]
            health_sum = daily[2]
            sleep_sum = json.loads(daily[3])
            food_sum = daily[4]
            act_sum = daily[5]
            sleep_count = daily[6]
            food_count = daily[7]
            act_count = daily[8]

        count += 1
        health_sum += health
        if include_sleep:
            sleep_sum = [old + new for old, new in zip(sleep_sum, sleep)]
            sleep_count += 1
        if include_food:
            food_sum += food
            food_count += 1
        if include_activity:
            act_sum += act
            act_count += 1
        conn.execute(
            """
            INSERT OR REPLACE INTO daily_checkup
            (username, checkup_date, checkup_count, health_sum, sleep_sum, food_sum, act_sum,
             sleep_count, food_count, act_count)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                user, today, count, health_sum, json.dumps(sleep_sum), food_sum, act_sum,
                sleep_count, food_count, act_count,
            ),
        )
    return True


def get_daily_sleep_checkup(user: str) -> dict:
    import datetime

    today = datetime.date.today().isoformat()
    with sqlite3.connect(DB_PATH) as conn:
        state = conn.execute(
            """
            SELECT started_after_checkup, completed, sleep_hours, sleep_quality
            FROM daily_sleep_checkup
            WHERE username=? AND checkup_date=? AND completed=1
            """,
            (user, today),
        ).fetchone()
        if state is None:
            state = conn.execute(
                """
                SELECT started_after_checkup, completed, sleep_hours, sleep_quality
                FROM daily_sleep_checkup
                WHERE username=? AND completed=0
                ORDER BY checkup_date DESC LIMIT 1
                """,
                (user,),
            ).fetchone()

    if state is None:
        return {"date": today, "status": "not_started", "started_after_checkup": False}
    return {
        "date": today,
        "status": "complete" if state[1] else "pending",
        "started_after_checkup": bool(state[0]),
        "sleep_hours": state[2],
        "sleep_quality": state[3],
    }


def mark_sleep_not_yet(user: str) -> bool:
    import datetime

    today = datetime.date.today().isoformat()
    with sqlite3.connect(DB_PATH) as conn:
        state = conn.execute(
            """
            SELECT completed FROM daily_sleep_checkup
            WHERE username=? AND checkup_date=?
            """,
            (user, today),
        ).fetchone()
        if state and state[0]:
            return False
        pending = conn.execute(
            "SELECT 1 FROM daily_sleep_checkup WHERE username=? AND completed=0 LIMIT 1",
            (user,),
        ).fetchone()
        if pending:
            return True
        conn.execute(
            """
            INSERT INTO daily_sleep_checkup
                (username, checkup_date, started_after_checkup, completed)
            VALUES (?, ?, 1, 0)
            ON CONFLICT(username, checkup_date)
            DO UPDATE SET started_after_checkup=1
            WHERE daily_sleep_checkup.completed=0
            """,
            (user, today),
        )
    return True


def save_daily_sleep_checkup(
    user: str,
    sleep_hours: float,
    sleep_point: float,
    sleep_quality: float,
) -> bool:
    import datetime
    import json

    today = datetime.date.today().isoformat()
    with sqlite3.connect(DB_PATH) as conn:
        state = conn.execute(
            """
            SELECT checkup_date, started_after_checkup, completed
            FROM daily_sleep_checkup
            WHERE username=? AND completed=0
            ORDER BY checkup_date DESC LIMIT 1
            """,
            (user,),
        ).fetchone()
        if state is None:
            state = conn.execute(
                """
                SELECT checkup_date, started_after_checkup, completed
                FROM daily_sleep_checkup
                WHERE username=? AND checkup_date=?
                """,
                (user, today),
            ).fetchone()
        if state and state[2]:
            return False

        pending_date = state[0] if state else today
        started_after_checkup = int(bool(state and state[1]))
    saved = save_checkup_entrie(
        user,
        1000.0 + sleep_quality,
        [sleep_hours, sleep_point, started_after_checkup],
        0.0,
        0.0,
        include_food=False,
        include_activity=False,
    )
    if not saved:
        return False

    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """
            INSERT INTO daily_sleep_checkup
                (username, checkup_date, started_after_checkup, completed,
                 sleep_hours, sleep_point, sleep_count, sleep_quality)
            VALUES (?, ?, ?, 1, ?, ?, ?, ?)
            ON CONFLICT(username, checkup_date)
            DO UPDATE SET completed=1, sleep_hours=excluded.sleep_hours,
                sleep_point=excluded.sleep_point, sleep_count=excluded.sleep_count,
                sleep_quality=excluded.sleep_quality
            """,
            (user, today, started_after_checkup, sleep_hours, sleep_point,
             started_after_checkup, sleep_quality),
        )
        if pending_date != today:
            conn.execute(
                """
                UPDATE daily_sleep_checkup
                SET completed=1, sleep_hours=?, sleep_point=?, sleep_count=?, sleep_quality=?
                WHERE username=? AND checkup_date=? AND completed=0
                """,
                (sleep_hours, sleep_point, started_after_checkup, sleep_quality,
                 user, pending_date),
            )
    return True


# andere user abfragen
def get_index_intel(user : str) -> list:
    import ast
    import json

    with sqlite3.connect(DB_PATH) as conn:
            data = conn.execute(
                """
                SELECT checkup_count, health_sum
                FROM daily_checkup
                WHERE username=?
                """,
                (user,),
            ).fetchone()
            count = data[0] if data else 0
            health = data[1] if data else 0
            # for curve below
            data_extra = conn.execute(
                """
                SELECT health_curve
                FROM profile
                WHERE username = ?
                """,
                (user,),
            ).fetchone()
            if data_extra and data_extra[0]:
                try:
                    health_curve = json.loads(data_extra[0])
                except json.JSONDecodeError:
                    health_curve = ast.literal_eval(data_extra[0])
            else:
                health_curve = {}

    return [count, health, health_curve]


def get_daily_feature_values(user: str) -> dict:
    import datetime
    import json

    today = datetime.date.today().isoformat()
    with sqlite3.connect(DB_PATH) as conn:
        data = conn.execute(
            """
                 SELECT checkup_date, checkup_count, sleep_sum, food_sum, act_sum,
                     sleep_count, food_count, act_count
            FROM daily_checkup
            WHERE username=?
            """,
            (user,),
        ).fetchone()

    if data is None or data[0] != today or data[1] == 0:
        return {
            "date": today,
            "checkup_count": 0,
            "sleep_hours": None,
            "food_score": None,
            "activity_score": None,
        }

    sleep_values = json.loads(data[2])
    return {
        "date": today,
        "checkup_count": data[1],
        "sleep_hours": sleep_values[0] / data[5] if data[5] else None,
        "food_score": data[3] / data[6] if data[6] else None,
        "activity_score": data[4] / data[7] if data[7] else None,
    }


def create_calendar_event(
    username: str,
    title: str,
    start_at: str,
    end_at: str | None,
    description: str | None,
    priority: int,
    all_day: bool,
) -> int:
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.execute(
            """
            INSERT INTO calendar_events
                (username, title, description, start_at, end_at, priority, all_day)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (username, title, description, start_at, end_at, priority, int(all_day)),
        )
    return cursor.lastrowid


def get_calendar_events(username: str, start_at: str, end_at: str) -> list[dict]:
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            """
            SELECT id, title, description, start_at, end_at, priority, status, all_day
            FROM calendar_events
            WHERE username=?
              AND start_at < ?
              AND COALESCE(end_at, start_at) >= ?
            ORDER BY start_at, priority DESC, id
            """,
            (username, end_at, start_at),
        ).fetchall()
    return [dict(row) for row in rows]


def delete_calendar_event(username: str, event_id: int) -> bool:
    with sqlite3.connect(DB_PATH) as conn:
        deleted = conn.execute(
            "DELETE FROM calendar_events WHERE id=? AND username=?",
            (event_id, username),
        )
    return deleted.rowcount > 0
    