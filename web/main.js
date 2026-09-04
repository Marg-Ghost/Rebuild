function add_note(node_type) {
    if (node_type === 'activity') {
        const node_obj = document.getElementById('activity_current');
        const node_class = 'activity';
        node_obj.insertAdjacentHTML('beforeend', `<div class="${node_class}"><input type="text" /></div>`);
    } else if (node_type === 'food') {
        const node_obj = document.getElementById('food_current');
        const node_class = 'food';
        node_obj.insertAdjacentHTML('beforeend', `<div class="${node_class}"><input type="text" /></div>`);
    }
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

    const response = await fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ method, identifier, password: document.getElementById('pwd_input').value })
    });

    const result = await response.json();
    console.log('login result:', result);

    if (!response.ok) {
        alert(result.detail || 'Login fehlgeschlagen');
        return;
    }

    document.getElementById('login_status').textContent = `Eingeloggt als: ${result.usr}`;
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

    Array.from(food_div).forEach((e) => {
        const value = e.querySelector('input')?.value ?? e.innerText.trim();
        if (value) list_food.push(value);
    });

    Array.from(activity_div).forEach((e) => {
        const value = e.querySelector('input')?.value ?? e.innerText.trim();
        if (value) list_activity.push(value);
    });

    const payload = {
        food: list_food,
        activity: list_activity
    };

    const response = await fetch('/api/checkup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
    });

    const data = await response.json();
    console.log('saved:', data);

    if (!response.ok) {
        alert(data.detail || 'Speichern fehlgeschlagen');
        return;
    }

    alert(`Daten gespeichert für User: ${data.usr}`);
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
