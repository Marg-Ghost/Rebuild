async function loadFeatureNavigation() {
    const username = document.getElementById('dashboard-username');

    try {
        const response = await fetch('/api/me', { credentials: 'include' });
        const data = await response.json();
        if (!response.ok) {
            if (response.status === 401) window.location.href = '/login';
            throw new Error(data.detail || 'Benutzer konnte nicht geladen werden.');
        }
        if (username) username.textContent = data.usr || 'Dein Bereich';
    } catch (error) {
        if (error instanceof TypeError && username) {
            username.textContent = 'Dein Bereich';
        }
        console.error('Navigation des Bereichs konnte nicht geladen werden.', error);
    }
}

window.addEventListener('DOMContentLoaded', loadFeatureNavigation);
