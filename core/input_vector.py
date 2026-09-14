import sqlite3
import math
import ollama

HEALTH_SLEEP = [18, 19, 20, 22, 23]

conn = sqlite3.connect("data/ai_konstanten/health.db")
cursor = conn.cursor() 

def all_check(health: float, sleep: list, food: list, act: list) -> list:
    # sleep data/logic
    sleep_score = float(sleep[0])
    point_score = float(sleep[1])
    count_score = int(sleep[2])
    sleep_impact = sleep_clac(sleep_score, point_score, count_score)

    # food section
    from core.ai.ai import forwardpropagation
    input_vec_f = create_food_vector("food", food)
    return_val_f = forwardpropagation(0, train=False, input_vector=input_vec_f)
    # act section
    input_vec_a = create_food_vector("act", act)
    return_val_a = forwardpropagation(1, train=False, input_vector=input_vec_a)

    # get return -> impact val
    food_impact = get_impact("food", return_val_f)
    act_impact = get_impact("act", return_val_a)

    # helath calc mit impact
    health += sleep_impact
    health += food_impact
    health += act_impact

    return [health,[sleep_score,point_score,count_score],return_val_f,return_val_a]
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
def sleep_clac (sleep_score : int, point_score : int, count_score : int) -> float:
    erg = sleep_score + point_score * math.exp(count_score)
    return erg
    
def create_food_vector(type: str, vec: list) -> list:
    database = sqlite3.connect("data/ai_konstanten/health.db")
    database_cursor = database.cursor()
    input_vector = [0.0] * 8

    if type == "food":
        table = "food_nährwerte"
    elif type == "act":
        table = "activity_werte"
    else:
        raise ValueError("No type given")

    name_column = "food_name" if type == "food" else "activity_name"
    for element in vec:
        database_cursor.execute(
            f'SELECT * FROM "{table}" WHERE "{name_column}"=?',
            (str(element).strip(),),
        )
        return_array = database_cursor.fetchone()
        if return_array is not None:
            for index in range(8):
                input_vector[index] += float(return_array[index + 2] or 0)
    
    if type == "act" and vec:
        input_vector = [value / len(vec) for value in input_vector]

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

    cursor.execute(f'SELECT "return" FROM "{table_name}" WHERE "Score "=?', (number,))
    return_val = cursor.fetchone()

    return float(return_val[0]) if return_val else 0.0
        