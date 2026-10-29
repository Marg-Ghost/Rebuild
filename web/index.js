
const byId = (id) => document.getElementById(id);

async function fetchJson(url) {
    const response = await fetch(url, { credentials: 'include' });
    const data = await response.json();
    if (!response.ok) {
        if (response.status === 401) window.location.href = '/login';
        throw new Error('Could not load the data.');
    }
    return data;
}

function setProgressRing(ring, percent) {
    ring.style.setProperty('--progress', `${Math.max(0, Math.min(percent, 100))}%`);
}

function renderHealthChart(history) {
    const chart = byId('health-chart');
    const namespace = 'http://www.w3.org/2000/svg';
    chart.replaceChildren();
    const values = Object.entries(history || {})
        .map(([date, value]) => [date, Number(value)])
        .filter(([, value]) => Number.isFinite(value))
        .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
        .slice(-7);

    if (!values.length) {
        const empty = document.createElementNS(namespace, 'text');
        empty.setAttribute('x', '360');
        empty.setAttribute('y', '96');
        empty.setAttribute('text-anchor', 'middle');
        empty.setAttribute('class', 'chart-empty');
        empty.textContent = 'No history entries yet';
        chart.appendChild(empty);
        return;
    }

    const min = Math.min(...values.map(([, value]) => value));
    const max = Math.max(...values.map(([, value]) => value));
    const spread = max - min;
    const points = values.map(([, value], index) => {
        const x = values.length === 1 ? 360 : 20 + index * 680 / (values.length - 1);
        const y = spread === 0 ? 102 : 165 - ((value - min) / spread) * 125;
        return [x, y];
    });

    const baseline = document.createElementNS(namespace, 'line');
    baseline.setAttribute('x1', '0');
    baseline.setAttribute('x2', '720');
    baseline.setAttribute('y1', '178');
    baseline.setAttribute('y2', '178');
    baseline.setAttribute('class', 'chart-baseline');
    chart.appendChild(baseline);

    const line = document.createElementNS(namespace, 'polyline');
    line.setAttribute('points', points.map(([x, y]) => `${x},${y}`).join(' '));
    line.setAttribute('class', 'chart-line');
    chart.appendChild(line);

    points.forEach(([x, y], index) => {
        const dot = document.createElementNS(namespace, 'circle');
        dot.setAttribute('cx', x);
        dot.setAttribute('cy', y);
        dot.setAttribute('r', index === points.length - 1 ? '5' : '3');
        dot.setAttribute('class', index === points.length - 1 ? 'chart-dot chart-dot-current' : 'chart-dot');
        chart.appendChild(dot);
    });

    const firstDate = new Date(`${values[0][0]}T00:00:00`);
    const lastDate = new Date(`${values[values.length - 1][0]}T00:00:00`);
    byId('health-chart-caption').textContent = values.length === 1
        ? `First entry on ${firstDate.toLocaleDateString('en-GB')}`
        : `${firstDate.toLocaleDateString('en-GB')} bis ${lastDate.toLocaleDateString('en-GB')}`;
}

function renderCheckup(status) {
    const sleep = status.sleep || {};
    const checkups = Array.isArray(status.checkups) ? status.checkups : [];
    const done = Math.min(checkups.length, 5);
    const percent = Math.round(done / 5 * 100);
    byId('checkupwert_today').textContent = `${done}/5`;
    byId('checkup-status-label').textContent = done === 5 ? 'Complete' : 'In progress';
    setProgressRing(byId('checkup-ring'), percent);

    document.querySelectorAll('#checkin-segments [data-checkup-slot]').forEach((slot) => {
        const complete = Number(slot.dataset.checkupSlot) <= done;
        slot.classList.toggle('complete', complete);
        slot.setAttribute('aria-label', `Check-in ${slot.dataset.checkupSlot}${complete ? ', complete' : ', open'}`);
    });
    const statusText = byId('sleep_checkup_today');
    const startLink = byId('start-checkup');
    if (status.processing) {
        statusText.textContent = 'Your check-in is being processed in the background.';
        startLink.hidden = true;
    } else if (sleep.status !== 'complete') {
        statusText.textContent = 'Complete your sleep check-in first. Then you can log food and activity five times between check-ins.';
        startLink.href = '/sleep-checkup';
        startLink.textContent = sleep.status === 'pending'
            ? 'Continue sleep check-in →'
            : 'Start sleep check-in →';
        startLink.hidden = false;
    } else if (done < 5) {
        statusText.textContent = `Check-in ${done + 1} of 5: Log food and activity since your last check-in.`;
        startLink.href = '/checkup';
        startLink.textContent = `Check-in ${done + 1} →`;
        startLink.hidden = false;
    } else {
        statusText.textContent = 'All five check-ins for today are complete.';
        startLink.hidden = true;
    }
}

function renderHealthExplanation(currentScore, history, isToday) {
    const assessment = byId('health-assessment');
    const baselineMarker = byId('health-scale-baseline');
    const currentMarker = byId('health-scale-current');
    const historyValues = Object.entries(history || {})
        .map(([date, score]) => ({ date, score: Number(score) }))
        .filter((entry) => Number.isFinite(entry.score))
        .sort((left, right) => left.date.localeCompare(right.date));

    if (!Number.isFinite(currentScore)) {
        assessment.textContent = 'No daily score yet. The internal baseline is 1,000 points.';
        return;
    }

    const baseline = 1000;
    const now = new Date();
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const currentHistoryEntry = historyValues.filter((entry) => entry.date <= todayKey).at(-1);
    const scoreDate = isToday ? todayKey : currentHistoryEntry?.date;
    const scoreDifference = Math.round(currentScore - baseline);
    const comparison = scoreDifference === 0
        ? 'matches the internal baseline of 1,000 points.'
        : `${Math.abs(scoreDifference).toLocaleString('en-GB')} points ${scoreDifference < 0 ? 'below' : 'above'} the internal baseline of 1,000.`;
    const previousDay = scoreDate
        ? historyValues.filter((entry) => entry.date < scoreDate).at(-1)
        : undefined;
    const dailyChange = previousDay
        ? Math.round(currentScore - previousDay.score)
        : null;
    const dailyComparison = dailyChange === null
        ? ''
        : ` Compared with the previous saved day (${new Date(`${previousDay.date}T00:00:00`).toLocaleDateString('en-GB')}) the difference is ${Math.abs(dailyChange).toLocaleString('en-GB')} points ${dailyChange < 0 ? 'fewer' : 'more'}.`;
    const scoreLabel = isToday
        ? 'Today'
        : `Last saved daily score${scoreDate ? ` (${new Date(`${scoreDate}T00:00:00`).toLocaleDateString('en-GB')})` : ''}`;
    assessment.textContent = `${scoreLabel}: ${Math.round(currentScore).toLocaleString('en-GB')} points; ${comparison}${dailyComparison} This is an app model score, not a medical assessment.`;

    const values = [...historyValues.map((entry) => entry.score), currentScore, baseline];
    const low = Math.min(...values);
    const high = Math.max(...values);
    const padding = Math.max((high - low) * 0.12, 25);
    const scaleLow = low - padding;
    const scaleHigh = high + padding;
    const position = (score) => `${((score - scaleLow) / (scaleHigh - scaleLow)) * 100}%`;
    baselineMarker.parentElement.style.setProperty('--baseline-position', position(baseline));
    currentMarker.parentElement.style.setProperty('--current-position', position(currentScore));
}

async function loadRecommendation() {
    const target = byId('recommendation-text');
    const discussLink = byId('discuss-recommendation');
    const retryButton = byId('retry-recommendation');
    try {
        const data = await fetchJson('/api/dashboard/recommendation');
        const recommendation = typeof data.recommendation === 'string' ? data.recommendation.trim() : '';
        target.textContent = recommendation || 'There are no recommendations for today yet.';
        retryButton.hidden = true;
        discussLink.hidden = !recommendation;
        if (recommendation) {
            discussLink.href = `/llm?ask=${encodeURIComponent(`Help me understand this recommendation: ${recommendation}`)}`;
        }
    } catch (error) {
        target.textContent = error instanceof Error ? `Opty could not load the recommendation: ${error.message}` : 'Opty could not load the recommendation.';
        discussLink.hidden = true;
        retryButton.hidden = false;
    }
}

async function loadDashboard() {
    const status = byId('dashboard-status');
    const now = new Date();
    byId('today-date').textContent = now.toLocaleDateString('en-GB', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    }).toUpperCase();

    try {
        const [health, checkup, user] = await Promise.all([
            fetchJson('/api/get_health_data/index'),
            fetchJson('/api/daily-checkup/status'),
            fetchJson('/api/me'),
        ]);

        byId('dashboard-username').textContent = user.usr || 'Your space';
        const count = Number(health[0]) || 0;
        const healthTotal = Number(health[1]) || 0;
        const history = health[2] && typeof health[2] === 'object' ? health[2] : {};
        const lastHistoryValue = Object.values(history).map(Number).filter(Number.isFinite).at(-1);
        const healthToday = count ? Math.round(healthTotal / count) : lastHistoryValue;
        const chartHistory = { ...history };
        if (count > 0 && Number.isFinite(healthToday)) {
            const todayKey = checkup.daily?.date || [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
            chartHistory[todayKey] = healthToday;
        }
        byId('health_count').textContent = checkup.processing ? 'Calculating...' : (healthToday === undefined ? '--' : Math.round(healthToday).toLocaleString('en-GB'));
        renderHealthExplanation(healthToday, history, count > 0);
        renderHealthChart(chartHistory);
        renderCheckup(checkup);
        status.textContent = '';
        if (checkup.processing) {
            window.setTimeout(() => { void loadDashboard(); }, 3000);
        } else {
            void loadRecommendation();
        }
    } catch (error) {
        status.textContent = error.message;
    }
}

byId('retry-recommendation').addEventListener('click', async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    button.hidden = true;
    byId('recommendation-text').textContent = 'Opty versucht es erneut ...';
    await loadRecommendation();
    button.disabled = false;
});

window.addEventListener('DOMContentLoaded', loadDashboard);
