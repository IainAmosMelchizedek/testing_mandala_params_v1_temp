// audio.js - Hash-seeded meditation audio engine for the Intention Keeper
// Generates a unique soundscape for each intention using the Web Audio API.
// Three layered audio sources are derived from hash bytes:
//   1. Deep bass drone — the root frequency of the intention (40–80 Hz)
//   2. Harmonic overtone — one octave above the bass for richness
//   3. Rhythmic pulse — a drum-like beat synced to the mandala's breathing rate
// All frequencies and rhythms are deterministic — same intention = same sound.

class IntentionAudioEngine {
    constructor() {
        // AudioContext is the Web Audio API entry point.
        // Created lazily on first user interaction to comply with browser autoplay policies.
        this.ctx = null;

        // Master gain node controls overall volume.
        // All audio sources route through this node so mute/unmute affects everything.
        this.masterGain = null;

        // Individual audio nodes — stored so we can stop them cleanly
        this.bassOscillator = null;
        this.harmonicOscillator = null;
        this.pulseInterval = null;

        // Tracks whether audio is currently muted by the user
        this.muted = false;

        // Tracks whether the engine is actively running
        this.running = false;

        // Hash-derived parameters — set in start() before audio nodes are created
        this.bassFrequency = 55;      // Hz — default A1, overwritten from hash
        this.pulseRate = 1.0;         // beats per second, overwritten from hash
        this.harmonicRatio = 2.0;     // octave above bass by default
    }

    // Initializes the AudioContext on first call.
    // Must be called from a user gesture (click) to satisfy browser autoplay policy.
    // Subsequent calls are no-ops.
    initContext() {
        if (this.ctx) return;
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();

        // Master gain routes to speakers — default volume 0.4 to avoid overwhelming the experience
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(0.4, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);
    }

    // Derives audio parameters from hash bytes.
    // Uses bytes 12–19 — distinct from the visual parameter bytes (0–11)
    // so audio and visual feel independent yet both tied to the same intention.
    extractAudioParams(hashNumbers) {
        // Bass frequency: maps byte 12 to 40–90 Hz (deep sub-bass to bass range)
        // This range gives the grounded, meditative quality of Tibetan singing bowls
        // and ceremonial drums without being too low for most speakers
        this.bassFrequency = 40 + (hashNumbers[12] / 255) * 50;

        // Pulse rate: maps byte 13 to 0.5–1.5 beats per second (30–90 BPM)
        // Synced loosely to the mandala's breathing speed for visual-audio coherence
        this.pulseRate = 0.5 + (hashNumbers[13] / 255) * 1.0;

        // Harmonic ratio: selects from musically consonant intervals
        // 2.0 = octave, 1.5 = perfect fifth, 1.333 = perfect fourth, 1.25 = major third
        // All sacred intervals found in world music traditions
        const ratios = [2.0, 1.5, 1.333, 1.25];
        this.harmonicRatio = ratios[hashNumbers[14] % 4];
    }

    // Creates and starts the deep bass drone oscillator.
    // Sine wave chosen for its pure, smooth, non-aggressive quality.
    // Frequency is the hash-derived root note of the intention.
    startBassDrone() {
        this.bassOscillator = this.ctx.createOscillator();
        this.bassOscillator.type = 'sine';
        this.bassOscillator.frequency.setValueAtTime(this.bassFrequency, this.ctx.currentTime);

        // Bass gain kept low so it is felt more than heard — physical resonance effect
        const bassGain = this.ctx.createGain();
        bassGain.gain.setValueAtTime(0.3, this.ctx.currentTime);

        this.bassOscillator.connect(bassGain);
        bassGain.connect(this.masterGain);
        this.bassOscillator.start();
    }

    // Creates and starts the harmonic overtone oscillator.
    // Plays a consonant interval above the bass for tonal richness.
    // Triangle wave is softer than square wave, warmer than pure sine.
    startHarmonic() {
        this.harmonicOscillator = this.ctx.createOscillator();
        this.harmonicOscillator.type = 'triangle';
        this.harmonicOscillator.frequency.setValueAtTime(
            this.bassFrequency * this.harmonicRatio,
            this.ctx.currentTime
        );

        // Harmonic gain lower than bass — sits behind it in the mix
        const harmonicGain = this.ctx.createGain();
        harmonicGain.gain.setValueAtTime(0.15, this.ctx.currentTime);

        this.harmonicOscillator.connect(harmonicGain);
        harmonicGain.connect(this.masterGain);
        this.harmonicOscillator.start();
    }

    // Creates a rhythmic pulse using short burst oscillators triggered on an interval.
    // Mimics a soft drum hit — a brief tone that decays quickly.
    // The decay envelope (attack/release) is what gives it the percussive quality.
    startRhythmicPulse() {
        const intervalMs = 1000 / this.pulseRate;

        this.pulseInterval = setInterval(() => {
            if (!this.ctx || this.muted) return;

            // Each pulse is a new short-lived oscillator — more efficient than
            // modulating a continuous one for percussive effects
            const pulseOsc = this.ctx.createOscillator();
            const pulseGain = this.ctx.createGain();

            // Pulse frequency is 2.5x the bass — creates a mid-range drum-like thud
            pulseOsc.type = 'sine';
            pulseOsc.frequency.setValueAtTime(this.bassFrequency * 2.5, this.ctx.currentTime);

            // Sharp attack, fast decay — the envelope that makes it sound like a drum hit
            pulseGain.gain.setValueAtTime(0, this.ctx.currentTime);
            pulseGain.gain.linearRampToValueAtTime(0.5, this.ctx.currentTime + 0.01);  // 10ms attack
            pulseGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.3); // 300ms decay

            pulseOsc.connect(pulseGain);
            pulseGain.connect(this.masterGain);

            pulseOsc.start(this.ctx.currentTime);
            pulseOsc.stop(this.ctx.currentTime + 0.35); // auto-cleanup after decay

        }, intervalMs);
    }

    // Starts the full audio engine with parameters derived from the intention's hash.
    // Called automatically when the mandala appears.
    // hashNumbers: the 32-byte array from hexToNumbers() in hash-encoder.js
    start(hashNumbers) {
        if (this.running) this.stop();

        this.initContext();
        this.extractAudioParams(hashNumbers);

        // Resume context in case browser suspended it (common on mobile)
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }

        this.startBassDrone();
        this.startHarmonic();
        this.startRhythmicPulse();

        this.running = true;
        this.muted = false;
    }

    // Stops all audio and cleans up nodes.
    // Called when a new intention is submitted or the page is reset.
    stop() {
        if (this.bassOscillator) {
            try { this.bassOscillator.stop(); } catch(e) {}
            this.bassOscillator = null;
        }
        if (this.harmonicOscillator) {
            try { this.harmonicOscillator.stop(); } catch(e) {}
            this.harmonicOscillator = null;
        }
        if (this.pulseInterval) {
            clearInterval(this.pulseInterval);
            this.pulseInterval = null;
        }

        this.running = false;
    }

    // Toggles mute state by setting master gain to 0 or restoring it.
    // Preferred over stop/start because it preserves the audio timing —
    // when unmuted the rhythm resumes in sync rather than restarting from zero.
    toggleMute() {
        if (!this.masterGain) return;

        this.muted = !this.muted;

        if (this.muted) {
            // Smooth fade out over 0.1 seconds to avoid an audible click
            this.masterGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.1);
        } else {
            // Resume context if browser suspended it while muted
            if (this.ctx.state === 'suspended') this.ctx.resume();
            // Smooth fade in
            this.masterGain.gain.linearRampToValueAtTime(0.4, this.ctx.currentTime + 0.1);
        }

        return this.muted;
    }
}
