const API_BASE = '/api';

document.addEventListener('DOMContentLoaded', async () => {
    await loadMockUsers();
    setupFormHandler();
});

async function loadMockUsers() {
    try {
        const response = await fetch(`${API_BASE}/auth/users`);
        const users = await response.json();
        
        const userList = document.getElementById('userList');
        userList.innerHTML = users.map(user => `
            <li class="user-item" data-username="${user.username}" data-color="${user.color}">
                <div class="user-avatar" style="background: ${user.color}">
                    ${user.nickname.charAt(0)}
                </div>
                <div class="user-info">
                    <div class="name">${user.nickname}</div>
                    <div class="username">用户名: ${user.username}</div>
                </div>
            </li>
        `).join('');
        
        userList.querySelectorAll('.user-item').forEach(item => {
            item.addEventListener('click', () => {
                const username = item.dataset.username;
                document.getElementById('username').value = username;
                document.getElementById('password').value = 'password123';
                document.getElementById('username').focus();
            });
        });
    } catch (error) {
        console.error('Failed to load users:', error);
    }
}

function setupFormHandler() {
    const form = document.getElementById('loginForm');
    const errorMessage = document.getElementById('errorMessage');
    const loginBtn = document.getElementById('loginBtn');
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;
        
        if (!username || !password) {
            showError('请输入用户名和密码');
            return;
        }
        
        loginBtn.disabled = true;
        loginBtn.textContent = '登录中...';
        errorMessage.style.display = 'none';
        
        try {
            const response = await fetch(`${API_BASE}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });
            
            const data = await response.json();
            
            if (data.success) {
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                window.location.href = '/dashboard';
            } else {
                showError(data.message || '登录失败');
            }
        } catch (error) {
            console.error('Login error:', error);
            showError('网络错误，请稍后重试');
        } finally {
            loginBtn.disabled = false;
            loginBtn.textContent = '登录';
        }
    });
}

function showError(message) {
    const errorMessage = document.getElementById('errorMessage');
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
}
