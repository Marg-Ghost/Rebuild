function add_note(node_type) {
    const node = document.getElementById(`${node_type}_current`);
    if (!node || !['activity', 'food'].includes(node_type)) return;

    const label = node_type === 'food' ? 'Lebensmittel oder Mahlzeit' : 'Aktivität im Freien';
    const placeholder = node_type === 'food' ? 'z. B. Frühstück, Obst, Pasta' : 'z. B. Spaziergang, Radfahren';
    node.insertAdjacentHTML('beforeend', `
        <div class="entry-row ${node_type}">
            <input type="text" aria-label="${label}" placeholder="${placeholder}">
            <button class="icon-button" type="button" aria-label="Eintrag entfernen" onclick="remove_note(this)">&times;</button>
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

    Array.from(food_div).forEach((e) => {
        const value = e.querySelector('input')?.value ?? e.innerText.trim();
        if (value) list_food.push(value);
    });

    Array.from(activity_div).forEach((e) => {
        const value = e.querySelector('input')?.value ?? e.innerText.trim();
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