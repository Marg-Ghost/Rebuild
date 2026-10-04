
let gespräch = [];

function displayGespräch(messages = gespräch) {
    const gesprächDiv = document.getElementById("gespräch");
    gesprächDiv.replaceChildren();
    messages.forEach((message) => {
        const messageDiv = document.createElement("p");
        messageDiv.className = `message message-${message.role}`;
        messageDiv.textContent = message.content;
        gesprächDiv.appendChild(messageDiv);
    });
    gesprächDiv.scrollTop = gesprächDiv.scrollHeight;
}

async function request() {
    const textInput = document.getElementById("text");
    const sendButton = document.getElementById("sendButton");
    const status = document.getElementById("status");
    const message = textInput.value.trim();
    if (!message || sendButton.disabled) return;

    const previousConversation = [...gespräch];
    const visibleConversation = [...previousConversation, { role: "user", content: message }];
    displayGespräch(visibleConversation);
    sendButton.disabled = true;
    status.textContent = "Opty denkt nach ...";

    try {
        const response = await fetch("/api/llm/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message, conversation: previousConversation }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || "Die Anfrage ist fehlgeschlagen.");

        gespräch = [
            ...visibleConversation,
            { role: "assistant", content: data.answer },
        ];
        textInput.value = "";
        status.textContent = "";
        displayGespräch();
    } catch (error) {
        status.textContent = error.message;
        displayGespräch();
    } finally {
        sendButton.disabled = false;
        textInput.focus();
    }
}

async function clearConversation() {
    const sendButton = document.getElementById("sendButton");
    const clearButton = document.getElementById("clearButton");
    const status = document.getElementById("status");
    if (!gespräch.length || sendButton.disabled || clearButton.disabled) return;

    sendButton.disabled = true;
    clearButton.disabled = true;
    status.textContent = "Gespräch wird als persönliches Memory gespeichert ...";
    try {
        const response = await fetch("/api/llm/conversation/clear", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ conversation: gespräch }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || "Speichern fehlgeschlagen.");
        gespräch = [];
        displayGespräch();
        status.textContent = data.saved ? "Gespräch gespeichert." : "";
    } catch (error) {
        status.textContent = error.message;
    } finally {
        sendButton.disabled = false;
        clearButton.disabled = false;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("sendButton").addEventListener("click", request);
    document.getElementById("clearButton").addEventListener("click", clearConversation);
    document.getElementById("text").addEventListener("keydown", (event) => {
        if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) request();
    });

    const url = new URL(window.location.href);
    const initialMessage = url.searchParams.get("ask");
    if (initialMessage) {
        url.searchParams.delete("ask");
        window.history.replaceState({}, "", url);
        document.getElementById("text").value = initialMessage;
        request();
    }
});