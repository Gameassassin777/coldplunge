// ============================================
// 🌴 Cold Plunge Tracker - Main App
// ============================================

(function () {
    'use strict';

    // --- State ---
    let state = {
        sessions: [],
        settings: {
            overclock: true,
            sound: true,
            manualGoal: null,
            apiKey: '',
            aiModel: 'gpt-4o-mini'
        },
        timer: {
            running: false,
            startTime: null,
            elapsed: 0,
            interval: null,
            goalReached: false,
            overclocking: false
        },
        chatHistory: []
    };

    // --- DOM Elements ---
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    const els = {
        timerText: $('#timerText'),
        timerLabel: $('#timerLabel'),
        ringProgress: $('#ringProgress'),
        goalText: $('#goalText'),
        overclockBadge: $('#overclockBadge'),
        overclockTime: $('#overclockTime'),
        btnStart: $('#btnStart'),
        btnStop: $('#btnStop'),
        goodJobOverlay: $('#goodJobOverlay'),
        gjTime: $('#gjTime'),
        gjGoal: $('#gjGoal'),
        gjOverclock: $('#gjOverclock'),
        goodJobMessage: $('#goodJobMessage'),
        btnDismiss: $('#btnDismiss'),
        historyList: $('#historyList'),
        totalSessions: $('#totalSessions'),
        currentStreak: $('#currentStreak'),
        longestTime: $('#longestTime'),
        totalTime: $('#totalTime'),
        progressChart: $('#progressChart'),
        chatMessages: $('#chatMessages'),
        chatInput: $('#chatInput'),
        btnSend: $('#btnSend'),
        btnSummary: $('#btnSummary'),
        btnTips: $('#btnTips'),
        noApiWarning: $('#noApiWarning'),
        overclockToggle: $('#overclockToggle'),
        soundToggle: $('#soundToggle'),
        manualGoal: $('#manualGoal'),
        apiKey: $('#apiKey'),
        aiModel: $('#aiModel'),
        btnClearData: $('#btnClearData'),
        btnExport: $('#btnExport')
    };

    // --- Persistence ---
    function save() {
        localStorage.setItem('coldplunge_sessions', JSON.stringify(state.sessions));
        localStorage.setItem('coldplunge_settings', JSON.stringify(state.settings));
        localStorage.setItem('coldplunge_chat', JSON.stringify(state.chatHistory));
    }

    function load() {
        try {
            const sessions = localStorage.getItem('coldplunge_sessions');
            const settings = localStorage.getItem('coldplunge_settings');
            const chat = localStorage.getItem('coldplunge_chat');
            if (sessions) state.sessions = JSON.parse(sessions);
            if (settings) state.settings = { ...state.settings, ...JSON.parse(settings) };
            if (chat) state.chatHistory = JSON.parse(chat);
        } catch (e) {
            console.error('Error loading data:', e);
        }
    }

    // --- Formatting ---
    function formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    function formatDate(dateStr) {
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });
    }

    // --- Goal Calculation ---
    function calculateGoal() {
        // Manual override
        if (state.settings.manualGoal && state.settings.manualGoal > 0) {
            return state.settings.manualGoal;
        }

        // No sessions yet - start at 60 seconds
        if (state.sessions.length === 0) {
            return 60;
        }

        const lastSession = state.sessions[state.sessions.length - 1];
        const lastTime = lastSession.duration;

        // Scaling increment:
        // Under 60s: add 10s
        // 60-120s: add 8s
        // 120-180s: add 6s
        // 180-300s: add 5s
        // 300-600s: add 4s (5-10 min)
        // 600+: add 3s (10+ min)
        let increment;
        if (lastTime < 60) {
            increment = 10;
        } else if (lastTime < 120) {
            increment = 8;
        } else if (lastTime < 180) {
            increment = 6;
        } else if (lastTime < 300) {
            increment = 5;
        } else if (lastTime < 600) {
            increment = 4;
        } else {
            increment = 3;
        }

        // Use the actual duration (not the goal) as the base
        // This way if they overclocked, next goal reflects that
        return Math.round(lastTime + increment);
    }

    function getCurrentGoal() {
        return calculateGoal();
    }

    // --- Timer ---
    function startTimer() {
        const goal = getCurrentGoal();
        state.timer = {
            running: true,
            startTime: Date.now(),
            elapsed: 0,
            interval: null,
            goalReached: false,
            overclocking: false,
            goal: goal
        };

        els.btnStart.classList.add('hidden');
        els.btnStop.classList.remove('hidden');
        els.timerLabel.textContent = 'HOLD STRONG';
        els.timerLabel.className = 'timer-label';
        els.overclockBadge.classList.add('hidden');
        els.ringProgress.classList.remove('overclock');

        state.timer.interval = setInterval(updateTimer, 100);
    }

    function updateTimer() {
        if (!state.timer.running) return;

        state.timer.elapsed = (Date.now() - state.timer.startTime) / 1000;
        const elapsed = state.timer.elapsed;
        const goal = state.timer.goal;

        els.timerText.textContent = formatTime(elapsed);

        // Update ring
        const circumference = 565.48;
        if (!state.timer.goalReached) {
            const progress = Math.min(elapsed / goal, 1);
            els.ringProgress.style.strokeDashoffset = circumference - (progress * circumference);
        } else {
            // Overclocking - pulse the ring
            const overclockExtra = elapsed - goal;
            const overclockProgress = (overclockExtra % 60) / 60;
            els.ringProgress.style.strokeDashoffset = circumference - (overclockProgress * circumference);
        }

        // Goal reached
        if (elapsed >= goal && !state.timer.goalReached) {
            state.timer.goalReached = true;

            if (state.settings.sound) {
                playGoalSound();
            }

            if (state.settings.overclock) {
                state.timer.overclocking = true;
                els.timerLabel.textContent = 'OVERCLOCKING 🔥';
                els.timerLabel.className = 'timer-label overclock-label';
                els.overclockBadge.classList.remove('hidden');
                els.ringProgress.classList.add('overclock');
            } else {
                stopTimer();
                return;
            }
        }

        // Update overclock badge
        if (state.timer.overclocking) {
            const extra = Math.floor(elapsed - goal);
            els.overclockTime.textContent = extra;
        }
    }

    function stopTimer() {
        if (!state.timer.running) return;

        clearInterval(state.timer.interval);
        state.timer.running = false;

        const duration = state.timer.elapsed;
        const goal = state.timer.goal;
        const overclocked = duration > goal;
        const overclockAmount = overclocked ? duration - goal : 0;

        // Save session
        const session = {
            id: Date.now(),
            date: new Date().toISOString(),
            duration: Math.round(duration * 10) / 10,
            goal: goal,
            goalReached: duration >= goal,
            overclocked: overclocked,
            overclockAmount: Math.round(overclockAmount * 10) / 10
        };

        state.sessions.push(session);
        save();

        // Show good job screen
        showGoodJob(session);

        // Reset UI
        els.btnStart.classList.remove('hidden');
        els.btnStop.classList.add('hidden');
        els.overclockBadge.classList.add('hidden');
    }

    function showGoodJob(session) {
        els.gjTime.textContent = formatTime(session.duration);
        els.gjGoal.textContent = formatTime(session.goal);

        if (session.overclocked) {
            els.gjOverclock.textContent = '+' + formatTime(session.overclockAmount);
            els.goodJobMessage.textContent = "You went beyond! Absolute beast! 🔥";
        } else if (session.goalReached) {
            els.gjOverclock.textContent = '-';
            els.goodJobMessage.textContent = "You hit your goal! Keep it up! 🌊";
        } else {
            els.gjOverclock.textContent = '-';
            els.goodJobMessage.textContent = "Every second counts. You showed up! 💪";
        }

        els.goodJobOverlay.classList.remove('hidden');
    }

    function dismissGoodJob() {
        els.goodJobOverlay.classList.add('hidden');
        resetTimerDisplay();
        updateHistoryPage();
    }

    function resetTimerDisplay() {
        els.timerText.textContent = '0:00';
        els.timerLabel.textContent = 'READY';
        els.timerLabel.className = 'timer-label';
        els.ringProgress.style.strokeDashoffset = 565.48;
        els.ringProgress.classList.remove('overclock');
        els.goalText.textContent = 'Goal: ' + formatTime(getCurrentGoal());
    }

    // --- Sound ---
    function playGoalSound() {
        try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

            // Play a pleasant tropical chime
            const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
            notes.forEach((freq, i) => {
                const oscillator = audioCtx.createOscillator();
                const gainNode = audioCtx.createGain();
                oscillator.connect(gainNode);
                gainNode.connect(audioCtx.destination);
                oscillator.type = 'sine';
                oscillator.frequency.value = freq;
                gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime + i * 0.15);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + i * 0.15 + 0.5);
                oscillator.start(audioCtx.currentTime + i * 0.15);
                oscillator.stop(audioCtx.currentTime + i * 0.15 + 0.5);
            });
        } catch (e) {
            console.log('Audio not available');
        }
    }

    // --- History Page ---
    function updateHistoryPage() {
        const sessions = state.sessions;

        // Stats
        els.totalSessions.textContent = sessions.length;
        els.currentStreak.textContent = calculateStreak();

        if (sessions.length > 0) {
            const longest = Math.max(...sessions.map(s => s.duration));
            els.longestTime.textContent = formatTime(longest);

            const total = sessions.reduce((sum, s) => sum + s.duration, 0);
            els.totalTime.textContent = formatTime(total);
        } else {
            els.longestTime.textContent = '0:00';
            els.totalTime.textContent = '0:00';
        }

        // History list
        if (sessions.length === 0) {
            els.historyList.innerHTML = '<p class="empty-state">🌺 No sessions yet. Jump in!</p>';
        } else {
            const reversed = [...sessions].reverse();
            els.historyList.innerHTML = reversed.map(s => {
                let badgeClass, badgeText;
                if (s.overclocked) {
                    badgeClass = 'badge-overclock';
                    badgeText = '🔥 +' + formatTime(s.overclockAmount);
                } else if (s.goalReached) {
                    badgeClass = 'badge-hit';
                    badgeText = '✅ Goal Hit';
                } else {
                    badgeClass = 'badge-miss';
                    badgeText = '🌱 Building';
                }

                return `
                    <div class="history-item">
                        <div class="history-item-left">
                            <span class="history-date">${formatDate(s.date)}</span>
                            <span class="history-time">${formatTime(s.duration)}</span>
                            <span class="history-goal">Goal: ${formatTime(s.goal)}</span>
                        </div>
                        <span class="history-badge ${badgeClass}">${badgeText}</span>
                    </div>
                `;
            }).join('');
        }

        // Chart
        drawChart();
    }

    function calculateStreak() {
        if (state.sessions.length === 0) return 0;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const sessionDays = new Set();
        state.sessions.forEach(s => {
            const d = new Date(s.date);
            d.setHours(0, 0, 0, 0);
            sessionDays.add(d.getTime());
        });

        let streak = 0;
        let checkDate = new Date(today);

        // Check if there's a session today or yesterday to start the streak
        if (!sessionDays.has(checkDate.getTime())) {
            checkDate.setDate(checkDate.getDate() - 1);
            if (!sessionDays.has(checkDate.getTime())) {
                return 0;
            }
        }

        while (sessionDays.has(checkDate.getTime())) {
            streak++;
            checkDate.setDate(checkDate.getDate() - 1);
        }

        return streak;
    }

    // --- Chart ---
    function drawChart() {
        const canvas = els.progressChart;
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;

        canvas.width = canvas.offsetWidth * dpr;
        canvas.height = canvas.offsetHeight * dpr;
        ctx.scale(dpr, dpr);

        const width = canvas.offsetWidth;
        const height = canvas.offsetHeight;

        ctx.clearRect(0, 0, width, height);

        const sessions = state.sessions;
        if (sessions.length < 2) {
            ctx.fillStyle = '#b2bec3';
            ctx.font = '14px Poppins';
            ctx.textAlign = 'center';
            ctx.fillText('Need 2+ sessions for chart', width / 2, height / 2);
            return;
        }

        const last20 = sessions.slice(-20);
        const durations = last20.map(s => s.duration);
        const goals = last20.map(s => s.goal);
        const maxVal = Math.max(...durations, ...goals) * 1.15;
        const minVal = 0;

        const padding = { top: 20, right: 20, bottom: 30, left: 45 };
        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;

        // Grid lines
        ctx.strokeStyle = '#e0f5ed';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 4; i++) {
            const y = padding.top + (chartHeight / 4) * i;
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(width - padding.right, y);
            ctx.stroke();

            const val = maxVal - (maxVal / 4) * i;
            ctx.fillStyle = '#b2bec3';
            ctx.font = '10px Poppins';
            ctx.textAlign = 'right';
            ctx.fillText(formatTime(val), padding.left - 8, y + 4);
        }

        const pointSpacing = chartWidth / (last20.length - 1);

        function getX(i) { return padding.left + i * pointSpacing; }
        function getY(val) { return padding.top + chartHeight - (val / maxVal) * chartHeight; }

        // Goal line (dashed)
        ctx.strokeStyle = '#fdcb6e';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        last20.forEach((s, i) => {
            const x = getX(i);
            const y = getY(s.goal);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();
        ctx.setLineDash([]);

        // Duration line
        const gradient = ctx.createLinearGradient(0, padding.top, 0, height - padding.bottom);
        gradient.addColorStop(0, 'rgba(0, 184, 148, 0.3)');
        gradient.addColorStop(1, 'rgba(0, 184, 148, 0)');

        // Fill area
        ctx.beginPath();
        ctx.moveTo(getX(0), height - padding.bottom);
        last20.forEach((s, i) => ctx.lineTo(getX(i), getY(s.duration)));
        ctx.lineTo(getX(last20.length - 1), height - padding.bottom);
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();

        // Duration line
        ctx.strokeStyle = '#00b894';
        ctx.lineWidth = 3;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.beginPath();
        last20.forEach((s, i) => {
            const x = getX(i);
            const y = getY(s.duration);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();

        // Dots
        last20.forEach((s, i) => {
            const x = getX(i);
            const y = getY(s.duration);
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, Math.PI * 2);
            ctx.fillStyle = s.overclocked ? '#e17055' : '#00b894';
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();
        });

        // Legend
        ctx.font = '10px Poppins';
        ctx.textAlign = 'left';

        ctx.fillStyle = '#00b894';
        ctx.fillRect(padding.left, height - 12, 12, 3);
        ctx.fillStyle = '#636e72';
        ctx.fillText('Duration', padding.left + 16, height - 8);

        ctx.fillStyle = '#fdcb6e';
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(padding.left + 80, height - 10.5);
        ctx.lineTo(padding.left + 92, height - 10.5);
        ctx.strokeStyle = '#fdcb6e';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#636e72';
        ctx.fillText('Goal', padding.left + 96, height - 8);
    }

    // --- AI Chat ---
    async function sendToAI(messages) {
        const apiKey = state.settings.apiKey;
        if (!apiKey) {
            return 'Please add your OpenAI API key in Settings to use the coach! 🔑';
        }

        try {
            const systemPrompt = buildSystemPrompt();

            const apiMessages = [
                { role: 'system', content: systemPrompt },
                ...messages
            ];

            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: state.settings.aiModel,
                    messages: apiMessages,
                    max_tokens: 500,
                    temperature: 0.8
                })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error?.message || 'API Error');
            }

            const data = await response.json();
            return data.choices[0].message.content;
        } catch (e) {
            return `⚠️ Error: ${e.message}. Check your API key and try again.`;
        }
    }

    function buildSystemPrompt() {
        const sessions = state.sessions;
        const last10 = sessions.slice(-10);

        let dataContext = `You are a friendly, encouraging cold plunge coach with a tropical/island vibe. Use emojis. Be concise but insightful.\n\n`;
        dataContext += `USER DATA:\n`;
        dataContext += `Total sessions: ${sessions.length}\n`;
        dataContext += `Current streak: ${calculateStreak()} days\n`;

        if (sessions.length > 0) {
            const longest = Math.max(...sessions.map(s => s.duration));
            const total = sessions.reduce((sum, s) => sum + s.duration, 0);
            const avgDuration = total / sessions.length;
            const goalsHit = sessions.filter(s => s.goalReached).length;
            const overclocks = sessions.filter(s => s.overclocked).length;

            dataContext += `Longest session: ${formatTime(longest)}\n`;
            dataContext += `Total time: ${formatTime(total)}\n`;
            dataContext += `Average duration: ${formatTime(avgDuration)}\n`;
            dataContext += `Goals hit: ${goalsHit}/${sessions.length} (${Math.round(goalsHit / sessions.length * 100)}%)\n`;
            dataContext += `Overclock sessions: ${overclocks}\n\n`;

            dataContext += `RECENT SESSIONS (last ${last10.length}):\n`;
            last10.forEach((s, i) => {
                dataContext += `${i + 1}. ${formatDate(s.date)} - Duration: ${formatTime(s.duration)}, Goal: ${formatTime(s.goal)}, ${s.overclocked ? 'OVERCLOCKED +' + formatTime(s.overclockAmount) : s.goalReached ? 'Goal Hit' : 'Under Goal'}\n`;
            });
        } else {
            dataContext += `No sessions recorded yet.\n`;
        }

        dataContext += `\nThe user is building cold water tolerance for swimming in Green Lake, Wisconsin. They started with cold showers. Their current goal system auto-scales: adds fewer seconds as duration increases so it doesn't drag on forever.`;

        return dataContext;
    }

    function addChatMessage(text, role) {
        const div = document.createElement('div');
        div.className = `chat-message ${role}`;
        div.innerHTML = `<div class="message-bubble">${escapeHtml(text)}</div>`;
        els.chatMessages.appendChild(div);
        els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
    }

    function addLoadingMessage() {
        const div = document.createElement('div');
        div.className = 'chat-message bot loading';
        div.id = 'loadingMsg';
        div.innerHTML = '<div class="message-bubble">🌴 Thinking...</div>';
        els.chatMessages.appendChild(div);
        els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
    }

    function removeLoadingMessage() {
        const el = $('#loadingMsg');
        if (el) el.remove();
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    async function handleChat(userMessage) {
        addChatMessage(userMessage, 'user');
        state.chatHistory.push({ role: 'user', content: userMessage });

        addLoadingMessage();

        const reply = await sendToAI(state.chatHistory.slice(-20));

        removeLoadingMessage();
        addChatMessage(reply, 'bot');
        state.chatHistory.push({ role: 'assistant', content: reply });
        save();
    }

    async function handleSummary() {
        if (state.sessions.length === 0) {
            addChatMessage("No sessions yet! Complete your first cold plunge and I'll have something to analyze. 🌊", 'bot');
            return;
        }
        await handleChat("Give me a detailed summary and analysis of my cold plunge progress. Include trends, strengths, areas to improve, and what I should focus on next.");
    }

    async function handleTips() {
        await handleChat("Based on my data, give me 3-5 specific tips to improve my cold exposure tolerance. Be practical and specific to where I am in my journey.");
    }

    // --- Settings ---
    function loadSettings() {
        els.overclockToggle.checked = state.settings.overclock;
        els.soundToggle.checked = state.settings.sound;
        els.manualGoal.value = state.settings.manualGoal || '';
        els.apiKey.value = state.settings.apiKey || '';
        els.aiModel.value = state.settings.aiModel || 'gpt-4o-mini';
    }

    function saveSettings() {
        state.settings.overclock = els.overclockToggle.checked;
        state.settings.sound = els.soundToggle.checked;
        state.settings.manualGoal = els.manualGoal.value ? parseInt(els.manualGoal.value) : null;
        state.settings.apiKey = els.apiKey.value.trim();
        state.settings.aiModel = els.aiModel.value;
        save();
        resetTimerDisplay();
        updateChatApiWarning();
    }

    function updateChatApiWarning() {
        if (state.settings.apiKey) {
            els.noApiWarning.classList.add('hidden');
        } else {
            els.noApiWarning.classList.remove('hidden');
        }
    }

    // --- Navigation ---
    function switchPage(pageName) {
        $$('.page').forEach(p => p.classList.remove('active'));
        $$('.nav-btn').forEach(b => b.classList.remove('active'));

        $(`#page-${pageName}`).classList.add('active');
        $(`.nav-btn[data-page="${pageName}"]`).classList.add('active');

        if (pageName === 'history') updateHistoryPage();
        if (pageName === 'chat') updateChatApiWarning();
        if (pageName === 'timer') resetTimerDisplay();
    }

    // --- Event Listeners ---
    function init() {
        load();
        loadSettings();
        resetTimerDisplay();
        updateHistoryPage();
        updateChatApiWarning();

        // Navigation
        $$('.nav-btn').forEach(btn => {
            btn.addEventListener('click', () => switchPage(btn.dataset.page));
        });

        // Timer
        els.btnStart.addEventListener('click', startTimer);
        els.btnStop.addEventListener('click', stopTimer);
        els.btnDismiss.addEventListener('click', dismissGoodJob);

        // Settings
        els.overclockToggle.addEventListener('change', saveSettings);
        els.soundToggle.addEventListener('change', saveSettings);
        els.manualGoal.addEventListener('change', saveSettings);
        els.apiKey.addEventListener('change', saveSettings);
        els.aiModel.addEventListener('change', saveSettings);

        els.btnClearData.addEventListener('click', () => {
            if (confirm('Are you sure? This will delete ALL your session data and chat history. This cannot be undone!')) {
                state.sessions = [];
                state.chatHistory = [];
                save();
                updateHistoryPage();
                resetTimerDisplay();
                els.chatMessages.innerHTML = `
                    <div class="chat-message bot">
                        <div class="message-bubble">Data cleared! Fresh start 🌴 Let's go!</div>
                    </div>
                `;
            }
        });

        els.btnExport.addEventListener('click', () => {
            const data = {
                sessions: state.sessions,
                exportDate: new Date().toISOString(),
                totalSessions: state.sessions.length
            };
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `cold-plunge-data-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
        });

        // Chat
        els.btnSend.addEventListener('click', () => {
            const msg = els.chatInput.value.trim();
            if (msg) {
                els.chatInput.value = '';
                handleChat(msg);
            }
        });

        els.chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const msg = els.chatInput.value.trim();
                if (msg) {
                    els.chatInput.value = '';
                    handleChat(msg);
                }
            }
        });

        els.btnSummary.addEventListener('click', handleSummary);
        els.btnTips.addEventListener('click', handleTips);

        // Handle window resize for chart
        window.addEventListener('resize', () => {
            if ($('#page-history').classList.contains('active')) {
                drawChart();
            }
        });

        // Register service worker for PWA
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('sw.js').catch(() => {});
        }
    }

    // Start app
    init();
})();
