import platform
import os
import json
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SAVE_DIR = os.path.join(BASE, "sys")
def get_hardware_profile():
    try:
        import psutil

        mem = psutil.virtual_memory()
        print(f"Total RAM: {mem.total / (1024**3):.1f} GB")
        print(f"Available RAM: {mem.available / (1024**3):.1f} GB")
        # print(f"CPU Usage: {psutil.cpu_percent(interval=1)}%")

        if mem.total > 31 * (1024**3) and mem.available >= 6 * (1024**3):
            return "llama3.1:8b"
        if mem.total > 11 * (1024**3) and mem.available >= 4 * (1024**3):
            return "llama3.2:3b"
        return "llama3.2:1b"

    except ImportError:
        print("Install psutil for detailed hardware metrics: pip install psutil")

if __name__ == "__main__":
    profile = get_hardware_profile()
    json.dump(profile, open(os.path.join(SAVE_DIR, "hardware_profile.txt"), "w"), indent=4)