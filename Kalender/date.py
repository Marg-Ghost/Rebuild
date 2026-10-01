
from .data import database


class Date:
    def __init__(self, date, time, task_type: str, importance: int, content: str):
        self.date = date
        self.time = time
        self.task_type = task_type
        self.importance = importance
        self.content = content

def init_date(username, date, time, task_type: str, importance: int, content: str):
    task = Date(date, time, task_type, importance, content)
    return database.save_date(username, task)

def get_date(username, month: int, year: int | None = None) -> list[dict]:
    return database.get_data(username, month, year)
