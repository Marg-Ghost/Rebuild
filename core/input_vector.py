import sqlite3
import math
import ollama
from pathlib import Path
from core.vector_config import INPUT_VECTOR_SIZE

HEALTH_SLEEP = [18, 19, 20, 22, 23]

HEALTH_DB_PATH = Path(__file__).resolve().parents[1] / "data" / "ai_konstanten" / "health.db"
CATALOGS = {
    "food": {
        "table": "food_nährwerte",
        "name": "food_name",
        "category": "Kategorie",
        "vector": [
            "Eiweiße (g)",
            "Fette (g)",
            "Zucker (g)",
            "Kohlenhydrate (g)",
            "Ballaststoffe (g)",
            "Wasser (g)",
            "Makronährstoffe (g)",
            "Mikronährstoffe (Score 0-10)",
        ],
        "score": "Healthiness_Score (1-100)",
    },
    "activity": {
        "table": "activity_werte",
        "name": "activity_name",
        "category": "Kategorie",
        "vector": [
            "Energieverbrauch (kcal/30min)",
            "Cardio-Intensitaet",
            "Kraft-/Muskelbeanspruchung ",
            "Beweglichkeit",
            "Koordination",
            "Stressabbau",
            "Gelenkbelastung",
            "Verletzungsrisiko ",
        ],
        "score": "Healthiness_Score ",
    },
}

def get_catalog_items(kind: str) -> list[dict]:
    catalog = CATALOGS.get(kind)
    if catalog is None:
        raise ValueError("Unbekannter Katalogtyp")

    table = catalog["table"]
    columns = [catalog["name"], catalog["category"], *catalog["vector"], catalog["score"]]
    selected_columns = ", ".join(f'"{column}"' for column in columns)
    with sqlite3.connect(HEALTH_DB_PATH) as database:
        rows = database.execute(
            f'SELECT {selected_columns} FROM "{table}" ORDER BY "{catalog["name"]}" COLLATE NOCASE'
        ).fetchall()

    return [
        {
            "name": str(row[0]),
            "category": str(row[1] or ""),
            "vector": [float(value or 0) for value in row[2:2 + INPUT_VECTOR_SIZE]],
            "score": float(row[2 + INPUT_VECTOR_SIZE] or 0),
        }
        for row in rows
    ]


def get_catalog_item(kind: str, name: str) -> dict | None:
    normalized_name = name.strip().casefold()
    return next(
        (
            item
            for item in get_catalog_items(kind)
            if item["name"].strip().casefold() == normalized_name
        ),
        None,
    )


def get_sleep_point(hour: int) -> float:
    database_hour = 24 if hour in {0, 24} else max(2, min(hour, 23))
    with sqlite3.connect(HEALTH_DB_PATH) as database:
        result = database.execute(
            'SELECT "-140" FROM "sleep_point" WHERE "1"=?',
            (database_hour,),
        ).fetchone()
    return float(result[0]) if result else 0.0


def all_check(health: float, sleep: list, food: list, act: list) -> list:
    # sleep data/logic
    sleep_score = float(sleep[0])
    point_score = float(sleep[1])
    late_nights_fraction = float(sleep[2])
    if not 0 <= late_nights_fraction <= 1:
        raise ValueError("late_nights_fraction muss zwischen 0 und 1 liegen")
    sleep_impact = sleep_clac(sleep_score, point_score, late_nights_fraction)

    # food section
    from core.ai.ai import forwardpropagation
    # Catalog labels are the training units: score each food individually and
    # average scores, rather than feeding a summed meal vector to the network.
    food_scores = []
    for item in food:
        input_vector = create_food_vector("food", [item])
        predicted = forwardpropagation(0, train=False, input_vector=input_vector)
        if predicted is None:
            catalog_item = get_catalog_item("food", item)
            predicted = round(catalog_item["score"]) if catalog_item else 0
        food_scores.append(float(predicted))
    return_val_f = round(sum(food_scores) / len(food_scores)) if food_scores else 0
    food_impact = get_impact("food", return_val_f) if food_scores else 0.0

    # Evaluate each activity on its own vector. Durations are minutes, and
    # their contribution uses the agreed logarithmic 30-minute reference.
    weighted_activity_scores = []
    act_impact = 0.0
    for entry in act:
        if isinstance(entry, str):
            name, duration_minutes = entry, 30.0
        elif isinstance(entry, dict):
            name = str(entry.get("name", ""))
            duration_minutes = float(entry.get("duration_minutes", 30.0))
        else:
            raise ValueError("Aktivität muss Name und Dauer enthalten")
        if not name or not math.isfinite(duration_minutes) or duration_minutes <= 0:
            raise ValueError("Aktivität oder Dauer ungültig")
        input_vector = create_food_vector("act", [name])
        predicted = forwardpropagation(1, train=False, input_vector=input_vector)
        if predicted is None:
            catalog_item = get_catalog_item("activity", name)
            predicted = round(catalog_item["score"]) if catalog_item else 0
        predicted = float(predicted)
        weight = math.log1p(duration_minutes / 30.0) / math.log(2.0)
        weighted_activity_scores.append((predicted, weight))
        act_impact += get_impact("act", int(round(predicted))) * weight
    return_val_a = (
        round(sum(score * weight for score, weight in weighted_activity_scores)
              / sum(weight for _, weight in weighted_activity_scores))
        if weighted_activity_scores else 0
    )

    # helath calc mit impact
    health += sleep_impact
    health += food_impact
    health += act_impact

    return [health, [sleep_score, point_score, late_nights_fraction],
            return_val_f, return_val_a, act_impact]
""" 
def register_vector(sleep: list, food : list, act : list):
    global HEALTH_SLEEP
    health_start = 1ooo
    # sleep
    # 0 = time || 1 = point
    sleep_time = sleep[0]
    sleep_point = sleep[1]
    sleep_point = None
    if sleep_point in HEALTH_SLEEP:
        sleep_point_count = 0
    else:
        sleep_point_count = 1

    all_check([sleep_time, sleep_point, sleep_point_count], food, act)
"""
def sleep_clac(sleep_score: float,point_score: float,late_nights_fraction: float,) -> float:
    penalty_point = min(point_score, 0.0)
    if not 0 <= late_nights_fraction <= 1:
        raise ValueError("late_nights_fraction muss zwischen 0 und 1 liegen")
    erg = sleep_score + penalty_point * late_nights_fraction
    return erg
    
def create_food_vector(type: str, vec: list) -> list:
    database = sqlite3.connect(HEALTH_DB_PATH)
    database_cursor = database.cursor()
    input_vector = [0.0] * INPUT_VECTOR_SIZE

    if type == "food":
        catalog = CATALOGS["food"]
    elif type == "act":
        catalog = CATALOGS["activity"]
    else:
        raise ValueError("No type given")

    table = catalog["table"]
    name_column = catalog["name"]
    feature_columns = ", ".join(f'"{column}"' for column in catalog["vector"])
    try:
        for element in vec:
            database_cursor.execute(
                f'SELECT {feature_columns} FROM "{table}" WHERE "{name_column}"=?',
                (str(element).strip(),),
            )
            return_array = database_cursor.fetchone()
            if return_array is None:
                raise ValueError(f"Unbekannter Referenzeintrag: {element}")
            for index in range(INPUT_VECTOR_SIZE):
                input_vector[index] += float(return_array[index] or 0)

        if type == "act" and vec:
            input_vector = [value / len(vec) for value in input_vector]
    finally:
        database.close()

    return input_vector
     
def get_impact(type : str, number : int) -> int:
    table_name = None
    if type == "food":
        table_name = "foodval_impact"
    elif type == "act":
        table_name = "activity_impact"
    else:
        raise ValueError("no type given!")

    if number is None:
        return 0.0

    with sqlite3.connect(HEALTH_DB_PATH) as database:
        return_val = database.execute(
            f'SELECT "return" FROM "{table_name}" WHERE "Score "=?',
            (number,),
        ).fetchone()

    if not return_val:
        return 0.0
    magnitude = abs(float(return_val[0]))
    # The legacy tables store magnitudes only: sub-neutral scores are harmful,
    # neutral scores map to zero, and scores above 70 are beneficial.
    return magnitude if number > 70 else -magnitude if number < 70 else 0.0
