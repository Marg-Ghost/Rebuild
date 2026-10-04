const byId = (id) => document.getElementById(id);

function renderBrainHistory(history) {
    const values = (Array.isArray(history) ? history : [])
        .map((item) => ({ date: item.date, value: Number(item.sleep_quality) }))
        .filter((item) => Number.isFinite(item.value));
    const path = byId('brain-chart-line');
    const caption = byId('brain-history-caption');

    if (values.length === 0) {
        path.setAttribute('d', '');
        caption.textContent = 'Dein Verlauf erscheint nach den ersten Schlaf-Check-ins.';
        return;
    }

    const scores = values.map((item) => item.value);
    const minimum = Math.min(...scores);
    const maximum = Math.max(...scores);
    const range = Math.max(maximum - minimum, 1);
    const points = scores.map((value, index) => {
        const x = values.length === 1 ? 180 : 12 + index * (336 / (values.length - 1));
        const y = 84 - ((value - minimum) / range) * 68;
        return `${x},${y}`;
    });
    path.setAttribute('d', `M ${points.join(' L ')}`);

    const firstDate = new Date(`${values[0].date}T00:00:00`);
    const formattedDate = Number.isNaN(firstDate.getTime())
        ? values[0].date
        : firstDate.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });
    caption.textContent = `Schlafqualität seit ${formattedDate} · ${values.length} Check-ins`;
}

async function loadBrainDashboard() {
    const status = byId('brain-status');

    try {
        const response = await fetch('/api/brain/summary', { credentials: 'include' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || 'Schlafdaten konnten nicht geladen werden.');

        const sleep = data.sleep || {};
        byId('brain-sleep-hours').textContent = sleep.sleep_hours === null || sleep.sleep_hours === undefined
            ? '--'
            : Number(sleep.sleep_hours).toLocaleString('de-DE', { maximumFractionDigits: 1 });
        byId('brain-late-nights').textContent = `${sleep.late_nights_last_week ?? 0}/7`;

        byId('brain-sleep-counter').textContent = Number.isFinite(Number(sleep.sleep_quality))
            ? Math.round(Number(sleep.sleep_quality)).toLocaleString('de-DE')
            : '--';
        renderBrainHistory(data.history);
        status.textContent = sleep.status === 'complete'
            ? 'Dein heutiger Schlaf-Check-in ist gespeichert.'
            : 'Dein Schlaf-Check-in für heute steht noch aus.';
    } catch (error) {
        status.textContent = error.message;
    }
}

window.addEventListener('DOMContentLoaded', loadBrainDashboard);
