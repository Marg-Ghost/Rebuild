(() => {
    const STORAGE_KEY = 'rebuild-browser-reminder-session';
    const INTERVAL_MS = 2 * 60 * 60 * 1000;
    const SESSION_MS = 10 * 60 * 60 * 1000;
    const userChip = document.querySelector('.user-chip');
    if (!userChip) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'browser-reminder-toggle';
    button.textContent = 'Erinnerungen aktivieren';
    button.setAttribute('aria-pressed', 'false');
    const status = document.createElement('span');
    status.className = 'visually-hidden';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    userChip.append(button, status);

    function readSession() {
        try {
            const session = JSON.parse(localStorage.getItem(STORAGE_KEY));
            return session && Number.isFinite(session.expiresAt) && Number.isFinite(session.nextAt)
                ? session : null;
        } catch {
            return null;
        }
    }

    function saveSession(session) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    }

    function refreshButton() {
        const session = readSession();
        const active = Boolean(session && session.expiresAt > Date.now());
        button.textContent = active ? 'Erinnerungen aktiv ✓' : 'Erinnerungen aktivieren';
        button.title = active
            ? 'Alle zwei Stunden, höchstens zehn Stunden. Klicken zum Ausschalten.'
            : 'Alle zwei Stunden für höchstens zehn Stunden.';
        button.setAttribute('aria-pressed', String(active));
    }

    function checkReminder() {
        const session = readSession();
        if (!session) return refreshButton();
        const now = Date.now();
        if (session.expiresAt <= now || !('Notification' in window) || Notification.permission !== 'granted') {
            localStorage.removeItem(STORAGE_KEY);
            return refreshButton();
        }
        if (session.nextAt <= now) {
            new Notification('Rebuild', {
                body: 'Zeit für eine kurze Pause oder einen Check-in.',
                icon: '/static/assets/logo.svg',
            });
            session.nextAt = now + INTERVAL_MS;
            saveSession(session);
        }
        refreshButton();
    }

    button.addEventListener('click', async () => {
        if (!('Notification' in window) || !window.isSecureContext) {
            status.textContent = 'Browser-Erinnerungen sind hier nicht verfügbar.';
            return;
        }
        if (readSession()?.expiresAt > Date.now()) {
            localStorage.removeItem(STORAGE_KEY);
            status.textContent = 'Browser-Erinnerungen sind ausgeschaltet.';
            refreshButton();
            return;
        }
        const permission = Notification.permission === 'default'
            ? await Notification.requestPermission()
            : Notification.permission;
        if (permission !== 'granted') {
            status.textContent = 'Bitte erlaube Benachrichtigungen in den Browsereinstellungen.';
            return;
        }
        const now = Date.now();
        saveSession({ startedAt: now, nextAt: now + INTERVAL_MS, expiresAt: now + SESSION_MS });
        status.textContent = 'Erinnerungen kommen alle zwei Stunden für bis zu zehn Stunden.';
        refreshButton();
    });

    window.setInterval(checkReminder, 30 * 1000);
    window.addEventListener('storage', refreshButton);
    refreshButton();
})();
