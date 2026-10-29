# Recommendations

## Two recommendation paths

The Overview requests `/api/dashboard/recommendation`. The Recommendations page uses `/api/recommendations`, `web/recommendations.js`, and calendar data to find a free 30-minute slot. Both paths can submit a prioritized request to the LLM queue.

For activity suggestions, the server builds context from profile hobbies and the next free calendar slot. Ollama can return up to three suggestions with reasons and an optional `estimated_health_score_delta`. The current server code fixes the recommended activity duration at 30 minutes.

If the model request is unavailable or returns no usable activities, `/api/recommendations` can return profile hobbies directly as suggestions. This fallback does not assess whether a hobby involves physical activity, so piano playing, for example, may appear. The fallback does not provide a point delta.

## Displaying estimated impact

`web/recommendations.js` loads the current point value and calculates the percentage display using a sigmoid function. An estimated percentage contribution is shown only when Ollama returns a point delta; the UI calculates the difference between the sigmoid values before and after that delta. This estimate comes from the LLM output; it is not part of the actual Rebuild point calculation.

Recommendation cards are alternatives for the same free slot. The UI therefore shows the same time window and 30-minute duration on each card. When there are several suggestions, the green card grows vertically.
