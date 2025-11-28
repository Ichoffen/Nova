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

// Элементы интерфейса
const chatsList = document.getElementById('chatsList');
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

// Инициализация при загрузке
window.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    loadData();
    renderChatsList();
    
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
            modelSelect.value = currentModel;
        }
    } catch (error) {
        console.error('Ошибка загрузки настроек:', error);
    }
}

function saveSettings() {
    try {
        const settings = {
            apiKey: apiKey,
            model: currentModel
        };
        fs.writeFileSync(settingsFilePath, JSON.stringify(settings, null, 2));
    } catch (error) {
        console.error('Ошибка сохранения настроек:', error);
    }
}

// === РАБОТА С ДАННЫМИ ===

function loadData() {
    try {
        if (fs.existsSync(dataFilePath)) {
            const data = fs.readFileSync(dataFilePath, 'utf8');
            const parsed = JSON.parse(data);
            projects = parsed.projects || [];
            chatsWithoutProject = parsed.chatsWithoutProject || [];
        } else {
            // Миграция со старого формата
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
        if (project.chats && project.chats.length > 0) return project.chats[0];
    }
    return null;
}

function findChat(chatId) {
    let chat = chatsWithoutProject.find(c => c.id === chatId);
    if (chat) return chat;
    
    for (let project of projects) {
        if (project.chats) {
            chat = project.chats.find(c => c.id === chatId);
            if (chat) return chat;
        }
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
    renderChatsList();
}

function toggleProject(projectId) {
    const project = projects.find(p => p.id === projectId);
    if (project) {
        project.expanded = !project.expanded;
        saveData();
        renderChatsList();
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
            if (!project.chats) project.chats = [];
            project.chats.unshift(newChat);
        }
    } else {
        chatsWithoutProject.unshift(newChat);
    }
    
    saveData();
    renderChatsList();
    switchToChat(newChat.id);
    
    setTimeout(() => messageInput.focus(), 100);
}

function deleteChat(chatId) {
    if (!confirm('Удалить этот чат?')) return;
    
    chatsWithoutProject = chatsWithoutProject.filter(chat => chat.id !== chatId);
    
    projects.forEach(project => {
        if (project.chats) {
            project.chats = project.chats.filter(chat => chat.id !== chatId);
        }
    });
    
    saveData();
    renderChatsList();
    
    if (currentChatId === chatId) {
        currentChatId = null;
        showWelcomeScreen();
    }
}

function moveChatToProject(chatId, targetProjectId) {
    // Находим чат и удаляем его откуда он был
    let chat = null;
    
    // Ищем в чатах без проекта
    const indexWithout = chatsWithoutProject.findIndex(c => c.id === chatId);
    if (indexWithout !== -1) {
        chat = chatsWithoutProject.splice(indexWithout, 1)[0];
    }
    
    // Ищем в проектах
    if (!chat) {
        for (let project of projects) {
            if (project.chats) {
                const index = project.chats.findIndex(c => c.id === chatId);
                if (index !== -1) {
                    chat = project.chats.splice(index, 1)[0];
                    break;
                }
            }
        }
    }
    
    if (!chat) return;
    
    // Добавляем в новое место
    if (targetProjectId === 'no-project') {
        chatsWithoutProject.unshift(chat);
    } else {
        const targetProject = projects.find(p => p.id === targetProjectId);
        if (targetProject) {
            if (!targetProject.chats) targetProject.chats = [];
            targetProject.chats.unshift(chat);
        }
    }
    
    saveData();
    renderChatsList();
}

function showMoveMenu(chatId, buttonElement) {
    // Удаляем старые меню
    document.querySelectorAll('.move-menu').forEach(m => m.remove());
    
    const menu = document.createElement('div');
    menu.className = 'move-menu';
    
    // Опция "Без проекта"
    const noProjectOption = document.createElement('div');
    noProjectOption.className = 'move-menu-item';
    noProjectOption.textContent = '📄 Без проекта';
    noProjectOption.onclick = () => {
        moveChatToProject(chatId, 'no-project');
        menu.remove();
    };
    menu.appendChild(noProjectOption);
    
    // Разделитель
    if (projects.length > 0) {
        const divider = document.createElement('div');
        divider.className = 'move-menu-divider';
        menu.appendChild(divider);
    }
    
    // Опции проектов
    projects.forEach(project => {
        const projectOption = document.createElement('div');
        projectOption.className = 'move-menu-item';
        projectOption.textContent = `📁 ${project.name}`;
        projectOption.onclick = () => {
            moveChatToProject(chatId, project.id);
            menu.remove();
        };
        menu.appendChild(projectOption);
    });
    
    // Позиционирование меню
    const rect = buttonElement.getBoundingClientRect();
    menu.style.position = 'fixed';
    menu.style.top = rect.bottom + 5 + 'px';
    menu.style.left = rect.left + 'px';
    
    document.body.appendChild(menu);
    
    // Закрытие при клике вне меню
    setTimeout(() => {
        document.addEventListener('click', function closeMenu(e) {
            if (!menu.contains(e.target) && e.target !== buttonElement) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        });
    }, 0);
}

function switchToChat(chatId) {
    currentChatId = chatId;
    renderChatsList();
    renderMessages();
    
    setTimeout(() => messageInput.focus(), 100);
}

function getCurrentChat() {
    return findChat(currentChatId);
}

// === ОТОБРАЖЕНИЕ ===

function renderChatsList() {
    chatsList.innerHTML = '';
    
    // Чаты без проекта
    if (chatsWithoutProject.length > 0) {
        const section = document.createElement('div');
        section.className = 'chats-section';
        
        chatsWithoutProject.forEach(chat => {
            const chatEl = createChatElement(chat);
            section.appendChild(chatEl);
        });
        
        chatsList.appendChild(section);
    }
    
    // Проекты
    projects.forEach(project => {
        const projectEl = createProjectElement(project);
        chatsList.appendChild(projectEl);
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
    
    const addChatBtn = document.createElement('button');
    addChatBtn.className = 'project-add-btn';
    addChatBtn.textContent = '+';
    addChatBtn.title = 'Добавить чат';
    addChatBtn.onclick = (e) => {
        e.stopPropagation();
        createNewChat(project.id);
    };
    
    header.appendChild(toggle);
    header.appendChild(name);
    header.appendChild(addChatBtn);
    
    projectDiv.appendChild(header);
    
    // Чаты проекта
    if (project.expanded && project.chats && project.chats.length > 0) {
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
    
    const actions = document.createElement('div');
    actions.className = 'chat-actions';
    
    const moveBtn = document.createElement('button');
    moveBtn.className = 'chat-action-btn';
    moveBtn.textContent = '📁';
    moveBtn.title = 'Переместить в проект';
    moveBtn.onclick = (e) => {
        e.stopPropagation();
        showMoveMenu(chat.id, moveBtn);
    };
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'chat-action-btn delete-btn';
    deleteBtn.textContent = '×';
    deleteBtn.title = 'Удалить чат';
    deleteBtn.onclick = (e) => {
        e.stopPropagation();
        deleteChat(chat.id);
    };
    
    actions.appendChild(moveBtn);
    actions.appendChild(deleteBtn);
    
    chatDiv.appendChild(title);
    chatDiv.appendChild(actions);
    
    chatDiv.onclick = () => switchToChat(chat.id);
    
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
    
    chat.messages.forEach(msg => {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${msg.role}`;
        
        const avatar = msg.role === 'user' ? '👤' : '🤖';
        
        messageDiv.innerHTML = `
            <div class="message-avatar">${avatar}</div>
            <div class="message-content">${escapeHtml(msg.content)}</div>
        `;
        
        messagesContainer.appendChild(messageDiv);
    });
    
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML.replace(/\n/g, '<br>');
}

// === ОТПРАВКА СООБЩЕНИЙ ===

async function sendMessage() {
    if (!currentChatId) {
        createNewChat();
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    const chat = getCurrentChat();
    if (!chat) {
        alert('Ошибка создания чата');
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
        renderChatsList();
    }
    
    messageInput.value = '';
    renderMessages();
    
    sendBtn.disabled = true;
    messageInput.disabled = true;
    
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
        console.error('Ошибка:', error);
        alert('Ошибка отправки сообщения. Проверьте API ключ.');
        chat.messages.pop();
        renderMessages();
    } finally {
        sendBtn.disabled = false;
        messageInput.disabled = false;
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

settingsBtn.addEventListener('click', () => {
    apiKeyInput.value = apiKey;
    settingsModal.classList.add('active');
});

closeSettings.addEventListener('click', () => {
    settingsModal.classList.remove('active');
    setTimeout(() => messageInput.focus(), 100);
});

saveApiKey.addEventListener('click', () => {
    apiKey = apiKeyInput.value.trim();
    saveSettings();
    settingsModal.classList.remove('active');
    
    if (apiKey) {
        alert('API ключ сохранён!');
    }
    
    setTimeout(() => messageInput.focus(), 100);
});

settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) {
        settingsModal.classList.remove('active');
        setTimeout(() => messageInput.focus(), 100);
    }
});
