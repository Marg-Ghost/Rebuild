const monthNames = [
    'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
];

let displayedDate = new Date();

function formatDate(year, month, day) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function renderCalendar(year, month, events) {
    const body = document.getElementById('calendar_body');
    const monthLabel = document.getElementById('month');
    const monthDate = document.querySelector('#month_date span');
    const firstDay = new Date(year, month, 1); // === das Datumsobjekt 1 des gewählten monats
    const daysInMonth = new Date(year, month + 1, 0).getDate(); // outputtet die gesamte zahl der Tage im Monat
    const offset = (firstDay.getDay() + 6) % 7;
    const cellCount = Math.ceil((offset + daysInMonth) / 7) * 7;
    const eventsByDate = new Map();

    events.forEach((event) => {
        const date = event.start_at.slice(0, 10);
        if (!eventsByDate.has(date)) eventsByDate.set(date, []);
        eventsByDate.get(date).push(event);
    });

    body.replaceChildren();
    monthLabel.textContent = monthNames[month];
    monthDate.textContent = String(year);

    for (let index = 0; index < cellCount; index += 1) {
        if (index % 7 === 0) body.appendChild(document.createElement('tr'));

        const cell = document.createElement('td');
        const day = index - offset + 1;
        if (day < 1 || day > daysInMonth) {
            cell.className = 'empty-day';
        } else {
            const date = formatDate(year, month, day);
            cell.dataset.date = date;
            cell.appendChild(document.createTextNode(String(day)));
            (eventsByDate.get(date) || []).forEach((event) => {
                const task = document.createElement('button');
                task.type = 'button';
                task.className = `calendar-event priority-${event.priority}`;
                task.textContent = event.title;
                task.title = 'Doppelklick zum Löschen';
                task.addEventListener('dblclick', () => deleteEvent(event.id));
                cell.appendChild(task);
            });
        }
        body.lastElementChild.appendChild(cell);
    }
}

async function loadMonth() {
    const year = displayedDate.getFullYear();
    const month = displayedDate.getMonth();
    const response = await fetch(`/api/calendar?year=${year}&month=${month + 1}`, {
        credentials: 'include'
    });
    if (!response.ok) return;
    renderCalendar(year, month, await response.json());
}

async function deleteEvent(eventId) {
    const response = await fetch(`/api/calendar/${eventId}`, {
        method: 'DELETE',
        credentials: 'include'
    });
    if (response.ok) loadMonth();
}

document.getElementById('previous_month').addEventListener('click', () => {
    displayedDate.setMonth(displayedDate.getMonth() - 1);
    loadMonth();
});

document.getElementById('next_month').addEventListener('click', () => {
    displayedDate.setMonth(displayedDate.getMonth() + 1);
    loadMonth();
});

document.getElementById('event_form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const response = await fetch('/api/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
            title: document.getElementById('event_title').value,
            start_at: document.getElementById('event_start').value,
            priority: Number(document.getElementById('event_priority').value),
            all_day: true
        })
    });
    if (response.ok) {
        event.target.reset();
        loadMonth();
    }
});

loadMonth();