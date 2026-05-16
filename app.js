// ============================================
// 🌴 Cold Plunge Tracker — Gemini 1.5 Pro
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
            aiModel: 'gemini-2.5-flash'
        },
        timer: {
            running: false,
            startTime: null,
            elapsed: 0,
            interval: null,
            goalReached: false,
            overclocking: false,
            goal: 60
        },
        chatHistory: [],
        xp: 0,
        achievements: []
    };

    // --- DOM ---
    const $ = (s) => document.querySelector(s);
    const $$ = (s) => document.querySelectorAll(s);

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
        gjXpContainer: $('#gjXpContainer'),
        gjXp: $('#gjXp'),
        gjAchievement: $('#gjAchievement'),
        gjAchievementText: $('#gjAchievementText'),
        btnDismiss: $('#btnDismiss'),
        dopaStreak: $('#dopaStreak'),
        dopaTotal: $('#dopaTotal'),
        dopaLevel: $('#dopaLevel'),
        achievementBanner: $('#achievementBanner'),
        achievementIcon: $('#achievementIcon'),
        achievementText: $('#achievementText'),
        milestoneCard: $('#milestoneCard'),
        milestoneName: $('#milestoneName'),
        milestoneFill: $('#milestoneFill'),
        milestoneDetail: $('#milestoneDetail'),
        qsBest: $('#qsBest'),
        qsTrend: $('#qsTrend'),
        qsOverclocks: $('#qsOverclocks'),
        qsTotalTime: $('#qsTotalTime'),
        weeklyDots: $('#weeklyDots'),
        quoteText: $('#quoteText'),
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
        localStorage.setItem('cp_sessions', JSON.stringify(state.sessions));
        localStorage.setItem('cp_settings', JSON.stringify(state.settings));
        localStorage.setItem('cp_chat', JSON.stringify(state.chatHistory));
        localStorage.setItem('cp_xp', JSON.stringify(state.xp));
        localStorage.setItem('cp_achievements', JSON.stringify(state.achievements));
    }

    function load() {
        try {
            const s = localStorage.getItem('cp_sessions');
            const st = localStorage.getItem('cp_settings');
            const c = localStorage.getItem('cp_chat');
            const x = localStorage.getItem('cp_xp');
            const a = localStorage.getItem('cp_achievements');
            if (s) state.sessions = JSON.parse(s);
            if (st) state.settings = { ...state.settings, ...JSON.parse(st) };
            if (c) state.chatHistory = JSON.parse(c);
            if (x) state.xp = JSON.parse(x);
            if (a) state.achievements = JSON.parse(a);
        } catch (e) {
            console.error('Load error:', e);
        }
    }

    // --- Formatting ---
    function fmt(seconds) {
        if (seconds == null || isNaN(seconds)) return '0:00';
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    }

    function fmtDate(d) {
        return new Date(d).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
        });
    }

    // --- Quotes ---
    const quotes = [
        '"The water doesn\'t get easier. You get stronger."',
        '"Comfort is the enemy of progress." — P.T. Barnum',
        '"Cold water is nature\'s reset button."',
        '"You\'re one plunge away from a better mood."',
        '"The hardest part is getting in. The best part is getting out."',
        '"Discipline is choosing between what you want now and what you want most."',
        '"Your body can stand almost anything. It\'s your mind you have to convince."',
        '"Every cold second is a deposit in your mental bank."',
        '"The cold doesn\'t build character. It reveals it."',
        '"Ice in the veins, fire in the heart. 🌴"',
        '"You didn\'t come this far to only come this far."',
        '"Embrace the suck. The magic is on the other side."',
        '"Cold showers: cheap therapy, expensive results."',
        '"Today\'s discomfort is tomorrow\'s superpower."',
        '"The ocean doesn\'t care about your comfort zone."'
    ];

    // --- Ranks ---
    const ranks = [
        { name: '🥥 Coconut', minXp: 0 },
        { name: '🐚 Shell', minXp: 50 },
        { name: '🌊 Wave', minXp: 150 },
        { name: '🐠 Reef Fish', minXp: 300 },
        { name: '🐬 Dolphin', minXp: 500 },
        { name: '🦈 Shark', minXp: 800 },
        { name: '🐋 Whale', minXp: 1200 },
        { name: '🧊 Iceberg', minXp: 1800 },
        { name: '❄️ Frost Giant', minXp: 2500 },
        { name: '🌴 Island Legend', minXp: 3500 }
    ];

    function getRank(xp) {
        let rank = ranks[0];
        for (const r of ranks) {
            if (xp >= r.minXp) rank = r;
        }
        return rank;
    }

    function getNextRank(xp) {
        for (const r of ranks) {
            if (xp < r.minXp) return r;
        }
        return null;
    }

    // --- Achievements ---
    const achievementDefs = [
        { id: 'first_plunge', name: '🏊 First Plunge', desc: 'Complete your first session', check: (s) => s.length >= 1 },
        { id: 'five_sessions', name: '🖐️ High Five', desc: 'Complete 5 sessions', check: (s) => s.length >= 5 },
        { id: 'ten_sessions', name: '🔟 Double Digits', desc: 'Complete 10 sessions', check: (s) => s.length >= 10 },
        { id: 'twentyfive_sessions', name: '🏅 Quarter Century', desc: 'Complete 25 sessions', check: (s) => s.length >= 25 },
        { id: 'fifty_sessions', name: '🎖️ Half Century', desc: 'Complete 50 sessions', check: (s) => s.length >= 50 },
        { id: 'hundred_sessions', name: '💯 Centurion', desc: 'Complete 100 sessions', check: (s) => s.length >= 100 },
        { id: 'first_overclock', name: '🔥 Overachiever', desc: 'Overclock for the first time', check: (s) => s.some(x => x.overclocked) },
        { id: 'five_overclocks', name: '🔥🔥 Flame On', desc: 'Overclock 5 times', check: (s) => s.filter(x => x.overclocked).length >= 5 },
        { id: 'one_minute', name: '⏱️ One Minute Warrior', desc: 'Hold for 1 minute', check: (s) => s.some(x => x.duration >= 60) },
        { id: 'two_minutes', name: '⏱️ Two Minute Titan', desc: 'Hold for 2 minutes', check: (s) => s.some(x => x.duration >= 120) },
        { id: 'three_minutes', name: '⏱️ Three Minute Thunder', desc: 'Hold for 3 minutes', check: (s) => s.some(x => x.duration >= 180) },
        { id: 'five_minutes', name: '🧊 Five Minute Freeze', desc: 'Hold for 5 minutes', check: (s) => s.some(x => x.duration >= 300) },
        { id: 'ten_minutes', name: '🏔️ Ten Minute Mountain', desc: 'Hold for 10 minutes', check: (s) => s.some(x => x.duration >= 600) },
        { id: 'streak_3', name: '🔥 Three Day Fire', desc: '3 day streak', check: (s, streak) => streak >= 3 },
        { id: 'streak_7', name: '🌈 Week Warrior', desc: '7 day streak', check: (s, streak) => streak >= 7 },
        { id: 'streak_14', name: '⚡ Two Week Thunder', desc: '14 day streak', check: (s, streak) => streak >= 14 },
        { id: 'streak_30', name: '👑 Monthly Monarch', desc: '30 day streak', check: (s, streak) => streak >= 30 },
        { id: 'total_10min', name: '🕐 10 Min Club', desc: '10 total minutes cold', check: (s) => s.reduce((a, x) => a + x.duration, 0) >= 600 },
        { id: 'total_30min', name: '🕑 30 Min Club', desc: '30 total minutes cold', check: (s) => s.reduce((a, x) => a + x.duration, 0) >= 1800 },
        { id: 'total_1hr', name: '🕒 Hour of Power', desc: '1 total hour cold', check: (s) => s.reduce((a, x) => a + x.duration, 0) >= 3600 },
        { id: 'total_5hr', name: '🏆 Five Hour Legend', desc: '5 total hours cold', check: (s) => s.reduce((a, x) => a + x.duration, 0) >= 18000 },
    ];

    function checkAchievements() {
        const streak = calculateStreak();
        const newAchievements = [];
        for (const def of achievementDefs) {
            if (!state.achievements.includes(def.id) && def.check(state.sessions, streak)) {
                state.achievements.push(def.id);
                newAchievements.push(def);
            }
        }
        return newAchievements;
    }

    // --- XP Calculation ---
    function calculateSessionXp(session) {
        let xp = 0;
        // Base XP: 1 per second
        xp += Math.round(session.duration);
        // Goal hit bonus
        if (session.goalReached) xp += 15;
        // Overclock bonus: 2x for extra time
        if (session.overclocked) xp += Math.round(session.overclockAmount * 2);
        // Streak bonus
        const streak = calculateStreak();
        if (streak >= 3) xp += 5;
        if (streak >= 7) xp += 10;
        if (streak >= 14) xp += 15;
        if (streak >= 30) xp += 25;
        return xp;
    }

    // --- Goal Calculation ---
    function calculateGoal() {
        if (state.settings.manualGoal && state.settings.manualGoal > 0) {
            return state.settings.manualGoal;
        }
        if (state.sessions.length === 0) return 60;

        const last = state.sessions[state.sessions.length - 1];
        const t = last.duration;
        let inc;
        if (t < 60) inc = 10;
        else if (t < 120) inc = 8;
        else if (t < 180) inc = 6;
        else if (t < 300) inc = 5;
        else if (t < 600) inc = 4;
        else inc = 3;
        return Math.round(t + inc);
    }

    // --- Streak ---
    function calculateStreak() {
        if (state.sessions.length === 0) return 0;
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const days = new Set();
        state.sessions.forEach(s => {
            const d = new Date(s.date); d.setHours(0, 0, 0, 0);
            days.add(d.getTime());
        });
        let streak = 0;
        let check = new Date(today);
        if (!days.has(check.getTime())) {
            check.setDate(check.getDate() - 1);
            if (!days.has(check.getTime())) return 0;
        }
        while (days.has(check.getTime())) {
            streak++;
            check.setDate(check.getDate() - 1);
        }
        return streak;
    }

    // --- Trend ---
    function calculateTrend() {
        if (state.sessions.length < 3) return { text: '-', direction: 'neutral' };
        const last5 = state.sessions.slice(-5);
        const last3 = last5.slice(-3);
        const older = last5.slice(0, Math.max(last5.length - 3, 1));
        const avgRecent = last3.reduce((a, s) => a + s.duration, 0) / last3.length;
        const avgOlder = older.reduce((a, s) => a + s.duration, 0) / older.length;
        const diff = avgRecent - avgOlder;
        if (diff > 5) return { text: '↑ ' + fmt(Math.abs(diff)), direction: 'up' };
        if (diff < -5) return { text: '↓ ' + fmt(Math.abs(diff)), direction: 'down' };
        return { text: '→ Steady', direction: 'neutral' };
    }

    // --- Milestones ---
    function getNextMilestone() {
        const s = state.sessions;
        const milestones = [
            { name: 'First Plunge', target: 1, current: s.length, unit: 'sessions', check: () => s.length >= 1 },
            { name: '1 Minute Hold', target: 60, current: s.length > 0 ? Math.max(...s.map(x => x.duration)) : 0, unit: 'seconds best', check: () => s.some(x => x.duration >= 60) },
            { name: '5 Sessions', target: 5, current: s.length, unit: 'sessions', check: () => s.length >= 5 },
            { name: '2 Minute Hold', target: 120, current: s.length > 0 ? Math.max(...s.map(x => x.duration)) : 0, unit: 'seconds best', check: () => s.some(x => x.duration >= 120) },
            { name: '3 Day Streak', target: 3, current: calculateStreak(), unit: 'day streak', check: () => calculateStreak() >= 3 },
            { name: '10 Sessions', target: 10, current: s.length, unit: 'sessions', check: () => s.length >= 10 },
            { name: '3 Minute Hold', target: 180, current: s.length > 0 ? Math.max(...s.map(x => x.duration)) : 0, unit: 'seconds best', check: () => s.some(x => x.duration >= 180) },
            { name: '7 Day Streak', target: 7, current: calculateStreak(), unit: 'day streak', check: () => calculateStreak() >= 7 },
            { name: '5 Minute Hold', target: 300, current: s.length > 0 ? Math.max(...s.map(x => x.duration)) : 0, unit: 'seconds best', check: () => s.some(x => x.duration >= 300) },
            { name: '25 Sessions', target: 25, current: s.length, unit: 'sessions', check: () => s.length >= 25 },
            { name: '10 Minute Hold', target: 600, current: s.length > 0 ? Math.max(...s.map(x => x.duration)) : 0, unit: 'seconds best', check: () => s.some(x => x.duration >= 600) },
            { name: '30 Day Streak', target: 30, current: calculateStreak(), unit: 'day streak', check: () => calculateStreak() >= 30 },
            { name: '50 Sessions', target: 50, current: s.length, unit: 'sessions', check: () => s.length >= 50 },
            { name: '100 Sessions', target: 100, current: s.length, unit: 'sessions', check: () => s.length >= 100 },
        ];

        for (const m of milestones) {
            if (!m.check()) {
                const progress = Math.min((m.current / m.target) * 100, 99);
                let detail;
                if (m.unit === 'seconds best') {
                    detail = `${fmt(m.current)} / ${fmt(m.target)}`;
                } else {
                    detail = `${m.current} / ${m.target} ${m.unit}`;
                }
                return { name: m.name, progress, detail };
            }
        }
        return { name: 'All Complete! 🏆', progress: 100, detail: 'You are a legend.' };
    }

    // --- Weekly Heatmap ---
    function buildWeeklyDots() {
        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        const today = new Date();
        const todayDay = (today.getDay() + 6) % 7; // Monday = 0

        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - todayDay);
        startOfWeek.setHours(0, 0, 0, 0);

        let html = '';
        for (let i = 0; i < 7; i++) {
            const dayDate = new Date(startOfWeek);
            dayDate.setDate(startOfWeek.getDate() + i);
            dayDate.setHours(0, 0, 0, 0);

            const daySessions = state.sessions.filter(s => {
                const sd = new Date(s.date);
                sd.setHours(0, 0, 0, 0);
                return sd.getTime() === dayDate.getTime();
            });

            const isToday = i === todayDay;
            const hasSession = daySessions.length > 0;
            const hasOverclock = daySessions.some(s => s.overclocked);
            const count = daySessions.length;

            let dotClass = 'week-day-dot';
            if (isToday) dotClass += ' today';
            if (hasOverclock) dotClass += ' overclocked';
            else if (hasSession) dotClass += ' completed';

            const dotContent = hasSession ? (count > 1 ? count : '✓') : (isToday ? '·' : '');

            html += `
                <div class="week-day">
                    <span class="week-day-label">${days[i]}</span>
                    <div class="${dotClass}">${dotContent}</div>
                </div>
            `;
        }
        els.weeklyDots.innerHTML = html;
    }

    // --- Update Timer Page Stats ---
    function updateTimerPage() {
        const s = state.sessions;
        const streak = calculateStreak();
        const rank = getRank(state.xp);
        const trend = calculateTrend();
        const milestone = getNextMilestone();

        // Dopamine bar
        els.dopaStreak.textContent = streak;
        els.dopaTotal.textContent = s.length;
        els.dopaLevel.textContent = rank.name.split(' ')[0]; // Just emoji
        els.dopaLevel.title = rank.name;

        // Quick stats
        if (s.length > 0) {
            els.qsBest.textContent = fmt(Math.max(...s.map(x => x.duration)));
            els.qsOverclocks.textContent = s.filter(x => x.overclocked).length;
            els.qsTotalTime.textContent = fmt(s.reduce((a, x) => a + x.duration, 0));
        } else {
            els.qsBest.textContent = '-';
            els.qsOverclocks.textContent = '0';
            els.qsTotalTime.textContent = '0:00';
        }
        els.qsTrend.textContent = trend.text;
        els.qsTrend.style.color = trend.direction === 'up' ? '#00b894' : trend.direction === 'down' ? '#e17055' : '#636e72';

        // Milestone
        els.milestoneName.textContent = milestone.name;
        els.milestoneFill.style.width = milestone.progress + '%';
        els.milestoneDetail.textContent = milestone.detail;

        // Weekly dots
        buildWeeklyDots();

        // Quote
        els.quoteText.textContent = quotes[Math.floor(Math.random() * quotes.length)];

        // Goal
        els.goalText.textContent = 'Goal: ' + fmt(calculateGoal());
    }

    // --- Timer ---
    function startTimer() {
        const goal = calculateGoal();
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

        els.timerText.textContent = fmt(elapsed);

        const circ = 565.48;
        if (!state.timer.goalReached) {
            const p = Math.min(elapsed / goal, 1);
            els.ringProgress.style.strokeDashoffset = circ - (p * circ);
        } else {
            const extra = elapsed - goal;
            const p = (extra % 60) / 60;
            els.ringProgress.style.strokeDashoffset = circ - (p * circ);
        }

        if (elapsed >= goal && !state.timer.goalReached) {
            state.timer.goalReached = true;
            if (state.settings.sound) playGoalSound();
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

        if (state.timer.overclocking) {
            els.overclockTime.textContent = Math.floor(elapsed - goal);
        }
    }

    function stopTimer() {
        if (!state.timer.running) return;
        clearInterval(state.timer.interval);
        state.timer.running = false;

        const duration = Math.round(state.timer.elapsed * 10) / 10;
        const goal = state.timer.goal;
        const overclocked = duration > goal;
        const overclockAmount = overclocked ? Math.round((duration - goal) * 10) / 10 : 0;

        const session = {
            id: Date.now(),
            date: new Date().toISOString(),
            duration,
            goal,
            goalReached: duration >= goal,
            overclocked,
            overclockAmount
        };

        state.sessions.push(session);

        // XP
        const sessionXp = calculateSessionXp(session);
        state.xp += sessionXp;

        // Achievements
        const newAch = checkAchievements();

        save();
        showGoodJob(session, sessionXp, newAch);

        els.btnStart.classList.remove('hidden');
        els.btnStop.classList.add('hidden');
        els.overclockBadge.classList.add('hidden');
    }

    function showGoodJob(session, xp, achievements) {
        els.gjTime.textContent = fmt(session.duration);
        els.gjGoal.textContent = fmt(session.goal);

        if (session.overclocked) {
            els.gjOverclock.textContent = '+' + fmt(session.overclockAmount);
            els.goodJobMessage.textContent = "You went beyond! Absolute beast! 🔥";
        } else if (session.goalReached) {
            els.gjOverclock.textContent = '-';
            els.goodJobMessage.textContent = "You hit your goal! Keep it up! 🌊";
        } else {
            els.gjOverclock.textContent = '-';
            els.goodJobMessage.textContent = "Every second counts. You showed up! 💪";
        }

        // XP
        els.gjXpContainer.classList.remove('hidden');
        els.gjXp.textContent = '+' + xp + ' XP';

        // Achievement
        if (achievements.length > 0) {
            els.gjAchievement.classList.remove('hidden');
            els.gjAchievementText.textContent = achievements.map(a => a.name).join(' • ');
        } else {
            els.gjAchievement.classList.add('hidden');
        }

        els.goodJobOverlay.classList.remove('hidden');
    }

    function dismissGoodJob() {
        els.goodJobOverlay.classList.add('hidden');
        resetTimerDisplay();
        updateTimerPage();
        updateHistoryPage();
    }

    function resetTimerDisplay() {
        els.timerText.textContent = '0:00';
        els.timerLabel.textContent = 'READY';
        els.timerLabel.className = 'timer-label';
        els.ringProgress.style.strokeDashoffset = 565.48;
        els.ringProgress.classList.remove('overclock');
        els.goalText.textContent = 'Goal: ' + fmt(calculateGoal());
    }

    // --- Sound ---
    function playGoalSound() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const notes = [523.25, 659.25, 783.99, 1046.50];
            notes.forEach((freq, i) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.type = 'sine';
                osc.frequency.value = freq;
                gain.gain.setValueAtTime(0.3, ctx.currentTime + i * 0.15);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.15 + 0.5);
                osc.start(ctx.currentTime + i * 0.15);
                osc.stop(ctx.currentTime + i * 0.15 + 0.5);
            });
        } catch (e) { }
    }

    // --- History Page ---
    function updateHistoryPage() {
        const s = state.sessions;
        els.totalSessions.textContent = s.length;
        els.currentStreak.textContent = calculateStreak();

        if (s.length > 0) {
            els.longestTime.textContent = fmt(Math.max(...s.map(x => x.duration)));
            els.totalTime.textContent = fmt(s.reduce((a, x) => a + x.duration, 0));
        } else {
            els.longestTime.textContent = '0:00';
            els.totalTime.textContent = '0:00';
        }

        if (s.length === 0) {
            els.historyList.innerHTML = '<p class="empty-state">🌺 No sessions yet. Jump in!</p>';
        } else {
            els.historyList.innerHTML = [...s].reverse().map(x => {
                let bc, bt;
                if (x.overclocked) { bc = 'badge-overclock'; bt = '🔥 +' + fmt(x.overclockAmount); }
                else if (x.goalReached) { bc = 'badge-hit'; bt = '✅ Goal Hit'; }
                else { bc = 'badge-miss'; bt = '🌱 Building'; }
                return `<div class="history-item">
                    <div class="history-item-left">
                        <span class="history-date">${fmtDate(x.date)}</span>
                        <span class="history-time">${fmt(x.duration)}</span>
                        <span class="history-goal">Goal: ${fmt(x.goal)}</span>
                    </div>
                    <span class="history-badge ${bc}">${bt}</span>
                </div>`;
            }).join('');
        }
        drawChart();
    }

    // --- Chart ---
    function drawChart() {
        const canvas = els.progressChart;
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        canvas.width = canvas.offsetWidth * dpr;
        canvas.height = canvas.offsetHeight * dpr;
        ctx.scale(dpr, dpr);
        const w = canvas.offsetWidth, h = canvas.offsetHeight;
        ctx.clearRect(0, 0, w, h);

        const s = state.sessions;
        if (s.length < 2) {
            ctx.fillStyle = '#b2bec3';
            ctx.font = '14px Poppins';
            ctx.textAlign = 'center';
            ctx.fillText('Need 2+ sessions for chart', w / 2, h / 2);
            return;
        }

        const last20 = s.slice(-20);
        const maxVal = Math.max(...last20.map(x => x.duration), ...last20.map(x => x.goal)) * 1.15;
        const pad = { top: 20, right: 20, bottom: 30, left: 45 };
        const cw = w - pad.left - pad.right, ch = h - pad.top - pad.bottom;

        // Grid
        ctx.strokeStyle = '#e0f5ed'; ctx.lineWidth = 1;
        for (let i = 0; i <= 4; i++) {
            const y = pad.top + (ch / 4) * i;
            ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(w - pad.right, y); ctx.stroke();
            ctx.fillStyle = '#b2bec3'; ctx.font = '10px Poppins'; ctx.textAlign = 'right';
            ctx.fillText(fmt(maxVal - (maxVal / 4) * i), pad.left - 8, y + 4);
        }

        const sp = cw / (last20.length - 1);
        const gx = (i) => pad.left + i * sp;
        const gy = (v) => pad.top + ch - (v / maxVal) * ch;

        // Goal line
        ctx.strokeStyle = '#fdcb6e'; ctx.lineWidth = 2; ctx.setLineDash([5, 5]);
        ctx.beginPath();
        last20.forEach((x, i) => { i === 0 ? ctx.moveTo(gx(i), gy(x.goal)) : ctx.lineTo(gx(i), gy(x.goal)); });
        ctx.stroke(); ctx.setLineDash([]);

        // Fill
        const grad = ctx.createLinearGradient(0, pad.top, 0, h - pad.bottom);
        grad.addColorStop(0, 'rgba(0,184,148,0.3)'); grad.addColorStop(1, 'rgba(0,184,148,0)');
        ctx.beginPath(); ctx.moveTo(gx(0), h - pad.bottom);
        last20.forEach((x, i) => ctx.lineTo(gx(i), gy(x.duration)));
        ctx.lineTo(gx(last20.length - 1), h - pad.bottom); ctx.closePath();
        ctx.fillStyle = grad; ctx.fill();

        // Line
        ctx.strokeStyle = '#00b894'; ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        ctx.beginPath();
        last20.forEach((x, i) => { i === 0 ? ctx.moveTo(gx(i), gy(x.duration)) : ctx.lineTo(gx(i), gy(x.duration)); });
        ctx.stroke();

        // Dots
        last20.forEach((x, i) => {
            ctx.beginPath(); ctx.arc(gx(i), gy(x.duration), 4, 0, Math.PI * 2);
            ctx.fillStyle = x.overclocked ? '#e17055' : '#00b894'; ctx.fill();
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
        });

        // Legend
        ctx.font = '10px Poppins'; ctx.textAlign = 'left';
        ctx.fillStyle = '#00b894'; ctx.fillRect(pad.left, h - 12, 12, 3);
        ctx.fillStyle = '#636e72'; ctx.fillText('Duration', pad.left + 16, h - 8);
        ctx.strokeStyle = '#fdcb6e'; ctx.lineWidth = 2; ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(pad.left + 80, h - 10.5); ctx.lineTo(pad.left + 92, h - 10.5); ctx.stroke();
        ctx.setLineDash([]); ctx.fillText('Goal', pad.left + 96, h - 8);
    }

    // --- AI Chat (Gemini) ---
    async function sendToGemini(messages) {
        const apiKey = state.settings.apiKey;
        if (!apiKey) return 'Please add your Google AI Studio API key in Settings to use the coach! 🔑';

        try {
            const model = state.settings.aiModel;
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

            const systemPrompt = buildSystemPrompt();

            const contents = [];

            // System instruction as first user/model exchange
            contents.push({
                role: 'user',
                parts: [{ text: systemPrompt }]
            });
            contents.push({
                role: 'model',
                parts: [{ text: 'Understood! I\'m your Cold Plunge Coach 🌴 I\'ll analyze your data, give advice, and I can adjust goals or log sessions when you ask. Let\'s go!' }]
            });

            // Chat history
            for (const msg of messages) {
                contents.push({
                    role: msg.role === 'user' ? 'user' : 'model',
                    parts: [{ text: msg.content }]
                });
            }

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents,
                    generationConfig: {
                        temperature: 0.8,
                        maxOutputTokens: 1024
                    }
                })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error?.message || 'API Error');
            }

            const data = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!text) throw new Error('No response from model');

            return text;
        } catch (e) {
            return `⚠️ Error: ${e.message}. Check your API key and try again.`;
        }
    }

    function buildSystemPrompt() {
        const s = state.sessions;
        const streak = calculateStreak();
        const rank = getRank(state.xp);
        const last10 = s.slice(-10);

        let p = `You are a friendly, encouraging cold plunge coach with a tropical/island vibe. Use emojis. Be concise but insightful.

IMPORTANT — SPECIAL COMMANDS:
You have the ability to modify the user's data when they ask. When you need to perform an action, include a JSON command block at the END of your message wrapped in triple backticks with "cmd" label, like this:

\`\`\`cmd
{"action": "add_session", "duration": 120, "date": "2025-01-15T10:00:00.000Z", "goal": 110}
\`\`\`

\`\`\`cmd
{"action": "set_goal", "goal": 90}
\`\`\`

\`\`\`cmd
{"action": "adjust_goal", "adjustment": -15}
\`\`\`

Available actions:
- "add_session": Log a missed session. Requires "duration" (seconds). Optional: "date" (ISO string, defaults to now), "goal" (defaults to what auto-calc would have been).
- "set_goal": Override the next goal. Requires "goal" (seconds). This sets the manual goal override in settings.
- "adjust_goal": Adjust current auto goal by an amount. Requires "adjustment" (seconds, can be negative). This sets manual goal override to current auto goal + adjustment.
- "clear_goal_override": Remove manual goal override, return to auto-scaling. No params needed.

Only use these when the user clearly asks to log a session, adjust a goal, or similar. Always respond conversationally BEFORE the command block. Don't mention the JSON to the user — just confirm what you did naturally.

USER DATA:
Total sessions: ${s.length}
Current streak: ${streak} days
XP: ${state.xp}
Rank: ${rank.name}
Achievements: ${state.achievements.length}/${achievementDefs.length}
Current auto goal: ${fmt(calculateGoal())} (${calculateGoal()}s)
Manual goal override: ${state.settings.manualGoal ? fmt(state.settings.manualGoal) + ' (' + state.settings.manualGoal + 's)' : 'None (auto-scaling)'}
Overclock mode: ${state.settings.overclock ? 'ON' : 'OFF'}
`;

        if (s.length > 0) {
            const longest = Math.max(...s.map(x => x.duration));
            const total = s.reduce((a, x) => a + x.duration, 0);
            const avg = total / s.length;
            const goalsHit = s.filter(x => x.goalReached).length;
            const overclocks = s.filter(x => x.overclocked).length;

            p += `
Longest session: ${fmt(longest)} (${Math.round(longest)}s)
Total time: ${fmt(total)}
Average duration: ${fmt(avg)} (${Math.round(avg)}s)
Goals hit: ${goalsHit}/${s.length} (${Math.round(goalsHit / s.length * 100)}%)
Overclock sessions: ${overclocks}

RECENT SESSIONS (last ${last10.length}):
`;
            last10.forEach((x, i) => {
                p += `${i + 1}. ${fmtDate(x.date)} — Duration: ${fmt(x.duration)} (${Math.round(x.duration)}s), Goal: ${fmt(x.goal)} (${x.goal}s), ${x.overclocked ? 'OVERCLOCKED +' + fmt(x.overclockAmount) : x.goalReached ? 'Goal Hit' : 'Under Goal'}\n`;
            });
        } else {
            p += '\nNo sessions recorded yet.\n';
        }

        p += `\nThe user is building cold water tolerance for swimming in Green Lake, Wisconsin. They started with cold showers. The goal system auto-scales: adds fewer seconds as duration increases.`;

        return p;
    }

    function parseAICommands(text) {
        const cmdRegex = /```cmd\s*\n?([\s\S]*?)\n?```/g;
        const commands = [];
        let match;
        while ((match = cmdRegex.exec(text)) !== null) {
            try {
                commands.push(JSON.parse(match[1].trim()));
            } catch (e) {
                console.error('Failed to parse AI command:', match[1]);
            }
        }
        // Clean commands from display text
        const cleanText = text.replace(/```cmd\s*\n?[\s\S]*?\n?```/g, '').trim();
        return { cleanText, commands };
    }

    function executeAICommands(commands) {
        const results = [];
        for (const cmd of commands) {
            try {
                switch (cmd.action) {
                    case 'add_session': {
                        const session = {
                            id: Date.now() + Math.random(),
                            date: cmd.date || new Date().toISOString(),
                            duration: cmd.duration,
                            goal: cmd.goal || calculateGoal(),
                            goalReached: cmd.duration >= (cmd.goal || calculateGoal()),
                            overclocked: cmd.duration > (cmd.goal || calculateGoal()),
                            overclockAmount: Math.max(0, cmd.duration - (cmd.goal || calculateGoal())),
                            loggedByCoach: true
                        };
                        state.sessions.push(session);
                        state.sessions.sort((a, b) => new Date(a.date) - new Date(b.date));
                        const xp = calculateSessionXp(session);
                        state.xp += xp;
                        checkAchievements();
                        results.push(`✅ Logged session: ${fmt(session.duration)} on ${fmtDate(session.date)}`);
                        break;
                    }
                    case 'set_goal': {
                        state.settings.manualGoal = cmd.goal;
                        els.manualGoal.value = cmd.goal;
                        results.push(`✅ Goal set to ${fmt(cmd.goal)}`);
                        break;
                    }
                    case 'adjust_goal': {
                        const currentGoal = calculateGoal();
                        const newGoal = Math.max(10, currentGoal + cmd.adjustment);
                        state.settings.manualGoal = newGoal;
                        els.manualGoal.value = newGoal;
                        results.push(`✅ Goal adjusted to ${fmt(newGoal)}`);
                        break;
                    }
                    case 'clear_goal_override': {
                        state.settings.manualGoal = null;
                        els.manualGoal.value = '';
                        results.push(`✅ Goal override cleared, back to auto-scaling`);
                        break;
                    }
                    default:
                        results.push(`⚠️ Unknown command: ${cmd.action}`);
                }
            } catch (e) {
                results.push(`⚠️ Command failed: ${e.message}`);
            }
        }

        if (results.length > 0) {
            save();
            updateTimerPage();
            updateHistoryPage();
        }

        return results;
    }

    function addChatMessage(text, role) {
        const div = document.createElement('div');
        div.className = `chat-message ${role}`;
        div.innerHTML = `<div class="message-bubble">${escapeHtml(text)}</div>`;
        els.chatMessages.appendChild(div);
        els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
    }

    function addSystemMessage(text) {
        const div = document.createElement('div');
        div.className = 'chat-message system';
        div.innerHTML = `<div class="message-bubble">${escapeHtml(text)}</div>`;
        els.chatMessages.appendChild(div);
        els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
    }

    function addLoadingMessage() {
        const div = document.createElement('div');
        div.className = 'chat-message bot';
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

    let chatInflight = false;
    async function handleChat(userMessage) {
        // Guard against double-sends: previous request still in flight.
        // Without this, rapid Enter / send-button clicks queue overlapping Gemini calls
        // and produce out-of-order rendering plus double-charged API quota.
        if (chatInflight) return;
        chatInflight = true;
        els.chatInput.disabled = true;
        els.btnSend.disabled = true;

        addChatMessage(userMessage, 'user');
        state.chatHistory.push({ role: 'user', content: userMessage });

        addLoadingMessage();

        try {
            const rawReply = await sendToGemini(state.chatHistory.slice(-20));
            removeLoadingMessage();

            const { cleanText, commands } = parseAICommands(rawReply);

            if (cleanText) {
                addChatMessage(cleanText, 'bot');
                state.chatHistory.push({ role: 'assistant', content: cleanText });
            }

            if (commands.length > 0) {
                const results = executeAICommands(commands);
                results.forEach(r => addSystemMessage(r));
            }

            save();
        } finally {
            chatInflight = false;
            els.chatInput.disabled = false;
            els.btnSend.disabled = false;
            els.chatInput.focus();
        }
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
        els.aiModel.value = state.settings.aiModel || 'gemini-2.5-flash';
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
    function switchPage(name) {
        $$('.page').forEach(p => p.classList.remove('active'));
        $$('.nav-btn').forEach(b => b.classList.remove('active'));
        $(`#page-${name}`).classList.add('active');
        $(`.nav-btn[data-page="${name}"]`).classList.add('active');
        if (name === 'history') updateHistoryPage();
        if (name === 'chat') updateChatApiWarning();
        if (name === 'timer') { resetTimerDisplay(); updateTimerPage(); }
    }

    // --- Init ---
    function init() {
        load();
        loadSettings();
        updateTimerPage();
        resetTimerDisplay();
        updateHistoryPage();
        updateChatApiWarning();

        // Nav
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
            if (confirm('Delete ALL data? This cannot be undone!')) {
                state.sessions = [];
                state.chatHistory = [];
                state.xp = 0;
                state.achievements = [];
                save();
                updateTimerPage();
                updateHistoryPage();
                resetTimerDisplay();
                els.chatMessages.innerHTML = `<div class="chat-message bot"><div class="message-bubble">Data cleared! Fresh start 🌴 Let's go!</div></div>`;
            }
        });

        els.btnExport.addEventListener('click', () => {
            const data = {
                sessions: state.sessions,
                xp: state.xp,
                achievements: state.achievements,
                exportDate: new Date().toISOString()
            };
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `cold-plunge-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
        });

        // Chat
        els.btnSend.addEventListener('click', () => {
            const msg = els.chatInput.value.trim();
            if (msg) { els.chatInput.value = ''; handleChat(msg); }
        });
        els.chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const msg = els.chatInput.value.trim();
                if (msg) { els.chatInput.value = ''; handleChat(msg); }
            }
        });
        els.btnSummary.addEventListener('click', handleSummary);
        els.btnTips.addEventListener('click', handleTips);

        // Resize
        window.addEventListener('resize', () => {
            if ($('#page-history').classList.contains('active')) drawChart();
        });

        // PWA
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('sw.js').catch(() => { });
        }

        // --- Wake Lock (Keep Screen Awake) ---
        // Track a single sentinel — without this guard, click/touchstart/visibilitychange
        // each fire their own request and the older sentinels leak (only the first
        // released event fires; the rest hang until GC).
        let wakeLock = null;
        const requestWakeLock = async () => {
            if (wakeLock !== null) return; // Already held — don't stack subscriptions
            try {
                if ('wakeLock' in navigator) {
                    wakeLock = await navigator.wakeLock.request('screen');
                    wakeLock.addEventListener('release', () => { wakeLock = null; });
                }
            } catch (err) {
                console.log('Wake Lock failed:', err.message);
            }
        };

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                requestWakeLock();
            }
        });

        // Safari requires user interaction to enable wake lock
        document.addEventListener('click', requestWakeLock, { once: true });
        document.addEventListener('touchstart', requestWakeLock, { once: true });

        requestWakeLock();
    }

    init();
})();
