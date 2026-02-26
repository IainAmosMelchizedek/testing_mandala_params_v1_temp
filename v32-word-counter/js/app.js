// app.js - Application controller for the Intention Keeper
// Wires together the mandala generator, audio engine, consciousness analyzer,
// and meditation timer. Manages all UI state transitions.
//
// Timer flow:
//   User selects duration → countdown starts → spiral dissolve triggers at zero →
//   audio fades simultaneously → session complete screen appears →
//   Begin New Session reloads the page for a completely clean state

let mandalaGen         = null;
let audioEngine        = null;
let currentIntention   = '';
let currentHash        = '';
let currentHashNumbers = [];

// Timer state — tracked here so cancel and reset work cleanly
let timerInterval = null;
let timerSeconds  = 0;

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

    mandalaGen  = new MandalaGenerator(canvas);
    audioEngine = new IntentionAudioEngine();

    // --- WORD COUNTER ---
    // Updates on every keystroke. Disables Analyze if over 50 words.
    // The 50-word limit keeps intentions focused and prevents hash parameter overflow.
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
    // Triggers consciousness analysis and reveals the analysis section.
    analyzeBtn.addEventListener('click', async function() {
        const intention = intentionInput.value.trim();
        if (!intention) { alert('Please enter an intention first.'); return; }
        const analysisSection = document.getElementById('analysisSection');
        analysisSection.style.display = 'block';
        analysisSection.scrollIntoView({ behavior: 'smooth' });
        await analyzeIntention(intention);
    });

    // --- ACCEPT REFRAME ---
    // User accepts the AI-suggested reframe of a harmful or neutral intention.
    acceptReframeBtn.addEventListener('click', async function() {
        const reframedText = document.getElementById('reframedText').textContent;
        await generateMandala(reframedText);
    });

    // --- KEEP ORIGINAL ---
    // Only available for neutral intentions — harmful content has no bypass.
    keepOriginalBtn.addEventListener('click', async function() {
        await generateMandala(currentIntention);
    });

    // --- DIRECT GENERATE ---
    // Shown when intention passes analysis as conscious or transcendent.
    generateDirectBtn.addEventListener('click', async function() {
        await generateMandala(currentIntention);
    });

    // --- DOWNLOAD PNG ---
    // Captures the current canvas frame as a timestamped PNG file.
    downloadPngBtn.addEventListener('click', function() {
        const link    = document.createElement('a');
        link.download = `intention-mandala-${Date.now()}.png`;
        link.href     = canvas.toDataURL('image/png');
        link.click();
    });

    // --- MUTE / UNMUTE ---
    // Toggles master gain with smooth ramping to prevent audible clicks.
    muteBtn.addEventListener('click', function() {
        if (!audioEngine) return;
        const isMuted       = audioEngine.toggleMute();
        muteBtn.textContent = isMuted ? '🔇 Unmute Audio' : '🔊 Mute Audio';
    });

    // --- TIMER PRESET BUTTONS ---
    // Each button carries a data-minutes attribute set in the HTML.
    // Clicking highlights the selected button and starts a fresh countdown.
    document.querySelectorAll('.timer-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.timer-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            const minutes = parseInt(this.dataset.minutes);
            startTimer(minutes);
        });
    });

    // --- CANCEL TIMER ---
    // Returns UI to timer selection state without resetting the mandala.
    cancelTimerBtn.addEventListener('click', function() {
        cancelTimer();
    });

    // --- NEW SESSION ---
    // Reloads the page for a completely clean state — audio, mandala, and timer all reset.
    // Page reload is the most reliable way to ensure no audio or animation artifacts persist.
    newSessionBtn.addEventListener('click', function() {
        window.location.reload();
    });
});

// Analyzes the intention using the frontend consciousness analyzer stub.
// In production this will be replaced by a fetch() call to the DeepSeek backend pipeline.
// Routes UI to the appropriate state based on severity: unconscious, neutral, or conscious.
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
        // Hard block — harmful content, reframe is mandatory, no bypass
        feedbackDiv.className         = 'feedback-message feedback-harmful';
        reframedText.textContent      = IntentionAnalyzer.reframe(intention);
        reframedSection.style.display = 'block';
        keepOriginalBtn.style.display = 'none';
        directGenerateSection.style.display = 'none';

    } else if (analysis.severity === 'neutral') {
        // Soft warning — reframe suggested but user may override
        feedbackDiv.className         = 'feedback-message feedback-warning';
        reframedText.textContent      = IntentionAnalyzer.reframe(intention);
        reframedSection.style.display = 'block';
        keepOriginalBtn.style.display = 'inline-block';
        directGenerateSection.style.display = 'none';

    } else {
        // Conscious or transcendent — direct path to mandala generation
        feedbackDiv.className = analysis.transcendentCount > 0
            ? 'feedback-message feedback-transcendent'
            : 'feedback-message feedback-conscious';
        reframedSection.style.display       = 'none';
        directGenerateSection.style.display = 'block';
    }
}

// Generates the mandala, starts audio, and reveals the timer selection UI.
// The Generate button click satisfies the browser autoplay policy for AudioContext.
async function generateMandala(intentionText) {
    const mandalaSection  = document.getElementById('mandalaSection');
    const hashDisplay     = document.getElementById('hashDisplay');
    const muteBtn         = document.getElementById('muteBtn');
    const mandalaWrapper  = document.getElementById('mandalaWrapper');
    const sessionComplete = document.getElementById('sessionComplete');
    const timerSection    = document.getElementById('timerSection');
    const countdown       = document.getElementById('countdown');

    // Reset any previous session state before generating a new mandala
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

    // Generate hash and extract all visual parameters
    const hash = await mandalaGen.generate(intentionText);
    currentHash        = hash;
    currentHashNumbers = mandalaGen.hashNumbers;

    hashDisplay.textContent = hash.substring(0, 16) + '...';
    mandalaGen.startBreathing();

    // Start audio using the same hash numbers that drive the visual —
    // ensures audio and visual are mathematically tied to the same intention
    if (audioEngine) {
        audioEngine.start(currentHashNumbers);
        muteBtn.textContent = '🔊 Mute Audio';
    }
}

// Starts the countdown timer for the selected number of minutes.
// Hides preset buttons and shows the live countdown while running.
function startTimer(minutes) {
    cancelTimer(); // clear any existing timer before starting fresh

    timerSeconds = minutes * 60;

    const timerPresets = document.querySelector('.timer-presets');
    const timerLabel   = document.querySelector('.timer-label');
    const countdown    = document.getElementById('countdown');

    // Hide preset buttons during meditation to reduce visual distraction
    timerPresets.style.display = 'none';
    timerLabel.style.display   = 'none';
    countdown.style.display    = 'flex';

    updateCountdownDisplay(timerSeconds);

    // Tick every second — decrement and check for completion
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

// Formats seconds into MM:SS and updates the countdown display element
function updateCountdownDisplay(seconds) {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    document.getElementById('countdownDisplay').textContent = `${mins}:${secs}`;
}

// Cancels a running timer and restores the preset button UI.
// Called by the Cancel button and before starting any new timer.
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

// Called when the countdown reaches zero.
// Triggers the spiral dissolve on the canvas and fades audio simultaneously.
// Both the visual and audio dissolve over 8 seconds before the session
// complete screen appears — creating a unified, ceremonial ending.
function completeSession() {
    const timerSection    = document.getElementById('timerSection');
    const sessionComplete = document.getElementById('sessionComplete');

    // Hide timer UI so only the dissolving mandala is visible
    timerSection.style.display = 'none';

    // Trigger spiral dissolve on canvas over 8 seconds
    if (mandalaGen) mandalaGen.spiralDissolve(8000);

    // Fade audio out over the same 8 seconds for a unified sensory ending
    if (audioEngine && audioEngine.masterGain && audioEngine.ctx) {
        audioEngine.masterGain.gain.linearRampToValueAtTime(
            0,
            audioEngine.ctx.currentTime + 8
        );
    }

    // After dissolve completes, stop audio and show session complete screen
    setTimeout(() => {
        if (audioEngine) audioEngine.stop();
        sessionComplete.style.display = 'block';
        sessionComplete.scrollIntoView({ behavior: 'smooth' });
    }, 8000);
}
