const API_URL = '/api';
let currentUser = null;
let currentCategory = 'all';

// DOM Elements
const authScreen = document.getElementById('auth-screen');
const dashboardScreen = document.getElementById('dashboard-screen');
const authForm = document.getElementById('auth-form');
const authTitle = document.getElementById('auth-title');
const authSwitchBtn = document.getElementById('auth-switch-btn');
const authSwitchText = document.getElementById('auth-switch-text');
const fileList = document.getElementById('file-list');
const toast = document.getElementById('toast');
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');

let isLoginMode = true;

// Init
console.log('App starting...');
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded');
    checkAuth();
});

// Auth Logic
async function checkAuth() {
    try {
        const res = await fetch(`${API_URL}/auth/me`);
        const data = await res.json();
        if (data.authenticated) {
            currentUser = data.user;
            showDashboard();
        } else {
            showAuth();
        }
    } catch (err) {
        showAuth();
    }
}

authSwitchBtn.addEventListener('click', () => {
    isLoginMode = !isLoginMode;
    if (isLoginMode) {
        authTitle.textContent = 'Welcome Back';
        authSwitchText.textContent = "Don't have an account?";
        authSwitchBtn.textContent = 'Register';
        authForm.querySelector('button').textContent = 'Login';
    } else {
        authTitle.textContent = 'Create Account';
        authSwitchText.textContent = "Already have an account?";
        authSwitchBtn.textContent = 'Login';
        authForm.querySelector('button').textContent = 'Register';
    }
});

authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = authForm.username.value;
    const password = authForm.password.value;
    const endpoint = isLoginMode ? '/auth/login' : '/auth/register';

    try {
        const res = await fetch(`${API_URL}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();

        if (res.ok) {
            if (isLoginMode) {
                currentUser = data.user;
                showDashboard();
            } else {
                showToast('Registration successful! Please login.');
                authSwitchBtn.click();
            }
        } else {
            showToast(data.error || 'Authentication failed');
        }
    } catch (err) {
        showToast('Server error');
    }
});

document.getElementById('logout-btn').addEventListener('click', async () => {
    await fetch(`${API_URL}/auth/logout`, { method: 'POST' });
    currentUser = null;
    showAuth();
});

function showAuth() {
    console.log('Showing Auth Screen');
    authScreen.classList.remove('hidden');
    dashboardScreen.classList.add('hidden');
    console.log('Auth Screen classes:', authScreen.className);
}

function showDashboard() {
    console.log('Showing Dashboard');
    authScreen.classList.add('hidden');
    dashboardScreen.classList.remove('hidden');
    document.getElementById('user-display-name').textContent = currentUser.username;

    // Show/hide admin button based on user role
    const adminNavBtn = document.getElementById('admin-nav-btn');
    if (currentUser.isAdmin) {
        adminNavBtn.classList.remove('hidden');
    } else {
        adminNavBtn.classList.add('hidden');
    }

    // Setup navigation
    setupNavigation();

    // Show files view by default
    showFilesView();
    loadFiles();
}

// File Management
async function loadFiles() {
    try {
        const res = await fetch(`${API_URL}/files?category=${currentCategory}`);
        const files = await res.json();
        renderFiles(files);
    } catch (err) {
        showToast('Failed to load files');
    }
}

function renderFiles(files) {
    fileList.innerHTML = '';
    if (files.length === 0) {
        fileList.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-secondary);">No files found.</p>';
        return;
    }

    files.forEach(file => {
        const card = document.createElement('div');
        card.className = 'file-card';

        let previewHtml = '';
        if (file.category === 'image') {
            previewHtml = `<img src="${API_URL}/files/${file.id}/content" alt="${file.original_name}">`;
        } else if (file.category === 'video') {
            previewHtml = `<video src="${API_URL}/files/${file.id}/content"></video>`; // Just a thumbnail or icon ideally, but this works for basic
        } else {
            const icon = getIconForCategory(file.category);
            previewHtml = `<i class="${icon} file-icon"></i>`;
        }

        card.innerHTML = `
            <div class="file-preview" onclick="previewFile(${file.id}, '${file.category}', '${file.original_name}')">
                ${previewHtml}
            </div>
            <div class="file-info">
                <div class="file-name" title="${file.original_name}">${file.original_name}</div>
                <div class="file-meta">
                    <span>${formatSize(file.size)}</span>
                    <span>${new Date(file.created_at).toLocaleDateString()}</span>
                </div>
            </div>
            <div class="file-actions">
                <button class="action-btn" onclick="downloadFile(${file.id}, '${file.original_name}')" title="Download"><i class="fa-solid fa-download"></i></button>
                <button class="action-btn" onclick="copyLink(${file.id})" title="Copy Link"><i class="fa-solid fa-link"></i></button>
                <button class="action-btn delete" onclick="deleteFile(${file.id})" title="Delete"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
        fileList.appendChild(card);
    });
}

function getIconForCategory(cat) {
    switch (cat) {
        case 'audio': return 'fa-solid fa-music';
        case 'video': return 'fa-solid fa-video';
        case 'image': return 'fa-solid fa-image';
        default: return 'fa-solid fa-file-lines';
    }
}

function formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Upload Logic
dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
});
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    handleFiles(e.dataTransfer.files);
});
fileInput.addEventListener('change', (e) => handleFiles(e.target.files));

async function handleFiles(files) {
    for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch(`${API_URL}/files/upload`, {
                method: 'POST',
                body: formData
            });
            if (res.ok) {
                showToast(`Uploaded: ${file.name}`);
            } else {
                showToast(`Failed: ${file.name}`);
            }
        } catch (err) {
            showToast(`Error uploading ${file.name}`);
        }
    }
    loadFiles();
}

// Actions
window.deleteFile = async (id) => {
    if (!confirm('Are you sure you want to delete this file?')) return;
    try {
        const res = await fetch(`${API_URL}/files/${id}`, { method: 'DELETE' });
        if (res.ok) {
            showToast('File deleted');
            loadFiles();
        } else {
            showToast('Failed to delete file');
        }
    } catch (err) {
        showToast('Error deleting file');
    }
};

window.downloadFile = (id, name) => {
    const link = document.createElement('a');
    link.href = `${API_URL}/files/${id}/content`;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

window.copyLink = async (id) => {
    try {
        const res = await fetch(`${API_URL}/files/${id}/share`, { method: 'POST' });
        const data = await res.json();

        if (res.ok) {
            // 尝试使用现代剪贴板 API
            if (navigator.clipboard && navigator.clipboard.writeText) {
                try {
                    await navigator.clipboard.writeText(data.shareUrl);
                    showToast('分享链接已复制到剪贴板');
                    return;
                } catch (clipboardErr) {
                    console.warn('现代剪贴板 API 失败，使用备用方案:', clipboardErr);
                }
            }

            // 备用方案：使用传统的 execCommand 方法
            const textarea = document.createElement('textarea');
            textarea.value = data.shareUrl;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();

            try {
                const successful = document.execCommand('copy');
                if (successful) {
                    showToast('分享链接已复制到剪贴板');
                } else {
                    showToast(`分享链接: ${data.shareUrl}`);
                }
            } catch (execErr) {
                console.error('execCommand 复制失败:', execErr);
                showToast(`分享链接: ${data.shareUrl}`);
            } finally {
                document.body.removeChild(textarea);
            }
        } else {
            showToast(data.error || '生成分享链接失败');
        }
    } catch (err) {
        console.error('分享错误:', err);
        showToast('生成分享链接时出错');
    }
};

window.previewFile = async (id, category, name) => {
    const modal = document.getElementById('preview-modal');
    const body = document.getElementById('modal-body');
    const url = `${API_URL}/files/${id}/content`;

    body.innerHTML = '';

    // Handle images
    if (category === 'image') {
        body.innerHTML = `<img src="${url}" class="preview-media">`;
    }
    // Handle videos
    else if (category === 'video') {
        body.innerHTML = `<video src="${url}" controls class="preview-media" autoplay></video>`;
    }
    // Handle audio
    else if (category === 'audio') {
        body.innerHTML = `<audio src="${url}" controls autoplay style="width: 100%"></audio><h3 style="color:white; text-align:center; margin-top:1rem">${name}</h3>`;
    }
    // Handle documents (enhanced support)
    else if (category === 'document') {
        const ext = name.split('.').pop().toLowerCase();

        // PDF files
        if (ext === 'pdf') {
            await renderPDF(url, body);
        }
        // CSV files - render as table
        else if (ext === 'csv') {
            try {
                const response = await fetch(url);
                const text = await response.text();
                body.innerHTML = `
                    <div style="background: white; padding: 2rem; border-radius: 12px; max-width: 1400px; max-height: 80vh; overflow-y: auto;">
                        ${parseCSV(text)}
                    </div>
                `;
            } catch (err) {
                body.innerHTML = `<p style="color: white;">Failed to load CSV</p>`;
            }
        }
        // Markdown files
        else if (ext === 'md' || ext === 'markdown') {
            try {
                const response = await fetch(url);
                const text = await response.text();
                body.innerHTML = `
                    <div style="background: white; padding: 2rem; border-radius: 12px; max-width: 1400px; max-height: 80vh; overflow-y: auto; color: #333;">
                        <div id="markdown-content"></div>
                    </div>
                `;
                const script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/npm/marked/marked.min.js';
                script.onload = () => {
                    document.getElementById('markdown-content').innerHTML = marked.parse(text);
                };
                document.head.appendChild(script);
            } catch (err) {
                body.innerHTML = `<p style="color: white;">Failed to load markdown</p>`;
            }
        }
        // Code files and text files with syntax highlighting
        else if (canPreviewAsText(name)) {
            try {
                const response = await fetch(url);
                const text = await response.text();
                const language = getLanguageForFile(name);

                body.innerHTML = `
                    <div style="background: #0d1117; padding: 2rem; border-radius: 12px; max-width: 1400px; max-height: 80vh; overflow-y: auto;">
                        <div style="background: #161b22; padding: 1rem; border-radius: 8px; margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center;">
                            <span style="color: #8b949e; font-size: 0.9rem;"><i class="fa-solid fa-file-code"></i> ${name}</span>
                            <div style="display: flex; gap: 0.5rem;">
                                <button id="copy-text-btn" class="btn btn-ghost" style="padding: 0.4rem 0.8rem; font-size: 0.85rem;" title="复制文本">
                                    <i class="fa-solid fa-copy"></i> 复制
                                </button>
                                <button id="toggle-wrap-btn" class="btn btn-ghost" style="padding: 0.4rem 0.8rem; font-size: 0.85rem;" title="切换换行">
                                    <i class="fa-solid fa-arrows-left-right"></i> 换行
                                </button>
                            </div>
                        </div>
                        <pre id="code-preview-pre" style="white-space: pre; overflow-x: auto;"><code class="language-${language}">${escapeHtml(text)}</code></pre>
                    </div>
                `;

                // Apply syntax highlighting
                document.querySelectorAll('pre code').forEach((block) => {
                    hljs.highlightElement(block);
                });

                // Store the original text for copying
                const copyBtn = document.getElementById('copy-text-btn');
                const toggleWrapBtn = document.getElementById('toggle-wrap-btn');
                const preElement = document.getElementById('code-preview-pre');
                let isWrapped = false;

                // Copy text functionality
                copyBtn.addEventListener('click', async () => {
                    try {
                        await navigator.clipboard.writeText(text);
                        copyBtn.innerHTML = '<i class="fa-solid fa-check"></i> 已复制';
                        setTimeout(() => {
                            copyBtn.innerHTML = '<i class="fa-solid fa-copy"></i> 复制';
                        }, 2000);
                        showToast('文本已复制到剪贴板');
                    } catch (err) {
                        showToast('复制失败，请手动复制');
                    }
                });

                // Toggle wrap functionality
                toggleWrapBtn.addEventListener('click', () => {
                    isWrapped = !isWrapped;
                    if (isWrapped) {
                        preElement.style.whiteSpace = 'pre-wrap';
                        preElement.style.overflowX = 'visible';
                        toggleWrapBtn.innerHTML = '<i class="fa-solid fa-arrows-left-right"></i> 不换行';
                    } else {
                        preElement.style.whiteSpace = 'pre';
                        preElement.style.overflowX = 'auto';
                        toggleWrapBtn.innerHTML = '<i class="fa-solid fa-arrows-left-right"></i> 换行';
                    }
                });
            } catch (err) {
                body.innerHTML = `<p style="color: white;">Failed to load file</p>`;
            }
        }
        // Other document types - open in new tab
        else {
            window.open(url, '_blank');
            return;
        }
    }
    // For other types, open in new tab
    else {
        window.open(url, '_blank');
        return;
    }

    modal.classList.remove('hidden');
};

// Helper function to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

window.closeModal = () => {
    document.getElementById('preview-modal').classList.add('hidden');
    document.getElementById('modal-body').innerHTML = '';
};

// Filters
document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentCategory = btn.dataset.category;
        loadFiles();
    });
});


// Toast
function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// ========== ADMIN PANEL ==========

function setupNavigation() {
    const filesNavBtn = document.getElementById('files-nav-btn');
    const adminNavBtn = document.getElementById('admin-nav-btn');

    filesNavBtn.addEventListener('click', () => {
        filesNavBtn.classList.add('active');
        adminNavBtn.classList.remove('active');
        showFilesView();
    });

    adminNavBtn.addEventListener('click', () => {
        adminNavBtn.classList.add('active');
        filesNavBtn.classList.remove('active');
        showAdminPanel();
    });
}

function showFilesView() {
    document.getElementById('files-view').classList.remove('hidden');
    document.getElementById('admin-panel').classList.add('hidden');
}

function showAdminPanel() {
    document.getElementById('files-view').classList.add('hidden');
    document.getElementById('admin-panel').classList.remove('hidden');
    loadUsers();
}

// Load all users
async function loadUsers() {
    try {
        const res = await fetch(`${API_URL}/admin/users`);
        const users = await res.json();
        renderUsers(users);
    } catch (err) {
        showToast('Failed to load users');
    }
}

// Render users list
function renderUsers(users) {
    const usersList = document.getElementById('users-list');
    usersList.innerHTML = '';

    users.forEach(user => {
        const userCard = document.createElement('div');
        userCard.className = 'user-card';
        userCard.innerHTML = `
            <div class="user-info-section">
                <div class="user-header">
                    <h3>${user.username} ${user.is_admin ? '<span class="admin-badge">ADMIN</span>' : ''}</h3>
                    <span class="user-status ${user.is_banned ? 'banned' : 'active'}">${user.is_banned ? 'Banned' : 'Active'}</span>
                </div>
                <p style="color: var(--text-secondary); font-size: 0.9rem;">Joined: ${new Date(user.created_at).toLocaleDateString()}</p>
            </div>
            <div class="user-actions">
                ${user.username !== 'root' ? `
                    <button class="btn ${user.is_banned ? 'btn-primary' : 'btn-danger'}" onclick="toggleBanUser(${user.id}, ${user.is_banned})">
                        <i class="fa-solid fa-${user.is_banned ? 'unlock' : 'ban'}"></i> ${user.is_banned ? 'Unban' : 'Ban'}
                    </button>
                    <button class="btn btn-ghost" onclick="viewUserFiles(${user.id}, '${user.username}')">
                        <i class="fa-solid fa-folder"></i> View Files
                    </button>
                    <button class="btn btn-danger" onclick="deleteUser(${user.id}, '${user.username}')">
                        <i class="fa-solid fa-trash"></i> Delete
                    </button>
                ` : '<span style="color: var(--text-secondary);">Root admin cannot be modified</span>'}
            </div>
        `;
        usersList.appendChild(userCard);
    });
}

// Toggle ban user
window.toggleBanUser = async (userId, currentlyBanned) => {
    const action = currentlyBanned ? 'unban' : 'ban';
    if (!confirm(`Are you sure you want to ${action} this user?`)) return;

    try {
        const res = await fetch(`${API_URL}/admin/users/${userId}/ban`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ banned: !currentlyBanned })
        });

        if (res.ok) {
            showToast(`User ${action}ned successfully`);
            loadUsers();
        } else {
            const data = await res.json();
            showToast(data.error || 'Failed to update user');
        }
    } catch (err) {
        showToast('Error updating user');
    }
};

// Delete user
window.deleteUser = async (userId, username) => {
    if (!confirm(`Are you sure you want to delete user "${username}" and all their files? This cannot be undone!`)) return;

    try {
        const res = await fetch(`${API_URL}/admin/users/${userId}`, { method: 'DELETE' });

        if (res.ok) {
            showToast('User deleted successfully');
            loadUsers();
        } else {
            const data = await res.json();
            showToast(data.error || 'Failed to delete user');
        }
    } catch (err) {
        showToast('Error deleting user');
    }
};

// View user's files
window.viewUserFiles = async (userId, username) => {
    try {
        const res = await fetch(`${API_URL}/admin/users/${userId}/files`);
        const files = await res.json();

        // Show modal with user's files
        const modal = document.getElementById('preview-modal');
        const body = document.getElementById('modal-body');

        body.innerHTML = `
            <div style="background: var(--card-bg); padding: 2rem; border-radius: 12px; max-width: 900px; max-height: 80vh; overflow-y: auto;">
                <h2 style="margin-bottom: 1.5rem;">Files of ${username}</h2>
                <div id="admin-file-list" style="display: grid; gap: 1rem;"></div>
            </div>
        `;

        const fileListDiv = document.getElementById('admin-file-list');

        if (files.length === 0) {
            fileListDiv.innerHTML = '<p style="color: var(--text-secondary); text-align: center;">No files found.</p>';
        } else {
            files.forEach(file => {
                const fileItem = document.createElement('div');
                fileItem.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 1rem; background: rgba(255,255,255,0.05); border-radius: 8px;';
                fileItem.innerHTML = `
                    <div>
                        <div style="font-weight: 600;">${file.original_name}</div>
                        <div style="font-size: 0.85rem; color: var(--text-secondary);">
                            ${formatSize(file.size)} • ${file.category} • ${new Date(file.created_at).toLocaleDateString()}
                        </div>
                    </div>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="btn btn-ghost" onclick="previewAdminFile(${file.id}, '${file.category}', '${file.original_name}')" title="Preview">
                            <i class="fa-solid fa-eye"></i>
                        </button>
                        <button class="btn btn-ghost" onclick="downloadAdminFile(${file.id}, '${file.original_name}')" title="Download">
                            <i class="fa-solid fa-download"></i>
                        </button>
                        <button class="btn btn-ghost" onclick="copyAdminLink(${file.id})" title="Copy Link">
                            <i class="fa-solid fa-link"></i>
                        </button>
                        <button class="btn btn-danger" onclick="adminDeleteFile(${file.id}, '${file.original_name}', ${userId}, '${username}')" title="Delete">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                `;
                fileListDiv.appendChild(fileItem);
            });
        }

        modal.classList.remove('hidden');
    } catch (err) {
        showToast('Failed to load user files');
    }
};


// ========== ADMIN PANEL ==========

function setupNavigation() {
    const filesNavBtn = document.getElementById('files-nav-btn');
    const adminNavBtn = document.getElementById('admin-nav-btn');

    filesNavBtn.addEventListener('click', () => {
        filesNavBtn.classList.add('active');
        adminNavBtn.classList.remove('active');
        showFilesView();
    });

    adminNavBtn.addEventListener('click', () => {
        adminNavBtn.classList.add('active');
        filesNavBtn.classList.remove('active');
        showAdminPanel();
    });
}

function showFilesView() {
    document.getElementById('files-view').classList.remove('hidden');
    document.getElementById('admin-panel').classList.add('hidden');
}

function showAdminPanel() {
    document.getElementById('files-view').classList.add('hidden');
    document.getElementById('admin-panel').classList.remove('hidden');
    loadUsers();
}

// Load all users
async function loadUsers() {
    try {
        const res = await fetch(`${API_URL}/admin/users`);
        const users = await res.json();
        renderUsers(users);
    } catch (err) {
        showToast('Failed to load users');
    }
}

// Render users list
function renderUsers(users) {
    const usersList = document.getElementById('users-list');
    usersList.innerHTML = '';

    users.forEach(user => {
        const userCard = document.createElement('div');
        userCard.className = 'user-card';
        userCard.innerHTML = `
            <div class="user-info-section">
                <div class="user-header">
                    <h3>${user.username} ${user.is_admin ? '<span class="admin-badge">ADMIN</span>' : ''}</h3>
                    <span class="user-status ${user.is_banned ? 'banned' : 'active'}">${user.is_banned ? 'Banned' : 'Active'}</span>
                </div>
                <p style="color: var(--text-secondary); font-size: 0.9rem;">Joined: ${new Date(user.created_at).toLocaleDateString()}</p>
            </div>
            <div class="user-actions">
                ${user.username !== 'root' ? `
                    <button class="btn ${user.is_banned ? 'btn-primary' : 'btn-danger'}" onclick="toggleBanUser(${user.id}, ${user.is_banned})">
                        <i class="fa-solid fa-${user.is_banned ? 'unlock' : 'ban'}"></i> ${user.is_banned ? 'Unban' : 'Ban'}
                    </button>
                    <button class="btn btn-ghost" onclick="viewUserFiles(${user.id}, '${user.username}')">
                        <i class="fa-solid fa-folder"></i> View Files
                    </button>
                    <button class="btn btn-danger" onclick="deleteUser(${user.id}, '${user.username}')">
                        <i class="fa-solid fa-trash"></i> Delete
                    </button>
                ` : '<span style="color: var(--text-secondary);">Root admin cannot be modified</span>'}
            </div>
        `;
        usersList.appendChild(userCard);
    });
}

// Toggle ban user
window.toggleBanUser = async (userId, currentlyBanned) => {
    const action = currentlyBanned ? 'unban' : 'ban';
    if (!confirm(`Are you sure you want to ${action} this user?`)) return;

    try {
        const res = await fetch(`${API_URL}/admin/users/${userId}/ban`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ banned: !currentlyBanned })
        });

        if (res.ok) {
            showToast(`User ${action}ned successfully`);
            loadUsers();
        } else {
            const data = await res.json();
            showToast(data.error || 'Failed to update user');
        }
    } catch (err) {
        showToast('Error updating user');
    }
};

// Delete user
window.deleteUser = async (userId, username) => {
    if (!confirm(`Are you sure you want to delete user "${username}" and all their files? This cannot be undone!`)) return;

    try {
        const res = await fetch(`${API_URL}/admin/users/${userId}`, { method: 'DELETE' });

        if (res.ok) {
            showToast('User deleted successfully');
            loadUsers();
        } else {
            const data = await res.json();
            showToast(data.error || 'Failed to delete user');
        }
    } catch (err) {
        showToast('Error deleting user');
    }
};

// Copy admin file link
window.copyAdminLink = (id) => {
    const url = `${window.location.origin}${API_URL}/admin/files/${id}/view`;
    navigator.clipboard.writeText(url).then(() => showToast('Link copied to clipboard'));
};

// Preview admin file (similar to previewFile but uses admin endpoint)
window.previewAdminFile = async (id, category, name) => {
    const modal = document.getElementById('preview-modal');
    const body = document.getElementById('modal-body');
    const url = `${API_URL}/admin/files/${id}/content`;

    body.innerHTML = '';

    // Handle images
    if (category === 'image') {
        body.innerHTML = `<img src="${url}" class="preview-media">`;
    }
    // Handle videos
    else if (category === 'video') {
        body.innerHTML = `<video src="${url}" controls class="preview-media" autoplay></video>`;
    }
    // Handle audio
    else if (category === 'audio') {
        body.innerHTML = `<audio src="${url}" controls autoplay style="width: 100%"></audio><h3 style="color:white; text-align:center; margin-top:1rem">${name}</h3>`;
    }
    // Handle documents (enhanced support)
    else if (category === 'document') {
        const ext = name.split('.').pop().toLowerCase();

        // PDF files
        if (ext === 'pdf') {
            await renderPDF(url, body);
        }
        // CSV files - render as table
        else if (ext === 'csv') {
            try {
                const response = await fetch(url);
                const text = await response.text();
                body.innerHTML = `
                    <div style="background: white; padding: 2rem; border-radius: 12px; max-width: 1400px; max-height: 80vh; overflow-y: auto;">
                        ${parseCSV(text)}
                    </div>
                `;
            } catch (err) {
                body.innerHTML = `<p style="color: white;">Failed to load CSV</p>`;
            }
        }
        // Markdown files
        else if (ext === 'md' || ext === 'markdown') {
            try {
                const response = await fetch(url);
                const text = await response.text();
                body.innerHTML = `
                    <div style="background: white; padding: 2rem; border-radius: 12px; max-width: 1400px; max-height: 80vh; overflow-y: auto; color: #333;">
                        <div id="markdown-content"></div>
                    </div>
                `;
                const script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/npm/marked/marked.min.js';
                script.onload = () => {
                    document.getElementById('markdown-content').innerHTML = marked.parse(text);
                };
                document.head.appendChild(script);
            } catch (err) {
                body.innerHTML = `<p style="color: white;">Failed to load markdown</p>`;
            }
        }
        // Code files and text files with syntax highlighting
        else if (canPreviewAsText(name)) {
            try {
                const response = await fetch(url);
                const text = await response.text();
                const language = getLanguageForFile(name);

                body.innerHTML = `
                    <div style="background: #0d1117; padding: 2rem; border-radius: 12px; max-width: 1400px; max-height: 80vh; overflow-y: auto;">
                        <div style="background: #161b22; padding: 1rem; border-radius: 8px; margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center;">
                            <span style="color: #8b949e; font-size: 0.9rem;"><i class="fa-solid fa-file-code"></i> ${name}</span>
                            <div style="display: flex; gap: 0.5rem;">
                                <button id="copy-text-btn-admin" class="btn btn-ghost" style="padding: 0.4rem 0.8rem; font-size: 0.85rem;" title="复制文本">
                                    <i class="fa-solid fa-copy"></i> 复制
                                </button>
                                <button id="toggle-wrap-btn-admin" class="btn btn-ghost" style="padding: 0.4rem 0.8rem; font-size: 0.85rem;" title="切换换行">
                                    <i class="fa-solid fa-arrows-left-right"></i> 换行
                                </button>
                            </div>
                        </div>
                        <pre id="code-preview-pre-admin" style="white-space: pre; overflow-x: auto;"><code class="language-${language}">${escapeHtml(text)}</code></pre>
                    </div>
                `;

                // Apply syntax highlighting
                document.querySelectorAll('pre code').forEach((block) => {
                    hljs.highlightElement(block);
                });

                // Store the original text for copying
                const copyBtn = document.getElementById('copy-text-btn-admin');
                const toggleWrapBtn = document.getElementById('toggle-wrap-btn-admin');
                const preElement = document.getElementById('code-preview-pre-admin');
                let isWrapped = false;

                // Copy text functionality
                copyBtn.addEventListener('click', async () => {
                    try {
                        await navigator.clipboard.writeText(text);
                        copyBtn.innerHTML = '<i class="fa-solid fa-check"></i> 已复制';
                        setTimeout(() => {
                            copyBtn.innerHTML = '<i class="fa-solid fa-copy"></i> 复制';
                        }, 2000);
                        showToast('文本已复制到剪贴板');
                    } catch (err) {
                        showToast('复制失败，请手动复制');
                    }
                });

                // Toggle wrap functionality
                toggleWrapBtn.addEventListener('click', () => {
                    isWrapped = !isWrapped;
                    if (isWrapped) {
                        preElement.style.whiteSpace = 'pre-wrap';
                        preElement.style.overflowX = 'visible';
                        toggleWrapBtn.innerHTML = '<i class="fa-solid fa-arrows-left-right"></i> 不换行';
                    } else {
                        preElement.style.whiteSpace = 'pre';
                        preElement.style.overflowX = 'auto';
                        toggleWrapBtn.innerHTML = '<i class="fa-solid fa-arrows-left-right"></i> 换行';
                    }
                });
            } catch (err) {
                body.innerHTML = `<p style="color: white;">Failed to load file</p>`;
            }
        }
        // Other document types - open in new tab
        else {
            window.open(url, '_blank');
            return;
        }
    }
    // For other types, open in new tab
    else {
        window.open(url, '_blank');
        return;
    }

    modal.classList.remove('hidden');
};

// Download admin file
window.downloadAdminFile = (id, name) => {
    const link = document.createElement('a');
    link.href = `${API_URL}/admin/files/${id}/content`;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

// Admin delete file
window.adminDeleteFile = async (fileId, filename, userId, username) => {
    if (!confirm(`Delete file "${filename}"?`)) return;

    try {
        const res = await fetch(`${API_URL}/admin/files/${fileId}`, { method: 'DELETE' });

        if (res.ok) {
            showToast('File deleted');
            // Refresh the file list in the modal
            if (userId && username) {
                viewUserFiles(userId, username);
            }
        } else {
            showToast('Failed to delete file');
        }
    } catch (err) {
        showToast('Error deleting file');
    }
};

// Copy admin file link
window.copyAdminLink = async (id) => {
    try {
        const res = await fetch(`${API_URL}/files/${id}/share`, { method: 'POST' });
        const data = await res.json();

        if (res.ok) {
            // 尝试使用现代剪贴板 API
            if (navigator.clipboard && navigator.clipboard.writeText) {
                try {
                    await navigator.clipboard.writeText(data.shareUrl);
                    showToast('分享链接已复制到剪贴板');
                    return;
                } catch (clipboardErr) {
                    console.warn('现代剪贴板 API 失败，使用备用方案:', clipboardErr);
                }
            }

            // 备用方案：使用传统的 execCommand 方法
            const textarea = document.createElement('textarea');
            textarea.value = data.shareUrl;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();

            try {
                const successful = document.execCommand('copy');
                if (successful) {
                    showToast('分享链接已复制到剪贴板');
                } else {
                    showToast(`分享链接: ${data.shareUrl}`);
                }
            } catch (execErr) {
                console.error('execCommand 复制失败:', execErr);
                showToast(`分享链接: ${data.shareUrl}`);
            } finally {
                document.body.removeChild(textarea);
            }
        } else {
            showToast(data.error || '生成分享链接失败');
        }
    } catch (err) {
        console.error('分享错误:', err);
        showToast('生成分享链接时出错');
    }
};

// Change Password
document.getElementById('change-password-btn').addEventListener('click', () => {
    const modal = document.getElementById('preview-modal');
    const body = document.getElementById('modal-body');

    body.innerHTML = `
        <div style="background: var(--card-bg); padding: 2rem; border-radius: 12px; max-width: 500px;">
            <h2 style="margin-bottom: 1.5rem; color: white;">Change Password</h2>
            <form id="change-password-form" style="display: flex; flex-direction: column; gap: 1rem;">
                <div class="form-group">
                    <label style="color: var(--text-secondary); margin-bottom: 0.5rem; display: block;">Current Password</label>
                    <input type="password" id="current-password" required style="width: 100%; padding: 0.75rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.05); color: white;">
                </div>
                <div class="form-group">
                    <label style="color: var(--text-secondary); margin-bottom: 0.5rem; display: block;">New Password</label>
                    <input type="password" id="new-password" required style="width: 100%; padding: 0.75rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.05); color: white;">
                </div>
                <div class="form-group">
                    <label style="color: var(--text-secondary); margin-bottom: 0.5rem; display: block;">Confirm New Password</label>
                    <input type="password" id="confirm-password" required style="width: 100%; padding: 0.75rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.05); color: white;">
                </div>
                <div style="display: flex; gap: 1rem; margin-top: 1rem;">
                    <button type="submit" class="btn btn-primary" style="flex: 1;">Change Password</button>
                    <button type="button" class="btn btn-ghost" onclick="closeModal()" style="flex: 1;">Cancel</button>
                </div>
            </form>
        </div>
    `;

    modal.classList.remove('hidden');

    document.getElementById('change-password-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        const currentPassword = document.getElementById('current-password').value;
        const newPassword = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;

        if (newPassword !== confirmPassword) {
            showToast('New passwords do not match');
            return;
        }

        if (newPassword.length < 4) {
            showToast('New password must be at least 4 characters');
            return;
        }

        try {
            const res = await fetch(`${API_URL}/auth/change-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentPassword, newPassword })
            });

            const data = await res.json();

            if (res.ok) {
                showToast('Password changed successfully');
                closeModal();
            } else {
                showToast(data.error || 'Failed to change password');
            }
        } catch (err) {
            showToast('Error changing password');
        }
    });
});

