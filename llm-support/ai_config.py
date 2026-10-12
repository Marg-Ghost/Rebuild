"""Compatibility import for the shared, hardware-aware Ollama config."""

from llm.ollama_config import (
    OLLAMA_CONTEXT_LENGTH,
    OLLAMA_MODEL_BY_RAM_GB,
    OLLAMA_NUM_PARALLEL,
    available_memory_gb,
    select_ollama_model,
)

__all__ = [
    "OLLAMA_CONTEXT_LENGTH", "OLLAMA_MODEL_BY_RAM_GB", "OLLAMA_NUM_PARALLEL",
    "available_memory_gb", "select_ollama_model",
]
