(() => {
    const STORAGE_KEY = 'rebuild-browser-reminder-session';
    const INTERVAL_MS = 2 * 60 * 60 * 1000;
    const SESSION_MS = 10 * 60 * 60 * 1000;
    const userChip = document.querySelector('.user-chip');
    if (!userChip) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'browser-reminder-toggle';
    button.textContent = 'Enable reminders';
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
        button.textContent = active ? 'Erinnerungen aktiv ✓' : 'Enable reminders';
        button.title = active
            ? 'Every two hours for up to ten hours. Click to turn off.'
            : 'Every two hours for up to ten hours.';
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
                body: 'Time for a short break or a check-in.',
                icon: '/static/assets/logo.svg',
            });
            session.nextAt = now + INTERVAL_MS;
            saveSession(session);
        }
        refreshButton();
    }

    button.addEventListener('click', async () => {
        if (!('Notification' in window) || !window.isSecureContext) {
            status.textContent = 'Browser reminders are not available here.';
            return;
        }
        if (readSession()?.expiresAt > Date.now()) {
            localStorage.removeItem(STORAGE_KEY);
            status.textContent = 'Browser reminders are turned off.';
            refreshButton();
            return;
        }
        const permission = Notification.permission === 'default'
            ? await Notification.requestPermission()
            : Notification.permission;
        if (permission !== 'granted') {
            status.textContent = 'Allow notifications in your browser settings.';
            return;
        }
        const now = Date.now();
        saveSession({ startedAt: now, nextAt: now + INTERVAL_MS, expiresAt: now + SESSION_MS });
        status.textContent = 'Reminders will appear every two hours for up to ten hours.';
        refreshButton();
    });

    window.setInterval(checkReminder, 30 * 1000);
    window.addEventListener('storage', refreshButton);
    refreshButton();
})();
