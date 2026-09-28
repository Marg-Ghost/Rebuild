const checkupCatalog = { food: [], activity: [] };
const pendingCatalogResolutions = new WeakMap();
const catalogVectorLabels = {
    food: ['Eiweiß (g)', 'Fett (g)', 'Zucker (g)', 'Kohlenhydrate (g)', 'Ballaststoffe (g)', 'Wasser (g)', 'Makronährstoffe (g)', 'Mikronährstoffe'],
    activity: ['Energie (kcal/30 min)', 'Cardio', 'Kraft', 'Beweglichkeit', 'Koordination', 'Stressabbau', 'Gelenkbelastung', 'Verletzungsrisiko']
};

async function loadCheckupCatalog() {
    const status = document.getElementById('checkup_status');
    const submitButton = document.querySelector('.submit-button');
    try {
        const response = await fetch('/api/checkup/catalog', { credentials: 'include' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || 'Referenzdaten konnten nicht geladen werden');

        Object.assign(checkupCatalog, data);
        document.querySelectorAll('.catalog-control input[data-kind]').forEach((input) => {
            const menu = input.closest('.entry-row').querySelector('.catalog-options');
            if (!menu.hasAttribute('hidden')) renderCatalogMenu(input);
        });
        if (submitButton) submitButton.disabled = false;
    } catch (error) {
        if (status) status.textContent = error.message;
    }
}

function add_note(node_type) {
    const node = document.getElementById(`${node_type}_current`);
    if (!node || !['activity', 'food'].includes(node_type)) return;

    const label = node_type === 'food' ? 'Lebensmittel oder Mahlzeit' : 'Aktivität im Freien';
    const placeholder = node_type === 'food' ? 'z. B. Frühstück, Obst, Pasta' : 'z. B. Spaziergang, Radfahren';
    node.insertAdjacentHTML('beforeend', `
        <div class="entry-row ${node_type}">
            <div class="catalog-control">
                <input type="text" data-kind="${node_type}" aria-label="${label}" aria-autocomplete="list" aria-expanded="false" placeholder="${placeholder}" onfocus="openCatalogMenu(this)" onclick="openCatalogMenu(this)" oninput="updateReferenceValue(this)" onblur="handleReferenceBlur(this)" onkeydown="handleCatalogKeydown(event, this)">
                <div class="catalog-options" role="listbox" hidden></div>
            </div>
            <button class="icon-button" type="button" aria-label="Eintrag entfernen" onclick="remove_note(this)">&times;</button>
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
    const phoneInput = document.getElementById('phone_input');

    usernameInput.hidden = method !== 'username';
    emailInput.hidden = method !== 'email';
    phoneInput.hidden = method !== 'phone';
    usernameInput.required = method === 'username';
    emailInput.required = method === 'email';
    phoneInput.required = method === 'phone';
}

async function registerUser() {
    const username = document.getElementById('usr_input_reg').value.trim();
    const email = document.getElementById('email_input_reg').value.trim();
    const phone = document.getElementById('phone_input_reg').value.trim();
    const password = document.getElementById('pwd_input_reg').value;

    if (!email) {
        alert('Bitte eine E-Mail-Adresse eingeben');
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
        alert(result.detail || 'Registrierung fehlgeschlagen');
        return;
    }

    alert('Registrierung erfolgreich');
    load_r_or_l('login');
}

async function loadCurrentUser() {
    const response = await fetch('/api/me', {
        credentials: 'include'
    });

    const data = await response.json();
    if (!response.ok) {
        console.log(data.detail || 'Nicht eingeloggt');
        return;
    }

    document.getElementById('login_status').textContent = `Aktiver User: ${data.usr}`;
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

    submitButton.disabled = true;
    if (status) status.textContent = 'Pruefe Eingaben und Referenzwerte ...';

    try {
        const referenceInputs = Array.from(document.querySelectorAll('.entry-row input[data-kind]'));
        for (const input of referenceInputs) {
            if (!input.value.trim()) continue;
            const pending = pendingCatalogResolutions.get(input);
            if (pending) await pending;
            else await resolveReferenceValue(input);
            if (!input.dataset.catalogName) {
                throw new Error(input.dataset.resolveError || 'Ein Eintrag konnte nicht zugeordnet werden.');
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
        sleep_point: Number(document.getElementById('sleep_point_input').value),
        sleep_count: Number(document.getElementById('sleep_count_input').value),
        food: list_food,
        activity: list_activity
    };

    submitButton.disabled = true;
    if (status) status.textContent = 'Speichere deine Angaben ...';

    try {
        const response = await fetch('/api/checkup_data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(pass_payload)
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || 'Speichern fehlgeschlagen');
        }

        if (status) status.textContent = 'Gespeichert. Willkommen bei Rebuild.';
        window.setTimeout(() => { window.location.href = '/home'; }, 500);
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
    const phoneInput = document.getElementById('phone_input');
    const identifierInput = method === 'username' ? usernameInput : method === 'email' ? emailInput : phoneInput;
    const identifier = identifierInput.value.trim();

    if (!identifier) {
        alert('Bitte einen Identifikator eingeben');
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
            alert(result.detail || 'Login fehlgeschlagen');
            return;
        }

        document.getElementById('login_status').textContent = `Eingeloggt als: ${result.usr}`;
        const checkupResponse = await fetch('/register_checkup', {
            method: 'POST',
            credentials: 'include'
        });
        const checkupResult = await checkupResponse.json();

        if (!checkupResponse.ok) {
            alert(checkupResult.detail || 'Checkup-Status konnte nicht geladen werden');
            return;
        }

        if (checkupResult.profile === 'empty') {
            window.location.href = '/register_info';
        } else if (checkupResult.db === 'empty') {
            window.location.href = '/checkup_first';
        } else {
            window.location.href = '/home';
        }
    } catch (error) {
        alert('Server nicht erreichbar');
        console.error(error);
    }
}

async function saveProfile() {
    const status = document.getElementById('profile_status');
    const sickness = Array.from(document.querySelectorAll('input[name="sickness"]:checked'))
        .map((input) => input.value);

    status.textContent = 'Speichere deine Angaben ...';
    try {
        const response = await fetch('/register_info', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                age: document.getElementById('age_input').value,
                hobbies: document.getElementById('hobbies_input').value,
                job: document.getElementById('job_input').value,
                sickness
            })
        });
        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.detail || 'Speichern fehlgeschlagen');
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
        loadCheckupCatalog();
        loadDailyCheckupSummary();
    }
    if (document.getElementById('sleep_checkup_status')) loadSleepCheckupState();
});

function normalizeCatalogName(name) {
    return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('de');
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
        emptyOption.textContent = 'Keine DB-Treffer. Beim Verlassen wird Ollama gefragt.';
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
    const labels = catalogVectorLabels[input.dataset.kind];
    const values = item.vector.map((value, index) => `${labels[index]}: ${Number(value).toLocaleString('de-DE')}`);
    const prefix = source === 'ollama' ? `Ollama-Zuordnung: ${item.name}. ` : '';
    input.closest('.entry-row').querySelector('.reference-preview').textContent =
        `${prefix}DB (${item.category}) | ${values.join(' | ')} | Score: ${item.score}`;
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
    if (!response.ok) throw new Error(data.detail || 'Kein Referenzeintrag gefunden');
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
            throw new Error(input.dataset.resolveError || 'Ein Eintrag konnte nicht zugeordnet werden.');
        }
    }
}

async function loadDailyCheckupSummary() {
    const dateElement = document.getElementById('checkup_date');
    if (!dateElement) return;

    const response = await fetch('/api/daily-checkup/status', { credentials: 'include' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || 'Tageswerte konnten nicht geladen werden');
    dateElement.textContent = data.daily.date;
    document.getElementById('food_total').textContent = data.daily.food_score ?? '-';
    document.getElementById('activity_total').textContent = data.daily.activity_score ?? '-';
}

async function send_daily_checkup() {
    const status = document.getElementById('checkup_status');
    const submitButton = document.querySelector('.submit-button');
    submitButton.disabled = true;
    if (status) status.textContent = 'Pruefe Food- und Activity-Eintraege ...';

    try {
        await resolveAllReferenceInputs();
        const food = Array.from(document.querySelectorAll('#food_current input[data-kind="food"]'))
            .map((input) => input.dataset.catalogName)
            .filter(Boolean);
        const activity = Array.from(document.querySelectorAll('#activity_current input[data-kind="activity"]'))
            .map((input) => input.dataset.catalogName)
            .filter(Boolean);
        const response = await fetch('/api/daily-checkup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ food, activity })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || 'Checkup konnte nicht gespeichert werden');

        if (status) status.textContent = 'Tages-Checkup gespeichert.';
        window.setTimeout(() => { window.location.href = '/home'; }, 400);
    } catch (error) {
        if (status) status.textContent = error.message;
        submitButton.disabled = false;
    }
}

async function loadSleepCheckupState() {
    const status = document.getElementById('sleep_checkup_status');
    try {
        const response = await fetch('/api/sleep-checkup', { credentials: 'include' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || 'Schlafstatus konnte nicht geladen werden');
        if (data.status === 'pending') {
            status.textContent = 'Der Check-in bleibt offen. Trage die Schlafstunden ein, sobald du geschlafen hast.';
        }
    } catch (error) {
        status.textContent = error.message;
    }
}

async function submitSleepCheckup(action) {
    const status = document.getElementById('sleep_checkup_status');
    const payload = { action };
    if (action === 'slept') {
        const hours = document.getElementById('sleep_hours').value;
        const startTime = document.getElementById('sleep_start_time').value;
        if (!hours || !startTime) {
            status.textContent = 'Bitte Schlafstunden und Einschlafzeit angeben.';
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
        if (!response.ok) throw new Error(data.detail || 'Schlafstatus konnte nicht gespeichert werden');
        if (action === 'not_slept') {
            status.textContent = 'Gespeichert. Der erste Check-in bleibt offen, bis du deinen Schlaf einträgst.';
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
    submitSleepCheckup
});