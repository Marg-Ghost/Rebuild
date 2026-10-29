# Recommendations

## Two recommendation paths

The Overview requests `/api/dashboard/recommendation`. The Recommendations page uses `/api/recommendations`, `web/recommendations.js`, and calendar data to find a free 30-minute slot. Both paths can submit a prioritized request to the LLM queue.

For activity suggestions, the server builds context from profile hobbies, the next free 30-minute slot in the next 24 hours visible in Rebuild's calendar, and the current efficiency estimate when one has been saved. Ollama can return up to three suggestions with reasons. If efficiency is projected at or below the 20% usable threshold when the free slot starts, the server suggests a short, low-effort break. A saved workload rating of 8/10 or higher favors gentler activities; workload does not alter the efficiency estimate.

If the model request is unavailable or returns no usable activities, `/api/recommendations` can return profile hobbies directly as suggestions. This fallback does not assess whether a hobby involves physical activity, so piano playing, for example, may appear.

The recommendations page shows the current efficiency estimate, its countdown, and saved check-in history. It does not present a health percentage or an AI-generated estimate of activity impact.

Recommendation cards are alternatives for the same free slot. The UI therefore shows the same time window and 30-minute duration on each card. When there are several suggestions, the green card grows vertically.
