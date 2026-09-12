import sqlite3
import math
import ollama

HEALTH_SLEEP = [18, 19, 20, 22, 23]

conn = sqlite3.connect("data/user/user.db")
cursor = conn.cursor() 

    

def all_check (sleep:list, food : list, act : list, health : float):
    # sleep data/logic
    sleep_score = sleep[0]
    point_score = sleep[1]
    count_score = sleep[2]
    sleep_impact = sleep_clac(sleep_score, point_score, count_score)

    # food section
    from ai.ai import forwardpropagation
    input_vec_f = create_food_vector(food)

    forwardpropagation(food,train=False,input_vector=input_vec_f)
    
    # act section
 

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
    
def create_food_vector(type : str,vec : list) -> list :
    conn = sqlite3.connect("data/ai_konstanten/health.db")
    cursor = conn.cursor() 
    input_vecor = [0,0,0,0,0,0,0]
    ollama_list =[]
    ollama_vector[]
    if type == "food":
       for element in vec:
            cursor.execute("SELECT * FROM food_nährwerte WHERE name = ? ", (element))
            return_array = cursor.fetchone()
            if return_array not None:
                input_vecor[0] += return_array[1] 
                input_vecor[1] += return_array[2] 
                input_vecor[2] += return_array[3] 
                input_vecor[3] += return_array[4] 
                input_vecor[4] += return_array[5] 
                input_vecor[5] += return_array[6] 
                input_vecor[6] += return_array[7] 
            else:
                ollama_list.append(element) 
        elif type == "act":
        else: 
            raise TypeError()


    if ollama_list != []:
        answer = ollama.request(content = {user : "user", content : f"make input vector fot ...{ollama_list}"}
        
        )
        if  answer[0] == "[" and answer[-1] == "]":
            ollama_vector = list(answer)

    # for sec reasons hier einen for loop keine 1:1 zuweisung
    for i in ollama_vector:
            input_vecor[i] += ollama_vector[i]

    return input_vecor

    

        
        

        