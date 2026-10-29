async function loadFeatureNavigation() {
    const username = document.getElementById('dashboard-username');

    try {
        const response = await fetch('/api/me', { credentials: 'include' });
        const data = await response.json();
        if (!response.ok) {
            if (response.status === 401) window.location.href = '/login';
            throw new Error('Could not load the user.');
        }
        if (username) username.textContent = data.usr || 'Your space';
    } catch (error) {
        if (error instanceof TypeError && username) {
            username.textContent = 'Your space';
        }
        console.error('Could not load the section navigation.', error);
    }
}

window.addEventListener('DOMContentLoaded', loadFeatureNavigation);
