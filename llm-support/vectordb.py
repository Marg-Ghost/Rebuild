import chromadb
import requests
import uuid
import ollama
import os
import json

#my
import data.load_data as load_data

db = chromadb.PersistentClient(path="./chroma_data")
collection = db.get_or_create_collection(name="Ghost")


client = ollama.Client(host=os.getenv("OLLAMA_HOST", "http://host.docker.internal:11434"))
current_model = "qwen2.5:1.5b"


# Datenbanken
documents, ids = load_data.load_txt()
if documents and collection.count() == 0:
    print("Initialisiere ChromaDB mit Daten...")
    collection.upsert(documents=documents, ids=ids)
    print("ChromaDB erfolgreich geladen!")

collection.upsert(
    documents = documents,
    ids = ids
)

# Search Query
def init_brain(message: str) -> str:
    results = collection.query(query_texts=[message], n_results=5)
    documents = results.get("documents", [[]])[0]
    if not documents:
        return "Keine relevanten Erinnerungen gefunden."
    return "\n".join(documents)

    return str(results_return)

def remember(memory : list):
    try: 
        summary_prompt = [{
        "role": "system",
        "content": "Fasse die wichtigsten Fakten aus diesem Gespräch in Stichpunkten zusammen."
        }, {
            "role": "user",
            "content": str(memory)
        }]

        data = client.chat(
             model= current_model, 
             messages=summary_prompt, 
             keep_alive=-1
            )
        content = data["message"]["content"] 
        save_data = content 

    except Exception as e:
        print(f"[Fehler] Zusammenfassung fehlgeschlagen: {e}")
        return

    documents.append(save_data)
    ids.append(str(uuid.uuid4()))
   
    load_data.save_txt(documents, ids)


def summarize_for_storage(raw_text: str) -> list[str]:
    full_prompt = [{
        "role": "system",
        "content": "Fasse den folgenden Text in einzelne, eigenständige Stichpunkte. "
                    "Antworte NUR mit einer JSON-Liste von Strings, keine Erklärung."
    }, {
        "role": "user",
        "content": raw_text
    }]

    result = client.chat(
        model=current_model, 
        messages=full_prompt, 
        keep_alive=-1)
    try:
        entries = json.loads(result["message"]["content"])
    except json.JSONDecodeError:
        entries = [result["message"]["content"]] 

    ids_new = [str(uuid.uuid4()) for _ in entries]
    documents.extend(entries)
    ids.extend(ids_new)

    collection.upsert(documents=entries, ids=ids_new)
    load_data.save_txt(documents, ids)
    return entries
