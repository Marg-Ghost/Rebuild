
async function post_current_data()
{
    //nur die ersten ollama, kalender, etc. kommt alles noch
    const checkup = document.getElementById("checkupwert_today");
    const health = document.getElementById("health_count");
    let data;
    //web req
    try {
        const response = await fetch('/api/get_health_data/index', {
            method: 'GET',
            credentials: 'include'
        });

        data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || 'Gesundheitsdaten konnten nicht geladen werden');
        }

    } catch (error) {
        console.error(error);
        return;
    }
    //manipulate
    checkup.innerText = data[0]+ "/ 10";
    health.innerText = data[1] ;
}

//bei jedem bootup der seite sollte reichen
window.addEventListener('DOMContentLoaded', post_current_data);

const bodyTooltip = document.createElement('p');
bodyTooltip.className = 'body-tooltip';
document.body.appendChild(bodyTooltip);

document.querySelectorAll('.select').forEach((button) => {
    button.addEventListener('mouseenter', () => {
        bodyTooltip.textContent = button.dataset.label;
        bodyTooltip.style.display = 'block';
    });

    button.addEventListener('mousemove', (event) => {
        bodyTooltip.style.left = `${event.clientX}px`;
        bodyTooltip.style.top = `${event.clientY}px`;
    });

    button.addEventListener('mouseleave', () => {
        bodyTooltip.style.display = 'none';
    });
});

