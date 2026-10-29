# Opty: LLM, RAG, Priority Queue, and Data

## Components

- Interface and conversation state in the open tab: `llm-support/llm.html`, `llm-support/llm.js`.
- HTTP endpoints and session checks: `POST /api/llm/chat`, `POST /api/llm/conversation/clear` in `server.py`.
- Queue and Ollama client: `llm-support/llm_communication.py` (`LlmRequestQueue`).
- Context preparation and vector search: `llm-support/vectordb.py`.
- User data and personal summaries: `data/user/db_interaction.py`.
- Persistent general references: the `chroma_data/` directory and `GhostReferenceV1` collection.

## Request flow

1. The browser sends the message, visible conversation, and session cookie to `/api/llm/chat`.
2. `server.py` validates the number, roles, and length of messages, then submits a user-scoped request to the queue.
3. The queue sorts by priority and stable insertion order: user request (0), recommendation (1), summary (2), system request (3). One worker processes requests sequentially. Check-in scoring is calculated locally and does not wait on an unused LLM health or burnout assessment.
4. For normal chats, `vectordb.build_rag_context` creates a system context from the profile, check-ins, health history, recent efficiency logs, today's calendar data, personal memories, and the most similar general Chroma references.
5. The queue sends the context, conversation, and user message to the configured Ollama client. The model and server address come from `OLLAMA_HOST` and `OLLAMA_MODEL` or their selection functions.

## Data and storage boundaries

The Chroma collection contains the general reference corpus; it is not a separate personal vector database for each user. Personal summaries are stored in `llm_problem_memory` in the user database and loaded only for the signed-in username. Profile, health, and calendar data are also fetched through user-scoped database queries.

The visible chat history remains in the open browser tab's frontend state. When the user saves and clears it, the UI sends the conversation to the clear endpoint; the queue creates a summary and stores it for that user. If the model is unavailable, chat and generative recommendations are unavailable or use their respective implemented fallbacks.
