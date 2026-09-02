import sqlite3
import ollama

PATH_DB = "data/health_konstanten/health.db"
OLLAMA_MODEL = "llama3.1:8b"

GLOBAL_HEALTH = 0

# generral functions

def main(usr: str,hourse: int):
    GLOBAL_HEALTH = load_profile(usr)
    

# clac funktions
def sleep(hourse : int) -> float | None:
    conn = sqlite3.connect(PATH_DB)
    cursor = conn.cursor()
    try:
        cursor.execute(f"""
            SELECT impact_val
            FROM sleep
            WHERE hours = {hourse}
            """)
        row = cursor.fetchone()
        if row is None:
            print(f"Keine Werte fuer '{hourse}' Stunden Schlaf gefunden.")
            return None
        return float(row[0])
    except Exception as e:
        print(f"Fehler beim Laden: {e}")
        return None
    finally:
        conn.close()

def sleep_late(hourse : int) -> float | None:
    return 50*hourse # lineares Wachstum

# Parameter format [["name", number, in DB or to ollama][str, int, int]...]
def food_intake(input_vector : list) -> float | None:
    from ai/ai import forwardpropagation
    input_vector = [0.0 for _ in range(7)]
    for i in input_vector:
        # 0 == DB / 1 == ollama
        if i[2] == 0:
            conn = sqlite3.connect(PATH_DB)
            cursor = conn.cursor()
            try:
                cursor.execute(f"""
                    SELECT Eiweiße (g)	Fette (g)	Zucker (g)	Kohlenhydrate (g)	Ballaststoffe (g)	Wasser (g)	Makronährstoffe (g)	Mikronährstoffe (Score 0-10)
                    FROM food
                    WHERE name = '{i[0]}'
                    """)
                row = cursor.fetchone()
                if row is None:
                    print(f"Keine Werte fuer '{i[0]}' gefunden.")
                    return None
                input_vector[0] += float(row[0])*i[1]
                input_vector[1] += float(row[1])*i[1]
                input_vector[2] += float(row[2])*i[1]
                input_vector[3] += float(row[3])*i[1]
                input_vector[4] += float(row[4])*i[1]
                input_vector[5] += float(row[5])*i[1]
                input_vector[6] += float(row[6])*i[1]
            except Exception as e:
                print(f"Fehler beim Laden: {e}")
                return None
            finally:
                conn.close()
        elif i[2] == 1:
            # ollama
            try:
                model = ollama.Ollama(model=OLLAMA_MODEL)
                prompt = f"""
                Du bist ein Ernährungsberater. Ich gebe dir eine Liste von Lebensmitteln und deren Mengen in Gramm. 
                Bitte berechne die Nährwerte für Eiweiß, Fett, Zucker, Kohlenhydrate, Ballaststoffe, Wasser, Makronährstoffe und Mikronährstoffe (Score 0-10) für diese Lebensmittel.
                Gib die Werte in der Reihenfolge zurück: Eiweiße (g), Fette (g), Zucker (g), Kohlenhydrate (g), Ballaststoffe (g), Wasser (g), Makronährstoffe (g), Mikronährstoffe (Score 0-10).
                Die Lebensmittel und Mengen sind: {i[0]} {i[1]} Gramm.
                """
                response = model.generate(prompt)
                values = response.text.strip().split(", ")
                input_vector[0] += float(values[0])
                input_vector[1] += float(values[1])
                input_vector[2] += float(values[2])
                input_vector[3] += float(values[3])
                input_vector[4] += float(values[4])
                input_vector[5] += float(values[5])
                input_vector[6] += float(values[6])
            except Exception as e:
                print(f"Fehler beim Abrufen von Ollama: {e}")
                return None

    


# load and save
def load_profile(usr : str) -> dict | None:
    conn = sqlite3.connect(PATH_DB)
    cursor = conn.cursor()
    try:
        cursor.execute(f"""
            SELECT gen_profile, health_float
            FROM gen_profile
            WHERE user_id = '{usr}'
            """)
        row = cursor.fetchone()

        if row is None:
            print(f"Keine Werte fuer '{usr}' gefunden.")
            return None

        return {
            "age": int(row[0]["age"]),
            "weight": float(row[0]["weight"]),
            "height": float(row[0]["height"]),
            "gender": row[0]["gender"], 
            "health_float": float(row[1])
        }
    except Exception as e:
        print(f"Fehler beim Laden: {e}")
        return None
    finally:
        conn.close()
