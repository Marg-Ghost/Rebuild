const monthNames = [
    "Januar", "Februar", "März", "April", "Mai", "Juni",
    "Juli", "August", "September", "Oktober", "November", "Dezember"
];

let selected_month = new Date().getMonth() + 1;
let selected_year = new Date().getFullYear();
let task_is_submitting = false;

function local_date_string(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function toggle_add(force_open) {
    const add_element = document.getElementById("add_date");
    const should_open = typeof force_open === "boolean" ? force_open : add_element.hidden;
    add_element.hidden = !should_open;
    const toggle_button = document.getElementById("toggle_add_button");
    toggle_button.setAttribute("aria-expanded", String(should_open));
    toggle_button.textContent = should_open ? "Formular schließen" : "Task hinzufügen";
    if (should_open) {
        const now = new Date();
        const target_date = now.getFullYear() === selected_year
            && now.getMonth() + 1 === selected_month
            ? now
            : new Date(selected_year, selected_month - 1, 1);
        const date_input = document.getElementById("date");
        if (!date_input.value) date_input.value = local_date_string(target_date);
        date_input.focus();
    } else {
        toggle_button.focus();
    }
}

function show_status(message) {
    document.getElementById("calendar_status").textContent = message;
}

async function show_data(month, year) {
    try {
        const response = await fetch(`/api/kalender/get?month=${month}&year=${year}`, {
            credentials: "include"
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || "Kalenderdaten konnten nicht geladen werden.");

        if (!Array.isArray(data.entries)) {
            throw new Error("Die Kalenderdaten haben ein ungültiges Format.");
        }

        for (const entry of data.entries) {
            const table_cell = document.getElementById(`day_${entry.task_date}`);
            if (!table_cell) continue;

            const item = document.createElement("div");
            item.className = `entry importance-${entry.importance}`;
            const importance = document.createElement("span");
            importance.className = "importance";
            importance.textContent = `!${entry.importance}`;
            const content = document.createElement("span");
            content.className = "entry-content";
            content.textContent = entry.content || "Task";
            const type = document.createElement("span");
            type.className = "task-type";
            type.textContent = entry.task_type === "work" ? "Arbeit" : "Privat";
            item.append(importance, content, type);
            if (entry.task_time) {
                const time = document.createElement("span");
                time.className = "task-time";
                time.textContent = entry.task_time;
                item.append(time);
            }
            let list = table_cell.querySelector(".calendar-entry-list");
            if (!list) {
                list = document.createElement("div");
                list.className = "calendar-entry-list";
                table_cell.append(list);
            }
            list.append(item);
        }
        show_status("");
    } catch (error) {
        show_status(error.message || "Kalenderdaten konnten nicht geladen werden.");
    }
}

async function set_data(event) {
    event.preventDefault();
    if (task_is_submitting) return;
    const date = document.getElementById("date");
    const time = document.getElementById("time");
    const sliderOutput = document.getElementById("sliderOutput");
    const type_select = document.getElementById("type_select");
    const content = document.getElementById("content");
    const submit_button = document.querySelector("#task_form button[type='submit']");

    task_is_submitting = true;
    submit_button.disabled = true;
    show_status("Task wird gespeichert ...");
    try {
        const response = await fetch("/api/kalender/add", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
                date: date.value,
                time: time.value,
                importance: sliderOutput.value,
                task_type: type_select.value,
                content: content.value
            })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.detail || "Task konnte nicht gespeichert werden.");

        const task_month = Number(date.value.slice(5, 7));
        const task_year = Number(date.value.slice(0, 4));
        document.getElementById("task_form").reset();
        sliderOutput.value = "1";
        toggle_add(false);
        await get_all_enties(task_month, task_year);
        show_status("Task gespeichert.");
    } catch (error) {
        show_status(error.message || "Task konnte nicht gespeichert werden.");
    } finally {
        task_is_submitting = false;
        submit_button.disabled = false;
    }
}

function calculate_date(year, month) {
    let calculation_month = month;
    let calculation_year = year;
    if (calculation_month < 3) {
        calculation_month += 12;
        calculation_year -= 1;
    }

    const century = Math.floor(calculation_year / 100);
    const year_of_century = calculation_year % 100;
    const weekday = (1
        + Math.floor(13 * (calculation_month + 1) / 5)
        + year_of_century
        + Math.floor(year_of_century / 4)
        + Math.floor(century / 4)
        + 5 * century) % 7;
    return (weekday + 5) % 7;
}

async function get_all_enties(month, year) {
    const selected_date = new Date(year, month - 1, 1);
    selected_month = selected_date.getMonth() + 1;
    selected_year = selected_date.getFullYear();

    const table = document.getElementById("calendar_days");
    const month_days = {
        1: 31,
        2: ((selected_year % 4 === 0 && selected_year % 100 !== 0) || selected_year % 400 === 0) ? 29 : 28,
        3: 31,
        4: 30,
        5: 31,
        6: 30,
        7: 31,
        8: 31,
        9: 30,
        10: 31,
        11: 30,
        12: 31
    };
    const days_in_month = month_days[selected_month];
    const starting_day = calculate_date(selected_year, selected_month);
    const cell_count = Math.ceil((starting_day + days_in_month) / 7) * 7;
    table.replaceChildren();
    document.getElementById("month_label").textContent = `${monthNames[selected_month - 1]} ${selected_year}`;

    let day_counter = 0;
    for (let index = 0; index < cell_count; index++) {
        if (day_counter === 0) table.appendChild(document.createElement("tr"));
        const cell = document.createElement("td");
        const day = index - starting_day + 1;
        if (day < 1 || day > days_in_month) {
            cell.className = "empty-day";
        } else {
            const day_string = String(day).padStart(2, "0");
            const date_string = `${selected_year}-${String(selected_month).padStart(2, "0")}-${day_string}`;
            cell.id = `day_${date_string}`;
            cell.className = "calendar-date-cell";
            const now = new Date();
            if (
                now.getFullYear() === selected_year
                && now.getMonth() + 1 === selected_month
                && now.getDate() === day
            ) {
                cell.classList.add("calendar-today");
            }
            const day_number = document.createElement("span");
            day_number.className = "calendar-day-number";
            day_number.textContent = String(day);
            cell.append(day_number);
        }
        table.lastElementChild.appendChild(cell);
        day_counter += 1;
        if (day_counter === 7) day_counter = 0;
    }

    await show_data(selected_month, selected_year);
}

async function get_month_name() {
    try {
        const response = await fetch("/api/current-month", { credentials: "include" });
        if (response.ok) {
            const data = await response.json();
            return [data.month, data.year];
        }
    } catch {
        show_status("Aktueller Monat konnte nicht vom Server geladen werden.");
    }
    const now = new Date();
    return [now.getMonth() + 1, now.getFullYear()];
}

function change_calendar_month(offset) {
    return get_all_enties(selected_month + offset, selected_year);
}

function show_current_month() {
    const now = new Date();
    return get_all_enties(now.getMonth() + 1, now.getFullYear());
}

function update_importance(value) {
    document.getElementById("sliderOutput").value = value;
}

async function initialize_calendar() {
    const [current_month, current_year] = await get_month_name();
    await get_all_enties(current_month, current_year);
}

window.toggle_add = toggle_add;
window.set_data = set_data;
window.change_calendar_month = change_calendar_month;
window.show_current_month = show_current_month;
window.update_importance = update_importance;

document.getElementById("task_form").addEventListener("keydown", (event) => {
    if (event.key === "Escape") toggle_add(false);
});

initialize_calendar();
