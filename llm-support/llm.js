
let gespräch = [];

function findClosingDelimiter(text, delimiter, start) {
    let index = text.indexOf(delimiter, start);
    while (index !== -1) {
        let backslashes = 0;
        for (let cursor = index - 1; cursor >= 0 && text[cursor] === "\\"; cursor -= 1) {
            backslashes += 1;
        }
        if (backslashes % 2 === 0 && (delimiter === "`" || !/\s/.test(text[index - 1] || ""))) {
            return index;
        }
        index = text.indexOf(delimiter, index + delimiter.length);
    }
    return -1;
}

function parseInlineMarkdown(text) {
    const delimiters = [
        { marker: "**", style: "strong" },
        { marker: "__", style: "strong" },
        { marker: "*", style: "em" },
        { marker: "_", style: "em" },
        { marker: "`", style: "code" },
    ];
    const segments = [];
    const open = [];
    let buffer = "";

    function flush() {
        if (!buffer) return;
        segments.push({
            type: "text",
            text: buffer,
            styles: open.map((delimiter) => delimiter.style),
        });
        buffer = "";
    }

    for (let index = 0; index < text.length;) {
        const delimiter = delimiters.find((candidate) => text.startsWith(candidate.marker, index));
        if (!delimiter) {
            buffer += text[index];
            index += 1;
            continue;
        }

        const top = open[open.length - 1];
        if (top && top.marker === delimiter.marker) {
            const previous = text[index - 1] || "";
            if (delimiter.marker === "`" || !/\s/.test(previous)) {
                flush();
                open.pop();
                index += delimiter.marker.length;
                continue;
            }
        } else if (
            !open.some((item) => item.marker === delimiter.marker)
            && (!open.length || open[open.length - 1].marker !== "`" || delimiter.marker === "`")
        ) {
            const next = text[index + delimiter.marker.length] || "";
            const closingIndex = findClosingDelimiter(
                text,
                delimiter.marker,
                index + delimiter.marker.length,
            );
            if (
                closingIndex !== -1
                && (delimiter.marker === "`" || !/\s/.test(next))
                && (!open.length || open[open.length - 1].marker !== "`" || delimiter.marker === "`")
            ) {
                flush();
                open.push(delimiter);
                index += delimiter.marker.length;
                continue;
            }
        }

        buffer += delimiter.marker;
        index += delimiter.marker.length;
    }

    flush();
    return segments;
}

function startsMarkdownBlock(line) {
    return /^\s{0,3}(?:#{1,3}\s+|>\s?|[-+*]\s+|\d+[.)]\s+)/.test(line);
}

function parseAssistantMarkdown(content) {
    const lines = String(content ?? "").split(/\r?\n/);
    const blocks = [];

    for (let index = 0; index < lines.length;) {
        const line = lines[index];
        if (!line.trim()) {
            index += 1;
            continue;
        }

        const heading = line.match(/^\s{0,3}(#{1,3})\s+(.+?)\s*#*\s*$/);
        if (heading) {
            blocks.push({
                type: "heading",
                level: heading[1].length,
                content: parseInlineMarkdown(heading[2]),
            });
            index += 1;
            continue;
        }

        const quote = line.match(/^\s{0,3}>\s?(.*)$/);
        if (quote) {
            const quotedLines = [];
            while (index < lines.length) {
                const quotedLine = lines[index].match(/^\s{0,3}>\s?(.*)$/);
                if (!quotedLine) break;
                quotedLines.push(quotedLine[1]);
                index += 1;
            }
            blocks.push({ type: "quote", content: parseInlineMarkdown(quotedLines.join("\n")) });
            continue;
        }

        const listItem = line.match(/^\s{0,3}([-+*]|\d+[.)])\s+(.*)$/);
        if (listItem) {
            const ordered = /^\d/.test(listItem[1]);
            const items = [];
            while (index < lines.length) {
                const item = lines[index].match(/^\s{0,3}([-+*]|\d+[.)])\s+(.*)$/);
                if (!item || /^\d/.test(item[1]) !== ordered) break;
                items.push(parseInlineMarkdown(item[2]));
                index += 1;
            }
            blocks.push({ type: "list", ordered, items });
            continue;
        }

        const paragraph = [line];
        index += 1;
        while (index < lines.length && lines[index].trim() && !startsMarkdownBlock(lines[index])) {
            paragraph.push(lines[index]);
            index += 1;
        }
        blocks.push({ type: "paragraph", content: parseInlineMarkdown(paragraph.join("\n")) });
    }

    return blocks;
}

function appendInlineMarkdown(parent, segments) {
    const elements = {
        strong: "strong",
        em: "em",
        code: "code",
    };

    segments.forEach((segment) => {
        let target = parent;
        segment.styles.forEach((style) => {
            const element = document.createElement(elements[style]);
            target.appendChild(element);
            target = element;
        });
        target.appendChild(document.createTextNode(segment.text));
    });
}

function renderAssistantMessage(parent, content) {
    parseAssistantMarkdown(content).forEach((block) => {
        let element;
        if (block.type === "heading") {
            element = document.createElement(block.level === 1 ? "h3" : "h4");
            appendInlineMarkdown(element, block.content);
        } else if (block.type === "quote") {
            element = document.createElement("blockquote");
            appendInlineMarkdown(element, block.content);
        } else if (block.type === "list") {
            element = document.createElement(block.ordered ? "ol" : "ul");
            block.items.forEach((item) => {
                const listItem = document.createElement("li");
                appendInlineMarkdown(listItem, item);
                element.appendChild(listItem);
            });
        } else {
            element = document.createElement("p");
            appendInlineMarkdown(element, block.content);
        }
        parent.appendChild(element);
    });
}

function displayGespräch(messages = gespräch) {
    const gesprächDiv = document.getElementById("gespräch");
    const emptyState = document.getElementById("assistant-empty");
    emptyState.hidden = messages.length > 0;
    gesprächDiv.hidden = messages.length === 0;
    gesprächDiv.replaceChildren();
    messages.forEach((message) => {
        const messageDiv = document.createElement("div");
        messageDiv.className = `message message-${message.role}`;
        if (message.role === "assistant") {
            renderAssistantMessage(messageDiv, message.content);
        } else {
            messageDiv.textContent = message.content;
        }
        gesprächDiv.appendChild(messageDiv);
    });
    gesprächDiv.scrollTop = gesprächDiv.scrollHeight;
    document.getElementById("clearButton").disabled = messages.length === 0;
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
    status.textContent = "Opty is thinking ...";

    try {
        const response = await fetch("/api/llm/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message, conversation: previousConversation }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error("The request failed.");

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
        document.getElementById("clearButton").disabled = gespräch.length === 0;
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
    status.textContent = "Saving this conversation as a personal memory …";
    try {
        const response = await fetch("/api/llm/conversation/clear", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ conversation: gespräch }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error("Could not save.");
        gespräch = [];
        displayGespräch();
        status.textContent = data.saved ? "Conversation saved." : "";
    } catch (error) {
        status.textContent = error.message;
    } finally {
        sendButton.disabled = false;
        clearButton.disabled = gespräch.length === 0;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("sendButton").addEventListener("click", request);
    document.getElementById("clearButton").addEventListener("click", clearConversation);
    document.getElementById("text").addEventListener("keydown", (event) => {
        if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) request();
    });
    document.querySelectorAll("[data-prompt]").forEach((button) => {
        button.addEventListener("click", () => {
            document.getElementById("text").value = button.dataset.prompt;
            request();
        });
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