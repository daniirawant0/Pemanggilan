/**
 * Pemanggil (Caller) Dashboard JavaScript
 * Handles call initiation, status polling, and UI updates
 */

(function() {
  'use strict';

  // ================================================
  // Configuration
  // ================================================
  const API_BASE = 'api/call.php';
  const POLL_INTERVAL = 1000;       // Poll every 1 second
  const HEARTBEAT_INTERVAL = 5000;  // Heartbeat every 5 seconds

  // ================================================
  // DOM Elements
  // ================================================
  const callBtn = document.getElementById('call-btn');
  const callStatusText = document.getElementById('call-status-text');
  const ripple1 = document.getElementById('ripple-1');
  const ripple2 = document.getElementById('ripple-2');
  const ripple3 = document.getElementById('ripple-3');
  const receiverDot = document.getElementById('receiver-dot');
  const receiverStatusText = document.getElementById('receiver-status-text');
  const totalCallsEl = document.getElementById('total-calls');
  const callLogList = document.getElementById('call-log-list');
  const callLogEmpty = document.getElementById('call-log-empty');
  const toastContainer = document.getElementById('toast-container');

  // Name settings elements
  const callerNameInput = document.getElementById('caller-name-input');
  const saveNameBtn = document.getElementById('save-name-btn');
  const callerNameDisplay = document.getElementById('caller-name-display');
  const callerNameAvatar = document.getElementById('caller-name-avatar');
  const callerNameValue = document.getElementById('caller-name-value');
  const editNameBtn = document.getElementById('edit-name-btn');
  const settingsForm = document.getElementById('settings-form');

  // ================================================
  // State
  // ================================================
  let currentStatus = 'idle';
  let callTimer = null;
  let callDuration = 0;
  let pollTimer = null;
  let heartbeatTimer = null;
  let totalCalls = 0;
  let callerName = localStorage.getItem('callerName') || '';

  // ================================================
  // Caller Name Management
  // ================================================
  function getInitial(name) {
    if (!name) return '?';
    return name.trim().charAt(0).toUpperCase();
  }

  function saveName() {
    const name = callerNameInput.value.trim();
    if (!name) {
      showToast('Masukkan nama terlebih dahulu', 'warning');
      callerNameInput.focus();
      return;
    }

    callerName = name;
    localStorage.setItem('callerName', callerName);

    // Update display
    callerNameValue.textContent = callerName;
    callerNameAvatar.textContent = getInitial(callerName);
    callerNameDisplay.classList.add('active');
    settingsForm.style.display = 'none';

    // Show saved animation on button
    saveNameBtn.classList.add('saved');
    saveNameBtn.innerHTML = '✅ Tersimpan';
    setTimeout(() => {
      saveNameBtn.classList.remove('saved');
      saveNameBtn.innerHTML = '💾 Simpan';
    }, 1500);

    showToast(`Nama diset: ${callerName}`, 'success');
  }

  function editName() {
    settingsForm.style.display = 'flex';
    callerNameDisplay.classList.remove('active');
    callerNameInput.value = callerName;
    callerNameInput.focus();
  }

  function loadSavedName() {
    if (callerName) {
      callerNameInput.value = callerName;
      callerNameValue.textContent = callerName;
      callerNameAvatar.textContent = getInitial(callerName);
      callerNameDisplay.classList.add('active');
      settingsForm.style.display = 'none';
    }
  }

  // ================================================
  // API Functions
  // ================================================
  async function apiCall(action, method = 'GET', body = null) {
    try {
      const options = { method, headers: { 'Content-Type': 'application/json' } };
      if (body) options.body = JSON.stringify(body);
      const response = await fetch(`${API_BASE}?action=${action}`, options);
      return await response.json();
    } catch (error) {
      console.error('API Error:', error);
      return { success: false, error: error.message };
    }
  }

  // ================================================
  // Call Management
  // ================================================
  async function initiateCall() {
    if (currentStatus === 'calling') {
      await cancelCall();
      return;
    }

    const result = await apiCall('call', 'POST', { caller_name: callerName });
    if (result.success) {
      setCallingState();
      showToast('Panggilan dimulai!', 'info');
      totalCalls++;
      totalCallsEl.textContent = totalCalls;
    } else {
      showToast(result.error || 'Gagal melakukan panggilan', 'error');
    }
  }

  async function cancelCall() {
    const result = await apiCall('cancel', 'POST');
    if (result.success) {
      setIdleState();
      showToast('Panggilan dibatalkan', 'warning');
    }
  }

  function setCallingState() {
    currentStatus = 'calling';
    callBtn.classList.add('calling');
    callBtn.innerHTML = '📵';
    callStatusText.textContent = 'Memanggil... Tekan untuk membatalkan';
    callStatusText.classList.add('active');

    // Activate ripples
    ripple1.classList.add('active');
    ripple2.classList.add('active');
    ripple3.classList.add('active');

    // Start timer
    callDuration = 0;
    callTimer = setInterval(() => {
      callDuration++;
      const mins = Math.floor(callDuration / 60).toString().padStart(2, '0');
      const secs = (callDuration % 60).toString().padStart(2, '0');
      callStatusText.textContent = `Memanggil... ${mins}:${secs} — Tekan untuk membatalkan`;
    }, 1000);
  }

  function setIdleState() {
    currentStatus = 'idle';
    callBtn.classList.remove('calling');
    callBtn.innerHTML = '📞';
    callStatusText.textContent = 'Tekan tombol untuk memanggil';
    callStatusText.classList.remove('active');

    // Deactivate ripples
    ripple1.classList.remove('active');
    ripple2.classList.remove('active');
    ripple3.classList.remove('active');

    // Stop timer
    if (callTimer) {
      clearInterval(callTimer);
      callTimer = null;
    }
    callDuration = 0;
  }

  function setAnsweredState() {
    currentStatus = 'answered';
    callBtn.classList.add('calling');
    callBtn.innerHTML = '📵';
    callStatusText.textContent = 'Panggilan dijawab! Tekan untuk mengakhiri';
    callStatusText.classList.add('active');
    callStatusText.style.color = 'var(--accent-receiver-light)';

    // Keep ripples but change style
    ripple1.classList.add('active');
    ripple2.classList.remove('active');
    ripple3.classList.remove('active');
  }

  // ================================================
  // Status Polling
  // ================================================
  async function pollStatus() {
    const result = await apiCall('status');
    if (!result.success) return;

    const data = result.data;

    // Update receiver status
    if (data.receiver_active) {
      receiverDot.classList.remove('offline');
      receiverDot.classList.add('online');
      receiverStatusText.textContent = 'Online';
    } else {
      receiverDot.classList.remove('online');
      receiverDot.classList.add('offline');
      receiverStatusText.textContent = 'Offline';
    }

    // Handle status changes from receiver side
    if (currentStatus === 'calling' && data.status === 'answered') {
      setAnsweredState();
      showToast('Panggilan dijawab oleh penerima!', 'success');
    } else if (currentStatus === 'calling' && data.status === 'idle') {
      // Call was rejected by receiver
      setIdleState();
      showToast('Panggilan ditolak oleh penerima', 'error');
    } else if (currentStatus === 'answered' && data.status === 'idle') {
      // Call ended by receiver
      setIdleState();
      callStatusText.style.color = '';
      showToast('Panggilan diakhiri oleh penerima', 'info');
    } else if (currentStatus === 'idle' && data.status === 'idle') {
      // Normal idle state, nothing to do
    }
  }

  // ================================================
  // Heartbeat
  // ================================================
  async function sendHeartbeat() {
    await apiCall('heartbeat', 'POST', { role: 'caller' });
  }

  // ================================================
  // Call Log
  // ================================================
  async function loadCallLog() {
    const result = await apiCall('log');
    if (!result.success) return;

    const logs = result.data;
    if (!logs || logs.length === 0) {
      callLogEmpty.style.display = 'block';
      return;
    }

    callLogEmpty.style.display = 'none';

    // Clear existing items (except empty placeholder)
    const items = callLogList.querySelectorAll('.call-log-item');
    items.forEach(item => item.remove());

    // Show last 10 entries
    const recentLogs = logs.slice(0, 10);
    recentLogs.forEach(log => {
      const li = document.createElement('li');
      li.className = 'call-log-item';

      let iconClass = 'outgoing';
      let icon = '📲';
      if (log.type === 'incoming') {
        iconClass = 'incoming';
        icon = '📥';
      } else if (log.type === 'missed') {
        iconClass = 'missed';
        icon = '📵';
      }

      li.innerHTML = `
        <div class="call-log-item-left">
          <div class="call-log-item-icon ${iconClass}">${icon}</div>
          <span class="call-log-item-text">${log.message}</span>
        </div>
        <span class="call-log-item-time">${formatTime(log.timestamp)}</span>
      `;

      callLogList.appendChild(li);
    });
  }

  function formatTime(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  }

  // ================================================
  // Toast Notifications
  // ================================================
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '❌';
    if (type === 'warning') icon = '⚠️';

    toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
    toastContainer.appendChild(toast);

    // Remove after 4 seconds
    setTimeout(() => {
      toast.classList.add('removing');
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  // ================================================
  // Event Listeners
  // ================================================
  callBtn.addEventListener('click', async () => {
    if (currentStatus === 'answered') {
      // End the answered call
      const result = await apiCall('end', 'POST');
      if (result.success) {
        setIdleState();
        callStatusText.style.color = '';
        showToast('Panggilan diakhiri', 'info');
      }
    } else {
      await initiateCall();
    }
  });

  // ================================================
  // Initialize
  // ================================================
  function init() {
    // Send initial heartbeat
    sendHeartbeat();

    // Start polling
    pollTimer = setInterval(pollStatus, POLL_INTERVAL);

    // Start heartbeat
    heartbeatTimer = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);

    // Load call log
    loadCallLog();

    // Refresh call log every 10 seconds
    setInterval(loadCallLog, 10000);

    showToast('Dashboard pemanggil aktif', 'success');

    // Load saved name
    loadSavedName();
  }

  // Name event listeners
  saveNameBtn.addEventListener('click', saveName);
  editNameBtn.addEventListener('click', editName);
  callerNameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveName();
  });

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    if (pollTimer) clearInterval(pollTimer);
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    if (callTimer) clearInterval(callTimer);
  });

  init();
})();
