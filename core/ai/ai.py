# ai_ipc.py
import json
import math
import os
import struct
import subprocess
import sqlite3
from contextlib import closing
from multiprocessing import shared_memory
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
PATH_DB = PROJECT_ROOT / "core" / "ai" / "weigths.db"
TABLE_FOOD = "food"
TABLE_ACTIVITY = "act"

DATA_HEALTH = PROJECT_ROOT / "data" / "ai_konstanten" / "health.db"
HEALTH_TABLE_FOOD = "food_nährwerte"
HEALTH_TABLE_ACTIVITY = "activity_werte"

# complilierte C Data
C_AI = PROJECT_ROOT / "core" / "ai" / "ai"

INPUT_NEURONEN = 8
HIDDEN_NEURONEN = 8
OUTPUT_NEURONEN = 1
LERNRATE = 0.05

W1_SIZE = HIDDEN_NEURONEN * INPUT_NEURONEN    # 64 für 8x8 Matrix
B1_SIZE = HIDDEN_NEURONEN                      # 8
W2_SIZE = HIDDEN_NEURONEN * HIDDEN_NEURONEN    # 64 für 8x8 Matrix
B2_SIZE = HIDDEN_NEURONEN                      # 8
W3_SIZE = OUTPUT_NEURONEN * HIDDEN_NEURONEN    # 8
B3_SIZE = OUTPUT_NEURONEN                      # 1

IN_BUF_FLOATS = 1 + W1_SIZE + B1_SIZE + W2_SIZE + B2_SIZE + W3_SIZE + B3_SIZE + INPUT_NEURONEN + OUTPUT_NEURONEN + 1
OUT_BUF_FLOATS = W1_SIZE + B1_SIZE + W2_SIZE + B2_SIZE + W3_SIZE + B3_SIZE + OUTPUT_NEURONEN

SHM_INPUT_NAME = "ai_input"
SHM_OUTPUT_NAME = "ai_output"

"""
Hilfsfunktionen
"""
# Translator
# C will nur [] ncht 2 dimenesionen
def simple_list(matrix_2d):
    ergebnis = []
    for i in matrix_2d:
        for j in i:
            ergebnis.append(j)
    return ergebnis

def unsimple_list(flat, rows, cols):
    complex_list = []
    k = 0
    for i in range(rows):
        part = [] 
        part.append(flat[k:k + cols])
        k += cols
        complex_list.append(part[0])  
            
    return complex_list

def _python_ai_auf(modus, W1, b1, W2, b2, W3, b3, input_vector, expected, lernrate):
    W1, b1, W2, b2, W3, b3 = (
        list(map(float, values)) for values in (W1, b1, W2, b2, W3, b3)
    )
    input_vector = list(map(float, input_vector))
    if len(input_vector) != INPUT_NEURONEN:
        raise ValueError(f"Eingabe muss genau {INPUT_NEURONEN} Werte enthalten")

    def sigmoid(value):
        if value >= 0:
            return 1.0 / (1.0 + math.exp(-value))
        exp_value = math.exp(value)
        return exp_value / (1.0 + exp_value)

    def forward():
        h1 = [
            sigmoid(sum(W1[i * INPUT_NEURONEN + k] * input_vector[k]
                        for k in range(INPUT_NEURONEN)) + b1[i])
            for i in range(HIDDEN_NEURONEN)
        ]
        h2 = [
            sigmoid(sum(W2[i * HIDDEN_NEURONEN + k] * h1[k]
                        for k in range(HIDDEN_NEURONEN)) + b2[i])
            for i in range(HIDDEN_NEURONEN)
        ]
        output = [
            sigmoid(sum(W3[i * HIDDEN_NEURONEN + k] * h2[k]
                        for k in range(HIDDEN_NEURONEN)) + b3[i])
            for i in range(OUTPUT_NEURONEN)
        ]
        return h1, h2, output

    h1, h2, output = forward()
    if modus > 0.5:
        expected = list(map(float, expected))
        delta_out = [
            (output[i] - expected[i]) * output[i] * (1.0 - output[i])
            for i in range(OUTPUT_NEURONEN)
        ]
        delta_h2 = [
            sum(W3[i * HIDDEN_NEURONEN + k] * delta_out[i]
                for i in range(OUTPUT_NEURONEN)) * h2[k] * (1.0 - h2[k])
            for k in range(HIDDEN_NEURONEN)
        ]
        delta_h1 = [
            sum(W2[i * HIDDEN_NEURONEN + k] * delta_h2[i]
                for i in range(HIDDEN_NEURONEN)) * h1[k] * (1.0 - h1[k])
            for k in range(HIDDEN_NEURONEN)
        ]

        for i in range(OUTPUT_NEURONEN):
            for k in range(HIDDEN_NEURONEN):
                W3[i * HIDDEN_NEURONEN + k] -= lernrate * delta_out[i] * h2[k]
            b3[i] -= lernrate * delta_out[i]
        for i in range(HIDDEN_NEURONEN):
            for k in range(HIDDEN_NEURONEN):
                W2[i * HIDDEN_NEURONEN + k] -= lernrate * delta_h2[i] * h1[k]
            b2[i] -= lernrate * delta_h2[i]
        for i in range(HIDDEN_NEURONEN):
            for k in range(INPUT_NEURONEN):
                W1[i * INPUT_NEURONEN + k] -= lernrate * delta_h1[i] * input_vector[k]
            b1[i] -= lernrate * delta_h1[i]

        _, _, output = forward()

    return W1, b1, W2, b2, W3, b3, output


def _rufe_ai_auf(modus, W1, b1, W2, b2, W3, b3, input_vector, expected, lernrate):
    if os.name == "nt" or not C_AI.is_file():
        return _python_ai_auf(
            modus, W1, b1, W2, b2, W3, b3, input_vector, expected, lernrate,
        )

    # Input Array ++
    in_floats = [float(modus)] + W1 + b1 + W2 + b2 + W3 + b3 + input_vector + expected + [float(lernrate)]
    assert len(in_floats) == IN_BUF_FLOATS, f"Input-Layout stimmt nicht: {len(in_floats)} != {IN_BUF_FLOATS}"
    in_bytes = struct.pack(f"{IN_BUF_FLOATS}f", *in_floats)

    # Quasi Cache leeren
    for name in (SHM_INPUT_NAME, SHM_OUTPUT_NAME):
        try:
            alt = shared_memory.SharedMemory(name=name)
            alt.close()
            alt.unlink()
        except FileNotFoundError:
            pass
    
    # Declared die Variable + den SPeicher für die C Übergabe
    shm_in = shared_memory.SharedMemory(name=SHM_INPUT_NAME, create=True, size=len(in_bytes))
    shm_in.buf[:len(in_bytes)] = in_bytes

    out_size_bytes = OUT_BUF_FLOATS * 4
    shm_out = shared_memory.SharedMemory(name=SHM_OUTPUT_NAME, create=True, size=out_size_bytes)

    try:
        # Drect execution of C mit list pointer and return pointer
        subprocess.run([C_AI, SHM_INPUT_NAME, SHM_OUTPUT_NAME], check=True)

        out_bytes = bytes(shm_out.buf[:out_size_bytes])
        out_floats = list(struct.unpack(f"{OUT_BUF_FLOATS}f", out_bytes))
    finally:
        shm_in.close(); shm_in.unlink()
        shm_out.close(); shm_out.unlink()

    # orga return arr
    pos = 0
    W1n = out_floats[pos:pos + W1_SIZE]; pos += W1_SIZE
    b1n = out_floats[pos:pos + B1_SIZE]; pos += B1_SIZE
    W2n = out_floats[pos:pos + W2_SIZE]; pos += W2_SIZE
    b2n = out_floats[pos:pos + B2_SIZE]; pos += B2_SIZE
    W3n = out_floats[pos:pos + W3_SIZE]; pos += W3_SIZE
    b3n = out_floats[pos:pos + B3_SIZE]; pos += B3_SIZE
    output = out_floats[pos:pos + OUTPUT_NEURONEN]

    return W1n, b1n, W2n, b2n, W3n, b3n, output

"""
LOAD und save
"""
def _typ_name(type_int: int) -> str:
    match type_int:
        case 0:
            return TABLE_FOOD
        case 1:
            return TABLE_ACTIVITY
        case _:
            raise ValueError(f"Unbekannter type: {type_int}")

def load_data(type_int: int) -> dict | None:
    typ_data = _typ_name(type_int)
    PATH_DB.parent.mkdir(parents=True, exist_ok=True)
    with closing(sqlite3.connect(PATH_DB)) as conn:
        with conn:
            conn.execute(f"""
                CREATE TABLE IF NOT EXISTS {typ_data} (
                    weight_matrix1 TEXT, weight_matrix2 TEXT, weight_vector1 TEXT,
                    vector_hl_1 TEXT, vector_hl_2 TEXT, base_vector1 TEXT,
                    base_vector2 TEXT, base3 REAL
                )
            """)
            row = conn.execute(f"""
                SELECT weight_matrix1, weight_matrix2, weight_vector1,
                       vector_hl_1, vector_hl_2, base_vector1, base_vector2, base3
                FROM {typ_data}
                ORDER BY ROWID DESC LIMIT 1
            """).fetchone()
    if row is None:
        print(f"Keine Gewichte fuer '{typ_data}' gefunden.")
        return None
    return {
        "weight_matrix1": json.loads(row[0]),
        "weight_matrix2": json.loads(row[1]),
        "weight_vector1": json.loads(row[2]),
        "vector_hl_1": row[3],
        "vector_hl_2": row[4],
        "base_vector1": json.loads(row[5]),
        "base_vector2": json.loads(row[6]),
        "base3": row[7],
    }

def save_data(type_int: int, weight1, weight2, weight3, b1, b2, b3):
    typ_data = _typ_name(type_int)
    PATH_DB.parent.mkdir(parents=True, exist_ok=True)
    with closing(sqlite3.connect(PATH_DB)) as conn:
        with conn:
            conn.execute(f"""
                CREATE TABLE IF NOT EXISTS {typ_data} (
                    weight_matrix1 TEXT, weight_matrix2 TEXT, weight_vector1 TEXT,
                    vector_hl_1 TEXT, vector_hl_2 TEXT, base_vector1 TEXT,
                    base_vector2 TEXT, base3 REAL
                )
            """)
            conn.execute(f"""
                INSERT INTO {typ_data}
                (weight_matrix1, weight_matrix2, weight_vector1, base_vector1, base_vector2, base3)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (
                json.dumps(weight1), json.dumps(weight2), json.dumps(weight3),
                json.dumps(b1), json.dumps(b2), b3,
            ))

def load_health(type_str: str):
    samples = _load_health_samples(type_str)
    return samples[-1] if samples else (None, None)


def _load_health_samples(type_str: str) -> list[tuple[list[float], float]]:
    match type_str:
        case "food":
            table = HEALTH_TABLE_FOOD
            feature_columns = (
                "Eiweiße (g)", "Fette (g)", "Zucker (g)", "Kohlenhydrate (g)",
                "Ballaststoffe (g)", "Wasser (g)", "Makronährstoffe (g)",
                "Mikronährstoffe (Score 0-10)",
            )
            score_column = "Healthiness_Score (1-100)"
        case "act":
            table = HEALTH_TABLE_ACTIVITY
            feature_columns = (
                "Energieverbrauch (kcal/30min)", "Cardio-Intensitaet",
                "Kraft-/Muskelbeanspruchung ", "Beweglichkeit", "Koordination",
                "Stressabbau", "Gelenkbelastung", "Verletzungsrisiko ",
            )
            score_column = "Healthiness_Score "
        case _:
            raise ValueError(f"Unbekannter type_str: {type_str}")

    selected_columns = ", ".join(f'"{column}"' for column in (*feature_columns, score_column))
    with closing(sqlite3.connect(DATA_HEALTH)) as conn:
        rows = conn.execute(
            f'SELECT {selected_columns} FROM "{table}" ORDER BY ROWID'
        ).fetchall()
    return [
        ([float(value or 0) for value in row[:8]], float(row[8]) / 100.0)
        for row in rows
        if row[8] is not None
    ]

"""
execute Functions
"""
def _weights_zu_simple_listen(gewichte: dict):
    W1 = simple_list(gewichte["weight_matrix1"])
    W2 = simple_list(gewichte["weight_matrix2"])
    W3 = simple_list(gewichte["weight_vector1"])
    b1 = gewichte["base_vector1"]
    b2 = gewichte["base_vector2"]
    b3 = [gewichte["base3"]]
    return W1, b1, W2, b2, W3, b3

def forwardpropagation(type_int: int, train=True, input_vector=None) -> int | None:
    if not train and input_vector is None:
        return None

    weight1 = load_data(type_int)
    if weight1 is None:
        print("Keine gespeicherten Gewichte vorhanden; starte Initialtraining.")
        backprpergation(type_int)
        weight1 = load_data(type_int)
        if weight1 is None:
            return None

    health_need = "food" if type_int == 0 else "act"

    data1, ziel_score = load_health(health_need)

    if train:
        if data1 is None:
            return None
        data_vector = data1  
    else:
        if input_vector is None:
            return None
        data_vector = input_vector
    
    W1, b1, W2, b2, W3, b3 = _weights_zu_simple_listen(weight1)

    # modus=0 nur forward / 1 mit lernrate , etc.
    # trotzdem Platzhalter mitschicken, weil das Layout fest ist | vgl. C #define
    _, _, _, _, _, _, output = _rufe_ai_auf(
        modus=0, W1=W1, b1=b1, W2=W2, b2=b2, W3=W3, b3=b3,
        input_vector=data_vector, expected=[0.0], lernrate=0.0,
    )

    berteilung_formated = round(100 * output[0])
    echt = round(ziel_score * 100) if ziel_score is not None else "?"
    print(f"Vorhersage: {berteilung_formated} / 100  (echter Wert war: {echt})")
    return berteilung_formated

"""
training Functions
"""
def backprpergation(type_int: int, epochen: int = 1):
    if type_int == 2:
        # SKip for now!
        weight1 = load_data(0)
        weight2 = load_data(1)
        return

    if epochen < 1:
        raise ValueError("epochen muss mindestens 1 sein")

    weight1 = load_data(type_int)
    if weight1 is None:
        print("Keine Gewichte vorhanden - initialisiere zufaellig.")
        import random
        rnd = lambda n: [random.uniform(-0.5, 0.5) for _ in range(n)]
        W1, b1 = rnd(W1_SIZE), rnd(B1_SIZE)
        W2, b2 = rnd(W2_SIZE), rnd(B2_SIZE)
        W3, b3 = rnd(W3_SIZE), rnd(B3_SIZE)
    else:
        W1, b1, W2, b2, W3, b3 = _weights_zu_simple_listen(weight1)

    health_need = "food" if type_int == 0 else "act"
    training_samples = _load_health_samples(health_need)
    if not training_samples:
        raise ValueError(f"Keine Trainingsdaten in {DATA_HEALTH} fuer '{health_need}' gefunden.")

    for epoche in range(epochen):
        for data_vector, ziel_score in training_samples:
            expected = [ziel_score]
            W1, b1, W2, b2, W3, b3, output = _rufe_ai_auf(
                modus=1, W1=W1, b1=b1, W2=W2, b2=b2, W3=W3, b3=b3,
                input_vector=data_vector, expected=expected, lernrate=LERNRATE,
            )
        if epoche % max(1, epochen // 5) == 0 or epoche == epochen - 1:
            print(
                f"Epoche {epoche:4d} | Vorhersage: {output[0]:.4f} "
                f"| Ziel: {expected[0]:.4f}"
            )

    save_data(
        type_int,
        unsimple_list(W1, HIDDEN_NEURONEN, INPUT_NEURONEN),
        unsimple_list(W2, HIDDEN_NEURONEN, HIDDEN_NEURONEN),
        unsimple_list(W3, OUTPUT_NEURONEN, HIDDEN_NEURONEN),
        b1, b2, b3[0],
    )
    print(f"Training fertig, Gewichte gespeichert (type={type_int}).")

    