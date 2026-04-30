const API_BASE = '/api';
const WS_BASE = window.location.protocol === 'https:' ? 'wss:' : 'ws:';

let currentUser = null;
let documentId = null;
let editor = null;
let socket = null;
let documentVersion = 0;
let isApplyingRemoteChange = false;
let remoteCursors = {};
let cursorElements = {};

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    setupEventListeners();
});

function checkAuth() {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    
    if (!token || !user) {
        window.location.href = '/login';
        return;
    }
    
    try {
        currentUser = JSON.parse(user);
        documentId = getDocumentIdFromUrl();
        
        if (!documentId) {
            window.location.href = '/dashboard';
            return;
        }
        
        loadDocumentInfo();
    } catch (error) {
        console.error('Failed to parse user:', error);
        window.location.href = '/login';
    }
}

function getDocumentIdFromUrl() {
    const path = window.location.pathname;
    const match = path.match(/^\/editor\/([a-f0-9-]+)$/i);
    return match ? match[1] : null;
}

async function loadDocumentInfo() {
    try {
        const response = await fetch(`${API_BASE}/documents/${documentId}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                window.location.href = '/login';
                return;
            }
            if (response.status === 403 || response.status === 404) {
                showLoadingError('无权访问该文档');
                return;
            }
            throw new Error('Failed to load document');
        }
        
        const doc = await response.json();
        updateDocumentInfo(doc);
        connectWebSocket(doc.content);
        
    } catch (error) {
        console.error('Error loading document:', error);
        showLoadingError('加载文档失败');
    }
}

function showLoadingError(message) {
    document.getElementById('loadingText').textContent = message;
    document.querySelector('.loading-spinner').style.animation = 'none';
    document.querySelector('.loading-spinner').innerHTML = '✕';
    document.querySelector('.loading-spinner').style.color = '#f14c4c';
}

function updateDocumentInfo(doc) {
    document.getElementById('docName').textContent = doc.name;
    document.getElementById('docOwner').textContent = `by ${doc.owner}`;
}

function connectWebSocket(initialContent) {
    const wsUrl = `${WS_BASE}//${window.location.host}/ws/editor`;
    socket = new WebSocket(wsUrl);
    
    socket.onopen = () => {
        console.log('WebSocket connected');
        updateConnectionStatus(true);
        
        socket.send(JSON.stringify({
            type: 'join',
            documentId: documentId,
            username: currentUser.username
        }));
    };
    
    socket.onclose = () => {
        console.log('WebSocket disconnected');
        updateConnectionStatus(false);
        setTimeout(() => {
            if (!socket || socket.readyState !== WebSocket.OPEN) {
                connectWebSocket(editor ? editor.getValue() : initialContent);
            }
        }, 3000);
    };
    
    socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        updateConnectionStatus(false);
    };
    
    socket.onmessage = (event) => {
        try {
            const message = JSON.parse(event.data);
            handleWebSocketMessage(message, initialContent);
        } catch (error) {
            console.error('Error parsing WebSocket message:', error);
        }
    };
}

function handleWebSocketMessage(message, initialContent) {
    console.log('Received message:', message.type);
    
    switch (message.type) {
        case 'join':
            if (message.username === currentUser.username) {
                documentVersion = message.version;
                initEditor(message.initialContent || initialContent);
                hideLoading();
            } else {
                updateCollaboratorList();
            }
            break;
            
        case 'leave':
            removeRemoteCursor(message.username);
            updateCollaboratorList();
            break;
            
        case 'userList':
            updateOnlineUsers(message.users);
            updateCollaboratorListUI(message.users);
            break;
            
        case 'cursor':
            if (message.username !== currentUser.username) {
                updateRemoteCursor(message);
            }
            break;
            
        case 'selection':
            break;
            
        case 'edit':
            if (message.username !== currentUser.username) {
                applyRemoteEdit(message);
            }
            break;
            
        case 'conflict':
            showToast(message.warning, 'warning');
            break;
            
        case 'syncError':
            handleSyncError(message);
            break;
            
        case 'error':
            showToast(message.message, 'error');
            break;
    }
}

function initEditor(initialContent) {
    const textarea = document.getElementById('editor');
    
    editor = CodeMirror.fromTextArea(textarea, {
        mode: 'javascript',
        theme: 'dracula',
        lineNumbers: true,
        matchBrackets: true,
        autoCloseBrackets: true,
        indentUnit: 4,
        tabSize: 4,
        indentWithTabs: false,
        lineWrapping: true
    });
    
    editor.setValue(initialContent);
    
    editor.on('change', (cm, change) => {
        if (!isApplyingRemoteChange) {
            if (change.origin !== 'setValue') {
                const from = cm.indexFromPos(change.from);
                let to = from;
                
                if (change.removed.length > 0) {
                    const removedText = change.removed.join('\n');
                    to = from + removedText.length;
                }
                
                const insertedText = change.text.join('\n');
                sendEditChange(from, to, insertedText);
            }
        }
        checkErrors();
    });
    
    editor.on('cursorActivity', () => {
        sendCursorPosition();
    });
    
    checkErrors();
}

function lintJavaScript(text) {
    const diagnostics = [];
    
    try {
        acorn.parse(text, { ecmaVersion: 2024 });
        return [];
    } catch (e) {
        if (e.loc) {
            const line = e.loc.line - 1;
            const column = e.loc.column;
            
            diagnostics.push({
                from: CodeMirror.Pos(line, column),
                to: CodeMirror.Pos(line, column + 1),
                severity: 'error',
                message: e.message
            });
        }
    }
    
    return diagnostics;
}

function checkErrors() {
    if (!editor) return;
    
    const text = editor.getValue();
    const errors = lintJavaScript(text);
    
    const errorIndicator = document.getElementById('errorIndicator');
    const errorCount = document.getElementById('errorCount');
    
    if (errors.length > 0) {
        errorIndicator.classList.add('show');
        errorCount.textContent = errors.length;
    } else {
        errorIndicator.classList.remove('show');
    }
    
    const markers = editor.getAllMarks();
    markers.forEach(m => m.clear());
    
    errors.forEach(error => {
        editor.markText(error.from, error.to, {
            className: 'CodeMirror-lint-mark-error',
            title: error.message
        });
    });
}

function sendEditChange(from, to, text) {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    
    documentVersion++;
    
    socket.send(JSON.stringify({
        type: 'edit',
        documentId: documentId,
        username: currentUser.username,
        from,
        to,
        text,
        version: documentVersion
    }));
}

function sendCursorPosition() {
    if (!socket || socket.readyState !== WebSocket.OPEN || !editor) return;
    
    const cursor = editor.getCursor();
    const position = editor.indexFromPos(cursor);
    
    socket.send(JSON.stringify({
        type: 'cursor',
        documentId: documentId,
        username: currentUser.username,
        position: position
    }));
}

function applyRemoteEdit(message) {
    if (!editor) return;
    
    isApplyingRemoteChange = true;
    
    try {
        const { from, to, text } = message;
        
        const fromPos = editor.posFromIndex(from);
        let toPos;
        
        if (from === to && text) {
            toPos = fromPos;
        } else {
            toPos = editor.posFromIndex(to);
        }
        
        const doc = editor.getDoc();
        
        const currentCursor = editor.getCursor();
        const currentCursorIndex = editor.indexFromPos(currentCursor);
        
        doc.replaceRange(text, fromPos, toPos, 'setValue');
        
        if (currentCursorIndex > from) {
            const diff = text.length - (to - from);
            const newCursorIndex = currentCursorIndex + diff;
            const newCursorPos = editor.posFromIndex(Math.max(0, newCursorIndex));
            editor.setCursor(newCursorPos);
        }
        
        documentVersion = message.version;
        
        checkErrors();
    } catch (error) {
        console.error('Error applying remote edit:', error);
    } finally {
        isApplyingRemoteChange = false;
    }
}

function updateRemoteCursor(message) {
    if (!editor) return;
    
    const { username, nickname, color, position } = message;
    
    if (!cursorElements[username]) {
        const wrapper = editor.getWrapperElement();
        
        const cursorContainer = document.createElement('div');
        cursorContainer.className = 'remote-cursor';
        cursorContainer.style.position = 'absolute';
        cursorContainer.style.zIndex = '100';
        cursorContainer.style.pointerEvents = 'none';
        
        const cursor = document.createElement('div');
        cursor.style.width = '2px';
        cursor.style.height = '18px';
        cursor.style.backgroundColor = color;
        cursor.style.position = 'relative';
        
        const label = document.createElement('div');
        label.className = 'remote-cursor-label';
        label.style.backgroundColor = color;
        label.textContent = nickname;
        label.style.position = 'absolute';
        label.style.top = '-16px';
        label.style.left = '0';
        label.style.fontSize = '11px';
        label.style.padding = '1px 6px';
        label.style.borderRadius = '3px 3px 0 0';
        label.style.color = 'white';
        label.style.whiteSpace = 'nowrap';
        
        cursor.appendChild(label);
        cursorContainer.appendChild(cursor);
        
        wrapper.style.position = 'relative';
        wrapper.appendChild(cursorContainer);
        
        cursorElements[username] = { container: cursorContainer, cursor: cursor, label: label };
    }
    
    const elem = cursorElements[username];
    elem.cursor.style.backgroundColor = color;
    elem.label.style.backgroundColor = color;
    elem.label.textContent = nickname;
    
    const pos = editor.posFromIndex(position);
    const coords = editor.charCoords(pos, 'local');
    
    elem.container.style.left = coords.left + 'px';
    elem.container.style.top = (coords.top - editor.getScrollInfo().top) + 'px';
}

function removeRemoteCursor(username) {
    if (cursorElements[username]) {
        cursorElements[username].container.remove();
        delete cursorElements[username];
    }
}

function handleSyncError(message) {
    if (!editor) return;
    
    isApplyingRemoteChange = true;
    editor.setValue(message.currentContent);
    documentVersion = message.correctVersion;
    isApplyingRemoteChange = false;
    
    showToast('文档已同步', 'warning');
    checkErrors();
}

function updateConnectionStatus(connected) {
    const dot = document.getElementById('statusDot');
    const text = document.getElementById('statusText');
    
    if (connected) {
        dot.classList.add('connected');
        text.textContent = '已连接';
    } else {
        dot.classList.remove('connected');
        text.textContent = '连接中...';
    }
}

function updateOnlineUsers(users) {
    const container = document.getElementById('onlineUsers');
    container.innerHTML = users.map(user => `
        <div class="user-badge">
            <span class="user-dot" style="background: ${user.color}"></span>
            <span>${escapeHtml(user.nickname)}</span>
        </div>
    `).join('');
}

function updateCollaboratorListUI(users) {
    const list = document.getElementById('collaboratorList');
    
    const sortedUsers = [...users].sort((a, b) => {
        if (a.username === currentUser.username) return -1;
        if (b.username === currentUser.username) return 1;
        return 0;
    });
    
    list.innerHTML = sortedUsers.map(user => `
        <li class="collaborator-item ${user.username === currentUser.username ? 'current' : ''}">
            <span class="collaborator-color" style="background: ${user.color}"></span>
            <span class="collaborator-name">
                ${escapeHtml(user.nickname)}
                ${user.username === currentUser.username ? '<small>(你)</small>' : ''}
            </span>
        </li>
    `).join('');
}

function updateCollaboratorList() {
}

function hideLoading() {
    document.getElementById('loadingOverlay').style.display = 'none';
}

function setupEventListeners() {
    document.getElementById('backBtn').addEventListener('click', () => {
        if (socket) {
            socket.close();
        }
        window.location.href = '/dashboard';
    });
    
    window.addEventListener('beforeunload', () => {
        if (socket) {
            socket.close();
        }
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 4000);
}
