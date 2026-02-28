// audio.js - Pure Schumann Resonance heartbeat engine for the Intention Keeper
//
// A single layer of sound: one deep bass pulse at 7.83 Hz — Earth's electromagnetic
// heartbeat, the Schumann Resonance. No harmonics, no melody, no secondary layers.
//
// CLINICAL BASIS:
// The Schumann Resonance sits at the boundary of theta and alpha brainwave ranges.
// Research documents its association with autonomic nervous system calming, grounding,
// and meditative states. Expressing it as a felt bass pulse rather than a tone keeps
// the experience physical and grounding rather than musical or distracting.
// Source: Siever & Collura, "Audio-Visual Entrainment" (Elsevier, 2017).
//
// The pulse frequency is fixed. The tonal character (pitch of the bass hit) is
// hash-derived so each intention has a subtly unique physical resonance.

class IntentionAudioEngine {
    constructor() {
        // AudioContext deferred until first user gesture (browser autoplay policy)
        this.ctx        = null;
        this.masterGain = null;
        this.compressor = null;

        // Interval handle for the heartbeat pulse — cleared on stop()
        this.heartbeatInterval = null;

        this.muted   = false;
        this.running = false;

        // CLINICAL CONSTANT: 7.83 Hz Schumann Resonance.
        // One pulse every ~128ms. This value is fixed across all intentions.
        this.SCHUMANN_HZ = 7.83;

        // Hash-derived bass frequency — the pitch of each heartbeat hit.
        // Varies per intention so each meditation has its own physical resonance.
        this.bassFrequency = 80;
    }

    // Initializes AudioContext and processing chain on first call.
    // Subsequent calls are no-ops.
    initContext() {
        if (this.ctx) return;
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();

        // Compressor prevents clipping at high volume
        this.compressor = this.ctx.createDynamicsCompressor();
        this.compressor.threshold.setValueAtTime(-12, this.ctx.currentTime);
        this.compressor.knee.setValueAtTime(6,    this.ctx.currentTime);
        this.compressor.ratio.setValueAtTime(3,   this.ctx.currentTime);
        this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
        this.compressor.release.setValueAtTime(0.25,  this.ctx.currentTime);

        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(0.85, this.ctx.currentTime);

        this.compressor.connect(this.masterGain);
        this.masterGain.connect(this.ctx.destination);
    }

    // Derives the bass hit frequency from hash byte 12.
    // Range 60-140 Hz keeps the pulse deep and physical — felt in the chest
    // rather than heard as a distinct musical note.
    extractAudioParams(hashNumbers) {
        this.bassFrequency = 60 + (hashNumbers[12] / 255) * 80;
    }

    // Creates a single bass drum hit — a short sine burst with pitch bend downward.
    // The downward bend on attack gives it the organic thud of a physical drum
    // rather than the clinical quality of a pure tone.
    fireHeartbeat() {
        if (!this.ctx || this.muted) return;

        const osc  = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        // Start pitched higher and bend down — creates the "thud" of a struck drum
        osc.frequency.setValueAtTime(this.bassFrequency * 1.4, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(
            this.bassFrequency,
            this.ctx.currentTime + 0.06
        );

        // Sharp attack, slow exponential decay — the pulse is felt, not just heard
        gain.gain.setValueAtTime(0, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.9, this.ctx.currentTime + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.6);

        osc.connect(gain);
        gain.connect(this.compressor);
        osc.start(this.ctx.currentTime);
        osc.stop(this.ctx.currentTime + 0.65);
    }

    // Starts the heartbeat interval at exactly 7.83 Hz.
    // Each tick fires one bass pulse — nothing else.
    startHeartbeat() {
        const intervalMs = 1000 / this.SCHUMANN_HZ; // ~128ms

        this.heartbeatInterval = setInterval(() => {
            this.fireHeartbeat();
        }, intervalMs);
    }

    // Starts the audio engine. Called when the mandala appears.
    // The Generate button click satisfies the browser user-gesture requirement.
    start(hashNumbers) {
        if (this.running) this.stop();

        this.initContext();
        this.extractAudioParams(hashNumbers);

        if (this.ctx.state === 'suspended') this.ctx.resume();

        this.startHeartbeat();

        this.running = true;
        this.muted   = false;
    }

    // Stops the heartbeat and releases all nodes.
    // Always call before generating a new mandala.
    stop() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
        this.running = false;
    }

    // Toggles mute with smooth gain ramping to prevent audible clicks.
    toggleMute() {
        if (!this.masterGain) return;

        this.muted = !this.muted;

        if (this.muted) {
            this.masterGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.1);
        } else {
            if (this.ctx.state === 'suspended') this.ctx.resume();
            this.masterGain.gain.linearRampToValueAtTime(0.85, this.ctx.currentTime + 0.1);
        }

        return this.muted;
    }
}
