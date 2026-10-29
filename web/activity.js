const activityById = (id) => document.getElementById(id);

function formatActivityImpact(value) {
    const score = Number(value);
    if (!Number.isFinite(score)) return '--';
    const formatted = Math.abs(score).toLocaleString('en-GB', { maximumFractionDigits: 1 });
    return `${score > 0 ? '+' : score < 0 ? '−' : ''}${formatted}`;
}

function renderActivityHistory(history) {
    const values = (Array.isArray(history) ? history : [])
        .filter((item) => item.has_checkups);
    const path = activityById('activity-chart-line');
    const caption = activityById('activity-history-caption');

    if (values.length === 0) {
        path.setAttribute('d', '');
        caption.textContent = 'Your activity history will appear after your first check-ins.';
        return;
    }

    const pointsData = values
        .map((item) => ({ date: item.date, impact: Number(item.impact) }))
        .filter((item) => Number.isFinite(item.impact));
    if (pointsData.length === 0) {
        path.setAttribute('d', '');
        caption.textContent = 'There is not enough check-in data to show a history yet.';
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
        : firstDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    caption.textContent = `Daily activity score since ${formattedDate} · ${pointsData.length} days`;
}

function renderActivityEntries(checkups) {
    const list = activityById('activity-entry-list');
    list.replaceChildren();

    if (!checkups.length) {
        const empty = document.createElement('p');
        empty.className = 'food-empty-state';
        empty.textContent = 'No activity entries saved for today yet.';
        list.append(empty);
        return;
    }

    for (const checkup of checkups) {
        const row = document.createElement('article');
        row.className = 'food-entry-row';

        const names = document.createElement('span');
        names.className = 'food-entry-names';
        names.textContent = Array.isArray(checkup.activity) && checkup.activity.length
            ? checkup.activity.map((entry) => typeof entry === 'string'
                ? entry
                : `${entry.name} (${entry.duration_minutes} min)`).join(', ')
            : 'No activity entries';

        const checkupLabel = document.createElement('span');
        checkupLabel.className = 'food-entry-checkup';
        checkupLabel.textContent = `Checkup ${checkup.number}/5`;

        const impact = document.createElement('strong');
        impact.className = 'food-entry-impact';
        impact.textContent = formatActivityImpact(checkup.impact);
        impact.setAttribute('aria-label', `Score change ${impact.textContent}`);

        row.append(names, checkupLabel, impact);
        list.append(row);
    }
}

async function loadActivityDashboard() {
    const status = activityById('activity-status');

    try {
        const response = await fetch('/api/activity/summary', { credentials: 'include' });
        const data = await response.json();
        if (!response.ok) throw new Error('Could not load activity data.');

        activityById('activity-counter-value').textContent = data.checkups.length
            ? formatActivityImpact(data.today_impact)
            : '--';
        renderActivityHistory(data.history);
        renderActivityEntries(data.checkups);
    } catch (error) {
        status.textContent = error.message;
        renderActivityEntries([]);
        activityById('activity-entry-list').firstElementChild.textContent = 'Could not load activity entries.';
    }
}

window.addEventListener('DOMContentLoaded', loadActivityDashboard);
