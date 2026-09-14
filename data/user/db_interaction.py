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
                "act_sum" REAL NOT NULL
            )
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

def save_checkup_entrie(user: str, health: float, sleep: list, food: float, act: float, first = False):
    import json
    import datetime
    today = datetime.date.today().isoformat()

    with sqlite3.connect(DB_PATH) as conn:
        daily = conn.execute(
            """
            SELECT checkup_date, checkup_count, health_sum, sleep_sum, food_sum, act_sum
            FROM daily_checkup
            WHERE username=?
            """,
            (user,),
        ).fetchone()

        if daily is not None and daily[0] != today:
            old_date, count, health_sum, sleep_sum, food_sum, act_sum = daily
            sleep_sum = json.loads(sleep_sum)
            averages = {
                "health": health_sum / count,
                "sleep": [value / count for value in sleep_sum],
                "food": food_sum / count,
                "act": act_sum / count,
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
        else:
            count = daily[1]
            health_sum = daily[2]
            sleep_sum = json.loads(daily[3])
            food_sum = daily[4]
            act_sum = daily[5]

        count += 1
        health_sum += health
        sleep_sum = [old + new for old, new in zip(sleep_sum, sleep)]
        food_sum += food
        act_sum += act
        conn.execute(
            """
            INSERT OR REPLACE INTO daily_checkup
            (username, checkup_date, checkup_count, health_sum, sleep_sum, food_sum, act_sum)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (user, today, count, health_sum, json.dumps(sleep_sum), food_sum, act_sum),
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
    