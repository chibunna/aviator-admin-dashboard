// Configuration
const API_BASE_URL = 'https://aviator-control-api.onrender.com';
const REFRESH_INTERVAL = 30000; // 30 seconds
const MAX_OFFLINE_HOURS = 48; // Consider bot offline after 48 hours

// Global state
let botsData = {};
let filteredBots = {};
let refreshTimer = null;

// Authentication check
function checkAuth() {
    const isAuthenticated = localStorage.getItem('aviator_admin_auth') === 'true';
    const loginTime = localStorage.getItem('aviator_admin_login_time');
    
    if (!isAuthenticated || !loginTime) {
        redirectToLogin();
        return false;
    }
    
    // Check if session expired (24 hours)
    const now = Date.now();
    const hoursSinceLogin = (now - parseInt(loginTime)) / (1000 * 60 * 60);
    
    if (hoursSinceLogin >= 24) {
        logout();
        return false;
    }
    
    return true;
}

function redirectToLogin() {
    window.location.href = 'login.html';
}

function logout() {
    localStorage.removeItem('aviator_admin_auth');
    localStorage.removeItem('aviator_admin_login_time');
    redirectToLogin();
}

// API Functions
async function fetchBotsData() {
    try {
        const response = await fetch(`${API_BASE_URL}/dashboard`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching bots data:', error);
        throw error;
    }
}

async function setGlobalKill(killStatus) {
    try {
        const response = await fetch(`${API_BASE_URL}/admin/global-kill`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ kill: killStatus })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        return result;
    } catch (error) {
        console.error('Error setting global kill:', error);
        throw error;
    }
}

async function setBotKill(username, hostname, killStatus) {
    try {
        const response = await fetch(`${API_BASE_URL}/admin/bot-kill`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: username,
                hostname: hostname,
                kill: killStatus
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        return result;
    } catch (error) {
        console.error('Error setting bot kill:', error);
        throw error;
    }
}

// Utility Functions
function formatTimestamp(timestamp) {
    if (!timestamp) return 'Never';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
}

function getBotStatus(bot) {
    if (bot.kill || bot.status === 'killed') {
        return { status: 'offline', label: 'Stopped', class: 'status-offline' };
    }
    
    if (!bot.last_checkin) {
        return { status: 'warning', label: 'No Check-in', class: 'status-warning' };
    }
    
    const lastCheckin = new Date(bot.last_checkin);
    const now = new Date();
    const hoursSinceCheckin = (now - lastCheckin) / (1000 * 60 * 60);
    
    if (hoursSinceCheckin > MAX_OFFLINE_HOURS) {
        return { status: 'offline', label: 'Offline', class: 'status-offline' };
    } else if (hoursSinceCheckin > 25) {
        return { status: 'warning', label: 'Warning', class: 'status-warning' };
    } else {
        return { status: 'online', label: 'Online', class: 'status-online' };
    }
}

function filterBots(searchTerm) {
    if (!searchTerm) {
        filteredBots = { ...botsData };
        return;
    }
    
    const term = searchTerm.toLowerCase();
    filteredBots = {};
    
    Object.keys(botsData.registered_bots || {}).forEach(botId => {
        const bot = botsData.registered_bots[botId];
        if (bot.username.toLowerCase().includes(term) || 
            bot.hostname.toLowerCase().includes(term)) {
            if (!filteredBots.registered_bots) {
                filteredBots.registered_bots = {};
            }
            filteredBots.registered_bots[botId] = bot;
        }
    });
}

// UI Functions
function updateStats() {
    const bots = botsData.registered_bots || {};
    const botIds = Object.keys(bots);
    
    let onlineCount = 0;
    let offlineCount = 0;
    
    botIds.forEach(botId => {
        const status = getBotStatus(bots[botId]);
        if (status.status === 'online') {
            onlineCount++;
        } else {
            offlineCount++;
        }
    });
    
    document.getElementById('totalBots').textContent = botIds.length;
    document.getElementById('onlineBots').textContent = onlineCount;
    document.getElementById('offlineBots').textContent = offlineCount;
    document.getElementById('lastUpdate').textContent = formatTimestamp(botsData.last_updated);
}

function renderBotCard(botId, bot) {
    const status = getBotStatus(bot);
    
    return `
        <div class="bot-card" data-bot-id="${botId}">
            <div class="bot-header">
                <div class="bot-info">
                    <h3>${bot.username}</h3>
                    <p>${bot.hostname}</p>
                </div>
                <div class="bot-status ${status.class}">
                    ${status.label}
                </div>
            </div>
            
            <div class="bot-details">
                <div class="bot-detail">
                    <span class="bot-detail-label">Operating System</span>
                    <span class="bot-detail-value">${bot.os || 'Unknown'}</span>
                </div>
                <div class="bot-detail">
                    <span class="bot-detail-label">IP Address</span>
                    <span class="bot-detail-value">${bot.ip || 'Unknown'}</span>
                </div>
                <div class="bot-detail">
                    <span class="bot-detail-label">Last Check-in</span>
                    <span class="bot-detail-value">${formatTimestamp(bot.last_checkin)}</span>
                </div>
                <div class="bot-detail">
                    <span class="bot-detail-label">Registered</span>
                    <span class="bot-detail-value">${formatTimestamp(bot.registered_at)}</span>
                </div>
            </div>
            
            <div class="bot-actions">
                <button class="btn ${bot.kill ? 'btn-secondary' : 'btn-danger'} bot-kill-btn" 
                        data-username="${bot.username}" 
                        data-hostname="${bot.hostname}"
                        data-kill="${!bot.kill}">
                    ${bot.kill ? '▶️ Start' : '🛑 Stop'}
                </button>
            </div>
        </div>
    `;
}

function renderBots() {
    const botsGrid = document.getElementById('botsGrid');
    const noBots = document.getElementById('noBots');
    const visibleBotCount = document.getElementById('visibleBotCount');
    
    const bots = filteredBots.registered_bots || {};
    const botIds = Object.keys(bots);
    
    if (botIds.length === 0) {
        botsGrid.innerHTML = '';
        noBots.style.display = 'block';
        visibleBotCount.textContent = '0';
        return;
    }
    
    noBots.style.display = 'none';
    
    const botsHtml = botIds.map(botId => 
        renderBotCard(botId, bots[botId])
    ).join('');
    
    botsGrid.innerHTML = botsHtml;
    visibleBotCount.textContent = botIds.length;
    
    // Attach event listeners to bot action buttons
    document.querySelectorAll('.bot-kill-btn').forEach(btn => {
        btn.addEventListener('click', handleBotKillClick);
    });
}

function showError(message) {
    const errorMessage = document.getElementById('errorMessage');
    const errorText = document.getElementById('errorText');
    
    errorText.textContent = message;
    errorMessage.style.display = 'flex';
}

function hideError() {
    document.getElementById('errorMessage').style.display = 'none';
}

function showLoading() {
    document.getElementById('loadingIndicator').style.display = 'block';
}

function hideLoading() {
    document.getElementById('loadingIndicator').style.display = 'none';
}

function showModal(title, message, onConfirm) {
    const modal = document.getElementById('confirmModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalMessage = document.getElementById('modalMessage');
    const modalConfirm = document.getElementById('modalConfirm');
    
    modalTitle.textContent = title;
    modalMessage.textContent = message;
    modal.style.display = 'flex';
    
    // Remove previous event listeners
    const newConfirmBtn = modalConfirm.cloneNode(true);
    modalConfirm.parentNode.replaceChild(newConfirmBtn, modalConfirm);
    
    // Add new event listener
    newConfirmBtn.addEventListener('click', () => {
        hideModal();
        onConfirm();
    });
}

function hideModal() {
    document.getElementById('confirmModal').style.display = 'none';
}

// Event Handlers
async function handleRefresh() {
    const refreshIcon = document.getElementById('refreshIcon');
    const originalIcon = refreshIcon.textContent;
    
    try {
        refreshIcon.textContent = '⟳';
        refreshIcon.style.animation = 'spin 1s linear infinite';
        
        await loadDashboardData();
    } catch (error) {
        showError(`Failed to refresh data: ${error.message}`);
    } finally {
        refreshIcon.textContent = originalIcon;
        refreshIcon.style.animation = 'none';
    }
}

async function handleGlobalKill() {
    const isCurrentlyKilled = botsData.global_kill;
    const action = isCurrentlyKilled ? 'resume' : 'stop';
    const actionTitle = isCurrentlyKilled ? 'Resume All Bots' : 'Emergency Stop';
    const actionMessage = isCurrentlyKilled 
        ? 'Are you sure you want to resume all bots? They will continue normal operation.'
        : 'Are you sure you want to stop ALL bots? This will shut down every running instance.';
    
    showModal(actionTitle, actionMessage, async () => {
        try {
            await setGlobalKill(!isCurrentlyKilled);
            await loadDashboardData(); // Refresh data
        } catch (error) {
            showError(`Failed to ${action} all bots: ${error.message}`);
        }
    });
}

async function handleBotKillClick(event) {
    const btn = event.target;
    const username = btn.dataset.username;
    const hostname = btn.dataset.hostname;
    const kill = btn.dataset.kill === 'true';
    
    const action = kill ? 'stop' : 'start';
    const actionTitle = kill ? 'Stop Bot' : 'Start Bot';
    const actionMessage = `Are you sure you want to ${action} the bot "${username}" on "${hostname}"?`;
    
    showModal(actionTitle, actionMessage, async () => {
        try {
            await setBotKill(username, hostname, kill);
            await loadDashboardData(); // Refresh data
        } catch (error) {
            showError(`Failed to ${action} bot: ${error.message}`);
        }
    });
}

function handleSearch(event) {
    const searchTerm = event.target.value;
    filterBots(searchTerm);
    renderBots();
}

// Main Functions
async function loadDashboardData() {
    try {
        hideError();
        showLoading();
        
        const data = await fetchBotsData();
        botsData = data;
        filteredBots = { ...data };
        
        updateStats();
        renderBots();
        
        // Update global kill button
        const globalKillBtn = document.getElementById('globalKillBtn');
        if (data.global_kill) {
            globalKillBtn.innerHTML = `
                <span>▶️</span>
                <div>
                    <strong>RESUME ALL</strong>
                    <small>Start All Bots</small>
                </div>
            `;
            globalKillBtn.className = 'btn btn-primary btn-large';
        } else {
            globalKillBtn.innerHTML = `
                <span>🛑</span>
                <div>
                    <strong>EMERGENCY STOP</strong>
                    <small>Stop All Bots</small>
                </div>
            `;
            globalKillBtn.className = 'btn btn-danger btn-large';
        }
        
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        showError(`Failed to load data: ${error.message}`);
    } finally {
        hideLoading();
    }
}

function startAutoRefresh() {
    refreshTimer = setInterval(() => {
        loadDashboardData();
    }, REFRESH_INTERVAL);
}

function stopAutoRefresh() {
    if (refreshTimer) {
        clearInterval(refreshTimer);
        refreshTimer = null;
    }
}

// Initialization
document.addEventListener('DOMContentLoaded', async () => {
    // Check authentication
    if (!checkAuth()) {
        return;
    }
    
    // Set up event listeners
    document.getElementById('refreshBtn').addEventListener('click', handleRefresh);
    document.getElementById('logoutBtn').addEventListener('click', logout);
    document.getElementById('globalKillBtn').addEventListener('click', handleGlobalKill);
    document.getElementById('searchInput').addEventListener('input', handleSearch);
    document.getElementById('retryBtn').addEventListener('click', loadDashboardData);
    document.getElementById('modalCancel').addEventListener('click', hideModal);
    
    // Close modal when clicking outside
    document.getElementById('confirmModal').addEventListener('click', (e) => {
        if (e.target.id === 'confirmModal') {
            hideModal();
        }
    });
    
    // Load initial data
    await loadDashboardData();
    
    // Start auto-refresh
    startAutoRefresh();
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    stopAutoRefresh();
});
