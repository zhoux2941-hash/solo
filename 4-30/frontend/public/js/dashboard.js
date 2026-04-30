const API_BASE = '/api';
let currentUser = null;
let currentInviteDocId = null;

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
        updateUserDisplay();
        loadDocuments();
        loadAvailableUsers();
    } catch (error) {
        console.error('Failed to parse user:', error);
        window.location.href = '/login';
    }
}

function updateUserDisplay() {
    const avatar = document.getElementById('userAvatar');
    const name = document.getElementById('userName');
    
    avatar.style.background = currentUser.color;
    avatar.textContent = currentUser.nickname.charAt(0);
    name.textContent = currentUser.nickname;
}

async function loadDocuments() {
    try {
        const response = await fetch(`${API_BASE}/documents`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                window.location.href = '/login';
                return;
            }
            throw new Error('Failed to load documents');
        }
        
        const documents = await response.json();
        
        const ownedDocs = documents.filter(doc => doc.owner === currentUser.username);
        const invitedDocs = documents.filter(doc => doc.owner !== currentUser.username);
        
        renderDocuments('ownedDocuments', ownedDocs, true);
        renderDocuments('invitedDocuments', invitedDocs, false);
        
    } catch (error) {
        console.error('Error loading documents:', error);
        showToast('加载文档失败', 'error');
    }
}

function renderDocuments(containerId, documents, isOwner) {
    const container = document.getElementById(containerId);
    
    if (documents.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <div class="empty-state-icon">${isOwner ? '📄' : '📬'}</div>
                <p class="empty-state-text">${isOwner ? '还没有文档，创建一个开始协作吧！' : '还没有被邀请的文档'}</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = documents.map(doc => `
        <div class="document-card" data-doc-id="${doc.id}">
            <div class="document-preview">${escapeHtml(doc.content.substring(0, 150))}</div>
            <div class="document-info">
                <div class="document-name">
                    ${escapeHtml(doc.name)}
                    <span class="badge ${isOwner ? 'badge-owner' : 'badge-invited'}">
                        ${isOwner ? '我的文档' : '被邀请'}
                    </span>
                </div>
                <div class="document-meta">
                    ${isOwner ? `创建者: ${escapeHtml(doc.owner)}` : `所有者: ${escapeHtml(doc.owner)}`}
                    ${doc.activeEditors && doc.activeEditors.length > 0 ? 
                        ` · ${doc.activeEditors.length} 人在线` : ''}
                </div>
            </div>
            <div class="document-actions">
                <button class="btn-icon" onclick="openEditor('${doc.id}')">打开编辑</button>
                ${isOwner ? `<button class="btn-icon" onclick="openInviteModal('${doc.id}')">邀请用户</button>` : ''}
            </div>
        </div>
    `).join('');
    
    container.querySelectorAll('.document-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target.closest('button')) return;
            openEditor(card.dataset.docId);
        });
    });
}

async function loadAvailableUsers() {
    try {
        const response = await fetch(`${API_BASE}/auth/users`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        window.availableUsers = await response.json();
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

function openEditor(docId) {
    window.location.href = `/editor/${docId}`;
}

function openInviteModal(docId) {
    currentInviteDocId = docId;
    renderInviteUserList();
    document.getElementById('inviteModal').classList.add('active');
}

async function renderInviteUserList() {
    const list = document.getElementById('inviteUserList');
    if (!window.availableUsers) {
        await loadAvailableUsers();
    }
    
    try {
        const docResponse = await fetch(`${API_BASE}/documents/${currentInviteDocId}/invited`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        const docData = await docResponse.json();
        const invitedUsers = docData.invitedUsers || [];
        
        list.innerHTML = window.availableUsers.map(user => {
            const isInvited = invitedUsers.includes(user.username);
            return `
                <div class="user-select-item ${isInvited ? 'selected' : ''}" 
                     data-username="${user.username}"
                     data-invited="${isInvited}">
                    <div class="user-avatar" style="background: ${user.color}">
                        ${user.nickname.charAt(0)}
                    </div>
                    <div class="user-info">
                        <div class="name">${escapeHtml(user.nickname)}</div>
                        <div class="username">${user.username} ${isInvited ? '(已邀请)' : ''}</div>
                    </div>
                </div>
            `;
        }).join('');
        
        list.querySelectorAll('.user-select-item').forEach(item => {
            item.addEventListener('click', () => {
                const username = item.dataset.username;
                const isInvited = item.dataset.invited === 'true';
                if (!isInvited) {
                    inviteUser(username);
                }
            });
        });
        
    } catch (error) {
        console.error('Error loading invited users:', error);
        list.innerHTML = '<div style="padding: 16px; color: #9ca3af;">加载失败</div>';
    }
}

async function inviteUser(username) {
    try {
        const response = await fetch(`${API_BASE}/documents/${currentInviteDocId}/invite`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast(`已邀请用户 ${username}`, 'success');
            renderInviteUserList();
        } else {
            showToast(data.message || '邀请失败', 'error');
        }
    } catch (error) {
        console.error('Error inviting user:', error);
        showToast('邀请失败', 'error');
    }
}

function setupEventListeners() {
    document.getElementById('logoutBtn').addEventListener('click', () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
    });
    
    document.getElementById('createDocBtn').addEventListener('click', () => {
        document.getElementById('createModal').classList.add('active');
        document.getElementById('docName').value = '';
        document.getElementById('docName').focus();
    });
    
    document.getElementById('createDocForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await createDocument();
    });
    
    document.querySelectorAll('.modal-close, .btn-secondary[data-modal]').forEach(btn => {
        btn.addEventListener('click', () => {
            const modalId = btn.dataset.modal;
            document.getElementById(modalId).classList.remove('active');
        });
    });
    
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.classList.remove('active');
            }
        });
    });
}

async function createDocument() {
    const name = document.getElementById('docName').value.trim() || 'Untitled Document';
    
    try {
        const response = await fetch(`${API_BASE}/documents`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast('文档创建成功', 'success');
            document.getElementById('createModal').classList.remove('active');
            loadDocuments();
        } else {
            showToast(data.message || '创建失败', 'error');
        }
    } catch (error) {
        console.error('Error creating document:', error);
        showToast('创建失败', 'error');
    }
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
    }, 3000);
}
