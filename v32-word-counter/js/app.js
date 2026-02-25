// app.js - Application controller for the Intention Keeper
// Wires together the mandala generator, audio engine, and consciousness analyzer.
// Handles all user interactions and manages UI state transitions.
// Audio starts automatically when the mandala appears — the Generate button click
// satisfies the browser's user-gesture requirement for AudioContext initialization.

let mandalaGen = null;
let audioEngine = null;
let currentIntention = '';
let currentHash = '';
let currentHashNumbers = [];

// Initialize all components and event listeners once the DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    const canvas         = document.getElementById('mandalaCanvas');
    const analyzeBtn     = document.getElementById('analyzeBtn');
    const acceptReframeBtn   = document.getElementById('acceptReframeBtn');
    const keepOriginalBtn    = document.getElementById('keepOriginalBtn');
    const generateDirectBtn  = document.getElementById('generateDirectBtn');
    const downloadPngBtn     = document.getElementById('downloadPngBtn');
    const muteBtn            = document.getElementById('muteBtn');
    const intentionInput     = document.getElementById('intentionInput');
    const wordCountDisplay   = document.getElementById('wordCount');
    const wordWarning        = document.getElementById('wordWarning');

    // Instantiate the mandala generator and audio engine.
    // AudioEngine is created here but AudioContext is deferred until first user gesture.
    mandalaGen  = new MandalaGenerator(canvas);
    audioEngine = new IntentionAudioEngine();

    // --- WORD COUNTER ---
    // Updates on every keystroke. Disables the Analyze button if over 50 words.
    // The 50-word limit keeps intentions focused and prevents hash parameter overflow.
    intentionInput.addEventListener('input', function() {
        const text      = intentionInput.value.trim();
        const wordCount = text ? text.split(/\s+/).length : 0;

        wordCountDisplay.textContent = wordCount;

        if (wordCount > 50) {
            wordWarning.style.display  = 'inline';
            analyzeBtn.disabled        = true;
            wordCountDisplay.style.color = '#e74c3c';
        } else {
            wordWarning.style.display  = 'none';
            analyzeBtn.disabled        = false;
            wordCountDisplay.style.color = '#f39c12';
        }
    });

    // --- ANALYZE BUTTON ---
    // Triggers consciousness analysis pipeline and reveals the analysis section.
    // Smooth scroll ensures the user sees the feedback immediately.
    analyzeBtn.addEventListener('click', async function() {
        const intention = intentionInput.value.trim();

        if (!intention) {
            alert('Please enter an intention first.');
            return;
        }

        const analysisSection = document.getElementById('analysisSection');
        analysisSection.style.display = 'block';
        analysisSection.scrollIntoView({ behavior: 'smooth' });

        await analyzeIntention(intention);
    });

    // --- ACCEPT REFRAME ---
    // User accepts the AI-suggested reframe of a harmful or neutral intention.
    // The reframed text replaces the original for mandala generation.
    acceptReframeBtn.addEventListener('click', async function() {
        const reframedText = document.getElementById('reframedText').textContent;
        await generateMandala(reframedText);
    });

    // --- KEEP ORIGINAL ---
    // Only available for neutral intentions — harmful intentions have no bypass.
    // User acknowledges the warning and proceeds with their original intention.
    keepOriginalBtn.addEventListener('click', async function() {
        await generateMandala(currentIntention);
    });

    // --- DIRECT GENERATE ---
    // Shown when the intention passes analysis as conscious or transcendent.
    // No reframe needed — proceeds directly to mandala generation.
    generateDirectBtn.addEventListener('click', async function() {
        await generateMandala(currentIntention);
    });

    // --- DOWNLOAD PNG ---
    // Captures the current canvas frame as a PNG.
    // Filename includes timestamp to prevent overwriting previous downloads.
    downloadPngBtn.addEventListener('click', function() {
        const link      = document.createElement('a');
        link.download   = `intention-mandala-${Date.now()}.png`;
        link.href       = canvas.toDataURL('image/png');
        link.click();
    });

    // --- MUTE / UNMUTE AUDIO ---
    // Toggles the audio engine's master gain between 0 and full volume.
    // Uses smooth gain ramping inside the engine to avoid audible clicks.
    // Button label updates to reflect the current audio state.
    muteBtn.addEventListener('click', function() {
        if (!audioEngine) return;
        const isMuted = audioEngine.toggleMute();
        muteBtn.textContent = isMuted ? '🔇 Unmute Audio' : '🔊 Mute Audio';
    });
});

// Analyzes the intention using the frontend consciousness analyzer stub.
// In production this will be replaced by a fetch() call to the backend DeepSeek pipeline.
// Routes UI to the appropriate state based on severity: unconscious, neutral, or conscious.
async function analyzeIntention(intention) {
    currentIntention = intention;

    const feedbackDiv          = document.getElementById('feedbackMessage');
    const reframedSection      = document.getElementById('reframedSection');
    const directGenerateSection = document.getElementById('directGenerateSection');
    const reframedText         = document.getElementById('reframedText');
    const keepOriginalBtn      = document.getElementById('keepOriginalBtn');

    const analysis = IntentionAnalyzer.analyze(intention);
    feedbackDiv.innerHTML = analysis.feedback.replace(/\n/g, '<br>');

    if (analysis.severity === 'unconscious') {
        // Hard block — harmful content detected, reframe is mandatory
        feedbackDiv.className = 'feedback-message feedback-harmful';
        reframedText.textContent = IntentionAnalyzer.reframe(intention);
        reframedSection.style.display = 'block';
        keepOriginalBtn.style.display = 'none';
        directGenerateSection.style.display = 'none';

    } else if (analysis.severity === 'neutral') {
        // Soft warning — reframe suggested but user may override
        feedbackDiv.className = 'feedback-message feedback-warning';
        reframedText.textContent = IntentionAnalyzer.reframe(intention);
        reframedSection.style.display = 'block';
        keepOriginalBtn.style.display = 'inline-block';
        directGenerateSection.style.display = 'none';

    } else {
        // Conscious or transcendent — direct path to generation
        feedbackDiv.className = analysis.transcendentCount > 0
            ? 'feedback-message feedback-transcendent'
            : 'feedback-message feedback-conscious';

        reframedSection.style.display = 'none';
        directGenerateSection.style.display = 'block';
    }
}

// Generates the mandala and starts the audio engine simultaneously.
// The Generate button click is the user gesture that satisfies browser autoplay policy,
// so AudioContext initialization inside audioEngine.start() is always permitted here.
async function generateMandala(intentionText) {
    const mandalaSection = document.getElementById('mandalaSection');
    const hashDisplay    = document.getElementById('hashDisplay');
    const muteBtn        = document.getElementById('muteBtn');

    mandalaSection.style.display = 'block';
    mandalaSection.scrollIntoView({ behavior: 'smooth' });

    // Stop any previous audio before starting fresh for the new intention
    if (audioEngine) audioEngine.stop();

    // Generate hash and extract parameters — mandalaGen stores these internally
    const hash = await mandalaGen.generate(intentionText);
    currentHash = hash;
    currentHashNumbers = mandalaGen.hashNumbers;

    // Display truncated hash below the canvas
    hashDisplay.textContent = hash.substring(0, 16) + '...';

    // Start the breathing animation
    mandalaGen.startBreathing();

    // Start audio using the same hash numbers that drive the visual —
    // ensures audio and visual are mathematically tied to the same intention
    if (audioEngine) {
        audioEngine.start(currentHashNumbers);
        // Reset mute button label in case it was muted from a previous intention
        muteBtn.textContent = '🔊 Mute Audio';
    }
}
