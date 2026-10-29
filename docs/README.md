# Rebuild – Application Overview

This document summarizes what the visible parts of the application do and how the browser, server, and data stores work together. It is an orientation guide for developers, not a complete API or database specification.

For architecture details, see the [feature guides](architecture/README.md), covering account access and input validation, check-ins, scoring, recommendations, Ollama/RAG/queue processing, the calendar, and browser reminders.

## Contents

- [Technical overview](#technical-overview)
- [Starting the containers](#starting-the-containers)
- [Accounts and sign-in](#accounts-and-sign-in)
- [Overview and daily progress](#overview-and-daily-progress)
- [Check-ins](#check-ins)
- [Sleep and Brain](#sleep-and-brain)
- [Nutrition and Stomach](#nutrition-and-stomach)
- [Activity](#activity)
- [Opty and the LLM](#opty-and-the-llm)
- [Calendar](#calendar)
- [Current limitations](#current-limitations)

## Technical overview

- `server.py` serves the pages and FastAPI endpoints.
- HTML, CSS, and browser JavaScript are mainly under `web/`. Calendar JavaScript is under `Kalender/web/`; the assistant interface and its logic are under `llm-support/`.
- Account, check-in, and history database access goes through `data/user/db_interaction.py`. Calendar tasks are managed through `Kalender/date.py` and `Kalender/data/database.py`.
- The browser uses a server-side session for protected features. The API checks the signed-in user before reading or changing personal data.
- The nutrition and activity scoring network is implemented in `core/ai/ai.py`. The application combines user entries with reference data and the stored model weights.
- Opty uses Ollama for text responses. `llm-support/llm_communication.py` manages requests; `llm-support/vectordb.py` supplies additional context from the Chroma vector database.

## Starting the containers

Docker with Compose and Bash are required. On first run, `bash start.sh` automatically creates a local `.env` file with a random session secret, builds the app with the dependencies from `requirements.txt`, starts Ollama, checks `OLLAMA_MODEL`, and downloads the model only if it is missing. It then starts the Rebuild app container.

Compose serves the app at `http://localhost:8000`. Ollama is available to local tools at `http://localhost:11434`; inside the app container, the service is reached at `http://ollama:11434`. Model weights, user databases, reference databases, and Chroma data persist through volumes or bind mounts.

Compose binds the app port to `0.0.0.0:8000`, making it reachable from other devices on the network. For internet access, put an HTTPS reverse proxy in front of it and set `SESSION_HTTPS_ONLY=true`. Browser access to Ollama remains limited to `127.0.0.1:11434`. Keep `SessionMiddlewareSecretKey` secret; do not include it in a submission or public repository.

## Accounts and sign-in

The sign-in and registration interface is served from `web/pages/login/`. The browser sends sign-in or registration data to `server.py`; after a successful sign-in, the user is stored in a signed session cookie. Protected pages and endpoints use this session; no JWT or `localStorage` token is required. A unique SQLite index protects usernames; triggers block new duplicate email addresses and phone numbers. Existing duplicates are retained and make email- or phone-based sign-in ambiguous; in that case, the username must be used.

During registration, profile details and the first check-in are collected in stages. The profile endpoint stores details including age, hobbies, occupation, selected conditions, current problems, and primary concerns. The actual persistence is implemented in `data/user/db_interaction.py`.

Passwords are stored with PBKDF2-HMAC-SHA256 and an individual salt. New passwords must be at least 12 characters long. Sign-in and registration attempts are rate-limited per server process; the limit is not shared between multiple Uvicorn workers. Mutating browser requests that include an `Origin` or `Referer` header are restricted to the same host. SQL queries use bound parameters, and inputs are also checked for length and format.

## Overview and daily progress

The `/home` page loads daily values, check-in status, and history, then displays them as a health history, progress indicator, and next steps. Its browser logic is in `web/index.js`.

The overview also displays an Opty recommendation. The server combines check-in, sleep, health, and calendar data into a context and sends a prioritized system request to the LLM queue. If Ollama is unreachable, this dashboard endpoint reports an error. The Recommendations page has a separate fallback that can display profile hobbies directly; that fallback does not assess whether a hobby involves physical activity.

The displayed daily value is an internal calculation, not a medically validated health score. Each check-in starts at 1,000 points; sleep, food, and activity impacts change that value. The page displays the average of today's check-ins. Sleep is included in the first check-in but not in later ones, so additional check-ins can shift the average. Registration profile data does not currently affect this value. Its explanation shows the difference from the baseline and the previous saved day, not a medical classification.

A separate daily workload and recovery score ranges from 0 to 100. It combines sleep (40%), self-reported stress (30%), and self-reported workload (30%). Stress and workload are each entered on a 0–10 scale; sleep comes from the sleep check-in. Scores of 80–100 are labelled low risk, 50–79 moderate risk, and 0–49 high burnout risk. This is a transparent guidance value, not a validated test or diagnosis. Inputs and results are stored per user in `efficiency_scores`.

## Check-ins

### Sleep check-in

The sleep check-in is opened at `/sleep-checkup`. Users enter hours slept and an approximate time they fell asleep, or indicate that they have not slept yet. The server counts late nights in the past seven days, calculates a possible sleep-timing effect, and stores the daily status.

### Nutrition and activity

After the sleep check-in, users can save up to five nutrition/activity check-ins per day. The forms offer reference entries from a catalog. Free text can be matched to an existing catalog entry by Ollama on the server; unknown or uncertain entries are not accepted as reference data.

The server builds feature vectors from selected entries, scores nutrition and activity, and stores the scores and check-in data per user. The daily status endpoint returns progress to the overview.

### Reminders

`web/reminders.js` adds an optional browser reminder to the overview, Recommendations, Calendar, and AI assistant pages. After the user clicks to enable it and grants browser permission, a reminder appears every two hours for up to ten hours. The timer and activation status are kept in browser `localStorage`; there is no Python endpoint or database table for this feature. The page must remain open. Push notifications while the browser is closed are not implemented.

## Sleep and Brain

`/brain` displays sleep hours, late nights, and sleep quality history. The page loads data from `/api/brain/summary`; the chart is rendered by `web/brain.js`.

The sleep value is calculated from entered sleep hours and a possible effect from late bedtimes. History comes from the signed-in user's saved sleep check-ins.

## Nutrition and Stomach

`/stomach` displays the day's nutrition score, recent check-ins, and history. Data comes from `/api/food/summary`; `web/food.js` renders the chart and entry list.

The score is based on recorded nutrition entries and the scoring model. The displayed effect on the overall value is determined separately using the relevant impact data.

## Activity

`/activity` displays the activity score, recent activity check-ins, and history. The page loads `/api/activity/summary`; `web/activity.js` renders the data.

Activities are mapped to features through the reference catalog and scored by the activity model. The resulting effect on the overall value comes from the activity impact data.

## Opty and the LLM

The `/llm` page provides a chat with Opty. `llm-support/llm.js` keeps the conversation in the open browser page and sends new messages to `/api/llm/chat`.

The server queues requests in `LlmRequestQueue`. User messages take priority over automatically generated system recommendations. For every request, `build_rag_context` combines the profile (including current problems and concerns), health and check-in data, recent workload values, today's calendar tasks and events, personal summaries, and relevant Chroma context before sending the system prompt to Ollama.

The `GhostReferenceV1` Chroma collection is populated from the versioned general reference file; the old `Ghost` collection is no longer queried. Personal summaries are stored in `llm_problem_memory` with a user identifier and loaded only for that same user. Health, profile, and calendar data are also queried for the signed-in user.

“Save and clear conversation” sends the current conversation to `/api/llm/conversation/clear`. The queue creates a summary and stores it as personal memory, then clears the visible conversation. This browser code does not restore the conversation itself permanently.

The Ollama model and server address are configured through `OLLAMA_MODEL` and `OLLAMA_HOST`. When started with `bash start.sh`, `llm/ollama_config.py` selects a model based on available memory: up to 6 GB uses `llama3.2:1b`, up to 12 GB uses `llama3.2:3b`, and above that uses `llama3.1:8b`. If the memory query is unavailable, it uses `llama3.2:3b`. When starting directly with `docker compose up` and no `OLLAMA_MODEL` set, Compose defaults to `llama3.2:3b`.

For a faster response, set `OLLAMA_MODEL=llama3.2:1b` before startup; an explicit value overrides automatic selection. Alternatively, put the value in a local, unversioned `.env` file. The startup script checks whether the model is already present and downloads it only if needed. A smaller model may respond faster and use fewer resources, but may be less capable at answering questions and generating recommendations. Actual response time also depends on available CPU/GPU resources and context length.

## Calendar

`/kalender` displays a monthly task view. Browser logic is in `Kalender/web/kalender.js`; it loads a month through `/api/kalender/get` and saves tasks through `/api/kalender/add`. Tasks include a date, optional time, importance, type, and content.

The API scopes tasks to the signed-in user. Tasks are stored in the calendar database and sorted by date and time. The interface can switch months, return to the current month, and open the add-task form. The current calendar endpoints do not support editing or deleting existing tasks.

## Current limitations

- Chat messages remain in browser state during the session; when clearing the conversation, only a summary is saved for later use.
- The calendar currently supports reading and adding tasks; editing and deletion are not implemented.
- Check-ins are designed for one sleep check-in and up to five nutrition/activity check-ins per day.
- LLM answers, automatic recommendations, and free-text matching depend on the configured Ollama service and model being available.
- Browser reminders are currently time-based and are not tied to completion of check-ins; they are not push notifications for closed pages.
