/**
 * Penerima (Receiver) Dashboard JavaScript
 * Handles incoming call detection, ringtone, and UI updates
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
  const receiverIdle = document.getElementById('receiver-idle');
  const incomingCall = document.getElementById('incoming-call');
  const answeredState = document.getElementById('answered-state');
  const btnAnswer = document.getElementById('btn-answer');
  const btnReject = document.getElementById('btn-reject');
  const btnEnd = document.getElementById('btn-end');
  const callTimerEl = document.getElementById('call-timer');
  const connectedTimerEl = document.getElementById('connected-timer');
  const callerDot = document.getElementById('caller-dot');
  const callerStatusText = document.getElementById('caller-status-text');
  const totalReceivedEl = document.getElementById('total-received');
  const callLogList = document.getElementById('call-log-list');
  const callLogEmpty = document.getElementById('call-log-empty');
  const toastContainer = document.getElementById('toast-container');
  const notificationOverlay = document.getElementById('notification-overlay');
  const overlayAnswer = document.getElementById('overlay-answer');
  const overlayReject = document.getElementById('overlay-reject');

  // Caller name elements
  const incomingCallerAvatar = document.getElementById('incoming-caller-avatar');
  const incomingCallerName = document.getElementById('incoming-caller-name');
  const incomingCallSub = document.getElementById('incoming-call-sub');
  const answeredCallSub = document.getElementById('answered-call-sub');
  const overlayCallerAvatar = document.getElementById('overlay-caller-avatar');
  const overlayCallerName = document.getElementById('overlay-caller-name');
  const overlayCallSub = document.getElementById('overlay-call-sub');

  // ================================================
  // State
  // ================================================
  let currentStatus = 'idle';
  let callTimer = null;
  let callDuration = 0;
  let connectedTimer = null;
  let connectedDuration = 0;
  let pollTimer = null;
  let heartbeatTimer = null;
  let totalReceived = 0;
  let ringtoneContext = null;
  let ringtoneOscillators = [];
  let ringtoneInterval = null;
  let isRinging = false;
  let currentCallerName = '';

  // ================================================
  // Web Audio API - Ringtone Generator
  // ================================================
  function createRingtone() {
    if (ringtoneContext) return;

    try {
      ringtoneContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.error('Web Audio API not supported:', e);
    }
  }

  function startRingtone() {
    if (isRinging) return;
    isRinging = true;

    createRingtone();
    if (!ringtoneContext) return;

    // Resume audio context (required by browsers)
    if (ringtoneContext.state === 'suspended') {
      ringtoneContext.resume();
    }

    function playRingTone() {
      if (!isRinging) return;

      const now = ringtoneContext.currentTime;

      // Create a pleasant two-tone ring pattern
      // First tone
      const osc1 = ringtoneContext.createOscillator();
      const gain1 = ringtoneContext.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(523.25, now); // C5
      gain1.gain.setValueAtTime(0, now);
      gain1.gain.linearRampToValueAtTime(0.3, now + 0.05);
      gain1.gain.linearRampToValueAtTime(0.2, now + 0.3);
      gain1.gain.linearRampToValueAtTime(0, now + 0.5);
      osc1.connect(gain1);
      gain1.connect(ringtoneContext.destination);
      osc1.start(now);
      osc1.stop(now + 0.5);

      // Second tone (harmony)
      const osc2 = ringtoneContext.createOscillator();
      const gain2 = ringtoneContext.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(659.25, now); // E5
      gain2.gain.setValueAtTime(0, now);
      gain2.gain.linearRampToValueAtTime(0.2, now + 0.05);
      gain2.gain.linearRampToValueAtTime(0.15, now + 0.3);
      gain2.gain.linearRampToValueAtTime(0, now + 0.5);
      osc2.connect(gain2);
      gain2.connect(ringtoneContext.destination);
      osc2.start(now);
      osc2.stop(now + 0.5);

      // Third tone (higher)
      const osc3 = ringtoneContext.createOscillator();
      const gain3 = ringtoneContext.createGain();
      osc3.type = 'sine';
      osc3.frequency.setValueAtTime(783.99, now + 0.15); // G5
      gain3.gain.setValueAtTime(0, now + 0.15);
      gain3.gain.linearRampToValueAtTime(0.25, now + 0.2);
      gain3.gain.linearRampToValueAtTime(0.15, now + 0.5);
      gain3.gain.linearRampToValueAtTime(0, now + 0.8);
      osc3.connect(gain3);
      gain3.connect(ringtoneContext.destination);
      osc3.start(now + 0.15);
      osc3.stop(now + 0.8);

      // Second ring burst (repeat pattern)
      const osc4 = ringtoneContext.createOscillator();
      const gain4 = ringtoneContext.createGain();
      osc4.type = 'sine';
      osc4.frequency.setValueAtTime(523.25, now + 0.6);
      gain4.gain.setValueAtTime(0, now + 0.6);
      gain4.gain.linearRampToValueAtTime(0.3, now + 0.65);
      gain4.gain.linearRampToValueAtTime(0.2, now + 0.9);
      gain4.gain.linearRampToValueAtTime(0, now + 1.1);
      osc4.connect(gain4);
      gain4.connect(ringtoneContext.destination);
      osc4.start(now + 0.6);
      osc4.stop(now + 1.1);

      const osc5 = ringtoneContext.createOscillator();
      const gain5 = ringtoneContext.createGain();
      osc5.type = 'sine';
      osc5.frequency.setValueAtTime(659.25, now + 0.6);
      gain5.gain.setValueAtTime(0, now + 0.6);
      gain5.gain.linearRampToValueAtTime(0.2, now + 0.65);
      gain5.gain.linearRampToValueAtTime(0.15, now + 0.9);
      gain5.gain.linearRampToValueAtTime(0, now + 1.1);
      osc5.connect(gain5);
      gain5.connect(ringtoneContext.destination);
      osc5.start(now + 0.6);
      osc5.stop(now + 1.1);

      const osc6 = ringtoneContext.createOscillator();
      const gain6 = ringtoneContext.createGain();
      osc6.type = 'sine';
      osc6.frequency.setValueAtTime(783.99, now + 0.75);
      gain6.gain.setValueAtTime(0, now + 0.75);
      gain6.gain.linearRampToValueAtTime(0.25, now + 0.8);
      gain6.gain.linearRampToValueAtTime(0.15, now + 1.1);
      gain6.gain.linearRampToValueAtTime(0, now + 1.4);
      osc6.connect(gain6);
      gain6.connect(ringtoneContext.destination);
      osc6.start(now + 0.75);
      osc6.stop(now + 1.4);

      ringtoneOscillators.push(osc1, osc2, osc3, osc4, osc5, osc6);
    }

    // Play immediately
    playRingTone();

    // Repeat every 2.5 seconds
    ringtoneInterval = setInterval(() => {
      if (isRinging) {
        playRingTone();
      }
    }, 2500);
  }

  function stopRingtone() {
    isRinging = false;

    if (ringtoneInterval) {
      clearInterval(ringtoneInterval);
      ringtoneInterval = null;
    }

    // Stop all active oscillators
    ringtoneOscillators.forEach(osc => {
      try { osc.stop(); } catch(e) { /* Already stopped */ }
    });
    ringtoneOscillators = [];
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
  // Call State Management
  // ================================================
  function showIncomingCall(callerName) {
    if (currentStatus === 'calling') return; // Already showing
    
    currentStatus = 'calling';
    currentCallerName = callerName || '';
    receiverIdle.style.display = 'none';
    answeredState.style.display = 'none';
    incomingCall.classList.add('active');
    notificationOverlay.classList.add('active');

    // Update caller name display
    updateCallerNameUI(currentCallerName);

    // Start ringtone
    startRingtone();

    // Start incoming call timer
    callDuration = 0;
    callTimer = setInterval(() => {
      callDuration++;
      const mins = Math.floor(callDuration / 60).toString().padStart(2, '0');
      const secs = (callDuration % 60).toString().padStart(2, '0');
      callTimerEl.textContent = `${mins}:${secs}`;
    }, 1000);

    // Try to show browser notification
    showBrowserNotification(currentCallerName);
  }

  function updateCallerNameUI(name) {
    const initial = name ? name.trim().charAt(0).toUpperCase() : '';
    const displayName = name || 'Seseorang';
    const subText = name ? `${name} sedang memanggil Anda` : 'Seseorang sedang memanggil Anda';

    // Inline incoming call
    if (name) {
      incomingCallerAvatar.textContent = initial;
      incomingCallerAvatar.style.display = 'flex';
      incomingCallerName.textContent = name;
      incomingCallerName.style.display = 'block';
    } else {
      incomingCallerAvatar.style.display = 'none';
      incomingCallerName.style.display = 'none';
    }
    incomingCallSub.textContent = subText;

    // Overlay
    if (name) {
      overlayCallerAvatar.textContent = initial;
      overlayCallerAvatar.style.display = 'flex';
      overlayCallerName.textContent = name;
      overlayCallerName.style.display = 'block';
    } else {
      overlayCallerAvatar.style.display = 'none';
      overlayCallerName.style.display = 'none';
    }
    overlayCallSub.textContent = subText;
  }

  function showAnsweredState() {
    currentStatus = 'answered';
    receiverIdle.style.display = 'none';
    incomingCall.classList.remove('active');
    answeredState.style.display = 'flex';
    notificationOverlay.classList.remove('active');

    // Update answered state sub text with caller name
    if (currentCallerName) {
      answeredCallSub.textContent = `Terhubung dengan ${currentCallerName}`;
    } else {
      answeredCallSub.textContent = 'Panggilan sedang berlangsung';
    }

    // Stop ringtone
    stopRingtone();

    // Stop incoming timer
    if (callTimer) {
      clearInterval(callTimer);
      callTimer = null;
    }

    // Start connected timer
    connectedDuration = 0;
    connectedTimer = setInterval(() => {
      connectedDuration++;
      const mins = Math.floor(connectedDuration / 60).toString().padStart(2, '0');
      const secs = (connectedDuration % 60).toString().padStart(2, '0');
      connectedTimerEl.textContent = `${mins}:${secs}`;
    }, 1000);
  }

  function showIdleState() {
    currentStatus = 'idle';
    receiverIdle.style.display = 'block';
    incomingCall.classList.remove('active');
    answeredState.style.display = 'none';
    notificationOverlay.classList.remove('active');

    // Stop ringtone
    stopRingtone();

    // Stop timers
    if (callTimer) {
      clearInterval(callTimer);
      callTimer = null;
    }
    if (connectedTimer) {
      clearInterval(connectedTimer);
      connectedTimer = null;
    }

    callTimerEl.textContent = '00:00';
    connectedTimerEl.textContent = '00:00';

    // Reset caller name UI
    currentCallerName = '';
    incomingCallerAvatar.style.display = 'none';
    incomingCallerName.style.display = 'none';
    incomingCallSub.textContent = 'Seseorang sedang memanggil Anda';
    answeredCallSub.textContent = 'Panggilan sedang berlangsung';
    overlayCallerAvatar.style.display = 'none';
    overlayCallerName.style.display = 'none';
    overlayCallSub.textContent = 'Seseorang sedang memanggil Anda';
  }

  async function answerCall() {
    const result = await apiCall('answer', 'POST');
    if (result.success) {
      showAnsweredState();
      totalReceived++;
      totalReceivedEl.textContent = totalReceived;
      showToast('Panggilan dijawab', 'success');
    }
  }

  async function rejectCall() {
    const result = await apiCall('reject', 'POST');
    if (result.success) {
      showIdleState();
      showToast('Panggilan ditolak', 'warning');
    }
  }

  async function endCall() {
    const result = await apiCall('end', 'POST');
    if (result.success) {
      showIdleState();
      showToast('Panggilan diakhiri', 'info');
    }
  }

  // ================================================
  // Browser Notifications
  // ================================================
  function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }

  function showBrowserNotification(callerName) {
    if ('Notification' in window && Notification.permission === 'granted') {
      const displayName = callerName || 'Seseorang';
      const notification = new Notification(`📞 Panggilan dari ${displayName}!`, {
        body: `${displayName} sedang memanggil Anda`,
        icon: '📞',
        requireInteraction: true,
        tag: 'incoming-call'
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    }
  }

  // ================================================
  // Status Polling
  // ================================================
  async function pollStatus() {
    const result = await apiCall('status');
    if (!result.success) return;

    const data = result.data;

    // Update caller status
    if (data.caller_active) {
      callerDot.classList.remove('offline');
      callerDot.classList.add('online');
      callerStatusText.textContent = 'Online';
    } else {
      callerDot.classList.remove('online');
      callerDot.classList.add('offline');
      callerStatusText.textContent = 'Offline';
    }

    // Handle status transitions
    if (data.status === 'calling' && currentStatus === 'idle') {
      // New incoming call!
      showIncomingCall(data.caller_name || '');
    } else if (data.status === 'idle' && currentStatus === 'calling') {
      // Caller cancelled
      showIdleState();
      showToast('Panggilan dibatalkan oleh pemanggil', 'warning');
    } else if (data.status === 'idle' && currentStatus === 'answered') {
      // Call ended by caller
      showIdleState();
      showToast('Panggilan diakhiri oleh pemanggil', 'info');
    } else if (data.status === 'answered' && currentStatus === 'calling') {
      // This shouldn't normally happen from receiver's poll,
      // but handle gracefully
      showAnsweredState();
    }
  }

  // ================================================
  // Heartbeat
  // ================================================
  async function sendHeartbeat() {
    await apiCall('heartbeat', 'POST', { role: 'receiver' });
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

    // Clear existing items
    const items = callLogList.querySelectorAll('.call-log-item');
    items.forEach(item => item.remove());

    // Show last 10 entries
    const recentLogs = logs.slice(0, 10);
    recentLogs.forEach(log => {
      const li = document.createElement('li');
      li.className = 'call-log-item';

      let iconClass = 'incoming';
      let icon = '📥';
      if (log.type === 'outgoing') {
        iconClass = 'outgoing';
        icon = '📲';
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

    setTimeout(() => {
      toast.classList.add('removing');
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  // ================================================
  // Event Listeners
  // ================================================
  btnAnswer.addEventListener('click', answerCall);
  btnReject.addEventListener('click', rejectCall);
  btnEnd.addEventListener('click', endCall);
  overlayAnswer.addEventListener('click', answerCall);
  overlayReject.addEventListener('click', rejectCall);

  // Initialize audio context on first user interaction (browser policy)
  document.addEventListener('click', () => {
    createRingtone();
    if (ringtoneContext && ringtoneContext.state === 'suspended') {
      ringtoneContext.resume();
    }
  }, { once: true });

  // ================================================
  // Initialize
  // ================================================
  function init() {
    // Request notification permission
    requestNotificationPermission();

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

    showToast('Dashboard penerima aktif — menunggu panggilan', 'success');
  }

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    if (pollTimer) clearInterval(pollTimer);
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    if (callTimer) clearInterval(callTimer);
    if (connectedTimer) clearInterval(connectedTimer);
    stopRingtone();
  });

  init();
})();
