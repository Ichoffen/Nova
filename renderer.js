const fs = require('fs');
const path = require('path');

// Путь для хранения данных
const userDataPath = process.env.PORTABLE_EXECUTABLE_DIR || __dirname;
const dataFilePath = path.join(userDataPath, 'nova-data.json');
const settingsFilePath = path.join(userDataPath, 'settings.json');

// Глобальные переменные
let projects = [];
let chatsWithoutProject = [];
let currentChatId = null;
let apiKey = '';
let currentModel = 'claude-sonnet-4-5-20250929';
let maxMessages = 50; // Максимум сообщений для отображения

// Элементы интерфейса
const sidebar = document.querySelector('.sidebar');
const projectsList = document.getElementById('projectsList');
const messagesContainer = document.getElementById('messagesContainer');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const newChatBtn = document.getElementById('newChatBtn');
const newProjectBtn = document.getElementById('newProjectBtn');
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const closeSettings = document.getElementById('closeSettings');
const apiKeyInput = document.getElementById('apiKeyInput');
const saveApiKey = document.getElementById('saveApiKey');
const modelSelect = document.getElementById('modelSelect');
const maxMessagesInput = document.getElementById('maxMessagesInput');

// Инициализация при загрузке
window.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    loadData();
    renderSidebar();
    
    // Если есть чаты - открываем первый
    const firstChat = findFirstChat();
    if (firstChat) {
        switchToChat(firstChat.id);
    }
});

// === РАБОТА С НАСТРОЙКАМИ ===

function loadSettings() {
    try {
        if (fs.existsSync(settingsFilePath)) {
            const data = fs.readFileSync(settingsFilePath, 'utf8');
            const settings = JSON.parse(data);
            apiKey = settings.apiKey || '';
            currentModel = settings.model || 'claude-sonnet-4-5-20250929';
            maxMessages = settings.maxMessages || 50;
            modelSelect.value = currentModel;
            maxMessagesInput.value = maxMessages;
        }
    } catch (error) {
        console.error('Ошибка загрузки настроек:', error);
    }
}

function saveSettings() {
    try {
        const settings = {
            apiKey: apiKey,
            model: currentModel,
            maxMessages: maxMessages
        };
        fs.writeFileSync(settingsFilePath, JSON.stringify(settings, null, 2));
    } catch (error) {
        console.error('Ошибка сохранения настроек:', error);
    }
}

// === РАБОТА С ДАННЫМИ (ПРОЕКТЫ И ЧАТЫ) ===

function loadData() {
    try {
        if (fs.existsSync(dataFilePath)) {
            const data = fs.readFileSync(dataFilePath, 'utf8');
            const parsed = JSON.parse(data);
            projects = parsed.projects || [];
            chatsWithoutProject = parsed.chatsWithoutProject || [];
        } else {
            // Миграция со старого формата (если есть старый chats.json)
            const oldChatsPath = path.join(userDataPath, 'chats.json');
            if (fs.existsSync(oldChatsPath)) {
                const oldData = fs.readFileSync(oldChatsPath, 'utf8');
                chatsWithoutProject = JSON.parse(oldData);
                saveData();
            }
        }
    } catch (error) {
        console.error('Ошибка загрузки данных:', error);
        projects = [];
        chatsWithoutProject = [];
    }
}

function saveData() {
    try {
        const data = {
            projects: projects,
            chatsWithoutProject: chatsWithoutProject
        };
        fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Ошибка сохранения данных:', error);
    }
}

function findFirstChat() {
    if (chatsWithoutProject.length > 0) return chatsWithoutProject[0];
    for (let project of projects) {
        if (project.chats.length > 0) return project.chats[0];
    }
    return null;
}

function findChat(chatId) {
    // Ищем в чатах без проекта
    let chat = chatsWithoutProject.find(c => c.id === chatId);
    if (chat) return chat;
    
    // Ищем в проектах
    for (let project of projects) {
        chat = project.chats.find(c => c.id === chatId);
        if (chat) return chat;
    }
    return null;
}

// === ПРОЕКТЫ ===

function createNewProject() {
    const projectName = prompt('Название проекта:');
    if (!projectName || !projectName.trim()) return;
    
    const newProject = {
        id: Date.now().toString(),
        name: projectName.trim(),
        chats: [],
        expanded: true,
        createdAt: new Date().toISOString()
    };
    
    projects.unshift(newProject);
    saveData();
    renderSidebar();
}

function deleteProject(projectId) {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    
    if (project.chats.length > 0) {
        if (!confirm(`В проекте "${project.name}" есть ${project.chats.length} чатов. Удалить проект и все чаты?`)) {
            return;
        }
    }
    
    projects = projects.filter(p => p.id !== projectId);
    saveData();
    renderSidebar();
    
    // Если удалили проект с текущим чатом
    if (currentChatId && !findChat(currentChatId)) {
        currentChatId = null;
        showWelcomeScreen();
    }
}

function renameProject(projectId) {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    
    const newName = prompt('Новое название проекта:', project.name);
    if (!newName || !newName.trim()) return;
    
    project.name = newName.trim();
    saveData();
    renderSidebar();
}

function toggleProject(projectId) {
    const project = projects.find(p => p.id === projectId);
    if (project) {
        project.expanded = !project.expanded;
        saveData();
        renderSidebar();
    }
}

// === ЧАТЫ ===

function createNewChat(projectId = null) {
    const newChat = {
        id: Date.now().toString(),
        title: 'Новый чат',
        messages: [],
        createdAt: new Date().toISOString()
    };
    
    if (projectId) {
        const project = projects.find(p => p.id === projectId);
        if (project) {
            project.chats.unshift(newChat);
        }
    } else {
        chatsWithoutProject.unshift(newChat);
    }
    
    saveData();
    renderSidebar();
    switchToChat(newChat.id);
}

function deleteChat(chatId) {
    if (!confirm('Удалить этот чат?')) return;
    
    // Удаляем из чатов без проекта
    chatsWithoutProject = chatsWithoutProject.filter(chat => chat.id !== chatId);
    
    // Удаляем из проектов
    projects.forEach(project => {
        project.chats = project.chats.filter(chat => chat.id !== chatId);
    });
    
    saveData();
    renderSidebar();
    
    if (currentChatId === chatId) {
        currentChatId = null;
        showWelcomeScreen();
    }
}

function switchToChat(chatId) {
    currentChatId = chatId;
    renderSidebar();
    renderMessages();
}

function getCurrentChat() {
    return findChat(currentChatId);
}

// === ОТОБРАЖЕНИЕ ===

function renderSidebar() {
    projectsList.innerHTML = '';
    
    // Чаты без проекта
    if (chatsWithoutProject.length > 0) {
        const section = document.createElement('div');
        section.className = 'chats-section';
        
        chatsWithoutProject.forEach(chat => {
            const chatEl = createChatElement(chat);
            section.appendChild(chatEl);
        });
        
        projectsList.appendChild(section);
    }
    
    // Проекты
    projects.forEach(project => {
        const projectEl = createProjectElement(project);
        projectsList.appendChild(projectEl);
    });
}

function createProjectElement(project) {
    const projectDiv = document.createElement('div');
    projectDiv.className = 'project-item';
    
    const header = document.createElement('div');
    header.className = 'project-header';
    
    const toggle = document.createElement('button');
    toggle.className = 'project-toggle';
    toggle.textContent = project.expanded ? '▼' : '▶';
    toggle.onclick = () => toggleProject(project.id);
    
    const name = document.createElement('div');
    name.className = 'project-name';
    name.textContent = project.name;
    name.ondblclick = () => renameProject(project.id);
    
    const actions = document.createElement('div');
    actions.className = 'project-actions';
    
    const addChatBtn = document.createElement('button');
    addChatBtn.className = 'project-action-btn';
    addChatBtn.textContent = '+';
    addChatBtn.title = 'Добавить чат';
    addChatBtn.onclick = (e) => {
        e.stopPropagation();
        createNewChat(project.id);
    };
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'project-action-btn';
    deleteBtn.textContent = '×';
    deleteBtn.title = 'Удалить проект';
    deleteBtn.onclick = (e) => {
        e.stopPropagation();
        deleteProject(project.id);
    };
    
    actions.appendChild(addChatBtn);
    actions.appendChild(deleteBtn);
    
    header.appendChild(toggle);
    header.appendChild(name);
    header.appendChild(actions);
    
    projectDiv.appendChild(header);
    
    // Чаты проекта
    if (project.expanded) {
        const chatsContainer = document.createElement('div');
        chatsContainer.className = 'project-chats';
        
        project.chats.forEach(chat => {
            const chatEl = createChatElement(chat);
            chatsContainer.appendChild(chatEl);
        });
        
        projectDiv.appendChild(chatsContainer);
    }
    
    return projectDiv;
}

function createChatElement(chat) {
    const chatDiv = document.createElement('div');
    chatDiv.className = `chat-item ${chat.id === currentChatId ? 'active' : ''}`;
    
    const title = document.createElement('div');
    title.className = 'chat-item-title';
    title.textContent = chat.title;
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-chat-btn';
    deleteBtn.textContent = '×';
    
    chatDiv.appendChild(title);
    chatDiv.appendChild(deleteBtn);
    
    chatDiv.onclick = (e) => {
        if (!e.target.classList.contains('delete-chat-btn')) {
            switchToChat(chat.id);
        }
    };
    
    deleteBtn.onclick = (e) => {
        e.stopPropagation();
        deleteChat(chat.id);
    };
    
    return chatDiv;
}

function showWelcomeScreen() {
    messagesContainer.innerHTML = `
        <div class="welcome-message">
            <h1>👋 Привет! Я Nova</h1>
            <p>Выбери чат или создай новый</p>
        </div>
    `;
}

function renderMessages() {
    const chat = getCurrentChat();
    
    if (!chat) {
        showWelcomeScreen();
        return;
    }
    
    messagesContainer.innerHTML = '';
    
    // Показываем только последние maxMessages сообщений
    const messagesToShow = chat.messages.slice(-maxMessages);
    
    if (chat.messages.length > maxMessages) {
        const notice = document.createElement('div');
        notice.className = 'messages-notice';
        notice.textContent = `Показаны последние ${maxMessages} из ${chat.messages.length} сообщений`;
        messagesContainer.appendChild(notice);
    }
    
    messagesToShow.forEach(msg => {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${msg.role}`;
        
        const avatar = msg.role === 'user' ? '👤' : '🤖';
        
        messageDiv.innerHTML = `
            <div class="message-avatar">${avatar}</div>
            <div class="message-content">${formatMessage(msg.content)}</div>
        `;
        
        messagesContainer.appendChild(messageDiv);
    });
    
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function formatMessage(text) {
    // Простое форматирование Markdown
    let formatted = escapeHtml(text);
    
    // Блоки кода ```
    formatted = formatted.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
        return `<pre><code class="language-${lang || 'text'}">${code.trim()}</code></pre>`;
    });
    
    // Инлайн код `code`
    formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // Жирный **text**
    formatted = formatted.replace(/\*\*([^\*]+)\*\*/g, '<strong>$1</strong>');
    
    // Курсив *text*
    formatted = formatted.replace(/\*([^\*]+)\*/g, '<em>$1</em>');
    
    // Переносы строк
    formatted = formatted.replace(/\n/g, '<br>');
    
    return formatted;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// === ОТПРАВКА СООБЩЕНИЙ ===

async function sendMessage() {
    const chat = getCurrentChat();
    if (!chat) {
        alert('Выберите или создайте чат');
        return;
    }
    
    if (!apiKey) {
        alert('Введите API ключ в настройках');
        settingsModal.classList.add('active');
        return;
    }
    
    const message = messageInput.value.trim();
    if (!message) return;
    
    chat.messages.push({
        role: 'user',
        content: message
    });
    
    if (chat.messages.length === 1) {
        chat.title = message.substring(0, 50) + (message.length > 50 ? '...' : '');
        renderSidebar();
    }
    
    messageInput.value = '';
    renderMessages();
    
    sendBtn.disabled = true;
    
    try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: currentModel,
                max_tokens: 4096,
                messages: chat.messages
            })
        });
        
        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }
        
        const data = await response.json();
        
        chat.messages.push({
            role: 'assistant',
            content: data.content[0].text
        });
        
        saveData();
        renderMessages();
        
    } catch (error) {
        console.error('Ошибка отправки сообщения:', error);
        alert('Ошибка отправки сообщения. Проверьте API ключ и подключение.');
        chat.messages.pop();
        renderMessages();
    } finally {
        sendBtn.disabled = false;
        messageInput.focus();
    }
}

// === ОБРАБОТЧИКИ СОБЫТИЙ ===

newChatBtn.addEventListener('click', () => createNewChat());
newProjectBtn.addEventListener('click', createNewProject);
sendBtn.addEventListener('click', sendMessage);

messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

messageInput.addEventListener('input', () => {
    messageInput.style.height = 'auto';
    messageInput.style.height = messageInput.scrollHeight + 'px';
});

modelSelect.addEventListener('change', () => {
    currentModel = modelSelect.value;
    saveSettings();
});

maxMessagesInput.addEventListener('change', () => {
    maxMessages = parseInt(maxMessagesInput.value) || 50;
    saveSettings();
    renderMessages();
});

settingsBtn.addEventListener('click', () => {
    apiKeyInput.value = apiKey;
    settingsModal.classList.add('active');
});

closeSettings.addEventListener('click', () => {
    settingsModal.classList.remove('active');
});

saveApiKey.addEventListener('click', () => {
    apiKey = apiKeyInput.value.trim();
    saveSettings();
    settingsModal.classList.remove('active');
    
    if (apiKey) {
        alert('API ключ сохранён!');
    }
});

settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) {
        settingsModal.classList.remove('active');
    }
});
