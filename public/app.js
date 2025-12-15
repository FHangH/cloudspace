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

                // Copy text functionality with fallback
                copyBtn.addEventListener('click', async () => {
                    try {
                        // Try modern clipboard API first
                        if (navigator.clipboard && navigator.clipboard.writeText) {
                            await navigator.clipboard.writeText(text);
                            copyBtn.innerHTML = '<i class="fa-solid fa-check"></i> 已复制';
                            setTimeout(() => {
                                copyBtn.innerHTML = '<i class="fa-solid fa-copy"></i> 复制';
                            }, 2000);
                            showToast('文本已复制到剪贴板');
                        } else {
                            // Fallback to execCommand for older browsers or non-HTTPS
                            const textarea = document.createElement('textarea');
                            textarea.value = text;
                            textarea.style.position = 'fixed';
                            textarea.style.opacity = '0';
                            textarea.style.top = '0';
                            textarea.style.left = '0';
                            document.body.appendChild(textarea);
                            textarea.select();
                            textarea.setSelectionRange(0, text.length);

                            const successful = document.execCommand('copy');
                            document.body.removeChild(textarea);

                            if (successful) {
                                copyBtn.innerHTML = '<i class="fa-solid fa-check"></i> 已复制';
                                setTimeout(() => {
                                    copyBtn.innerHTML = '<i class="fa-solid fa-copy"></i> 复制';
                                }, 2000);
                                showToast('文本已复制到剪贴板');
                            } else {
                                showToast('复制失败，请手动选择文本复制');
                            }
                        }
                    } catch (err) {
                        console.error('复制错误:', err);
                        // Final fallback: try execCommand
                        try {
                            const textarea = document.createElement('textarea');
                            textarea.value = text;
                            textarea.style.position = 'fixed';
                            textarea.style.opacity = '0';
                            textarea.style.top = '0';
                            textarea.style.left = '0';
                            document.body.appendChild(textarea);
                            textarea.select();
                            textarea.setSelectionRange(0, text.length);

                            const successful = document.execCommand('copy');
                            document.body.removeChild(textarea);

                            if (successful) {
                                copyBtn.innerHTML = '<i class="fa-solid fa-check"></i> 已复制';
                                setTimeout(() => {
                                    copyBtn.innerHTML = '<i class="fa-solid fa-copy"></i> 复制';
                                }, 2000);
                                showToast('文本已复制到剪贴板');
                            } else {
                                showToast('复制失败，请手动选择文本复制');
                            }
                        } catch (fallbackErr) {
                            console.error('降级复制也失败:', fallbackErr);
                            showToast('复制失败，请手动选择文本复制');
                        }
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
                    <button class="btn btn-ghost" onclick="viewUserNotes(${user.id}, '${user.username}')">
                        <i class="fa-solid fa-note-sticky"></i> View Notes
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

                // Copy text functionality with fallback
                copyBtn.addEventListener('click', async () => {
                    try {
                        // Try modern clipboard API first
                        if (navigator.clipboard && navigator.clipboard.writeText) {
                            await navigator.clipboard.writeText(text);
                            copyBtn.innerHTML = '<i class="fa-solid fa-check"></i> 已复制';
                            setTimeout(() => {
                                copyBtn.innerHTML = '<i class="fa-solid fa-copy"></i> 复制';
                            }, 2000);
                            showToast('文本已复制到剪贴板');
                        } else {
                            // Fallback to execCommand for older browsers or non-HTTPS
                            const textarea = document.createElement('textarea');
                            textarea.value = text;
                            textarea.style.position = 'fixed';
                            textarea.style.opacity = '0';
                            textarea.style.top = '0';
                            textarea.style.left = '0';
                            document.body.appendChild(textarea);
                            textarea.select();
                            textarea.setSelectionRange(0, text.length);

                            const successful = document.execCommand('copy');
                            document.body.removeChild(textarea);

                            if (successful) {
                                copyBtn.innerHTML = '<i class="fa-solid fa-check"></i> 已复制';
                                setTimeout(() => {
                                    copyBtn.innerHTML = '<i class="fa-solid fa-copy"></i> 复制';
                                }, 2000);
                                showToast('文本已复制到剪贴板');
                            } else {
                                showToast('复制失败，请手动选择文本复制');
                            }
                        }
                    } catch (err) {
                        console.error('复制错误:', err);
                        // Final fallback: try execCommand
                        try {
                            const textarea = document.createElement('textarea');
                            textarea.value = text;
                            textarea.style.position = 'fixed';
                            textarea.style.opacity = '0';
                            textarea.style.top = '0';
                            textarea.style.left = '0';
                            document.body.appendChild(textarea);
                            textarea.select();
                            textarea.setSelectionRange(0, text.length);

                            const successful = document.execCommand('copy');
                            document.body.removeChild(textarea);

                            if (successful) {
                                copyBtn.innerHTML = '<i class="fa-solid fa-check"></i> 已复制';
                                setTimeout(() => {
                                    copyBtn.innerHTML = '<i class="fa-solid fa-copy"></i> 复制';
                                }, 2000);
                                showToast('文本已复制到剪贴板');
                            } else {
                                showToast('复制失败，请手动选择文本复制');
                            }
                        } catch (fallbackErr) {
                            console.error('降级复制也失败:', fallbackErr);
                            showToast('复制失败，请手动选择文本复制');
                        }
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


// ========== NOTES FUNCTIONALITY ==========

let currentNoteId = null;
let isEditMode = false;

// Show Notes View
function showNotesView() {
    document.getElementById('notes-view').classList.remove('hidden');
    document.getElementById('files-view').classList.add('hidden');
    document.getElementById('admin-panel').classList.add('hidden');

    // Reset UI to My Notes
    const header = document.querySelector('#notes-view h2');
    if (header) header.textContent = 'My Notes';
    const addNoteBtn = document.getElementById('add-note-btn');
    if (addNoteBtn) addNoteBtn.classList.remove('hidden');

    loadNotes();
}

// Load notes
async function loadNotes(searchQuery = '') {
    try {
        const url = searchQuery
            ? `${API_URL}/notes?search=${encodeURIComponent(searchQuery)}`
            : `${API_URL}/notes`;
        const res = await fetch(url);
        const notes = await res.json();
        renderNotes(notes);
    } catch (err) {
        showToast('Failed to load notes');
    }
}

// Render notes list
// Render notes list
function renderNotes(notes, isReadOnly = false, containerId = 'notes-list', isAdminView = false) {
    const notesList = document.getElementById(containerId);
    if (!notesList) return;
    notesList.innerHTML = '';

    if (notes.length === 0) {
        notesList.innerHTML = '<p style="text-align: center; color: var(--text-secondary); margin-top: 2rem;">No notes found. Create your first note!</p>';
        return;
    }

    notes.forEach(note => {
        if (typeof renderedNotesMap !== 'undefined') renderedNotesMap[note.id] = note;
        const noteCard = document.createElement('div');

        if (isAdminView) {
            noteCard.className = 'admin-note-item';
            noteCard.innerHTML = `
                <div class="note-info">
                    <span class="note-title">${escapeHtml(note.title)}</span>
                    <span class="note-snippet">${escapeHtml(note.content.substring(0, 50))}...</span>
                </div>
                <div class="note-actions" onclick="event.stopPropagation()">
                    <button class="btn btn-ghost" onclick="handleNoteAction('copy', ${note.id}, this)" title="复制">
                        <i class="fa-solid fa-copy"></i>
                    </button>
                    <button class="btn btn-ghost" onclick="handleNoteAction('link', ${note.id}, this)" title="链接">
                        <i class="fa-solid fa-link"></i>
                    </button>
                    <button class="btn btn-ghost" onclick="handleNoteAction('download', ${note.id}, this)" title="下载">
                        <i class="fa-solid fa-download"></i>
                    </button>
                </div>
            `;
        } else {
            noteCard.className = 'note-card';
            const preview = note.content.substring(0, 100) + (note.content.length > 100 ? '...' : '');
            const createdDate = new Date(note.created_at).toLocaleDateString();

            noteCard.innerHTML = `
                <div class="note-card-header">
                    <h3 class="note-title">${escapeHtml(note.title)}</h3>
                    ${isReadOnly ? '' : `
                    <div class="note-actions" onclick="event.stopPropagation()">
                        <button class="btn btn-ghost" style="padding: 0.4rem 0.8rem;" onclick="editNote(${note.id})" title="编辑">
                            <i class="fa-solid fa-edit"></i>
                        </button>
                        <button class="btn btn-ghost" style="padding: 0.4rem 0.8rem;" onclick="deleteNote(${note.id})" title="删除">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                    `}
                </div>
                <div class="note-preview">${escapeHtml(preview)}</div>
                <div class="note-meta">
                    <span><i class="fa-solid fa-calendar"></i> ${createdDate}</span>
                    <span>${note.content.length} 字符</span>
                </div>
            `;
        }

        noteCard.onclick = () => {
            if (isReadOnly) {
                previewAdminNote(note.id);
            } else {
                previewNote(note.id, note.title);
            }
        };
        notesList.appendChild(noteCard);
    });
}

// Open note modal for creating new note
function openNoteModal() {
    currentNoteId = null;
    isEditMode = false;
    document.getElementById('note-modal-title').textContent = '新建笔记';
    document.getElementById('note-title').value = '';
    document.getElementById('note-content').value = '';
    document.getElementById('note-modal').classList.remove('hidden');
}

// Close note modal
window.closeNoteModal = () => {
    document.getElementById('note-modal').classList.add('hidden');
    currentNoteId = null;
    isEditMode = false;
};

// Edit note
window.editNote = async (id) => {
    try {
        const res = await fetch(`${API_URL}/notes/${id}`);
        const note = await res.json();

        currentNoteId = id;
        isEditMode = true;
        document.getElementById('note-modal-title').textContent = '编辑笔记';
        document.getElementById('note-title').value = note.title;
        document.getElementById('note-content').value = note.content;
        document.getElementById('note-modal').classList.remove('hidden');
    } catch (err) {
        showToast('Failed to load note');
    }
};

// Delete note
window.deleteNote = async (id) => {
    if (!confirm('确定要删除这条笔记吗？')) return;

    try {
        const res = await fetch(`${API_URL}/notes/${id}`, { method: 'DELETE' });
        if (res.ok) {
            showToast('笔记已删除');
            loadNotes();
        } else {
            showToast('删除失败');
        }
    } catch (err) {
        showToast('删除失败');
    }
};

// Preview note
async function previewNote(id, title) {
    try {
        const res = await fetch(`${API_URL}/notes/${id}`);
        const note = await res.json();

        const modal = document.getElementById('preview-modal');
        const body = document.getElementById('modal-body');

        body.innerHTML = `
            <div style="background: #0d1117; padding: 2rem; border-radius: 12px; max-width: 1400px; max-height: 80vh; overflow-y: auto;">
                <div style="background: #161b22; padding: 1rem; border-radius: 8px; margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: #8b949e; font-size: 0.9rem;"><i class="fa-solid fa-note-sticky"></i> ${escapeHtml(note.title)}</span>
                    <div style="display: flex; gap: 0.5rem;">
                        <button id="copy-note-btn" class="btn btn-ghost" style="padding: 0.4rem 0.8rem; font-size: 0.85rem;" title="复制内容">
                            <i class="fa-solid fa-copy"></i> 复制
                        </button>
                        <button id="copy-note-link-btn" class="btn btn-ghost" style="padding: 0.4rem 0.8rem; font-size: 0.85rem;" title="复制链接">
                            <i class="fa-solid fa-link"></i> 链接
                        </button>
                        <button id="download-note-btn" class="btn btn-ghost" style="padding: 0.4rem 0.8rem; font-size: 0.85rem;" title="下载">
                            <i class="fa-solid fa-download"></i> 下载
                        </button>
                        <button id="toggle-note-wrap-btn" class="btn btn-ghost" style="padding: 0.4rem 0.8rem; font-size: 0.85rem;" title="切换换行">
                            <i class="fa-solid fa-arrows-left-right"></i> 换行
                        </button>
                        <button id="edit-note-preview-btn" class="btn btn-ghost" style="padding: 0.4rem 0.8rem; font-size: 0.85rem;" title="编辑">
                            <i class="fa-solid fa-edit"></i> 编辑
                        </button>
                    </div>
                </div>
                <pre id="note-preview-pre" style="white-space: pre-wrap; overflow-x: auto; color: #c9d1d9; background: #0d1117; padding: 1rem; border-radius: 8px; margin: 0;">${escapeHtml(note.content)}</pre>
            </div>
        `;

        // Copy content button
        const copyBtn = document.getElementById('copy-note-btn');
        copyBtn.addEventListener('click', async () => {
            try {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    await navigator.clipboard.writeText(note.content);
                    copyBtn.innerHTML = '<i class="fa-solid fa-check"></i> 已复制';
                    setTimeout(() => {
                        copyBtn.innerHTML = '<i class="fa-solid fa-copy"></i> 复制';
                    }, 2000);
                    showToast('内容已复制到剪贴板');
                } else {
                    const textarea = document.createElement('textarea');
                    textarea.value = note.content;
                    textarea.style.position = 'fixed';
                    textarea.style.opacity = '0';
                    document.body.appendChild(textarea);
                    textarea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textarea);
                    copyBtn.innerHTML = '<i class="fa-solid fa-check"></i> 已复制';
                    setTimeout(() => {
                        copyBtn.innerHTML = '<i class="fa-solid fa-copy"></i> 复制';
                    }, 2000);
                    showToast('内容已复制到剪贴板');
                }
            } catch (err) {
                showToast('复制失败');
            }
        });

        // Copy link button
        const copyLinkBtn = document.getElementById('copy-note-link-btn');
        copyLinkBtn.addEventListener('click', async () => {
            try {
                const shareRes = await fetch(`${API_URL}/notes/${id}/share`, { method: 'POST' });
                const shareData = await shareRes.json();

                if (shareRes.ok) {
                    if (navigator.clipboard && navigator.clipboard.writeText) {
                        await navigator.clipboard.writeText(shareData.shareUrl);
                    } else {
                        const textarea = document.createElement('textarea');
                        textarea.value = shareData.shareUrl;
                        textarea.style.position = 'fixed';
                        textarea.style.opacity = '0';
                        document.body.appendChild(textarea);
                        textarea.select();
                        document.execCommand('copy');
                        document.body.removeChild(textarea);
                    }
                    copyLinkBtn.innerHTML = '<i class="fa-solid fa-check"></i> 已复制';
                    setTimeout(() => {
                        copyLinkBtn.innerHTML = '<i class="fa-solid fa-link"></i> 链接';
                    }, 2000);
                    showToast('分享链接已复制');
                } else {
                    showToast('生成分享链接失败');
                }
            } catch (err) {
                showToast('生成分享链接失败');
            }
        });

        // Download button
        const downloadBtn = document.getElementById('download-note-btn');
        downloadBtn.addEventListener('click', () => {
            const blob = new Blob([note.content], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${note.title}.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showToast('笔记已下载');
        });

        // Toggle wrap button
        const toggleWrapBtn = document.getElementById('toggle-note-wrap-btn');
        const preElement = document.getElementById('note-preview-pre');
        let isWrapped = true;
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

        // Edit button
        const editBtn = document.getElementById('edit-note-preview-btn');
        editBtn.addEventListener('click', () => {
            closeModal();
            editNote(id);
        });

        modal.classList.remove('hidden');
    } catch (err) {
        showToast('Failed to load note');
    }
}

// Setup navigation for notes
document.addEventListener('DOMContentLoaded', () => {
    const notesNavBtn = document.getElementById('notes-nav-btn');
    const filesNavBtn = document.getElementById('files-nav-btn');
    const adminNavBtn = document.getElementById('admin-nav-btn');

    if (notesNavBtn) {
        notesNavBtn.addEventListener('click', () => {
            notesNavBtn.classList.add('active');
            filesNavBtn.classList.remove('active');
            adminNavBtn.classList.remove('active');
            showNotesView();
        });
    }

    // Add note button
    const addNoteBtn = document.getElementById('add-note-btn');
    if (addNoteBtn) {
        addNoteBtn.addEventListener('click', openNoteModal);
    }

    // Search notes
    const notesSearch = document.getElementById('notes-search');
    if (notesSearch) {
        let searchTimeout;
        notesSearch.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                loadNotes(e.target.value);
            }, 300);
        });
    }

    // Note form submission
    const noteForm = document.getElementById('note-form');
    if (noteForm) {
        noteForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const title = document.getElementById('note-title').value;
            const content = document.getElementById('note-content').value;

            try {
                let res;
                if (isEditMode && currentNoteId) {
                    // Update existing note
                    res = await fetch(`${API_URL}/notes/${currentNoteId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ title, content })
                    });
                } else {
                    // Create new note
                    res = await fetch(`${API_URL}/notes`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ title, content })
                    });
                }

                if (res.ok) {
                    showToast(isEditMode ? '笔记已更新' : '笔记已创建');
                    closeNoteModal();
                    loadNotes();
                } else {
                    showToast('保存失败');
                }
            } catch (err) {
                showToast('保存失败');
            }
        });
    }
});

// View User Notes (Admin)
window.viewUserNotes = async (userId, username) => {
    try {
        const res = await fetch(`${API_URL}/admin/users/${userId}/notes`);
        const notes = await res.json();

        const modal = document.getElementById('admin-notes-modal');
        const title = document.getElementById('admin-notes-title');

        title.textContent = `Notes of ${username}`;
        renderNotes(notes, true, 'admin-notes-list', true);

        modal.classList.remove('hidden');
    } catch (err) {
        showToast('Failed to load user notes');
    }
};

window.closeAdminNotesModal = () => {
    document.getElementById('admin-notes-modal').classList.add('hidden');
};

// Preview admin note
async function previewAdminNote(id) {
    try {
        const res = await fetch(`${API_URL}/admin/notes/${id}`);
        const note = await res.json();

        const modal = document.getElementById('preview-modal');
        const body = document.getElementById('modal-body');

        body.innerHTML = `
            <div class="note-preview-modal">
                <div class="note-preview-header">
                    <h3>${escapeHtml(note.title)} <span style="font-size: 0.8em; background: var(--primary-color); padding: 2px 6px; border-radius: 4px; margin-left: 8px;">Read Only</span></h3>
                    <div class="note-preview-actions">
                        <button class="btn btn-ghost" id="copy-note-content-btn"><i class="fa-solid fa-copy"></i> 复制</button>
                        <button class="btn btn-ghost" id="download-note-btn"><i class="fa-solid fa-download"></i> 下载</button>
                        <button class="btn btn-ghost" id="toggle-note-wrap-btn"><i class="fa-solid fa-arrows-left-right"></i> 换行</button>
                    </div>
                </div>
                <pre id="note-preview-pre">${escapeHtml(note.content)}</pre>
            </div>
        `;

        // Copy content button
        const copyBtn = document.getElementById('copy-note-content-btn');
        copyBtn.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(note.content);
                copyBtn.innerHTML = '<i class="fa-solid fa-check"></i> 已复制';
                setTimeout(() => {
                    copyBtn.innerHTML = '<i class="fa-solid fa-copy"></i> 复制';
                }, 2000);
                showToast('内容已复制到剪贴板');
            } catch (err) {
                showToast('复制失败');
            }
        });

        // Download button
        const downloadBtn = document.getElementById('download-note-btn');
        downloadBtn.addEventListener('click', () => {
            const blob = new Blob([note.content], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${note.title}.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showToast('笔记已下载');
        });

        // Toggle wrap button
        const toggleWrapBtn = document.getElementById('toggle-note-wrap-btn');
        const preElement = document.getElementById('note-preview-pre');
        let isWrapped = true;
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

        modal.classList.remove('hidden');
    } catch (err) {
        showToast('Failed to load note');
    }
}

// Helper functions for note actions
let renderedNotesMap = {};

window.handleNoteAction = (action, id, btn) => {
    const note = renderedNotesMap[id];
    if (!note) return;

    if (action === 'copy') copyNoteContent(note.content, btn);
    else if (action === 'link') copyNoteLink(id, btn);
    else if (action === 'download') downloadNote(note.title, note.content);
};

window.copyNoteContent = async (content, btn) => {
    try {
        await navigator.clipboard.writeText(content);
        const originalHtml = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-check"></i>';
        setTimeout(() => {
            btn.innerHTML = originalHtml;
        }, 2000);
        showToast('内容已复制');
    } catch (err) {
        showToast('复制失败');
    }
};

window.downloadNote = (title, content) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

window.copyNoteLink = async (id, btn) => {
    try {
        const res = await fetch(`${API_URL}/notes/${id}/share`, { method: 'POST' });
        const data = await res.json();
        if (data.shareUrl) {
            await navigator.clipboard.writeText(data.shareUrl);
            const originalHtml = btn.innerHTML;
            btn.innerHTML = '<i class="fa-solid fa-check"></i>';
            setTimeout(() => {
                btn.innerHTML = originalHtml;
            }, 2000);
            showToast('链接已复制');
        } else {
            showToast('获取链接失败');
        }
    } catch (err) {
        showToast('获取链接失败');
    }
};

// Update setupNavigation to include notes
const originalSetupNavigation = setupNavigation;
setupNavigation = function () {
    if (originalSetupNavigation) {
        originalSetupNavigation();
    }

    const notesNavBtn = document.getElementById('notes-nav-btn');
    const filesNavBtn = document.getElementById('files-nav-btn');
    const adminNavBtn = document.getElementById('admin-nav-btn');

    if (notesNavBtn) {
        notesNavBtn.addEventListener('click', () => {
            notesNavBtn.classList.add('active');
            filesNavBtn.classList.remove('active');
            if (adminNavBtn) adminNavBtn.classList.remove('active');
            showNotesView();
        });
    }

    if (filesNavBtn) {
        const oldFilesHandler = filesNavBtn.onclick;
        filesNavBtn.addEventListener('click', () => {
            if (notesNavBtn) notesNavBtn.classList.remove('active');
            document.getElementById('notes-view').classList.add('hidden');
        });
    }

    if (adminNavBtn) {
        const oldAdminHandler = adminNavBtn.onclick;
        adminNavBtn.addEventListener('click', () => {
            if (notesNavBtn) notesNavBtn.classList.remove('active');
            document.getElementById('notes-view').classList.add('hidden');
        });
    }
};
