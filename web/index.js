
const byId = (id) => document.getElementById(id);

async function fetchJson(url) {
    const response = await fetch(url, { credentials: 'include' });
    const data = await response.json();
    if (!response.ok) {
        if (response.status === 401) window.location.href = '/login';
        throw new Error(data.detail || 'Daten konnten nicht geladen werden.');
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
        empty.textContent = 'Noch keine Verlaufseinträge';
        chart.appendChild(empty);
        return;
    }

    const min = Math.min(...values.map(([, value]) => value));
    const max = Math.max(...values.map(([, value]) => value));
    const spread = max - min || Math.max(Math.abs(max) * 0.08, 1);
    const points = values.map(([, value], index) => {
        const x = values.length === 1 ? 360 : 20 + index * 680 / (values.length - 1);
        const y = 165 - ((value - min) / spread) * 125;
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
        ? `Erster Eintrag am ${firstDate.toLocaleDateString('de-DE')}`
        : `${firstDate.toLocaleDateString('de-DE')} bis ${lastDate.toLocaleDateString('de-DE')}`;
}

function renderTasks(tasks) {
    const today = new Date().toISOString().slice(0, 10);
    const upcoming = (tasks || [])
        .filter((task) => task.task_date >= today)
        .sort((a, b) => `${a.task_date} ${a.task_time || ''}`.localeCompare(`${b.task_date} ${b.task_time || ''}`))
        .slice(0, 3);
    byId('task-count').textContent = String(upcoming.length);
    const list = byId('task-list');
    list.replaceChildren();

    if (!upcoming.length) {
        const empty = document.createElement('li');
        empty.className = 'empty-state';
        empty.textContent = 'Keine anstehenden Termine';
        list.appendChild(empty);
        return;
    }

    upcoming.forEach((task) => {
        const item = document.createElement('li');
        item.className = 'task-item';
        const time = document.createElement('span');
        time.className = 'task-time';
        time.textContent = task.task_time || 'Ganztägig';
        const details = document.createElement('span');
        details.className = 'task-details';
        const title = document.createElement('strong');
        title.textContent = task.content || task.task_type || 'Termin';
        const date = document.createElement('small');
        date.textContent = new Date(`${task.task_date}T00:00:00`).toLocaleDateString('de-DE', {
            weekday: 'short', day: 'numeric', month: 'short',
        });
        details.append(title, date);
        item.append(time, details);
        list.appendChild(item);
    });
}

function renderCheckup(status) {
    const daily = status.daily || {};
    const sleep = status.sleep || {};
    const checkups = Array.isArray(status.checkups) ? status.checkups : [];
    const done = Math.min(checkups.length, 5);
    const percent = Math.round(done / 5 * 100);
    byId('checkupwert_today').textContent = `${done}/5`;
    byId('checkup-status-label').textContent = done === 5 ? 'Abgeschlossen' : 'In Arbeit';
    setProgressRing(byId('checkup-ring'), percent);
    setProgressRing(byId('efficiency-ring'), percent);
    byId('efficiency-value').textContent = `${percent}%`;
    byId('efficiency-caption').textContent = `${done} von 5 Check-ins abgeschlossen`;

    document.querySelectorAll('#checkin-segments [data-checkup-slot]').forEach((slot) => {
        const complete = Number(slot.dataset.checkupSlot) <= done;
        slot.classList.toggle('complete', complete);
        slot.setAttribute('aria-label', `Check-in ${slot.dataset.checkupSlot}${complete ? ', abgeschlossen' : ', offen'}`);
    });
    document.querySelector('[data-marker="brain"]').classList.toggle('complete', sleep.status === 'complete');
    document.querySelector('[data-marker="stomach"]').classList.toggle(
        'complete',
        daily.food_score !== null && daily.food_score !== undefined
    );
    document.querySelector('[data-marker="feet"]').classList.toggle(
        'complete',
        daily.activity_score !== null && daily.activity_score !== undefined
    );

    const statusText = byId('sleep_checkup_today');
    const startLink = byId('start-checkup');
    if (sleep.status !== 'complete') {
        statusText.textContent = 'Erfasse zuerst deinen Schlaf-Check-in. Danach kannst du fünfmal Essen und Bewegung seit dem letzten Check-in eintragen.';
        startLink.href = '/sleep-checkup';
        startLink.textContent = sleep.status === 'pending'
            ? 'Schlaf-Check-in fortsetzen →'
            : 'Schlaf-Check-in starten →';
        startLink.hidden = false;
    } else if (done < 5) {
        statusText.textContent = `Check-in ${done + 1} von 5: Trage Essen und Bewegung seit dem letzten Check-in ein.`;
        startLink.href = '/checkup';
        startLink.textContent = `Check-in ${done + 1} starten →`;
        startLink.hidden = false;
    } else {
        statusText.textContent = 'Alle fünf Check-ins für heute sind abgeschlossen.';
        startLink.hidden = true;
    }
}

function renderEfficiencyScore(result) {
    const target = byId('wellbeing-result');
    if (!result) {
        target.textContent = 'Noch kein Wert gespeichert. Schließe zuerst deinen Schlaf-Check-in ab und bewerte danach Stress und Workload.';
        delete target.dataset.risk;
        return;
    }
    const labels = {
        low: 'Niedriges Risiko',
        moderate: 'Moderates Risiko',
        high: 'Hohes Burnout-Risiko',
    };
    target.textContent = `${Math.round(Number(result.score))}/100 – ${result.label || labels[result.burnout_risk_level] || result.burnout_risk_level}. ${result.explanation || ''}`;
    target.dataset.risk = result.burnout_risk_level;
}

async function submitEfficiencyAssessment(event) {
    event.preventDefault();
    const target = byId('wellbeing-result');
    const button = event.currentTarget.querySelector('button[type="submit"]');
    button.disabled = true;
    target.textContent = 'Wert wird berechnet ...';
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
        if (!response.ok) throw new Error(data.detail || 'Wert konnte nicht gespeichert werden.');
        renderEfficiencyScore(data);
    } catch (error) {
        target.textContent = error.message;
        delete target.dataset.risk;
    } finally {
        button.disabled = false;
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
        assessment.textContent = 'Noch kein Tageswert vorhanden. Die interne Rechenbasis liegt bei 1.000 Punkten.';
        return;
    }

    const baseline = 1000;
    const now = new Date();
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const currentHistoryEntry = historyValues.filter((entry) => entry.date <= todayKey).at(-1);
    const scoreDate = isToday ? todayKey : currentHistoryEntry?.date;
    const scoreDifference = Math.round(currentScore - baseline);
    const comparison = scoreDifference === 0
        ? 'entspricht der internen Rechenbasis von 1.000 Punkten.'
        : `${Math.abs(scoreDifference).toLocaleString('de-DE')} Punkte ${scoreDifference < 0 ? 'unter' : 'über'} der internen Rechenbasis von 1.000.`;
    const previousDay = scoreDate
        ? historyValues.filter((entry) => entry.date < scoreDate).at(-1)
        : undefined;
    const dailyChange = previousDay
        ? Math.round(currentScore - previousDay.score)
        : null;
    const dailyComparison = dailyChange === null
        ? ''
        : ` Gegenüber dem letzten gespeicherten Verlaufstag (${new Date(`${previousDay.date}T00:00:00`).toLocaleDateString('de-DE')}) sind es ${Math.abs(dailyChange).toLocaleString('de-DE')} Punkte ${dailyChange < 0 ? 'weniger' : 'mehr'}.`;
    const scoreLabel = isToday
        ? 'Heute'
        : `Letzter gespeicherter Tageswert${scoreDate ? ` (${new Date(`${scoreDate}T00:00:00`).toLocaleDateString('de-DE')})` : ''}`;
    assessment.textContent = `${scoreLabel}: ${Math.round(currentScore).toLocaleString('de-DE')} Punkte; ${comparison}${dailyComparison} Das ist ein App-Modellwert, kein medizinischer Befund.`;

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
        const recommendation = typeof data.recommendation === 'string'
            ? data.recommendation.trim()
            : '';
        target.textContent = recommendation || 'Heute gibt es noch keine Empfehlung.';
        retryButton.hidden = true;
        if (recommendation) {
            const message = `Helfe mir diese Entscheidung nachzuvollziehn : ${recommendation}`;
            discussLink.href = `/llm?ask=${encodeURIComponent(message)}`;
            discussLink.hidden = false;
        } else {
            discussLink.hidden = true;
        }
    } catch (error) {
        target.textContent = error instanceof Error
            ? `Opty konnte die Empfehlung nicht laden: ${error.message}`
            : 'Opty konnte die Empfehlung nicht laden.';
        discussLink.hidden = true;
        retryButton.hidden = false;
    }
}

async function loadDashboard() {
    const status = byId('dashboard-status');
    const now = new Date();
    byId('today-date').textContent = now.toLocaleDateString('de-DE', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    }).toUpperCase();

    try {
        const [health, checkup, calendar, user, efficiency] = await Promise.all([
            fetchJson('/api/get_health_data/index'),
            fetchJson('/api/daily-checkup/status'),
            fetchJson(`/api/kalender/get?month=${now.getMonth() + 1}&year=${now.getFullYear()}`),
            fetchJson('/api/me'),
            fetchJson('/api/efficiency-score'),
        ]);

        byId('dashboard-username').textContent = user.usr || 'Dein Bereich';
        const count = Number(health[0]) || 0;
        const healthTotal = Number(health[1]) || 0;
        const history = health[2] && typeof health[2] === 'object' ? health[2] : {};
        const lastHistoryValue = Object.values(history).map(Number).filter(Number.isFinite).at(-1);
        const healthToday = count ? Math.round(healthTotal / count) : lastHistoryValue;
        byId('health_count').textContent = healthToday === undefined ? '--' : Math.round(healthToday).toLocaleString('de-DE');
        renderHealthExplanation(healthToday, history, count > 0);
        renderHealthChart(history);
        renderCheckup(checkup);
        renderEfficiencyScore(efficiency.latest);
        renderTasks(calendar.entries || []);
        status.textContent = '';
        void loadRecommendation();
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

byId('stress-level').addEventListener('input', (event) => {
    byId('stress-level-value').value = event.currentTarget.value;
});
byId('workload-level').addEventListener('input', (event) => {
    byId('workload-level-value').value = event.currentTarget.value;
});
byId('wellbeing-form').addEventListener('submit', submitEfficiencyAssessment);

window.addEventListener('DOMContentLoaded', loadDashboard);
