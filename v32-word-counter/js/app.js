// app.js - Application controller for the Intention Keeper
// Wires together the mandala generator, audio engine, consciousness analyzer,
// meditation timer, and local intention storage.
//
// Storage approach: Intentions are saved to localStorage as a JSON array.
// Each entry contains the intention text, timestamp, and MERIDIAN-HASH.
// No images are stored — the mandala regenerates deterministically from the text.
// This Tier 1 storage will eventually sync to the Hetzner backend (Tier 2).

let mandalaGen         = null;
let audioEngine        = null;
let currentIntention   = '';
let currentHash        = '';
let currentHashNumbers = [];

// Timer state
let timerInterval = null;
let timerSeconds  = 0;

// localStorage key — namespaced to avoid conflicts with other apps on the same domain
const STORAGE_KEY = 'intentionKeeper_intentions';

document.addEventListener('DOMContentLoaded', function() {
    const canvas            = document.getElementById('mandalaCanvas');
    const analyzeBtn        = document.getElementById('analyzeBtn');
    const acceptReframeBtn  = document.getElementById('acceptReframeBtn');
    const keepOriginalBtn   = document.getElementById('keepOriginalBtn');
    const generateDirectBtn = document.getElementById('generateDirectBtn');
    const downloadPngBtn    = document.getElementById('downloadPngBtn');
    const muteBtn           = document.getElementById('muteBtn');
    const intentionInput    = document.getElementById('intentionInput');
    const wordCountDisplay  = document.getElementById('wordCount');
    const wordWarning       = document.getElementById('wordWarning');
    const cancelTimerBtn    = document.getElementById('cancelTimerBtn');
    const newSessionBtn     = document.getElementById('newSessionBtn');
    const clearAllBtn       = document.getElementById('clearAllBtn');

    mandalaGen  = new MandalaGenerator(canvas);
    audioEngine = new IntentionAudioEngine();

    // Load and display any previously saved intentions on page load
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

    // --- DOWNLOAD PNG ---
    downloadPngBtn.addEventListener('click', function() {
        const link    = document.createElement('a');
        link.download = `intention-mandala-${Date.now()}.png`;
        link.href     = canvas.toDataURL('image/png');
        link.click();
    });

    // --- MUTE / UNMUTE ---
    muteBtn.addEventListener('click', function() {
        if (!audioEngine) return;
        const isMuted       = audioEngine.toggleMute();
        muteBtn.textContent = isMuted ? '🔇 Unmute Audio' : '🔊 Mute Audio';
    });

    // --- TIMER PRESET BUTTONS ---
    document.querySelectorAll('.timer-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.timer-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            startTimer(parseInt(this.dataset.minutes));
        });
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
    // Confirms before wiping all saved intentions from localStorage
    clearAllBtn.addEventListener('click', function() {
        if (confirm('Are you sure you want to delete all saved intentions? This cannot be undone.')) {
            localStorage.removeItem(STORAGE_KEY);
            renderIntentionsList();
        }
    });
});

// ─────────────────────────────────────────────
// INTENTION STORAGE FUNCTIONS
// ─────────────────────────────────────────────

// Saves a new intention entry to localStorage.
// Each entry includes the text, MERIDIAN-HASH, and ISO timestamp.
// Newer entries are prepended so the list shows most recent first.
function saveIntention(intentionText, hash) {
    const intentions = loadIntentions();

    // Avoid storing duplicate consecutive intentions
    if (intentions.length > 0 && intentions[0].text === intentionText) return;

    intentions.unshift({
        text:      intentionText,
        hash:      hash,
        timestamp: new Date().toISOString()
    });

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(intentions));
    } catch(e) {
        // localStorage may be full or blocked — fail silently rather than breaking the app
        console.warn('Could not save intention to localStorage:', e);
    }

    renderIntentionsList();
}

// Loads all saved intentions from localStorage.
// Returns an empty array if nothing is stored or storage is unavailable.
function loadIntentions() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch(e) {
        return [];
    }
}

// Deletes a single intention entry by its index in the stored array.
// Re-renders the list after deletion.
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

// Renders the full intentions list into the DOM.
// Shows the section if entries exist, hides it if empty.
// Each card is clickable to regenerate that intention's mandala.
function renderIntentionsList() {
    const intentions      = loadIntentions();
    const section         = document.getElementById('intentionsSection');
    const list            = document.getElementById('intentionsList');

    if (intentions.length === 0) {
        section.style.display = 'none';
        return;
    }

    section.style.display = 'block';
    list.innerHTML = '';

    intentions.forEach((entry, index) => {
        const card = document.createElement('div');
        card.className = 'intention-card';

        // Format the stored ISO timestamp into a readable local date/time
        const date = new Date(entry.timestamp);
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

        // Clicking the card content regenerates the mandala for that intention
        card.querySelector('.intention-card-content').addEventListener('click', async function() {
            document.getElementById('intentionInput').value = entry.text;
            await generateMandala(entry.text);
        });

        // Delete button removes only this entry without affecting others
        card.querySelector('.intention-delete-btn').addEventListener('click', function(e) {
            e.stopPropagation(); // prevent card click from firing
            deleteIntention(index);
        });

        list.appendChild(card);
    });
}

// ─────────────────────────────────────────────
// CONSCIOUSNESS ANALYSIS
// ─────────────────────────────────────────────

// Analyzes the intention using the frontend consciousness analyzer stub.
// In production this will be replaced by a fetch() call to the DeepSeek backend pipeline.
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

// Generates the mandala, starts audio, saves intention to storage,
// and reveals the timer selection UI.
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
    document.querySelectorAll('.timer-btn').forEach(b => b.classList.remove('active'));
    cancelTimer();

    mandalaSection.style.display = 'block';
    mandalaSection.scrollIntoView({ behavior: 'smooth' });

    if (audioEngine) audioEngine.stop();

    const hash = await mandalaGen.generate(intentionText);
    currentHash        = hash;
    currentHashNumbers = mandalaGen.hashNumbers;

    hashDisplay.textContent = hash.substring(0, 16) + '...';
    mandalaGen.startBreathing();

    // Save intention to local storage after successful mandala generation.
    // Storage happens here rather than at analysis time so only mandalas
    // that were actually generated (not just analyzed) are recorded.
    saveIntention(intentionText, hash);

    if (audioEngine) {
        audioEngine.start(currentHashNumbers);
        muteBtn.textContent = '🔊 Mute Audio';
    }
}

// ─────────────────────────────────────────────
// MEDITATION TIMER
// ─────────────────────────────────────────────

function startTimer(minutes) {
    cancelTimer();
    timerSeconds = minutes * 60;

    const timerPresets = document.querySelector('.timer-presets');
    const timerLabel   = document.querySelector('.timer-label');
    const countdown    = document.getElementById('countdown');

    timerPresets.style.display = 'none';
    timerLabel.style.display   = 'none';
    countdown.style.display    = 'flex';

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

function updateCountdownDisplay(seconds) {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    document.getElementById('countdownDisplay').textContent = `${mins}:${secs}`;
}

function cancelTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    timerSeconds = 0;

    const timerPresets = document.querySelector('.timer-presets');
    const timerLabel   = document.querySelector('.timer-label');
    const countdown    = document.getElementById('countdown');

    if (timerPresets) timerPresets.style.display = 'flex';
    if (timerLabel)   timerLabel.style.display   = 'block';
    if (countdown)    countdown.style.display    = 'none';

    document.querySelectorAll('.timer-btn').forEach(b => b.classList.remove('active'));
}

// Called when countdown reaches zero.
// Triggers spiral dissolve and synchronized audio fade over 8 seconds.
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
