"""Hardware-aware Ollama defaults shared by Python callers and start.sh."""

import os

OLLAMA_MODEL_BY_RAM_GB = ((6, "llama3.2:1b"), (12, "llama3.2:3b"), (float("inf"), "llama3.1:8b"))
OLLAMA_NUM_PARALLEL = 1
OLLAMA_CONTEXT_LENGTH = 4096


def available_memory_gb() -> float:
    try:
        with open("/proc/meminfo", encoding="ascii") as meminfo:
            for line in meminfo:
                if line.startswith("MemTotal:"):
                    return int(line.split()[1]) / 1024**2
    except (OSError, ValueError, IndexError):
        pass
    return 8.0


def select_ollama_model(memory_gb: float | None = None) -> str:
    override = os.getenv("OLLAMA_MODEL")
    if override:
        return override
    memory_gb = available_memory_gb() if memory_gb is None else memory_gb
    return next(model for maximum, model in OLLAMA_MODEL_BY_RAM_GB if memory_gb <= maximum)
