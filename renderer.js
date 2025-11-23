const messagesEl = document.getElementById('messages');
const inputEl = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const modelSelect = document.getElementById('model');
const messageLimitSelect = document.getElementById('message-limit');
const apiKeyInput = document.getElementById('api-key');
const saveKeyBtn = document.getElementById('save-key-btn');
const micBtn = document.getElementById('mic-btn');
const micStatusEl = document.getElementById('mic-status');
const chatListEl = document.getElementById('chat-list');
const newChatBtn = document.getElementById('new-chat-btn');

// Простая модель данных: чаты в памяти
let currentChatId = 'chat-1';
let chats = {
  'chat-1': {
    id: 'chat-1',
    title: 'Новый чат',
    messages: [] // { role: 'user'|'assistant', content: '...' }
  }
};

const API_KEY_STORAGE_KEY = 'nova_anthropic_api_key';

// ===== API key =====

function loadApiKey() {
  const stored = localStorage.getItem(API_KEY_STORAGE_KEY);
  if (stored) {
    apiKeyInput.value = stored;
  }
}

function saveApiKey() {
  const key = apiKeyInput.value.trim();
  if (!key) {
    alert('Введите API ключ перед сохранением.');
    return;
  }
  localStorage.setItem(API_KEY_STORAGE_KEY, key);
  alert('API ключ сохранён локально в браузере этого приложения.');
}

saveKeyBtn.addEventListener('click', saveApiKey);
loadApiKey();

// ===== Чаты =====

function getCurrentChat() {
  return chats[currentChatId];
}

function renderChatList() {
  chatListEl.innerHTML = '';
  Object.values(chats).forEach(chat => {
    const div = document.createElement('div');
    div.className = 'chat-item' + (chat.id === currentChatId ? ' active' : '');
    div.textContent = chat.title;
    div.addEventListener('click', () => {
      currentChatId = chat.id;
      renderChatList();
      renderMessages();
    });
    chatListEl.appendChild(div);
  });
}

newChatBtn.addEventListener('click', () => {
  const id = 'chat-' + (Object.keys(chats).length + 1);
  chats[id] = {
    id,
    title: 'Чат ' + Object.keys(chats).length,
    messages: []
  };
  currentChatId = id;
  renderChatList();
  renderMessages();
});

// ===== Отрисовка сообщений =====

function renderMessages() {
  const chat = getCurrentChat();
  const limit = parseInt(messageLimitSelect.value, 10);
  const msgs = limit >= chat.messages.length
    ? chat.messages
    : chat.messages.slice(chat.messages.length - limit);

  messagesEl.innerHTML = '';

  msgs.forEach(msg => {
    const row = document.createElement('div');
    row.className = 'message-row ' + (msg.role === 'user' ? 'user' : 'assistant');

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    bubble.textContent = msg.content;

    row.appendChild(bubble);
    messagesEl.appendChild(row);
  });

  messagesEl.scrollTop = messagesEl.scrollHeight;
}

messageLimitSelect.addEventListener('change', () => {
  renderMessages();
});

// ===== Отправка сообщений в Claude =====

async function sendMessage() {
  const text = inputEl.value.trim();
  if (!text) return;

  const chat = getCurrentChat();
  chat.messages.push({ role: 'user', content: text });
  inputEl.value = '';
  renderMessages();

  const apiKey = apiKeyInput.value.trim();
  if (!apiKey) {
    alert('Сначала введи и сохрани API ключ.');
    return;
  }

  const model = modelSelect.value;

  const messagesForClaude = chat.messages.map(m => ({
    role: m.role === 'user' ? 'user' : 'assistant',
    content: [
      {
        type: 'text',
        text: m.content
      }
    ]
  }));

  const thinkingMsg = { role: 'assistant', content: '...' };
  chat.messages.push(thinkingMsg);
  renderMessages();

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        messages: messagesForClaude
      })
    });

    if (!response.ok) {
      throw new Error('Ошибка API: ' + response.status + ' ' + response.statusText);
    }

    const data = await response.json();
    const replyText = (data.content && data.content[0] && data.content[0].text) || '[пустой ответ]';

    thinkingMsg.content = replyText;
    renderMessages();
  } catch (err) {
    console.error(err);
    thinkingMsg.content = 'Ошибка при запросе к Claude: ' + err.message;
    renderMessages();
  }
}

sendBtn.addEventListener('click', sendMessage);

inputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

// ===== Голосовой ввод =====

let recognition = null;
let recognizing = false;

function initSpeech() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    micStatusEl.textContent = 'Голосовой ввод не поддерживается.';
    micBtn.disabled = true;
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = 'ru-RU';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    recognizing = true;
    micStatusEl.textContent = 'Слушаю...';
    micBtn.textContent = '■';
  };

  recognition.onend = () => {
    recognizing = false;
    micStatusEl.textContent = '';
    micBtn.textContent = '🎤';
  };

  recognition.onerror = (e) => {
    recognizing = false;
    micStatusEl.textContent = 'Ошибка голосового ввода: ' + e.error;
    micBtn.textContent = '🎤';
  };

  recognition.onresult = (e) => {
    const transcript = e.results[0][0].transcript;
    if (inputEl.value) {
      inputEl.value = inputEl.value + ' ' + transcript;
    } else {
      inputEl.value = transcript;
    }
    inputEl.focus();
  };
}

micBtn.addEventListener('click', () => {
  if (!recognition) {
    initSpeech();
  }
  if (!recognition) return;

  if (!recognizing) {
    recognition.start();
  } else {
    recognition.stop();
  }
});

// ===== Инициализация =====
renderChatList();
renderMessages();
initSpeech();
