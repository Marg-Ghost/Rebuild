import json
import os

DATA_PATH = os.path.join(os.path.dirname(__file__), "Vector_intel.json")

def load_txt() -> tuple[list, list]:
    try:
        data = []
        with open(DATA_PATH, "r") as f:
            data = json.load(f)
        doc , ids = data
        return doc , ids
    except FileNotFoundError:
            return [], []

def save_txt(doc : list, ids : list):
    data = []
    data.append(doc)
    data.append(ids)
    with open(DATA_PATH, "w") as f:
        json.dump(data, f, indent=4)