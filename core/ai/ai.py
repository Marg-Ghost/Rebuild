import sqlite3
from multiprocessing import shared_memory

PATH_DB = "core/ai/weigths"
TABLE_FOOD = "food"
TABLE_ACTIVITY = "act"

DATA_HEALTH = "data/ai_algoritmus/health.db"


C_AI = "core/ai/ai.c"

"""
execute Functions
"""
def forwardpropagation(type : int):
    weight1 = {}
    data1 = []

    weight1 = load_data(type)
    health_need
    if type == 0:
        health_need = "food"
    else:
        health_need = "act"

    data1 = load_health(health_need)
    data_vector = [ data1[i] for i < len(data1)]
    # expected_return[len(data1)]

    #all in one memory adress for fast acces
    data1.insert(0, weigth1)

    shm = shared_memory.SharedMemory(name="ai_weights", create=True, size=len(data_vector))
    buffer = data_vector
    buffer[:] = data[:]

    subprocess.run(["./core/ai/ai", "ai_weights", str(len(data))])

    shm.close()
    shm.unlink()
    

"""
training Functions
"""
def backprpergation(type : int):
    weight1 = {}
    weight2 = {}
    data1 = []

    if type == 2:
        # SKip for now!
        weight1 = load_data(0)
        weight2 = load_data(1)
    else:
        weight1 = load_data(type)
        health_need
        if type == 0:
            health_need = "food"
        else:
            health_need = "act"

        data1 = load_health(health_need)
        #data_vecTOR = [ data1[i] for i < len(data1)]
        #expected_return[len(data1)]

        # TSruktur ->  weights | expected | real return value
        data1.insert(0, weigth1)

        shm = shared_memory.SharedMemory(name="ai_weights", create=True, size=len(data_vector))
        buffer = data_vector
        buffer[:] = data[:]

        subprocess.run(["./core/ai/ai", "ai_weights", str(len(data))])

        shm.close()
        shm.unlink()
     


"""
LOAD and save 
"""
# load health data #
def load_health (type : str) -> list:
    conn = sqlite3.connect(PATH_DB)
    cursor = conn.cursor()
    model_params = {}
    try:
        table_type = ""
        match (type):
            case "food":
                #table_type = "food"
                cursor.execute("""
                    SELECT 'Eiweiße (g)', 'Fette (g)', 'Zucker (g)', 'Kohlenhydrate (g)', 'Ballaststoffe (g)', 'Wasser (g)', 'Makronährstoffe (g)', 'Mikronährstoffe (Score 0-10)', 'Healthiness_Score (1-100)'
                    FROM food_nährwerte
                    ORDER BY ROWID DESC LIMIT 1
                    """)
                row = cursor.fetchone()

                if row is None:
                    print("Keine Daten in der Datenbank gefunden.")
                    return None

                model_params = [
                    row[0],
                    row[1],
                    row[2],
                    row[3],
                    row[4],
                    row[5],
                    row[6],
                    row[7]
                ]
            case "act":
                # fertig machen !!!!!!
                ...

        return model_params
    except Exception as e:
        print(f"Fehler beim Laden: {e}")
        return None
    finally:
        conn.close()
        

        


# save Structure #

# load Database structure #
def load_data(type : int) -> dict:
    conn = sqlite3.connect(PATH_DB)
    cursor = conn.cursor()
    typ_data = ""

    match(type):
        case 0:
            typ_data = TABLE_FOOD
        case 1:
            typ_data = TABLE_ACTIVITY
    
    try:
        cursor.execute("""
            SELECT weight_matrix1, weight_matrix2, weight_vector1, 
                   vector_hl_1, vector_hl_2, base_vector1, base_vector2, base3 
            FROM {typ_data} 
            ORDER BY ROWID DESC LIMIT 1
        """)

        row = cursor.fetchone()

        if row is None:
            print("Keine Daten in der Datenbank gefunden.")
            return None

        model_params = {
            "weight_matrix1": json.loads(row[0]),
            "weight_matrix2": json.loads(row[1]),
            "weight_vector1": json.loads(row[2]),
            "vector_hl_1": json.loads(row[3]),
            "vector_hl_2": json.loads(row[4]),
            "base_vector1": json.loads(row[5]),
            "base_vector2": json.loads(row[6]),
            "base3": row[7]
        }

        return model_params

    except Exception as e:
        print(f"Fehler beim Laden: {e}")
        return None
    finally:
        conn.close()
        
