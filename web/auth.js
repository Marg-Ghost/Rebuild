function updateLoginIdentifierLabel() {
    const method = document.querySelector('input[name="login_method"]:checked').value;
    const identifierLabel = document.getElementById('login-identifier-label');
    const fields = {
        username: ['username_input', 'Username'],
        email: ['email_input', 'E-Mail'],
        phone: ['phone_input', 'Telefonnummer']
    };

    [identifierLabel.htmlFor, identifierLabel.textContent] = fields[method];
}

document.querySelectorAll('.auth-topic').forEach((topic) => {
    const tooltip = topic.querySelector('.auth-tooltip');

    topic.addEventListener('pointerenter', () => {
        tooltip.hidden = false;
    });

    topic.addEventListener('pointerleave', () => {
        if (topic.getAttribute('aria-expanded') !== 'true' && !topic.contains(document.activeElement)) {
            tooltip.hidden = true;
        }
    });

    topic.addEventListener('focusin', () => {
        tooltip.hidden = false;
    });

    topic.addEventListener('focusout', () => {
        if (topic.getAttribute('aria-expanded') !== 'true' && !topic.matches(':hover')) {
            tooltip.hidden = true;
        }
    });

    topic.addEventListener('click', () => {
        const willOpen = topic.getAttribute('aria-expanded') !== 'true';

        document.querySelectorAll('.auth-topic').forEach((otherTopic) => {
            otherTopic.setAttribute('aria-expanded', 'false');
            otherTopic.querySelector('.auth-tooltip').hidden = true;
        });

        topic.setAttribute('aria-expanded', String(willOpen));
        topic.querySelector('.auth-tooltip').hidden = !willOpen;
    });
});

document.addEventListener('click', (event) => {
    if (event.target.closest('.auth-topic')) return;

    document.querySelectorAll('.auth-topic').forEach((topic) => {
        topic.setAttribute('aria-expanded', 'false');
        topic.querySelector('.auth-tooltip').hidden = true;
    });
});

document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;

    document.querySelectorAll('.auth-topic').forEach((topic) => {
        topic.setAttribute('aria-expanded', 'false');
        topic.querySelector('.auth-tooltip').hidden = true;
    });
});
