
class Date():
    def __init__(self, date, time, task_type : str, importance : int, content :str):
        self.date = date
        self.time = time
        self.task_type = task_type
        self.importance = importance
        self.content = content

def init_date(usr ,date, time, task_type : str, importance : int, content :str):
    save_date = new Date(date, time, task_type : str, importance : int, content :str)
    import data.database as database
    database.save_date(usr, save_date)