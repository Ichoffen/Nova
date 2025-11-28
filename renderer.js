const fs = require('fs');
const path = require('path');

// Путь для хранения данных
const userDataPath = process.env.PORTABLE_EXECUTABLE_DIR || __dirname;
const chatsFilePath = path.join(userDataPath, 'chats.json');
const settingsFilePath = path.join(userDataPath, 'settings.json');

// Глобальные переменные
let chats = [];
let currentChatId = null;
let apiKey = '';
let currentModel = 'claude-sonnet-4-5-20250929';

// Элементы интерфейса
const chatsList = document.getElementById('chatsList');
const messagesContainer = document.getElementById('messagesContainer');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const newChatBtn = document.getElementById('newChatBtn');
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const closeSettings = document.getElementById('closeSettings');
const apiKeyInput = document.getElementById('apiKeyInput');
const saveApiKey = document.getElementById('saveApiKey');
const modelSelect = document.getElementById('modelSelect');

// Инициализация при загрузке
window.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    loadChats();
    renderChatsList();
    
    if (chats.length > 0) {
        switchToChat(chats[0].id);
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

// === РАБОТА С ЧАТАМИ ===

function loadChats() {
    try {
        if (fs.existsSync(chatsFilePath)) {
            const data = fs.readFileSync(chatsFilePath, 'utf8');
            chats = JSON.parse(data);
        }
    } catch (error) {
        console.error('Ошибка загрузки чатов:', error);
        chats = [];
    }
}

function saveChats() {
    try {
        fs.writeFileSync(chatsFilePath, JSON.stringify(chats, null, 2));
    } catch (error) {
        console.error('Ошибка сохранения чатов:', error);
    }
}

function createNewChat() {
    const newChat = {
        id: Date.now().toString(),
        title: 'Новый чат',
        messages: [],
        createdAt: new Date().toISOString()
    };
    
    chats.unshift(newChat);
    saveChats();
    renderChatsList();
    switchToChat(newChat.id);
}

function deleteChat(chatId) {
    if (confirm('Удалить этот чат?')) {
        chats = chats.filter(chat => chat.id !== chatId);
        saveChats();
        renderChatsList();
        
        if (currentChatId === chatId) {
            currentChatId = null;
            messagesContainer.innerHTML = `
                <div class="welcome-message">
                    <h1>👋 Привет! Я Nova</h1>
                    <p>Выбери чат слева или создай новый</p>
                </div>
            `;
        }
    }
}

function switchToChat(chatId) {
    currentChatId = chatId;
    renderChatsList();
    renderMessages();
}

function getCurrentChat() {
    return chats.find(chat => chat.id === currentChatId);
}

// === ОТОБРАЖЕНИЕ ===

function renderChatsList() {
    chatsList.innerHTML = '';
    
    chats.forEach(chat => {
        const chatItem = document.createElement('div');
        chatItem.className = `chat-item ${chat.id === currentChatId ? 'active' : ''}`;
        
        const titleDiv = document.createElement('div');
        titleDiv.className = 'chat-item-title';
        titleDiv.textContent = chat.title;
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-chat-btn';
        deleteBtn.textContent = '×';
        
        chatItem.appendChild(titleDiv);
        chatItem.appendChild(deleteBtn);
        
        chatItem.addEventListener('click', (e) => {
            if (!e.target.classList.contains('delete-chat-btn')) {
                switchToChat(chat.id);
            }
        });
        
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteChat(chat.id);
        });
        
        chatsList.appendChild(chatItem);
    });
}

function renderMessages() {
    const chat = getCurrentChat();
    
    if (!chat) {
        messagesContainer.innerHTML = `
            <div class="welcome-message">
                <h1>👋 Привет! Я Nova</h1>
                <p>Выбери чат слева или создай новый</p>
            </div>
        `;
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
        renderChatsList();
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
        
        saveChats();
        renderMessages();
        
    } catch (error) {
        console.error('Ошибка отправки сообщения:', error);
        alert('Ошибка отправки сообщения. Проверьте API ключ.');
        chat.messages.pop();
        renderMessages();
    } finally {
        sendBtn.disabled = false;
        messageInput.focus();
    }
}

// === ОБРАБОТЧИКИ СОБЫТИЙ ===

newChatBtn.addEventListener('click', createNewChat);
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
