async function loadDailyFeature() {
    const featureKey = document.body.dataset.feature;
    const valueElement = document.getElementById('feature-value');
    const statusElement = document.getElementById('feature-status');

    try {
        const response = await fetch('/api/daily-features', { credentials: 'include' });
        const data = await response.json();
        if (!response.ok) {
            throw new Error('Could not load daily values');
        }

        const value = data[featureKey];
        valueElement.textContent = value === null
            ? '-'
            : Number(value).toLocaleString('en-GB', { maximumFractionDigits: 2 });
        statusElement.textContent = data.checkup_count
            ? `Average across ${data.checkup_count} check-in(s) today.`
            : 'No check-in data for today yet.';
    } catch (error) {
        valueElement.textContent = '-';
        statusElement.textContent = error.message;
    }
}

window.addEventListener('DOMContentLoaded', loadDailyFeature);
