const checkupCatalog = { food: [], activity: [] };
const pendingCatalogResolutions = new WeakMap();
const catalogVectorLabels = {
    food: ['Protein (g)', 'Fat (g)', 'Sugar (g)', 'Carbohydrates (g)', 'Fiber (g)', 'Water (g)', 'Macronutrients (g)', 'Micronutrients'],
    activity: ['Energy (kcal/30 min)', 'Cardio', 'Strength', 'Flexibility', 'Coordination', 'Stress relief', 'Joint strain', 'Injury risk']
};

async function loadCheck-inCatalog() {
    const status = document.getElementById('checkup_status');
    const submitButton = document.querySelector('.submit-button');
    try {
        const response = await fetch('/api/checkup/catalog', { credentials: 'include' });
        const data = await response.json();
        if (!response.ok) throw new Error('Could not load reference data.');

        Object.assign(checkupCatalog, data);
        document.querySelectorAll('.catalog-control input[data-kind]').forEach((input) => {
            const menu = input.closest('.entry-row').querySelector('.catalog-options');
            if (!menu.hasAttribute('hidden')) renderCatalogMenu(input);
        });
        if (submitButton && submitButton.dataset.limitReached !== 'true') submitButton.disabled = false;
    } catch (error) {
        if (status) status.textContent = error.message;
    }
}

function add_note(node_type) {
    const node = document.getElementById(`${node_type}_current`);
    if (!node || !['activity', 'food'].includes(node_type)) return;

    const label = node_type === 'food' ? 'Food or meal' : 'Outdoor activity';
    const placeholder = node_type === 'food' ? 'e.g. breakfast, fruit, pasta' : 'e.g. walking, cycling';
    node.insertAdjacentHTML('beforeend', `
        <div class="entry-row ${node_type}">
            <div class="catalog-control">
                <input type="text" data-kind="${node_type}" aria-label="${label}" aria-autocomplete="list" aria-expanded="false" placeholder="${placeholder}" onfocus="openCatalogMenu(this)" onclick="openCatalogMenu(this)" oninput="updateReferenceValue(this)" onblur="handleReferenceBlur(this)" onkeydown="handleCatalogKeydown(event, this)">
                <div class="catalog-options" role="listbox" hidden></div>
            </div>
            ${node_type === 'activity' ? '<label class="activity-duration">Duration (minutes)<input type="number" data-activity-duration min="1" max="1440" value="30" inputmode="numeric"></label>' : ''}
            <button class="icon-button" type="button" aria-label="Remove entry" onclick="remove_note(this)">&times;</button>
            <output class="reference-preview" aria-live="polite"></output>
        </div>`);
    node.lastElementChild.querySelector('input').focus();
}

function remove_note(button) {
    const row = button.closest('.entry-row');
    const list = row?.parentElement;
    if (!row || !list) return;

    if (list.children.length === 1) {
        row.querySelector('input').value = '';
        row.querySelector('input').focus();
        return;
    }

    row.remove();
}

function updateLoginFields() {
    const method = document.querySelector('input[name="login_method"]:checked').value;
    const usernameInput = document.getElementById('username_input');
    const emailInput = document.getElementById('email_input');

    usernameInput.hidden = method !== 'username';
    emailInput.hidden = method !== 'email';
    usernameInput.required = method === 'username';
    emailInput.required = method === 'email';
}

async function registerUser() {
    const username = document.getElementById('usr_input_reg').value.trim();
    const email = document.getElementById('email_input_reg').value.trim();
    const phone = document.getElementById('phone_input_reg')?.value.trim() || '';
    const password = document.getElementById('pwd_input_reg').value;

    if (!email) {
        alert('Please enter an email address.');
        return;
    }

    const response = await fetch('/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, email, phone, password })
    });

    const result = await response.json();
    if (!response.ok) {
        alert('Sign-up failed.');
        return;
    }

    alert('Account created successfully.');
    load_r_or_l('login');
}

async function loadCurrentUser() {
    const response = await fetch('/api/me', {
        credentials: 'include'
    });

    const data = await response.json();
    if (!response.ok) {
        console.log(data.detail || 'Not signed in');
        return;
    }

    document.getElementById('login_status').textContent = `Signed in as: ${data.usr}`;
}

async function send_data() {
    const food_div = document.getElementsByClassName('food');
    const activity_div = document.getElementsByClassName('activity');
    const list_food = [];
    const list_activity = [];
    const sleepInput = document.getElementById('sleep_input');
    const submitButton = document.querySelector('.submit-button');
    const status = document.getElementById('checkup_status');

    if (!sleepInput?.value) {
        sleepInput?.focus();
        return;
    }

    const lateSleepInput = document.getElementById('sleep_count_input');
    const lateSleepCount = Number(lateSleepInput.value);
    if (!lateSleepInput.value.trim() || !Number.isInteger(lateSleepCount) || lateSleepCount < 0 || lateSleepCount > 7) {
        status.textContent = 'Enter a whole number from 0 to 7 nights.';
        lateSleepInput.focus();
        return;
    }

    submitButton.disabled = true;
    if (status) status.textContent = 'Checking entries and reference values ...';

    try {
        const referenceInputs = Array.from(document.querySelectorAll('.entry-row input[data-kind]'));
        for (const input of referenceInputs) {
            if (!input.value.trim()) continue;
            const pending = pendingCatalogResolutions.get(input);
            if (pending) await pending;
            else await resolveReferenceValue(input);
            if (!input.dataset.catalogName) {
                throw new Error(input.dataset.resolveError || 'Could not match an entry to the catalog.');
            }
        }
    } catch (error) {
        if (status) status.textContent = error.message;
        submitButton.disabled = false;
        return;
    }

    Array.from(food_div).forEach((e) => {
        const input = e.querySelector('input');
        const value = input?.dataset.catalogName || input?.value || e.innerText.trim();
        if (value) list_food.push(value);
    });

    Array.from(activity_div).forEach((e) => {
        const input = e.querySelector('input');
        const value = input?.dataset.catalogName || input?.value || e.innerText.trim();
        if (value) list_activity.push(value);
    });

    const pass_payload = {
        sleep_hours: Number(sleepInput.value),
        sleep_count: lateSleepCount,
        food: list_food,
        activity: list_activity
    };

    submitButton.disabled = true;
    if (status) status.textContent = 'Saving your entries ...';

    try {
        const response = await fetch('/api/checkup_data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(pass_payload)
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error('Could not save.');
        }

        if (status) status.textContent = 'Saved. Welcome to Rebuild.';
        window.location.href = '/index.html';
    } catch (error) {
        if (status) status.textContent = error.message;
        submitButton.disabled = false;
    }
}

// login and register page functions
function toggleAccordion(sectionId) {
    const login = document.getElementById('login');
    const register = document.getElementById('register');
    const showRegister = sectionId === 'register';

    login.hidden = showRegister;
    register.hidden = !showRegister;
}

function load_r_or_l(type_return) {
    toggleAccordion(type_return);
}

async function loginUser() {
    const method = document.querySelector('input[name="login_method"]:checked').value;
    const usernameInput = document.getElementById('username_input');
    const emailInput = document.getElementById('email_input');
    const identifierInput = method === 'username' ? usernameInput : emailInput;
    const identifier = identifierInput.value.trim();

    if (!identifier) {
        alert('Please enter a username or email address.');
        return;
    }

    try {
        const response = await fetch('/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ method, identifier, password: document.getElementById('pwd_input').value })
        });

        const result = await response.json();
        if (!response.ok) {
            alert('Sign-in failed.');
            return;
        }

        document.getElementById('login_status').textContent = `Signed in as: ${result.usr}`;
        const checkupResponse = await fetch('/register_checkup', {
            method: 'POST',
            credentials: 'include'
        });
        const checkupResult = await checkupResponse.json();

        if (!checkupResponse.ok) {
            alert('Could not load check-in status.');
            return;
        }

        if (checkupResult.profile === 'empty') {
            window.location.href = '/register_info';
        } else if (checkupResult.db === 'empty') {
            window.location.href = '/checkup_first';
        } else if (checkupResult.sleep_status !== 'complete') {
            window.location.href = '/sleep-checkup';
        } else {
            window.location.href = '/home';
        }
    } catch (error) {
        alert('Server is unavailable.');
        console.error(error);
    }
}

async function saveProfile() {
    const status = document.getElementById('profile_status');
    const sickness = Array.from(document.querySelectorAll('input[name="sickness"]:checked'))
        .map((input) => input.value);

    status.textContent = 'Saving your entries ...';
    try {
        const response = await fetch('/register_info', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                age: document.getElementById('age_input').value,
                hobbies: document.getElementById('hobbies_input').value,
                job: document.getElementById('job_input').value,
                sickness,
                current_problems: document.getElementById('current_problems_input').value,
                primary_fears: document.getElementById('primary_fears_input').value
            })
        });
        const result = await response.json();
        if (!response.ok) {
            throw new Error('Could not save.');
        }
        window.location.href = '/checkup_first';
    } catch (error) {
        status.textContent = error.message;
    }
}

function confirm_register() {
    send_data();
}

window.addEventListener('DOMContentLoaded', () => {
    if (document.querySelector('.catalog-control input[data-kind]')) {
        loadCheck-inCatalog();
        loadDailyCheck-inSummary();
    }
    if (document.getElementById('sleep_checkup_status')) loadSleepCheck-inState();
});

function normalizeCatalogName(name) {
    return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('en');
}

function closeCatalogMenu(input) {
    const menu = input.closest('.entry-row').querySelector('.catalog-options');
    menu.setAttribute('hidden', '');
    input.setAttribute('aria-expanded', 'false');
}

function selectCatalogItem(input, item) {
    input.value = item.name;
    input.dataset.catalogName = item.name;
    input.dataset.resolveError = '';
    input.dataset.queryVersion = String(Number(input.dataset.queryVersion || 0) + 1);
    pendingCatalogResolutions.delete(input);
    showReferenceValue(input, item, 'DB');
    closeCatalogMenu(input);
    if (document.activeElement !== input) {
        input.dataset.suppressCatalogOpen = 'true';
        input.focus();
    } else {
        delete input.dataset.suppressCatalogOpen;
    }
}

function renderCatalogMenu(input) {
    const kind = input.dataset.kind;
    const menu = input.closest('.entry-row').querySelector('.catalog-options');
    const query = normalizeCatalogName(input.value);
    const matches = checkupCatalog[kind].filter((item) =>
        normalizeCatalogName(item.name).includes(query)
    );

    menu.replaceChildren();
    if (matches.length === 0) {
        const emptyOption = document.createElement('div');
        emptyOption.className = 'catalog-empty';
        emptyOption.textContent = 'No catalog matches. Ollama will be asked when you leave this field.';
        menu.appendChild(emptyOption);
    } else {
        for (const item of matches) {
            const option = document.createElement('button');
            option.type = 'button';
            option.className = 'catalog-option';
            option.setAttribute('role', 'option');
            option.textContent = `${item.name} (${item.category})`;
            option.addEventListener('pointerdown', (event) => {
                event.preventDefault();
                selectCatalogItem(input, item);
            });
            option.addEventListener('click', () => selectCatalogItem(input, item));
            option.addEventListener('keydown', (event) => {
                if (event.key === 'Escape') {
                    event.preventDefault();
                    closeCatalogMenu(input);
                    input.focus();
                    return;
                }
                if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
                event.preventDefault();
                const options = Array.from(menu.querySelectorAll('.catalog-option'));
                const nextIndex = options.indexOf(option) + (event.key === 'ArrowDown' ? 1 : -1);
                if (options[nextIndex]) options[nextIndex].focus();
                else if (event.key === 'ArrowUp') input.focus();
            });
            menu.appendChild(option);
        }
    }

    menu.removeAttribute('hidden');
    input.setAttribute('aria-expanded', 'true');
}

function openCatalogMenu(input) {
    if (input.dataset.suppressCatalogOpen === 'true') {
        delete input.dataset.suppressCatalogOpen;
        return;
    }
    renderCatalogMenu(input);
}

function handleCatalogKeydown(event, input) {
    const menu = input.closest('.entry-row').querySelector('.catalog-options');
    if (event.key === 'Escape') {
        closeCatalogMenu(input);
        return;
    }
    if (event.key !== 'ArrowDown') return;

    event.preventDefault();
    if (menu.hasAttribute('hidden')) renderCatalogMenu(input);
    menu.querySelector('.catalog-option')?.focus();
}

function updateReferenceValue(input) {
    const kind = input.dataset.kind;
    const query = input.value.trim();
    const preview = input.closest('.entry-row').querySelector('.reference-preview');
    input.dataset.catalogName = '';
    input.dataset.resolveError = '';
    input.dataset.queryVersion = String(Number(input.dataset.queryVersion || 0) + 1);
    pendingCatalogResolutions.delete(input);

    if (!query) {
        preview.textContent = '';
        renderCatalogMenu(input);
        return;
    }

    const normalizedQuery = normalizeCatalogName(query);
    const item = checkupCatalog[kind].find((entry) => normalizeCatalogName(entry.name) === normalizedQuery);
    if (!item) {
        preview.textContent = '';
        renderCatalogMenu(input);
        return;
    }

    input.dataset.catalogName = item.name;
    showReferenceValue(input, item, 'DB');
    renderCatalogMenu(input);
}

function showReferenceValue(input, item, source) {
    const prefix = source === 'ollama' ? `Ollama match: ${item.name}. ` : '';
    input.closest('.entry-row').querySelector('.reference-preview').textContent =
        `${prefix}Catalog (${item.category}) | Score: ${Number(item.score).toLocaleString('en-GB')}`;
}

async function resolveReferenceValue(input) {
    const kind = input.dataset.kind;
    const query = input.value.trim();
    const queryVersion = input.dataset.queryVersion;
    if (!query) return;
    if (input.dataset.catalogName) return;

    const normalizedQuery = normalizeCatalogName(query);
    const exactItem = checkupCatalog[kind].find((entry) => normalizeCatalogName(entry.name) === normalizedQuery);
    if (exactItem) {
        input.dataset.catalogName = exactItem.name;
        showReferenceValue(input, exactItem, 'DB');
        return;
    }

    const response = await fetch('/api/checkup/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ kind, query })
    });
    const data = await response.json();
    if (!response.ok) throw new Error('No matching catalog entry found.');
    if (input.dataset.queryVersion !== queryVersion || input.value.trim() !== query) return;

    input.value = data.item.name;
    input.dataset.catalogName = data.item.name;
    input.dataset.resolveError = '';
    showReferenceValue(input, data.item, data.match_type);
}

function handleReferenceBlur(input) {
    window.setTimeout(() => {
        const row = input.closest('.entry-row');
        if (row.contains(document.activeElement)) return;
        closeCatalogMenu(input);
        const resolution = resolveReferenceValue(input).catch((error) => {
            input.dataset.resolveError = error.message;
            row.querySelector('.reference-preview').textContent = error.message;
        });
        pendingCatalogResolutions.set(input, resolution);
    }, 0);
}

async function resolveAllReferenceInputs() {
    const inputs = Array.from(document.querySelectorAll('.entry-row input[data-kind]'));
    for (const input of inputs) {
        if (!input.value.trim()) continue;
        const pending = pendingCatalogResolutions.get(input);
        if (pending) await pending;
        else await resolveReferenceValue(input);
        if (!input.dataset.catalogName) {
            throw new Error(input.dataset.resolveError || 'Could not match an entry to the catalog.');
        }
    }
}

async function loadDailyCheck-inSummary() {
    const dateElement = document.getElementById('checkup_date');
    if (!dateElement) return;

    const response = await fetch('/api/daily-checkup/status', { credentials: 'include' });
    const data = await response.json();
    if (!response.ok) throw new Error('Could not load daily values.');
    dateElement.textContent = data.daily.date;
    document.getElementById('food_total').textContent = data.daily.food_score ?? '-';
    document.getElementById('activity_total').textContent = data.daily.activity_score ?? '-';
    const completed = Array.isArray(data.checkups) ? data.checkups.length : 0;
    const checkupNumber = document.getElementById('checkup-number');
    const submitButton = document.querySelector('.submit-button');
    if (checkupNumber) checkupNumber.textContent = String(Math.min(completed + 1, 5));
    if (submitButton && completed >= 5) {
        submitButton.dataset.limitReached = 'true';
        submitButton.disabled = true;
        submitButton.textContent = 'All five check-ins complete';
        document.getElementById('checkup_status').textContent = 'You have already completed all five check-ins today.';
    }
}

async function send_daily_checkup() {
    const status = document.getElementById('checkup_status');
    const submitButton = document.querySelector('.submit-button');
    submitButton.disabled = true;
    if (status) status.textContent = 'Checking food and activity entries ...';

    try {
        const food = Array.from(document.querySelectorAll('#food_current input[data-kind="food"]'))
            .map((input) => input.dataset.catalogName || input.value.trim())
            .filter(Boolean);
        const activity = Array.from(document.querySelectorAll('#activity_current input[data-kind="activity"]'))
            .filter((input) => input.dataset.catalogName || input.value.trim())
            .map((input) => {
                const duration = Number(input.closest('.entry-row').querySelector('[data-activity-duration]')?.value);
                if (!Number.isInteger(duration) || duration < 1 || duration > 1440) {
                    throw new Error('Enter a duration from 1 to 1,440 minutes for each activity.');
                }
                return { name: input.dataset.catalogName || input.value.trim(), duration_minutes: duration };
            });
        if (activity.reduce((sum, item) => sum + item.duration_minutes, 0) > 1440) {
            throw new Error('Total activity duration cannot exceed 1,440 minutes.');
        }
        const response = await fetch('/api/daily-checkup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ food, activity })
        });
        const data = await response.json();
        if (!response.ok) throw new Error('Could not save the check-in.');

        if (status) status.textContent = `Check-in ${data.checkup_number} of 5 is being processed.`;
        window.location.href = '/index.html';
    } catch (error) {
        if (status) status.textContent = error.message;
        submitButton.disabled = false;
    }
}

async function loadSleepCheck-inState() {
    const status = document.getElementById('sleep_checkup_status');
    try {
        const response = await fetch('/api/sleep-checkup', { credentials: 'include' });
        const data = await response.json();
        if (!response.ok) throw new Error('Could not load sleep status.');
        const weeklySummary = document.getElementById('sleep_week_summary');
        if (weeklySummary) {
            weeklySummary.textContent = `In the past 7 days: ${data.late_nights_last_week}/7 nights after midnight.`;
        }
        if (data.status === 'pending') {
            status.textContent = 'This check-in remains open. Enter your sleep hours once you have slept.';
        }
    } catch (error) {
        status.textContent = error.message;
    }
}

async function submitSleepCheck-in(action) {
    const status = document.getElementById('sleep_checkup_status');
    const payload = { action };
    if (action === 'slept') {
        const hours = document.getElementById('sleep_hours').value;
        const startTime = document.getElementById('sleep_start_time').value;
        if (!hours || !startTime) {
            status.textContent = 'Enter your sleep hours and bedtime.';
            return;
        }
        payload.sleep_hours = Number(hours);
        payload.sleep_start_time = startTime;
    }

    try {
        const response = await fetch('/api/sleep-checkup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (!response.ok) throw new Error('Could not save sleep status.');
        if (action === 'not_slept') {
            status.textContent = 'Saved. Your first check-in remains open until you log your sleep.';
            return;
        }
        window.location.href = '/checkup';
    } catch (error) {
        status.textContent = error.message;
    }
}

Object.assign(window, {
    openCatalogMenu,
    updateReferenceValue,
    handleCatalogKeydown,
    handleReferenceBlur,
    add_note,
    remove_note,
    confirm_register,
    send_daily_checkup,
    submitSleepCheck-in
});
