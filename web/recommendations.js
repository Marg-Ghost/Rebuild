const byId = (id) => document.getElementById(id);

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

let efficiencySnapshot = null;
let efficiencyTimer = null;
let efficiencyBelowThreshold = null;
const svgNamespace = "http://www.w3.org/2000/svg";

function formatDuration(totalSeconds) {
    const seconds = Math.max(0, Math.floor(totalSeconds));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainder = seconds % 60;
    return hours > 0
        ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
        : `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

function updateEfficiencyCountdown() {
    if (!efficiencySnapshot) return;
    const elapsedHours = Math.max(0, (Date.now() - efficiencySnapshot.calculatedAt) / 3600000);
    const score = Math.max(0, efficiencySnapshot.score - efficiencySnapshot.decayRate * elapsedHours);
    const belowThreshold = score <= 20;
    if (efficiencyBelowThreshold === false && belowThreshold) void loadRecommendations();
    efficiencyBelowThreshold = belowThreshold;
    const secondsLeft = score > 20 ? Math.floor(((score - 20) / efficiencySnapshot.decayRate) * 3600) : 0;
    byId('efficiency-current').textContent = `${score.toFixed(1)}%`;
    byId('efficiency-status').textContent = score > 20
        ? 'Above the 20% usable threshold'
        : 'At or below the 20% usable threshold';
    byId('efficiency-time-left').textContent = secondsLeft > 0
        ? formatDuration(secondsLeft)
        : 'Threshold reached';
}

function renderEfficiency(result) {
    if (!result) {
        efficiencySnapshot = null;
        byId('efficiency-current').textContent = '--%';
        byId('efficiency-status').textContent = 'Save a check-in to start the estimate.';
        byId('efficiency-components').textContent = 'Complete the sleep check-in, then save your stress and workload ratings.';
        byId('efficiency-time-left').textContent = '--:--';
        byId('efficiency-decay-rate').textContent = 'Estimated decay: -- points per hour.';
        byId('wellbeing-result').textContent = 'No efficiency check-ins have been saved yet.';
        if (efficiencyTimer) clearInterval(efficiencyTimer);
        return;
    }
    const score = Number(result.efficiency_score);
    const decayRate = Number(result.decay_rate_per_hour);
    const calculatedAt = Date.parse(result.calculated_at);
    if (!Number.isFinite(score) || !Number.isFinite(decayRate) || decayRate <= 0 || !Number.isFinite(calculatedAt)) {
        byId('efficiency-status').textContent = 'Could not read the saved estimate.';
        return;
    }
    efficiencySnapshot = { score, decayRate, calculatedAt };
    byId('efficiency-decay-rate').textContent = `Estimated decay: ${decayRate.toFixed(1)} points per hour.`;
    byId('stress-level').value = result.stress_level;
    byId('stress-level-value').value = result.stress_level;
    byId('workload-level').value = result.workload_level;
    byId('workload-level-value').value = result.workload_level;
    const componentLabel = (value) => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value))
        ? `${Number(value).toFixed(0)}/100`
        : 'not logged';
    byId('efficiency-components').textContent =
        `Components — sleep ${componentLabel(result.sleep_score)}, food ${componentLabel(result.food_score)}, activity ${componentLabel(result.activity_score)}; stress bonus +${Number(result.stress_bonus).toFixed(1)}. Workload ${result.workload_level}/10 is used only for activity suggestions.`;
    const savedAt = result.timestamp ? new Date(result.timestamp).toLocaleString('en-GB') : '';
    byId('wellbeing-result').textContent = `Latest saved ratings: stress ${result.stress_level}/10, workload ${result.workload_level}/10${savedAt ? ` · ${savedAt}` : ''}.`;
    updateEfficiencyCountdown();
    if (efficiencyTimer) clearInterval(efficiencyTimer);
    efficiencyTimer = setInterval(updateEfficiencyCountdown, 1000);
}

function renderEfficiencyHistory(history) {
    const chart = byId('efficiency-history-chart');
    const empty = byId('efficiency-history-empty');
    chart.replaceChildren();
    const entries = Array.isArray(history)
        ? history.slice().reverse().filter((entry) => Number.isFinite(Number(entry.efficiency_score)))
        : [];
    empty.hidden = entries.length > 0;
    chart.setAttribute('aria-label', entries.length
        ? `Saved efficiency estimates, from ${entries.length} check-ins`
        : 'No saved efficiency check-ins yet');
    if (!entries.length) return;

    const left = 42;
    const right = 586;
    const top = 18;
    const bottom = 126;
    const y = (score) => bottom - (Math.max(0, Math.min(100, Number(score))) / 100) * (bottom - top);
    [0, 20, 50, 100].forEach((value) => {
        const line = document.createElementNS(svgNamespace, 'line');
        line.setAttribute('x1', String(left));
        line.setAttribute('x2', String(right));
        line.setAttribute('y1', String(y(value)));
        line.setAttribute('y2', String(y(value)));
        line.setAttribute('class', value === 20
            ? 'efficiency-chart-gridline efficiency-chart-threshold'
            : 'efficiency-chart-gridline');
        chart.appendChild(line);
        const label = document.createElementNS(svgNamespace, 'text');
        label.setAttribute('x', '4');
        label.setAttribute('y', String(y(value) + 4));
        label.setAttribute('class', 'efficiency-chart-label');
        label.textContent = `${value}%`;
        chart.appendChild(label);
    });

    const times = entries.map((entry) => Date.parse(`${entry.timestamp.replace(' ', 'T')}Z`));
    const firstTime = Math.min(...times);
    const lastTime = Math.max(...times);
    const x = (index) => lastTime > firstTime
        ? left + ((times[index] - firstTime) / (lastTime - firstTime)) * (right - left)
        : entries.length === 1
            ? (left + right) / 2
            : left + (index / (entries.length - 1)) * (right - left);
    const coordinates = entries.map((entry, index) => `${x(index)},${y(entry.efficiency_score)}`);
    const path = document.createElementNS(svgNamespace, 'polyline');
    path.setAttribute('points', coordinates.join(' '));
    path.setAttribute('class', 'efficiency-chart-line');
    chart.appendChild(path);
    entries.forEach((entry, index) => {
        const dot = document.createElementNS(svgNamespace, 'circle');
        dot.setAttribute('cx', String(x(index)));
        dot.setAttribute('cy', String(y(entry.efficiency_score)));
        dot.setAttribute('r', index === entries.length - 1 ? '5' : '3.5');
        dot.setAttribute('class', index === entries.length - 1
            ? 'efficiency-chart-dot efficiency-chart-dot-current'
            : 'efficiency-chart-dot');
        const title = document.createElementNS(svgNamespace, 'title');
        title.textContent = `${Number(entry.efficiency_score).toFixed(1)}% · ${new Date(`${entry.timestamp.replace(' ', 'T')}Z`).toLocaleString()}`;
        dot.appendChild(title);
        chart.appendChild(dot);
    });
}

async function loadEfficiencyScore() {
    try {
        const response = await fetch('/api/efficiency', { credentials: 'include' });
        if (response.status === 401) {
            window.location.href = '/login';
            return;
        }
        if (!response.ok) throw new Error('Could not load efficiency history.');
        const data = await response.json();
        renderEfficiency(data.latest);
        renderEfficiencyHistory(data.history);
    } catch (error) {
        byId('efficiency-status').textContent = error instanceof Error
            ? error.message
            : 'Could not load efficiency history.';
    }
}

async function saveEfficiencyScore(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    const target = byId('wellbeing-result');
    button.disabled = true;
    target.textContent = 'Saving and starting a new estimate…';
    try {
        const response = await fetch('/api/efficiency', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                stress_level: Number(byId('stress-level').value),
                workload_level: Number(byId('workload-level').value),
            }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || 'Could not save efficiency check-in.');
        efficiencyBelowThreshold = Number(data.efficiency_score) <= 20;
        renderEfficiency(data);
        target.textContent = 'Saved. Your efficiency estimate has restarted.';
        await loadEfficiencyScore();
        void loadRecommendations();
    } catch (error) {
        target.textContent = error instanceof Error ? error.message : 'Could not save check-in.';
    } finally {
        button.disabled = false;
    }
}
function renderActivity(activity, window) {
    const details = [];
    const time = window?.start
        ? new Date(window.start).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
        : '';
    if (window) details.push('30 min');
    if (time) details.push(`at ${time}`);
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

    const [meResult, recommendationResult] = await Promise.allSettled([
        fetch('/api/me', { credentials: 'include' }),
        fetch('/api/recommendations', { credentials: 'include' }),
    ]);
    const responses = [meResult, recommendationResult]
        .filter((result) => result.status === 'fulfilled').map((result) => result.value);
    if (responses.some((response) => response.status === 401)) {
        window.location.href = '/login';
        return;
    }

    if (meResult.status === 'fulfilled' && meResult.value.ok) {
        const user = await meResult.value.json();
        byId('recommendation-user').textContent = user.usr || 'Your space';
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
            : 'No free 30-minute time slot found in the next 24 hours.';

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
                ? 'No free 30-minute time slot found in the next 24 hours.'
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
const efficiencyExplainer = byId('efficiency-explainer');
efficiencyExplainer.addEventListener('click', () => {
    efficiencyExplainer.setAttribute('aria-expanded', efficiencyExplainer.getAttribute('aria-expanded') !== 'true');
});
efficiencyExplainer.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        efficiencyExplainer.click();
    } else if (event.key === 'Escape') {
        efficiencyExplainer.setAttribute('aria-expanded', 'false');
        efficiencyExplainer.blur();
    }
});
document.addEventListener('click', (event) => {
    if (!efficiencyExplainer.contains(event.target)) {
        efficiencyExplainer.setAttribute('aria-expanded', 'false');
        efficiencyExplainer.blur();
    }
});
['stress-level', 'workload-level'].forEach((id) => {
    byId(id).addEventListener('input', (event) => {
        byId(`${id}-value`).value = event.currentTarget.value;
    });
});
byId('wellbeing-form').addEventListener('submit', saveEfficiencyScore);
window.addEventListener('DOMContentLoaded', () => {
    void loadEfficiencyScore();
    void loadRecommendations();
});
