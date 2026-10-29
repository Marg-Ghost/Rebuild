const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
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
    toggle_button.textContent = should_open ? "Close form" : "Add task";
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

function task_type_label(task_type) {
    const labels = {
        work: "Work",
        leisure: "Leisure",
        health: "Health",
        personal: "Personal",
        other: "Other",
        private: "Personal"
    };
    return labels[task_type] || "Other";
}

async function show_data(month, year) {
    try {
        const response = await fetch(`/api/kalender/get?month=${month}&year=${year}`, {
            credentials: "include"
        });
        const data = await response.json();
        if (!response.ok) throw new Error("Could not load calendar data.");

        if (!Array.isArray(data.entries)) {
            throw new Error("The calendar data has an invalid format.");
        }

        const entriesByDate = new Map();
        for (const entry of data.entries) {
            const entries = entriesByDate.get(entry.task_date) || [];
            entries.push(entry);
            entriesByDate.set(entry.task_date, entries);
        }

        for (const [taskDate, entries] of entriesByDate) {
            const table_cell = document.getElementById(`day_${taskDate}`);
            if (!table_cell) continue;
            const list = document.createElement("div");
            list.className = "calendar-entry-list";
            for (const entry of entries.slice(0, 3)) {
                const item = document.createElement("div");
                item.className = `entry importance-${entry.importance}`;
                if (entry.is_google_event) item.classList.add("entry-google-event");
                const importance = document.createElement("span");
                importance.className = "importance";
                importance.textContent = `!${entry.importance}`;
                const content = document.createElement("span");
                content.className = "entry-content";
                content.textContent = entry.content || "Event";
                const type = document.createElement("span");
                type.className = "task-type";
                type.textContent = task_type_label(entry.task_type);
                item.append(importance, content, type);
                if (entry.task_time) {
                    const time = document.createElement("span");
                    time.className = "task-time";
                    const endTime = entry.task_end_at ? entry.task_end_at.slice(11, 16) : "";
                    const overnight = entry.task_end_at
                        && entry.task_end_at.slice(0, 10) !== entry.task_date;
                    time.textContent = endTime
                        ? `${entry.task_time}–${endTime}${overnight ? " +1d" : ""}`
                        : entry.task_time;
                    item.append(time);
                }
                if (entry.is_google_event) {
                    const source = document.createElement("span");
                    source.className = "entry-source";
                    source.textContent = "Google";
                    item.append(source);
                }
                list.append(item);
            }
            if (entries.length > 3) {
                const more = document.createElement("span");
                more.className = "calendar-more-entries";
                more.textContent = `+${entries.length - 3} more`;
                list.append(more);
            }
            table_cell.append(list);
        }
        show_status("");
    } catch (error) {
        show_status(error.message || "Could not load calendar data.");
    }
}

function open_google_calendar_dialog() {
    const dialog = document.getElementById("google_calendar_dialog");
    document.getElementById("google_calendar_status").textContent = "";
    dialog.showModal();
    document.getElementById("google_ics_url").focus();
}

function close_google_calendar_dialog() {
    document.getElementById("google_calendar_dialog").close();
}

async function connect_google_calendar(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const submitButton = document.getElementById("google_calendar_submit");
    const status = document.getElementById("google_calendar_status");
    submitButton.disabled = true;
    status.textContent = "Fetching the feed and classifying events ...";
    try {
        const response = await fetch("/api/calendar/connect-google", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
                ics_url: document.getElementById("google_ics_url").value.trim()
            })
        });
        const result = await response.json();
        if (!response.ok) {
            throw new Error("Could not connect Google Calendar.");
        }

        close_google_calendar_dialog();
        form.reset();
        await get_all_enties(selected_month, selected_year);
        show_status(`${result.imported_count} Google events synced.`);
    } catch (error) {
        status.textContent = error instanceof Error
            ? error.message
            : "Could not connect Google Calendar.";
    } finally {
        submitButton.disabled = false;
    }
}

async function set_data(event) {
    event.preventDefault();
    if (task_is_submitting) return;
    const date = document.getElementById("date");
    const time = document.getElementById("time");
    const endTime = document.getElementById("end_time");
    const sliderOutput = document.getElementById("sliderOutput");
    const type_select = document.getElementById("type_select");
    const content = document.getElementById("content");
    const submit_button = document.querySelector("#task_form button[type='submit']");

    task_is_submitting = true;
    submit_button.disabled = true;
    show_status("Saving task ...");
    try {
        const response = await fetch("/api/kalender/add", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
                date: date.value,
                time: time.value,
                end_time: endTime.value,
                importance: sliderOutput.value,
                task_type: type_select.value,
                content: content.value
            })
        });
        const result = await response.json();
        if (!response.ok) throw new Error("Could not save task.");

        const task_month = Number(date.value.slice(5, 7));
        const task_year = Number(date.value.slice(0, 4));
        document.getElementById("task_form").reset();
        sliderOutput.value = "1";
        toggle_add(false);
        await get_all_enties(task_month, task_year);
        show_status("Task saved.");
    } catch (error) {
        show_status(error.message || "Could not save task.");
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
        show_status("Could not load the current month from the server.");
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
window.open_google_calendar_dialog = open_google_calendar_dialog;
window.close_google_calendar_dialog = close_google_calendar_dialog;

document.getElementById("task_form").addEventListener("keydown", (event) => {
    if (event.key === "Escape") toggle_add(false);
});

document.getElementById("time").addEventListener("change", (event) => {
    const endInput = document.getElementById("end_time");
    if (!event.currentTarget.value || endInput.value) return;
    const [hours, minutes] = event.currentTarget.value.split(":").map(Number);
    const endMinutes = (hours * 60 + minutes + 60) % (24 * 60);
    endInput.value = `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`;
});

document.getElementById("google_calendar_form").addEventListener(
    "submit",
    connect_google_calendar
);
document.getElementById("google_calendar_dialog").addEventListener("click", (event) => {
    if (event.target === event.currentTarget) close_google_calendar_dialog();
});
document.getElementById("google_calendar_dialog").addEventListener("cancel", () => {
    document.getElementById("google_calendar_status").textContent = "";
});

initialize_calendar();
