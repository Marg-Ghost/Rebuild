import json
import os

import ollama


def match_catalog_entry(kind: str, query: str, candidates: list[str]) -> str | None:
    model = os.getenv("OLLAMA_MODEL", "llama3.1:8b")
    response_schema = {
        "type": "object",
        "properties": {
            "match": {
                "type": ["string", "null"],
                "enum": candidates + [None],
            }
        },
        "required": ["match"],
    }
    response = ollama.chat(
        model=model,
        messages=[
            {
                "role": "system",
                "content": (
                    "Match the user's food or activity description to one existing catalog entry. "
                    "Only return an exact entry from the allowed list. Never invent data; return null if none fits."
                ),
            },
            {
                "role": "user",
                "content": json.dumps(
                    {"kind": kind, "query": query, "allowed_entries": candidates},
                    ensure_ascii=False,
                ),
            },
        ],
        format=response_schema,
        options={"temperature": 0},
    )
    result = json.loads(response.message.content)
    match = result.get("match")
    return match if match in candidates else None