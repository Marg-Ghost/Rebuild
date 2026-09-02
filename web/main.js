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
    const userInput = document.getElementById('usr_input');
    const userId = userInput.value.trim();

    if (!userId) {
        alert('Bitte Benutzer eingeben');
        return;
    }

    const response = await fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ user_id: userId })
    });

    const result = await response.json();
    console.log('login result:', result);

    if (!response.ok) {
        alert(result.detail || 'Login fehlgeschlagen');
        return;
    }

    document.getElementById('login_status').textContent = `Eingeloggt als: ${result.usr}`;
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
