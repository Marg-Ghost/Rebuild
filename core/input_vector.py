import sqlite3
import math
import ollama

HEALTH_SLEEP = [18, 19, 20, 22, 23]

conn = sqlite3.connect("data/user/user.db")
cursor = conn.cursor() 

def all_check (sleep:list, food : list, act : list, health : float) -> int:
    # sleep data/logic
    sleep_score = sleep[0]
    point_score = sleep[1]
    count_score = sleep[2]
    sleep_impact = sleep_clac(sleep_score, point_score, count_score)

    # food section
    from ai.ai import forwardpropagation
    input_vec_f = create_food_vector("food", food)
    return_val_f =forwardpropagation("food",train=False,input_vector=input_vec_f)
    # act section
    input_vec_a = create_food_vector("act", act )
    return_val_a = forwardpropagation("act",train=False,input_vector=input_vec_a)

    # get return -> impact val
    food_impact = get_impact("food", return_val_f)
    act_impact = get_impact("act", return_val_a)

    # helath calc mit impact
    health += sleep_impact
    health += food_impact
    health += act_impact

    return health
 
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

def sleep_clac (sleep_score : int, point_score : int, count_score : int) -> float:
    erg = sleep_score + point_score * math.exp(count_score)
    return erg
    
def create_food_vector(type : str, vec : list) -> list :
    conn = sqlite3.connect("data/ai_konstanten/health.db")
    cursor = conn.cursor() 
    input_vecor = [0,0,0,0,0,0,0,0]
    ollama_list =[]
    ollama_vector[]
    
    length = len(vec)
    table = None
    if type == "food":
        table = "food_nährwerte"
    elif type == "act":
        table = "activity_werte"
    else:
        raise ValueError("No type given")

    for element in vec:
        cursor.execute("SELECT * FROM {table} WHERE name = ? ", (element))
        return_array = cursor.fetchone()
        if return_array not None:
            input_vecor[0] += return_array[1] 
            input_vecor[1] += return_array[2] 
            input_vecor[2] += return_array[3] 
            input_vecor[3] += return_array[4] 
            input_vecor[4] += return_array[5] 
            input_vecor[5] += return_array[6] 
            input_vecor[6] += return_array[7] 
            input_vecor[7] += return_array[8]        
        else:
            ollama_list.append(element) 


    if ollama_list != []:
        answer = ollama.request(content = {user : "user", content : f"make input vector fot ...{ollama_list}"})
        if  answer[0] == "[" and answer[-1] == "]":
            ollama_vector = list(answer)

    # for sec reasons hier einen for loop keine 1:1 zuweisung
    for i in ollama_vector:
            input_vecor[i] += ollama_vector[i]
    
    if type == "act":
        input_vecor[0] /= length
        input_vecor[1] /= length 
        input_vecor[2] /= length 
        input_vecor[3] /= length 
        input_vecor[4]  /= length
        input_vecor[5]  /= length
        input_vecor[6]  /= length
        input_vecor[7] /= length

    return input_vecor
     
def get_impact(type : str, number : int) -> int:
    table_name = None
    if type == "food":
        table_name = "foodval_impact"
    elif type == "act":
        table_name = "activity_impact"
    else:
        raise ValueError("no type given!")

    cursor.execute("SELECT return FROM {table_name} WHERE Score = ? ", (number))
    return_val = cursor.fetchone()

    return return_val
        