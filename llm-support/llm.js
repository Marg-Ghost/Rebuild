
let gespräch = [];

function addGespräch(message) {
    gespräch.push(message);
}

function request(){
    const text = document.getElementById("text").value;
    let request = //Server.py abfrage ( ncah merge)
    addGespräch(request.json());
    }

function displayGespräch() {
    const gesprächDiv = document.getElementById("gespräch");
    gesprächDiv.innerHTML = "";
    gespräch.forEach((message) => {
        const messageDiv = document.createElement("div");
        messageDiv.textContent = message;
        gesprächDiv.appendChild(messageDiv);
    }
}

addEventListener("DOMContentLoaded", () => {
    const sendButton = document.getElementById("sendButton");
    sendButton.addEventListener("click", request);
}