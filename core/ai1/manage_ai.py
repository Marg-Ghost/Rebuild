import json
import sqlite3

conn = sqlite3.connect("data/ai_algoritmus/user.db")
cursor = conn.cursor()

# mit type beeing food und activity
def save_vector(type, weight_matrix1, weight_matrix2,weight_vector1,vector_hl_1,vector_hl_2,base_vector1,base_vector2,base3,):
    # 1. Tabelle erstellen (falls sie noch nicht existiert)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS {type} (
            weight_matrix1 TEXT,
            weight_matrix2 TEXT,
            weight_vector1 TEXT,
            vector_hl_1 TEXT,
            vector_hl_2 TEXT,
            base_vector1 TEXT,
            base_vector2 TEXT,
            base3 REAL
        )
    """)

    try:
        # 2. Daten in die Tabelle einfügen (mit Datensicherheit durch SQL-Platzhalter ?)
        cursor.execute(
            """
            INSERT INTO {type} VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
            (
                json.dumps(weight_matrix1),
                json.dumps(weight_matrix2),
                json.dumps(weight_vector1),
                json.dumps(vector_hl_1),
                json.dumps(vector_hl_2),
                json.dumps(base_vector1),
                json.dumps(base_vector2),
                base3,
            ),
        )

        # 3. Speichern bestätigen
        conn.commit()
        print("Gewichte erfolgreich gespeichert!")

    except Exception as e:
        print(f"Fehler beim Speichern: {e}")

def load_vector_data():
    try:
        # Hol den neusten/letzten Eintrag aus der Tabelle
        cursor.execute("""
            SELECT weight_matrix1, weight_matrix2, weight_vector1, 
                   vector_hl_1, vector_hl_2, base_vector1, base_vector2, base3 
            FROM {type} 
            ORDER BY ROWID DESC LIMIT 1
        """)

        row = cursor.fetchone()

        if row is None:
            print("Keine Daten in der Datenbank gefunden.")
            return None

        # JSON-Strings wieder in Python-Arrays/Listen umwandeln
        model_params = {
            "weight_matrix1": json.loads(row[0]),
            "weight_matrix2": json.loads(row[1]),
            "weight_vector1": json.loads(row[2]),
            "vector_hl_1": json.loads(row[3]),
            "vector_hl_2": json.loads(row[4]),
            "base_vector1": json.loads(row[5]),
            "base_vector2": json.loads(row[6]),
            "base3": row[7],  # REAL/Float muss nicht geparst werden
        }

        return model_params

    except Exception as e:
        print(f"Fehler beim Laden: {e}")
        return None
    finally:
        conn.close()