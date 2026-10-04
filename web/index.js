
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

async function loadRecommendation() {
    const target = byId('recommendation-text');
    const discussLink = byId('discuss-recommendation');
    try {
        const data = await fetchJson('/api/dashboard/recommendation');
        const recommendation = typeof data.recommendation === 'string'
            ? data.recommendation.trim()
            : '';
        target.textContent = recommendation || 'Heute gibt es noch keine Empfehlung.';
        if (recommendation) {
            const message = `Helfe mir diese Entscheidung nachzuvollziehn : ${recommendation}`;
            discussLink.href = `/llm?ask=${encodeURIComponent(message)}`;
            discussLink.hidden = false;
        }
    } catch (error) {
        target.textContent = 'Deine Empfehlung ist gerade nicht verfügbar.';
        discussLink.hidden = true;
    }
}

async function loadDashboard() {
    const status = byId('dashboard-status');
    const now = new Date();
    byId('today-date').textContent = now.toLocaleDateString('de-DE', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    }).toUpperCase();

    try {
        const [health, checkup, calendar, user] = await Promise.all([
            fetchJson('/api/get_health_data/index'),
            fetchJson('/api/daily-checkup/status'),
            fetchJson(`/api/kalender/get?month=${now.getMonth() + 1}&year=${now.getFullYear()}`),
            fetchJson('/api/me'),
        ]);

        byId('dashboard-username').textContent = user.usr || 'Dein Bereich';
        const count = Number(health[0]) || 0;
        const healthTotal = Number(health[1]) || 0;
        const history = health[2] && typeof health[2] === 'object' ? health[2] : {};
        const lastHistoryValue = Object.values(history).map(Number).filter(Number.isFinite).at(-1);
        const healthToday = count ? Math.round(healthTotal / count) : lastHistoryValue;
        byId('health_count').textContent = healthToday === undefined ? '--' : Math.round(healthToday).toLocaleString('de-DE');
        renderHealthChart(history);
        renderCheckup(checkup);
        renderTasks(calendar.entries || []);
        status.textContent = '';
        void loadRecommendation();
    } catch (error) {
        status.textContent = error.message;
    }
}

window.addEventListener('DOMContentLoaded', loadDashboard);
