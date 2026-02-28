// app.js - Application controller for the Intention Keeper
// Wires together the mandala generator, audio engine, consciousness analyzer,
// meditation timer, local intention storage, and scroll wheel timer picker.
//
// Timer flow:
//   User scrolls hours/minutes/seconds wheels → taps Begin Meditation →
//   countdown starts → spiral dissolve triggers at zero →
//   audio fades simultaneously → session complete screen appears →
//   Begin New Session reloads page for a completely clean state

let mandalaGen         = null;
let audioEngine        = null;
let currentIntention   = '';
let currentHash        = '';
let currentHashNumbers = [];

// Timer state
let timerInterval = null;
let timerSeconds  = 0;

// localStorage key — namespaced to avoid conflicts with other apps
const STORAGE_KEY = 'intentionKeeper_intentions';

// Wheel picker state — tracks selected hours, minutes, and seconds
let selectedHours   = 0;
let selectedMinutes = 5; // default to 5 minutes so wheel is never at zero on load
let selectedSeconds = 0;

document.addEventListener('DOMContentLoaded', function() {
    const canvas            = document.getElementById('mandalaCanvas');
    const analyzeBtn        = document.getElementById('analyzeBtn');
    const acceptReframeBtn  = document.getElementById('acceptReframeBtn');
    const keepOriginalBtn   = document.getElementById('keepOriginalBtn');
    const generateDirectBtn = document.getElementById('generateDirectBtn');
    const muteBtn           = document.getElementById('muteBtn');
    const intentionInput    = document.getElementById('intentionInput');
    const wordCountDisplay  = document.getElementById('wordCount');
    const wordWarning       = document.getElementById('wordWarning');
    const cancelTimerBtn    = document.getElementById('cancelTimerBtn');
    const newSessionBtn     = document.getElementById('newSessionBtn');
    const clearAllBtn       = document.getElementById('clearAllBtn');
    const startTimerBtn     = document.getElementById('startTimerBtn');

    mandalaGen  = new MandalaGenerator(canvas);
    audioEngine = new IntentionAudioEngine();

    // Build all three wheel pickers and render saved intentions on page load
    buildWheel('hoursWheel',   0,  2, selectedHours,   (val) => { selectedHours   = val; });
    buildWheel('minutesWheel', 0, 59, selectedMinutes,  (val) => { selectedMinutes = val; });
    buildWheel('secondsWheel', 0, 59, selectedSeconds,  (val) => { selectedSeconds = val; });
    renderIntentionsList();

    // --- WORD COUNTER ---
    intentionInput.addEventListener('input', function() {
        const text      = intentionInput.value.trim();
        const wordCount = text ? text.split(/\s+/).length : 0;
        wordCountDisplay.textContent = wordCount;
        if (wordCount > 50) {
            wordWarning.style.display    = 'inline';
            analyzeBtn.disabled          = true;
            wordCountDisplay.style.color = '#e74c3c';
        } else {
            wordWarning.style.display    = 'none';
            analyzeBtn.disabled          = false;
            wordCountDisplay.style.color = '#f39c12';
        }
    });

    // --- ANALYZE BUTTON ---
    analyzeBtn.addEventListener('click', async function() {
        const intention = intentionInput.value.trim();
        if (!intention) { alert('Please enter an intention first.'); return; }
        const analysisSection = document.getElementById('analysisSection');
        analysisSection.style.display = 'block';
        analysisSection.scrollIntoView({ behavior: 'smooth' });
        await analyzeIntention(intention);
    });

    // --- ACCEPT REFRAME ---
    acceptReframeBtn.addEventListener('click', async function() {
        const reframedText = document.getElementById('reframedText').textContent;
        await generateMandala(reframedText);
    });

    // --- KEEP ORIGINAL ---
    keepOriginalBtn.addEventListener('click', async function() {
        await generateMandala(currentIntention);
    });

    // --- DIRECT GENERATE ---
    generateDirectBtn.addEventListener('click', async function() {
        await generateMandala(currentIntention);
    });

    // --- STYLE TOGGLE ---
    // Switches between Sacred and Cosmic rendering styles instantly.
    // No re-hashing needed — setStyle() reuses the stored hash parameters.
    const sacredBtn = document.getElementById('sacredBtn');
    const cosmicBtn = document.getElementById('cosmicBtn');

    sacredBtn.addEventListener('click', function() {
        mandalaGen.setStyle('sacred');
        sacredBtn.classList.add('active');
        cosmicBtn.classList.remove('active');
    });

    cosmicBtn.addEventListener('click', function() {
        mandalaGen.setStyle('cosmic');
        cosmicBtn.classList.add('active');
        sacredBtn.classList.remove('active');
    });// --- MUTE / UNMUTE ---
    muteBtn.addEventListener('click', function() {
        if (!audioEngine) return;
        const isMuted       = audioEngine.toggleMute();
        muteBtn.textContent = isMuted ? '🔇 Unmute Audio' : '🔊 Mute Audio';
    });

    // --- BEGIN MEDITATION BUTTON ---
    // Validates that at least 1 second is selected before starting.
    // Zero on all three wheels is not a valid meditation duration.
    startTimerBtn.addEventListener('click', function() {
        const totalSeconds = (selectedHours * 3600) + (selectedMinutes * 60) + selectedSeconds;
        if (totalSeconds === 0) {
            alert('Please select a meditation duration greater than zero.');
            return;
        }
        startTimer(totalSeconds);
    });

    // --- CANCEL TIMER ---
    cancelTimerBtn.addEventListener('click', function() {
        cancelTimer();
    });

    // --- NEW SESSION ---
    // Full page reload guarantees clean audio, animation, and timer state
    newSessionBtn.addEventListener('click', function() {
        window.location.reload();
    });

    // --- CLEAR ALL INTENTIONS ---
    clearAllBtn.addEventListener('click', function() {
        if (confirm('Are you sure you want to delete all saved intentions? This cannot be undone.')) {
            localStorage.removeItem(STORAGE_KEY);
            renderIntentionsList();
        }
    });
});

// ─────────────────────────────────────────────
// SCROLL WHEEL PICKER
// ─────────────────────────────────────────────

// Builds a scroll wheel for a numeric range and attaches drag/touch/mouse-wheel handlers.
// containerId: the DOM element to populate with wheel items
// min/max: the numeric range to display
// defaultValue: which value is selected when the wheel first renders
// onChange: callback fired with the new value whenever selection changes
function buildWheel(containerId, min, max, defaultValue, onChange) {
    const container = document.getElementById(containerId);
    const track     = document.createElement('div');
    track.className = 'wheel-track';

    const items = [];
    for (let i = min; i <= max; i++) {
        const item = document.createElement('div');
        item.className   = 'wheel-item';
        item.textContent = String(i).padStart(2, '0');
        item.dataset.value = i;
        track.appendChild(item);
        items.push(item);
    }
    container.appendChild(track);

    const itemHeight = 44; // must match CSS .wheel-item height
    const totalItems = max - min + 1;

    // Snaps the wheel to the nearest item and updates the selected value.
    // Called after every drag/scroll gesture ends.
    function snapToIndex(index) {
        const clamped = Math.max(0, Math.min(index, totalItems - 1));
        track.style.transform = `translateY(${-clamped * itemHeight}px)`;

        items.forEach((item, i) => {
            item.classList.remove('selected', 'near-selected');
            if (i === clamped)                   item.classList.add('selected');
            else if (Math.abs(i - clamped) === 1) item.classList.add('near-selected');
        });

        onChange(min + clamped);
    }

    // Initialize wheel at the default value
    snapToIndex(defaultValue - min);

    // --- MOUSE DRAG ---
    let isDragging    = false;
    let startY        = 0;
    let currentOffset = (defaultValue - min) * itemHeight;

    container.addEventListener('mousedown', (e) => {
        isDragging    = true;
        startY        = e.clientY;
        currentOffset = Math.abs(parseInt(track.style.transform.replace('translateY(', '') || '0'));
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const delta     = startY - e.clientY;
        const newOffset = Math.max(0, Math.min(currentOffset + delta, (totalItems - 1) * itemHeight));
        track.style.transform = `translateY(${-newOffset}px)`;
    });

    document.addEventListener('mouseup', (e) => {
        if (!isDragging) return;
        isDragging = false;
        const delta    = startY - e.clientY;
        const rawIndex = Math.round((currentOffset + delta) / itemHeight);
        snapToIndex(rawIndex);
    });

    // --- TOUCH DRAG (mobile) ---
    let touchStartY      = 0;
    let touchStartOffset = (defaultValue - min) * itemHeight;

    container.addEventListener('touchstart', (e) => {
        touchStartY      = e.touches[0].clientY;
        touchStartOffset = Math.abs(parseInt(track.style.transform.replace('translateY(', '') || '0'));
        e.preventDefault();
    }, { passive: false });

    container.addEventListener('touchmove', (e) => {
        const delta     = touchStartY - e.touches[0].clientY;
        const newOffset = Math.max(0, Math.min(touchStartOffset + delta, (totalItems - 1) * itemHeight));
        track.style.transform = `translateY(${-newOffset}px)`;
        e.preventDefault();
    }, { passive: false });

    container.addEventListener('touchend', (e) => {
        const delta    = touchStartY - e.changedTouches[0].clientY;
        const rawIndex = Math.round((touchStartOffset + delta) / itemHeight);
        snapToIndex(rawIndex);
    });

    // --- MOUSE WHEEL SCROLL ---
    // Allows desktop users to scroll the picker with their mouse wheel
    container.addEventListener('wheel', (e) => {
        e.preventDefault();
        const currentIndex = Math.round(Math.abs(parseInt(track.style.transform.replace('translateY(', '') || '0')) / itemHeight);
        snapToIndex(currentIndex + (e.deltaY > 0 ? 1 : -1));
    }, { passive: false });
}

// ─────────────────────────────────────────────
// INTENTION STORAGE
// ─────────────────────────────────────────────

// Saves intention text, MERIDIAN-HASH, and timestamp to localStorage.
// Skips duplicate consecutive entries to avoid redundant storage.
function saveIntention(intentionText, hash) {
    const intentions = loadIntentions();
    if (intentions.length > 0 && intentions[0].text === intentionText) return;

    intentions.unshift({
        text:      intentionText,
        hash:      hash,
        timestamp: new Date().toISOString()
    });

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(intentions));
    } catch(e) {
        console.warn('Could not save intention to localStorage:', e);
    }
    renderIntentionsList();
}

function loadIntentions() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch(e) { return []; }
}

function deleteIntention(index) {
    const intentions = loadIntentions();
    intentions.splice(index, 1);
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(intentions));
    } catch(e) {
        console.warn('Could not update localStorage:', e);
    }
    renderIntentionsList();
}

// Renders the full intentions list. Shows section if entries exist, hides if empty.
function renderIntentionsList() {
    const intentions = loadIntentions();
    const section    = document.getElementById('intentionsSection');
    const list       = document.getElementById('intentionsList');

    if (intentions.length === 0) { section.style.display = 'none'; return; }

    section.style.display = 'block';
    list.innerHTML = '';

    intentions.forEach((entry, index) => {
        const card     = document.createElement('div');
        card.className = 'intention-card';

        const date      = new Date(entry.timestamp);
        const formatted = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {
            hour: '2-digit', minute: '2-digit'
        });

        card.innerHTML = `
            <div class="intention-card-content">
                <div class="intention-card-text">${entry.text}</div>
                <div class="intention-card-date">${formatted} &nbsp;·&nbsp; ${entry.hash.substring(0, 12)}...</div>
            </div>
            <button class="intention-delete-btn" data-index="${index}">Delete</button>
        `;

        card.querySelector('.intention-card-content').addEventListener('click', async function() {
            document.getElementById('intentionInput').value = entry.text;
            await generateMandala(entry.text);
        });

        card.querySelector('.intention-delete-btn').addEventListener('click', function(e) {
            e.stopPropagation();
            deleteIntention(index);
        });

        list.appendChild(card);
    });
}

// ─────────────────────────────────────────────
// CONSCIOUSNESS ANALYSIS
// ─────────────────────────────────────────────

async function analyzeIntention(intention) {
    currentIntention = intention;

    const feedbackDiv           = document.getElementById('feedbackMessage');
    const reframedSection       = document.getElementById('reframedSection');
    const directGenerateSection = document.getElementById('directGenerateSection');
    const reframedText          = document.getElementById('reframedText');
    const keepOriginalBtn       = document.getElementById('keepOriginalBtn');

    const analysis = IntentionAnalyzer.analyze(intention);
    feedbackDiv.innerHTML = analysis.feedback.replace(/\n/g, '<br>');

    if (analysis.severity === 'unconscious') {
        feedbackDiv.className         = 'feedback-message feedback-harmful';
        reframedText.textContent      = IntentionAnalyzer.reframe(intention);
        reframedSection.style.display = 'block';
        keepOriginalBtn.style.display = 'none';
        directGenerateSection.style.display = 'none';
    } else if (analysis.severity === 'neutral') {
        feedbackDiv.className         = 'feedback-message feedback-warning';
        reframedText.textContent      = IntentionAnalyzer.reframe(intention);
        reframedSection.style.display = 'block';
        keepOriginalBtn.style.display = 'inline-block';
        directGenerateSection.style.display = 'none';
    } else {
        feedbackDiv.className = analysis.transcendentCount > 0
            ? 'feedback-message feedback-transcendent'
            : 'feedback-message feedback-conscious';
        reframedSection.style.display       = 'none';
        directGenerateSection.style.display = 'block';
    }
}

// ─────────────────────────────────────────────
// MANDALA GENERATION
// ─────────────────────────────────────────────

async function generateMandala(intentionText) {
    const mandalaSection  = document.getElementById('mandalaSection');
    const hashDisplay     = document.getElementById('hashDisplay');
    const muteBtn         = document.getElementById('muteBtn');
    const mandalaWrapper  = document.getElementById('mandalaWrapper');
    const sessionComplete = document.getElementById('sessionComplete');
    const timerSection    = document.getElementById('timerSection');
    const countdown       = document.getElementById('countdown');

    mandalaWrapper.classList.remove('fading');
    mandalaWrapper.style.opacity  = '1';
    sessionComplete.style.display = 'none';
    timerSection.style.display    = 'block';
    countdown.style.display       = 'none';
    cancelTimer();

    mandalaSection.style.display = 'block';
    mandalaSection.scrollIntoView({ behavior: 'smooth' });

    if (audioEngine) audioEngine.stop();

    const hash = await mandalaGen.generate(intentionText);
    currentHash        = hash;
    currentHashNumbers = mandalaGen.hashNumbers;

    hashDisplay.textContent = hash.substring(0, 16) + '...';
    mandalaGen.startBreathing();

    // Save to local storage after successful generation
    saveIntention(intentionText, hash);

    if (audioEngine) {
        audioEngine.start(currentHashNumbers);
        muteBtn.textContent = '🔊 Mute Audio';
    }
}

// ─────────────────────────────────────────────
// MEDITATION TIMER
// ─────────────────────────────────────────────

// Starts countdown from total seconds derived from all three wheels.
// Hides the wheel picker UI and shows the live countdown while running.
// The spiral dissolve and audio fade at completion are unchanged from
// previous versions — only the duration source has changed.
function startTimer(totalSeconds) {
    cancelTimer();
    timerSeconds = totalSeconds;

    const wheelPicker   = document.getElementById('wheelPicker');
    const startTimerBtn = document.getElementById('startTimerBtn');
    const timerLabel    = document.querySelector('.timer-label');
    const countdown     = document.getElementById('countdown');

    wheelPicker.style.display   = 'none';
    startTimerBtn.style.display = 'none';
    timerLabel.style.display    = 'none';
    countdown.style.display     = 'flex';

    updateCountdownDisplay(timerSeconds);

    timerInterval = setInterval(() => {
        timerSeconds--;
        updateCountdownDisplay(timerSeconds);
        if (timerSeconds <= 0) {
            clearInterval(timerInterval);
            timerInterval = null;
            completeSession();
        }
    }, 1000);
}

// Formats total seconds into HH:MM:SS always — consistent display regardless of duration
function updateCountdownDisplay(seconds) {
    const h  = Math.floor(seconds / 3600);
    const m  = Math.floor((seconds % 3600) / 60);
    const s  = seconds % 60;
    document.getElementById('countdownDisplay').textContent =
        `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

// Cancels a running timer and restores the wheel picker UI
function cancelTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    timerSeconds = 0;

    const wheelPicker   = document.getElementById('wheelPicker');
    const startTimerBtn = document.getElementById('startTimerBtn');
    const timerLabel    = document.querySelector('.timer-label');
    const countdown     = document.getElementById('countdown');

    if (wheelPicker)   wheelPicker.style.display   = 'flex';
    if (startTimerBtn) startTimerBtn.style.display = 'block';
    if (timerLabel)    timerLabel.style.display    = 'block';
    if (countdown)     countdown.style.display     = 'none';
}

// Called when countdown reaches zero.
// Spiral dissolve and audio fade run simultaneously over 8 seconds.
// Session complete screen appears after dissolve finishes.
function completeSession() {
    const timerSection    = document.getElementById('timerSection');
    const sessionComplete = document.getElementById('sessionComplete');

    timerSection.style.display = 'none';

    if (mandalaGen) mandalaGen.spiralDissolve(8000);

    if (audioEngine && audioEngine.masterGain && audioEngine.ctx) {
        audioEngine.masterGain.gain.linearRampToValueAtTime(
            0,
            audioEngine.ctx.currentTime + 8
        );
    }

    setTimeout(() => {
        if (audioEngine) audioEngine.stop();
        sessionComplete.style.display = 'block';
        sessionComplete.scrollIntoView({ behavior: 'smooth' });
    }, 8000);
}
