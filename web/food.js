const foodById = (id) => document.getElementById(id);

function formatFoodImpact(value) {
    const score = Number(value);
    if (!Number.isFinite(score)) return '--';
    const formatted = Math.abs(score).toLocaleString('de-DE', { maximumFractionDigits: 1 });
    return `${score > 0 ? '+' : score < 0 ? '−' : ''}${formatted}`;
}

function renderFoodHistory(history) {
    const values = (Array.isArray(history) ? history : [])
        .filter((item) => item.has_checkups);
    const path = foodById('food-chart-line');
    const caption = foodById('food-history-caption');

    if (values.length === 0) {
        path.setAttribute('d', '');
        caption.textContent = 'Dein Food-Verlauf erscheint nach den ersten Check-ins.';
        return;
    }

    const pointsData = values
        .map((item) => ({ date: item.date, impact: Number(item.impact) }))
        .filter((item) => Number.isFinite(item.impact));
    if (pointsData.length === 0) {
        path.setAttribute('d', '');
        caption.textContent = 'Für den Verlauf liegen noch keine auswertbaren Check-ins vor.';
        return;
    }

    const impacts = pointsData.map((item) => item.impact);
    const minimum = Math.min(...impacts);
    const maximum = Math.max(...impacts);
    const range = Math.max(maximum - minimum, 1);
    const points = impacts.map((impact, index) => {
        const x = impacts.length === 1 ? 180 : 12 + index * (336 / (impacts.length - 1));
        const y = 84 - ((impact - minimum) / range) * 68;
        return `${x},${y}`;
    });
    path.setAttribute('d', `M ${points.join(' L ')}`);

    const firstDate = new Date(`${pointsData[0].date}T00:00:00`);
    const formattedDate = Number.isNaN(firstDate.getTime())
        ? pointsData[0].date
        : firstDate.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });
    caption.textContent = `Täglicher Food-Score seit ${formattedDate} · ${pointsData.length} Tage`;
}

function renderFoodEntries(checkups) {
    const list = foodById('food-entry-list');
    list.replaceChildren();

    if (!checkups.length) {
        const empty = document.createElement('p');
        empty.className = 'food-empty-state';
        empty.textContent = 'Heute wurden noch keine Food-Einträge gespeichert.';
        list.append(empty);
        return;
    }

    for (const checkup of checkups) {
        const row = document.createElement('article');
        row.className = 'food-entry-row';

        const names = document.createElement('span');
        names.className = 'food-entry-names';
        names.textContent = Array.isArray(checkup.food) && checkup.food.length
            ? checkup.food.join(', ')
            : 'Keine Food-Einträge';

        const checkupLabel = document.createElement('span');
        checkupLabel.className = 'food-entry-checkup';
        checkupLabel.textContent = `Checkup ${checkup.number}/5`;

        const impact = document.createElement('strong');
        impact.className = 'food-entry-impact';
        impact.textContent = formatFoodImpact(checkup.impact);
        impact.setAttribute('aria-label', `Score-Veränderung ${impact.textContent}`);

        row.append(names, checkupLabel, impact);
        list.append(row);
    }
}

async function loadFoodDashboard() {
    const status = foodById('food-status');

    try {
        const response = await fetch('/api/food/summary', { credentials: 'include' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || 'Food-Daten konnten nicht geladen werden.');

        foodById('food-counter-value').textContent = data.checkups.length
            ? formatFoodImpact(data.today_impact)
            : '--';
        renderFoodHistory(data.history);
        renderFoodEntries(data.checkups);
    } catch (error) {
        status.textContent = error.message;
        renderFoodEntries([]);
        foodById('food-entry-list').firstElementChild.textContent = 'Food-Einträge konnten nicht geladen werden.';
    }
}

window.addEventListener('DOMContentLoaded', loadFoodDashboard);
