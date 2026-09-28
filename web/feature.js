async function loadDailyFeature() {
    const featureKey = document.body.dataset.feature;
    const valueElement = document.getElementById('feature-value');
    const statusElement = document.getElementById('feature-status');

    try {
        const response = await fetch('/api/daily-features', { credentials: 'include' });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.detail || 'Tageswerte konnten nicht geladen werden');
        }

        const value = data[featureKey];
        valueElement.textContent = value === null
            ? '-'
            : Number(value).toLocaleString('de-DE', { maximumFractionDigits: 2 });
        statusElement.textContent = data.checkup_count
            ? `Durchschnitt aus ${data.checkup_count} Checkup(s) heute.`
            : 'Noch keine Checkup-Daten fuer heute.';
    } catch (error) {
        valueElement.textContent = '-';
        statusElement.textContent = error.message;
    }
}

window.addEventListener('DOMContentLoaded', loadDailyFeature);
