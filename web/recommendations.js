const byId = (id) => document.getElementById(id);
let activeHealthScore = 1000;

async function readApiJson(response) {
    const body = await response.text();
    try {
        return body ? JSON.parse(body) : {};
    } catch {
        const status = `HTTP ${response.status}`;
        throw new Error(response.ok
            ? `The server did not return valid JSON (${status}).`
            : `The server returned an unexpected response (${status}). Check the backend log.`);
    }
}

function renderEfficiencyScore(result) {
    const target = byId('wellbeing-result');
    if (!result) return;
    target.textContent = `${Math.round(Number(result.score))}/100 · Guidance score based on your entries.`;
    if (Number.isFinite(Number(result.stress_level))) {
        byId('stress-level').value = result.stress_level;
        byId('stress-level-value').value = result.stress_level;
    }
    if (Number.isFinite(Number(result.workload_level))) {
        byId('workload-level').value = result.workload_level;
        byId('workload-level-value').value = result.workload_level;
    }
}

async function loadEfficiencyScore() {
    try {
        const response = await fetch('/api/efficiency-score', { credentials: 'include' });
        if (response.status === 401) {
            window.location.href = '/login';
            return;
        }
        if (response.ok) {
            const data = await response.json();
            renderEfficiencyScore(data.latest);
        }
    } catch {
        byId('wellbeing-result').textContent = 'Could not load assessment.';
    }
}

async function saveEfficiencyScore(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    const target = byId('wellbeing-result');
    button.disabled = true;
    target.textContent = 'Saving …';
    try {
        const response = await fetch('/api/efficiency-score', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                stress_level: Number(byId('stress-level').value),
                workload_level: Number(byId('workload-level').value),
            }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error('Could not save assessment.');
        renderEfficiencyScore(data);
    } catch (error) {
        target.textContent = error instanceof Error ? error.message : 'Could not save.';
    } finally {
        button.disabled = false;
    }
}

function healthPercent(score) {
    return 100 / (1 + Math.exp(-0.00618 * (score - 755)));
}

function renderHealthScore(health) {
    if (!Array.isArray(health)) return;
    const count = Number(health[0]) || 0;
    const total = Number(health[1]) || 0;
    const history = health[2] && typeof health[2] === 'object' ? health[2] : {};
    const lastScore = Object.values(history).map(Number).filter(Number.isFinite).at(-1);
    const score = count ? total / count : lastScore;
    if (!Number.isFinite(score)) {
        byId('health-percent').textContent = '–';
        byId('health-score').textContent = 'No health score available yet';
        return;
    }
    activeHealthScore = score;
    byId('health-percent').textContent = `${Math.round(healthPercent(score))}%`;
    byId('health-score').textContent = `${Math.round(score).toLocaleString('en-GB')} Rebuild points`;
}

function renderActivity(activity, window) {
    const details = [];
    const time = window?.start
        ? new Date(window.start).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
        : '';
    if (window) details.push('30 min');
    if (time) details.push(`at ${time}`);
    const delta = Number(activity.estimated_health_score_delta);
    if (Number.isFinite(delta)) {
        const impact = healthPercent(activeHealthScore + delta) - healthPercent(activeHealthScore);
        details.push(`${impact >= 0 ? '+' : ''}${impact.toFixed(1)} estimated percentage points`);
    }
    const card = document.createElement('article');
    card.className = 'recommendation-activity-card';
    const title = document.createElement('h3');
    title.textContent = activity.activity || 'Activity from your hobby profile';
    card.appendChild(title);
    if (details.length) {
        const meta = document.createElement('p');
        meta.className = 'recommendation-activity-meta';
        meta.textContent = details.join(' · ');
        card.appendChild(meta);
    }
    if (activity.reason) {
        const reason = document.createElement('p');
        reason.textContent = activity.reason;
        card.appendChild(reason);
    }
    card.dataset.summary = [title.textContent, ...details, activity.reason].filter(Boolean).join(' · ');
    return card;
}

async function loadRecommendations() {
    const text = byId('recommendation-text');
    const retry = byId('retry-recommendation');
    const link = byId('discuss-recommendation');
    retry.hidden = true;
    text.hidden = false;
    byId('recommendation-list').replaceChildren(text);
    text.textContent = 'Opty is looking for an activity that fits your free time …';

    const [meResult, healthResult, recommendationResult] = await Promise.allSettled([
        fetch('/api/me', { credentials: 'include' }),
        fetch('/api/get_health_data/index', { credentials: 'include' }),
        fetch('/api/recommendations', { credentials: 'include' }),
    ]);
    const responses = [meResult, healthResult, recommendationResult]
        .filter((result) => result.status === 'fulfilled').map((result) => result.value);
    if (responses.some((response) => response.status === 401)) {
        window.location.href = '/login';
        return;
    }

    if (meResult.status === 'fulfilled' && meResult.value.ok) {
        const user = await meResult.value.json();
        byId('recommendation-user').textContent = user.usr || 'Your space';
    }
    if (healthResult.status === 'fulfilled' && healthResult.value.ok) {
        renderHealthScore(await healthResult.value.json());
    }

    try {
        if (recommendationResult.status === 'rejected') throw recommendationResult.reason;
        const response = recommendationResult.value;
        const data = await readApiJson(response);
        if (!response.ok) throw new Error('Could not load the recommendation.');

        const windowStart = data.window?.start
            ? new Date(data.window.start).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
            : '';
        byId('recommendation-window').textContent = data.window
            ? `Free time slot: ${windowStart}–${new Date(data.window.end).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
            : 'No free 30-minute time slot found today.';

        const activities = Array.isArray(data.recommendation?.activities) ? data.recommendation.activities : [];
        if (activities.length) {
            const cards = activities.map((activity) => renderActivity(activity, data.window));
            byId('recommendation-list').replaceChildren(...cards);
            text.hidden = true;
            const recommendationText = cards.map((card) => card.dataset.summary).join('\n');
            link.href = `/llm?ask=${encodeURIComponent(`Help me understand this recommendation: ${recommendationText}`)}`;
            link.hidden = false;
        } else {
            text.hidden = false;
            byId('recommendation-list').replaceChildren(text);
            text.textContent = data.recommendation_note || (!data.window
                ? 'No free 30-minute time slot found today.'
                : 'Add hobbies to your profile so Opty can suggest activities that suit you.');
            link.hidden = true;
        }
        byId('recommendation-status').textContent = data.recommendation_note || '';
    } catch (error) {
        text.hidden = false;
        byId('recommendation-list').replaceChildren(text);
        text.textContent = error instanceof Error ? error.message : 'Could not load recommendations.';
        retry.hidden = false;
    }
}

byId('retry-recommendation').addEventListener('click', loadRecommendations);
['stress-level', 'workload-level'].forEach((id) => {
    byId(id).addEventListener('input', (event) => {
        byId(`${id}-value`).value = event.currentTarget.value;
    });
});
byId('wellbeing-form').addEventListener('submit', saveEfficiencyScore);
window.addEventListener('DOMContentLoaded', () => {
    void loadRecommendations();
    void loadEfficiencyScore();
});
