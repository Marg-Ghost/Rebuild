# ai_ipc.py
import json
import os
import struct
import subprocess
import sqlite3
from multiprocessing import shared_memory

PATH_DB = "core/ai/weigths.db"
TABLE_FOOD = "food"
TABLE_ACTIVITY = "act"

DATA_HEALTH = "data/ai_algoritmus/health.db"
HEALTH_TABLE_FOOD = "food_naehrwerte"   # muss exakt zur echten Tabelle passen - pruefen!

C_AI = "core/ai/ai"   # kompiliertes Binary (aus ai.c), NICHT die .c-Datei selbst

INPUT_NEURONEN = 8
HIDDEN_NEURONEN = 8
OUTPUT_NEURONEN = 1
LERNRATE = 0.05

# ---------------------------------------------------------------------------
# FESTES LAYOUT - muss 1:1 zu den #define-Kommentaren in ai.c passen!
# Aendert sich hier was, muss ai.c neu kompiliert UND synchron angepasst werden.
# ---------------------------------------------------------------------------
W1_SIZE = HIDDEN_NEURONEN * INPUT_NEURONEN    # 64
B1_SIZE = HIDDEN_NEURONEN                      # 8
W2_SIZE = HIDDEN_NEURONEN * HIDDEN_NEURONEN    # 64
B2_SIZE = HIDDEN_NEURONEN                      # 8
W3_SIZE = OUTPUT_NEURONEN * HIDDEN_NEURONEN    # 8
B3_SIZE = OUTPUT_NEURONEN                      # 1

IN_BUF_FLOATS = 1 + W1_SIZE + B1_SIZE + W2_SIZE + B2_SIZE + W3_SIZE + B3_SIZE + INPUT_NEURONEN + OUTPUT_NEURONEN + 1
OUT_BUF_FLOATS = W1_SIZE + B1_SIZE + W2_SIZE + B2_SIZE + W3_SIZE + B3_SIZE + OUTPUT_NEURONEN

SHM_INPUT_NAME = "ai_input"
SHM_OUTPUT_NAME = "ai_output"


def flatten(matrix_2d):
    return [v for row in matrix_2d for v in row]


def unflatten(flat, rows, cols):
    return [flat[i * cols:(i + 1) * cols] for i in range(rows)]


# ---------------------------------------------------------------------------
# Shared-Memory <-> C Bruecke: packt/entpackt EXAKT das Layout aus ai.c
# ---------------------------------------------------------------------------
def _rufe_ai_auf(modus, W1, b1, W2, b2, W3, b3, input_vector, expected, lernrate):
    in_floats = [float(modus)] + W1 + b1 + W2 + b2 + W3 + b3 + input_vector + expected + [float(lernrate)]
    assert len(in_floats) == IN_BUF_FLOATS, f"Input-Layout stimmt nicht: {len(in_floats)} != {IN_BUF_FLOATS}"
    in_bytes = struct.pack(f"{IN_BUF_FLOATS}f", *in_floats)

    # Falls von einem vorherigen (abgebrochenen) Lauf noch Segmente existieren,
    # erst aufraeumen - sonst schlaegt create=True mit "FileExistsError" fehl.
    for name in (SHM_INPUT_NAME, SHM_OUTPUT_NAME):
        try:
            alt = shared_memory.SharedMemory(name=name)
            alt.close()
            alt.unlink()
        except FileNotFoundError:
            pass

    shm_in = shared_memory.SharedMemory(name=SHM_INPUT_NAME, create=True, size=len(in_bytes))
    shm_in.buf[:len(in_bytes)] = in_bytes

    out_size_bytes = OUT_BUF_FLOATS * 4
    shm_out = shared_memory.SharedMemory(name=SHM_OUTPUT_NAME, create=True, size=out_size_bytes)

    try:
        subprocess.run([C_AI, SHM_INPUT_NAME, SHM_OUTPUT_NAME], check=True)

        out_bytes = bytes(shm_out.buf[:out_size_bytes])
        out_floats = list(struct.unpack(f"{OUT_BUF_FLOATS}f", out_bytes))
    finally:
        shm_in.close(); shm_in.unlink()
        shm_out.close(); shm_out.unlink()

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
    conn = sqlite3.connect(PATH_DB)
    cursor = conn.cursor()
    typ_data = _typ_name(type_int)
    try:
        cursor.execute(f"""
            SELECT weight_matrix1, weight_matrix2, weight_vector1,
                   vector_hl_1, vector_hl_2, base_vector1, base_vector2, base3
            FROM {typ_data}
            ORDER BY ROWID DESC LIMIT 1
        """)
        row = cursor.fetchone()
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
    except Exception as e:
        print(f"Fehler beim Laden: {e}")
        return None
    finally:
        conn.close()


def save_data(type_int: int, weight1, weight2, weight3, b1, b2, b3):
    conn = sqlite3.connect(PATH_DB)
    cursor = conn.cursor()
    typ_data = _typ_name(type_int)
    cursor.execute(f"""
        CREATE TABLE IF NOT EXISTS {typ_data} (
            weight_matrix1 TEXT, weight_matrix2 TEXT, weight_vector1 TEXT,
            vector_hl_1 TEXT, vector_hl_2 TEXT,
            base_vector1 TEXT, base_vector2 TEXT, base3 REAL
        )
    """)
    cursor.execute(f"""
        INSERT INTO {typ_data}
        (weight_matrix1, weight_matrix2, weight_vector1, base_vector1, base_vector2, base3)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (
        json.dumps(weight1), json.dumps(weight2), json.dumps(weight3),
        json.dumps(b1), json.dumps(b2), b3,
    ))
    conn.commit()
    conn.close()


def load_health(type_str: str):
    """Gibt (features, ziel_score) zurueck - beides wird fuer's Training gebraucht."""
    conn = sqlite3.connect(DATA_HEALTH)
    cursor = conn.cursor()
    try:
        match type_str:
            case "food":
                cursor.execute(f"""
                    SELECT "Eiweiße (g)", "Fette (g)", "Zucker (g)", "Kohlenhydrate (g)",
                           "Ballaststoffe (g)", "Wasser (g)", "Makronährstoffe (g)",
                           "Mikronährstoffe (Score 0-10)", "Healthiness_Score (1-100)"
                    FROM {HEALTH_TABLE_FOOD}
                    ORDER BY ROWID DESC LIMIT 1
                """)
                row = cursor.fetchone()
                if row is None:
                    print("Keine Daten in der Datenbank gefunden.")
                    return None, None
                features = list(row[0:8])
                ziel_score = row[8] / 100.0
                return features, ziel_score
            case "act":
                print("activity-Laden noch nicht implementiert.")
                return None, None
            case _:
                raise ValueError(f"Unbekannter type_str: {type_str}")
    except Exception as e:
        print(f"Fehler beim Laden: {e}")
        return None, None
    finally:
        conn.close()


"""
execute Functions
"""

def _weights_zu_flachen_listen(gewichte: dict):
    W1 = flatten(gewichte["weight_matrix1"])
    W2 = flatten(gewichte["weight_matrix2"])
    W3 = flatten(gewichte["weight_vector1"])
    b1 = gewichte["base_vector1"]
    b2 = gewichte["base_vector2"]
    b3 = [gewichte["base3"]]
    return W1, b1, W2, b2, W3, b3


def forwardpropagation(type_int: int):
    weight1 = load_data(type_int)
    if weight1 is None:
        print("Keine Gewichte vorhanden - bitte erst trainieren.")
        return None

    health_need = "food" if type_int == 0 else "act"
    data1, ziel_score = load_health(health_need)
    if data1 is None:
        return None
    data_vector = data1  # war vorher die kaputte List-Comprehension - data1 ist schon die richtige Liste

    W1, b1, W2, b2, W3, b3 = _weights_zu_flachen_listen(weight1)

    # modus=0 -> nur forward, expected/lernrate werden von ai.c ignoriert,
    # trotzdem muessen wir Platzhalter mitschicken, weil das Layout fest ist
    _, _, _, _, _, _, output = _rufe_ai_auf(
        modus=0, W1=W1, b1=b1, W2=W2, b2=b2, W3=W3, b3=b3,
        input_vector=data_vector, expected=[0.0], lernrate=0.0,
    )

    vorhersage_1_100 = round(1 + 99 * output[0])
    echt = round(ziel_score * 100) if ziel_score is not None else "?"
    print(f"Vorhersage: {vorhersage_1_100} / 100  (echter Wert war: {echt})")
    return vorhersage_1_100


"""
training Functions
"""

def backprpergation(type_int: int, epochen: int = 1):
    if type_int == 2:
        # SKip for now!
        weight1 = load_data(0)
        weight2 = load_data(1)
        return

    weight1 = load_data(type_int)
    if weight1 is None:
        print("Keine Gewichte vorhanden - initialisiere zufaellig.")
        import random
        rnd = lambda n: [random.uniform(-0.5, 0.5) for _ in range(n)]
        W1, b1 = rnd(W1_SIZE), rnd(B1_SIZE)
        W2, b2 = rnd(W2_SIZE), rnd(B2_SIZE)
        W3, b3 = rnd(W3_SIZE), rnd(B3_SIZE)
    else:
        W1, b1, W2, b2, W3, b3 = _weights_zu_flachen_listen(weight1)

    health_need = "food" if type_int == 0 else "act"
    data1, ziel_score = load_health(health_need)
    if data1 is None:
        return
    data_vector = data1
    expected = [ziel_score]

    for epoche in range(epochen):
        W1, b1, W2, b2, W3, b3, output = _rufe_ai_auf(
            modus=1, W1=W1, b1=b1, W2=W2, b2=b2, W3=W3, b3=b3,
            input_vector=data_vector, expected=expected, lernrate=LERNRATE,
        )
        if epoche % max(1, epochen // 5) == 0 or epoche == epochen - 1:
            print(f"Epoche {epoche:4d} | Vorhersage: {output[0]:.4f} | Ziel: {expected[0]:.4f}")

    save_data(
        type_int,
        unflatten(W1, HIDDEN_NEURONEN, INPUT_NEURONEN),
        unflatten(W2, HIDDEN_NEURONEN, HIDDEN_NEURONEN),
        unflatten(W3, OUTPUT_NEURONEN, HIDDEN_NEURONEN),
        b1, b2, b3[0],
    )
    print(f"Training fertig, Gewichte gespeichert (type={type_int}).")


if __name__ == "__main__":
    os.makedirs(os.path.dirname(PATH_DB), exist_ok=True)
    backprpergation(type_int=0, epochen=50)
    forwardpropagation(type_int=0)