const API_BASE = '/api';
const WS_BASE = window.location.protocol === 'https:' ? 'wss:' : 'ws:';

let currentUser = null;
let documentId = null;
let editor = null;
let view = null;
let socket = null;
let documentVersion = 0;
let isApplyingRemoteChange = false;
let remoteCursors = {};
let remoteSelections = {};
let errorMarkers = [];

const { EditorState, Compartment } = CMState;
const { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection, dropCursor, rectangularSelection, crosshairCursor, Decoration, ViewPlugin } = CMView;
const { defaultKeymap, history, historyKeymap, indentWithTab } = CMCommands;
const { javascript, javascriptLanguage, snippets } = CMLangJavascript;
const { defaultHighlightStyle, syntaxHighlighting, bracketMatching, indentOnInput } = CMLanguage;
const { oneDark } = CMThemeOneDark;
const { autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap } = CMAutocomplete;
const { lintKeymap, linter, setDiagnostics } = CMLint;

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
                connectWebSocket(view ? view.state.doc.toString() : initialContent);
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
            removeRemoteSelection(message.username);
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
            if (message.username !== currentUser.username) {
                updateRemoteSelection(message);
            }
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
    const lintExtension = javascriptLanguage.data.of({
        lint: (text) => {
            return lintJavaScript(text);
        }
    });
    
    const cursorPlugin = ViewPlugin.fromClass(class {
        constructor(view) {
            this.view = view;
        }
        
        update(update) {
            if (update.selectionSet) {
                sendCursorPosition();
            }
            if (update.docChanged) {
                sendCursorPosition();
                checkErrors();
            }
        }
        
        destroy() {}
    });
    
    const state = EditorState.create({
        doc: initialContent,
        extensions: [
            lineNumbers(),
            highlightActiveLine(),
            highlightActiveLineGutter(),
            drawSelection(),
            dropCursor(),
            EditorState.allowMultipleSelections.of(true),
            indentOnInput(),
            syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
            bracketMatching(),
            closeBrackets(),
            autocompletion(),
            rectangularSelection(),
            crosshairCursor(),
            history(),
            oneDark,
            javascript(),
            lintExtension,
            keymap.of([
                ...defaultKeymap,
                ...closeBracketsKeymap,
                ...historyKeymap,
                ...completionKeymap,
                ...lintKeymap,
                indentWithTab
            ]),
            EditorView.updateListener.of((update) => {
                if (update.docChanged && !isApplyingRemoteChange) {
                    update.transactions.forEach(tr => {
                        if (tr.docChanged) {
                            tr.changes.iterChanges((fromA, toA, fromB, toB, inserted) => {
                                const text = inserted.toString();
                                sendEditChange(fromA, toA, text);
                            });
                        }
                    });
                }
            }),
            cursorPlugin
        ]
    });
    
    view = new EditorView({
        state,
        parent: document.getElementById('editor')
    });
    
    checkErrors();
}

function lintJavaScript(text) {
    const diagnostics = [];
    
    try {
        acorn.parse(text, { ecmaVersion: 2024 });
        errorMarkers = [];
        return [];
    } catch (e) {
        if (e.loc) {
            const line = e.loc.line - 1;
            const column = e.loc.column;
            const lines = text.split('\n');
            const from = lines.slice(0, line).reduce((sum, l) => sum + l.length + 1, 0) + column;
            const to = from + 1;
            
            diagnostics.push({
                from,
                to,
                severity: 'error',
                message: e.message
            });
        }
    }
    
    errorMarkers = diagnostics;
    return diagnostics;
}

function checkErrors() {
    if (!view) return;
    
    const text = view.state.doc.toString();
    const errors = lintJavaScript(text);
    
    const errorIndicator = document.getElementById('errorIndicator');
    const errorCount = document.getElementById('errorCount');
    
    if (errors.length > 0) {
        errorIndicator.classList.add('show');
        errorCount.textContent = errors.length;
    } else {
        errorIndicator.classList.remove('show');
    }
    
    view.dispatch({
        effects: setDiagnostics.of(errors)
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
    if (!socket || socket.readyState !== WebSocket.OPEN || !view) return;
    
    const selection = view.state.selection.main;
    
    socket.send(JSON.stringify({
        type: 'cursor',
        documentId: documentId,
        username: currentUser.username,
        position: selection.from
    }));
    
    if (selection.from !== selection.to) {
        socket.send(JSON.stringify({
            type: 'selection',
            documentId: documentId,
            username: currentUser.username,
            from: selection.from,
            to: selection.to
        }));
    }
}

function applyRemoteEdit(message) {
    if (!view) return;
    
    isApplyingRemoteChange = true;
    
    try {
        const { from, to, text } = message;
        
        view.dispatch({
            changes: { from, to, insert: text }
        });
        
        documentVersion = message.version;
        
        checkErrors();
    } catch (error) {
        console.error('Error applying remote edit:', error);
    } finally {
        isApplyingRemoteChange = false;
    }
}

function updateRemoteCursor(message) {
    if (!view) return;
    
    const { username, nickname, color, position } = message;
    
    if (!remoteCursors[username]) {
        const cursor = document.createElement('div');
        cursor.className = 'remote-cursor';
        cursor.style.backgroundColor = color;
        cursor.dataset.username = nickname;
        cursor.querySelector('::after')?.style.setProperty('background', color);
        remoteCursors[username] = cursor;
    }
    
    const cursor = remoteCursors[username];
    cursor.style.backgroundColor = color;
    cursor.innerHTML = `<span style="position:absolute;top:-20px;left:0;font-size:11px;padding:2px 6px;border-radius:3px;color:white;white-space:nowrap;background:${color};">${nickname}</span>`;
    
    const coords = view.coordsAtPos(position);
    if (coords) {
        const editorRect = view.dom.getBoundingClientRect();
        cursor.style.left = (coords.left - editorRect.left) + 'px';
        cursor.style.top = (coords.top - editorRect.top) + 'px';
        
        view.dom.appendChild(cursor);
    }
}

function removeRemoteCursor(username) {
    if (remoteCursors[username]) {
        remoteCursors[username].remove();
        delete remoteCursors[username];
    }
}

function updateRemoteSelection(message) {
    if (!view) return;
    
    const { username, nickname, color, from, to } = message;
    
    if (!remoteSelections[username]) {
        const selection = document.createElement('div');
        selection.className = 'remote-selection';
        selection.style.backgroundColor = color;
        remoteSelections[username] = selection;
    }
    
    const selection = remoteSelections[username];
    selection.style.backgroundColor = color;
    selection.style.opacity = '0.3';
    
    const startCoords = view.coordsAtPos(Math.min(from, to));
    const endCoords = view.coordsAtPos(Math.max(from, to));
    
    if (startCoords && endCoords) {
        const editorRect = view.dom.getBoundingClientRect();
        selection.style.left = (startCoords.left - editorRect.left) + 'px';
        selection.style.top = (startCoords.top - editorRect.top) + 'px';
        selection.style.width = (endCoords.right - startCoords.left) + 'px';
        selection.style.height = (endCoords.bottom - startCoords.top) + 'px';
        
        view.dom.appendChild(selection);
    }
}

function removeRemoteSelection(username) {
    if (remoteSelections[username]) {
        remoteSelections[username].remove();
        delete remoteSelections[username];
    }
}

function handleSyncError(message) {
    if (!view) return;
    
    isApplyingRemoteChange = true;
    view.dispatch({
        changes: {
            from: 0,
            to: view.state.doc.length,
            insert: message.currentContent
        }
    });
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
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
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
