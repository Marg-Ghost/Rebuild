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
    status.className = 'browser-reminder-status';
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
        const active = Boolean(
            session
            && session.expiresAt > Date.now()
            && 'Notification' in window
            && Notification.permission === 'granted'
        );
        button.textContent = active ? 'Reminders on ✓' : 'Enable reminders';
        button.title = active
            ? 'Every two hours for up to ten hours. Click to turn off.'
            : 'Every two hours for up to ten hours.';
        button.setAttribute('aria-label', active ? 'Reminders are on' : 'Enable reminders');
        button.setAttribute('aria-pressed', String(active));
    }

    function setStatus(message) {
        status.textContent = message;
        status.hidden = !message;
    }

    function checkReminder() {
        const session = readSession();
        if (!session) return refreshButton();
        const now = Date.now();
        if (session.expiresAt <= now) {
            localStorage.removeItem(STORAGE_KEY);
            setStatus('This reminder session has ended. Enable reminders to start another session.');
            return refreshButton();
        }
        if (!('Notification' in window) || Notification.permission !== 'granted') {
            localStorage.removeItem(STORAGE_KEY);
            setStatus('Reminders stopped because browser notification permission is unavailable.');
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
            setStatus('Reminders require browser notifications and a secure page (HTTPS or localhost).');
            return;
        }
        if (readSession()?.expiresAt > Date.now()) {
            localStorage.removeItem(STORAGE_KEY);
            setStatus('Reminders are turned off.');
            refreshButton();
            return;
        }
        let permission;
        try {
            permission = Notification.permission === 'default'
                ? await Notification.requestPermission()
                : Notification.permission;
        } catch (error) {
            console.error('Could not request browser notification permission.', error);
            setStatus('The browser could not request notification permission. Check your browser settings.');
            return;
        }
        if (permission !== 'granted') {
            setStatus('Reminders are off. Allow notifications for this site in your browser settings.');
            refreshButton();
            return;
        }
        const now = Date.now();
        saveSession({ startedAt: now, nextAt: now + INTERVAL_MS, expiresAt: now + SESSION_MS });
        setStatus('Reminders are on. The first notification will appear in two hours.');
        refreshButton();
    });

    window.setInterval(checkReminder, 30 * 1000);
    window.addEventListener('storage', refreshButton);
    refreshButton();
})();
