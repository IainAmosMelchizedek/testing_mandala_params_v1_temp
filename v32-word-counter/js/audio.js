// audio.js - Alpha entrainment audio engine for the Intention Keeper
//
// Clinical basis: 10 Hz is a well-documented alpha frequency associated with
// relaxed alertness, increased cerebral blood flow, and meditative states.
// Source: Siever & Collura, "Audio-Visual Entrainment: Physiological Mechanisms
// and Clinical Outcomes" (Elsevier, 2017).
//
// Architecture: Four layered audio sources create an Indian-inspired meditation
// soundscape. The heartbeat pulse is locked at 10 Hz (alpha entrainment).
// All tonal qualities (bass note, harmonic interval) are derived from the
// intention's SHA-256 hash so each intention has a unique sound signature.

class IntentionAudioEngine {
    constructor() {
        // AudioContext deferred until first user gesture to satisfy browser autoplay policy
        this.ctx = null;

        // Master gain routes all audio layers to speakers.
        // Compressor sits between layers and master gain to prevent clipping.
        this.masterGain = null;
        this.compressor = null;

        // Continuous oscillator nodes for the tambura drone
        this.droneOscillator  = null;
        this.droneOscillator2 = null;

        // Interval handles for rhythmic layers — cleared on stop()
        this.heartbeatInterval = null;
        this.tablaInterval     = null;
        this.sitarInterval     = null;

        this.muted  = false;
        this.running = false;

        // CLINICAL CONSTANT: 10 Hz alpha frequency locked for entrainment.
        // The heartbeat pulse fires at this rate to drive brainwave entrainment
        // toward the alpha state associated with relaxed, meditative alertness.
        // This value does NOT change between intentions — only tonal qualities vary.
        this.ENTRAINMENT_HZ = 10;

        // Hash-derived tonal parameters — set in extractAudioParams() before audio starts.
        // These control the musical character of the soundscape without affecting entrainment rate.
        this.rootFrequency    = 110;  // Hz — default A2, overwritten from hash
        this.harmonicInterval = 1.5;  // musical interval ratio, overwritten from hash
    }

    // Initializes AudioContext and the processing chain: Layers → Compressor → MasterGain → Speakers.
    // Called once on first use. Subsequent calls are no-ops.
    initContext() {
        if (this.ctx) return;
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();

        // Compressor prevents distortion when multiple loud layers fire simultaneously
        this.compressor = this.ctx.createDynamicsCompressor();
        this.compressor.threshold.setValueAtTime(-12, this.ctx.currentTime);
        this.compressor.knee.setValueAtTime(6,   this.ctx.currentTime);
        this.compressor.ratio.setValueAtTime(3,  this.ctx.currentTime);
        this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
        this.compressor.release.setValueAtTime(0.25, this.ctx.currentTime);

        // Master gain at 0.85 for loud, immersive volume
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(0.85, this.ctx.currentTime);

        this.compressor.connect(this.masterGain);
        this.masterGain.connect(this.ctx.destination);
    }

    // Derives tonal parameters from hash bytes 12-14.
    // Uses bytes distinct from visual parameters (0-11) so audio and visual
    // feel independent while both remaining tied to the same intention.
    // The entrainment rate (10 Hz) is NOT derived from the hash — it is fixed.
    extractAudioParams(hashNumbers) {
        // Root frequency: maps to the Solfeggio/healing frequency range.
        // 110 Hz = A2, known for grounding and meditative effects (ancient sacred chambers).
        // Range 100-160 Hz keeps the bass warm and resonant on all speakers including mobile.
        this.rootFrequency = 100 + (hashNumbers[12] / 255) * 60;

        // Harmonic interval: selects from Indian classical raga-compatible consonant ratios.
        // 1.5 = perfect fifth (Pa), 1.333 = perfect fourth (Ma),
        // 1.25 = major third (Ga), 1.125 = major second (Re)
        const intervals = [1.5, 1.333, 1.25, 1.125];
        this.harmonicInterval = intervals[hashNumbers[14] % 4];
    }

    // Creates a short percussive burst — shared by heartbeat and tabla layers.
    // Pitch bend downward on attack gives the characteristic thud of a tabla or bass drum.
    // frequency: pitch of the hit
    // gainPeak: peak loudness
    // decayTime: how quickly the sound fades (shorter = snappier)
    createDrumHit(frequency, gainPeak, decayTime) {
        const osc  = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        // Start pitched higher, bend down — creates the "thud" of a struck drum head
        osc.frequency.setValueAtTime(frequency * 1.5, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(frequency, this.ctx.currentTime + 0.05);

        gain.gain.setValueAtTime(0, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(gainPeak, this.ctx.currentTime + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + decayTime);

        osc.connect(gain);
        gain.connect(this.compressor);
        osc.start(this.ctx.currentTime);
        osc.stop(this.ctx.currentTime + decayTime + 0.05);
    }

    // Heartbeat bass drum — the primary entrainment driver.
    // Fires at exactly 10 Hz (one beat every 100ms) to drive alpha brainwave entrainment.
    // This is the clinical core of the audio engine — do not change this rate.
    startHeartbeat() {
        const intervalMs = 1000 / this.ENTRAINMENT_HZ; // 100ms at 10 Hz

        this.heartbeatInterval = setInterval(() => {
            if (!this.ctx || this.muted) return;
            // Deep resonant hit — low frequency, high gain, long decay
            this.createDrumHit(this.rootFrequency * 0.8, 0.9, 0.5);
        }, intervalMs);
    }

    // Tabla-inspired syncopated rhythm at 1.5x the heartbeat rate.
    // Offset by half a beat interval to land on the off-beat — traditional Indian phrasing.
    // Higher pitch and shorter decay distinguish it from the heartbeat.
    startTablaRhythm() {
        const beatMs   = 1000 / this.ENTRAINMENT_HZ;
        const intervalMs = beatMs / 1.5;

        // Half-beat offset places tabla hits between heartbeats
        setTimeout(() => {
            this.tablaInterval = setInterval(() => {
                if (!this.ctx || this.muted) return;
                this.createDrumHit(this.rootFrequency * 2.2, 0.55, 0.18);
            }, intervalMs);
        }, beatMs * 0.5);
    }

    // Tambura drone — continuous low hum anchoring the tonal center.
    // Two slightly detuned sawtooth oscillators create the natural shimmer/beating
    // characteristic of a real tanpura string instrument.
    startTambouraDrone() {
        this.droneOscillator = this.ctx.createOscillator();
        this.droneOscillator.type = 'sawtooth';
        this.droneOscillator.frequency.setValueAtTime(this.rootFrequency, this.ctx.currentTime);

        const gain1 = this.ctx.createGain();
        gain1.gain.setValueAtTime(0.22, this.ctx.currentTime);

        // Secondary oscillator detuned by ~3 cents creates natural beating/shimmer
        this.droneOscillator2 = this.ctx.createOscillator();
        this.droneOscillator2.type = 'sawtooth';
        this.droneOscillator2.frequency.setValueAtTime(
            this.rootFrequency * 1.0017,
            this.ctx.currentTime
        );

        const gain2 = this.ctx.createGain();
        gain2.gain.setValueAtTime(0.18, this.ctx.currentTime);

        this.droneOscillator.connect(gain1);
        gain1.connect(this.compressor);
        this.droneOscillator2.connect(gain2);
        gain2.connect(this.compressor);

        this.droneOscillator.start();
        this.droneOscillator2.start();
    }

    // Sitar-inspired harmonic pluck on every other heartbeat.
    // Triangle wave approximates the warm, bright quality of a plucked sitar string.
    // Fires at the hash-derived harmonic interval above the root — unique per intention.
    startSitarHarmonic() {
        const beatMs     = 1000 / this.ENTRAINMENT_HZ;
        const intervalMs = beatMs * 2; // every other beat

        // Small offset after the heartbeat — traditional Indian melodic phrasing
        setTimeout(() => {
            this.sitarInterval = setInterval(() => {
                if (!this.ctx || this.muted) return;

                const osc  = this.ctx.createOscillator();
                const gain = this.ctx.createGain();

                osc.type = 'triangle';
                // Two octaves up in the harmonic range for brightness
                osc.frequency.setValueAtTime(
                    this.rootFrequency * this.harmonicInterval * 4,
                    this.ctx.currentTime
                );

                // Fast attack, medium decay — plucked string envelope
                gain.gain.setValueAtTime(0, this.ctx.currentTime);
                gain.gain.linearRampToValueAtTime(0.4, this.ctx.currentTime + 0.005);
                gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.4);

                osc.connect(gain);
                gain.connect(this.compressor);
                osc.start(this.ctx.currentTime);
                osc.stop(this.ctx.currentTime + 0.45);

            }, intervalMs);
        }, 80);
    }

    // Starts the full layered soundscape using hash-derived tonal parameters.
    // The Generate button click satisfies the browser's user-gesture requirement
    // for AudioContext initialization, so this can always be called from generateMandala().
    start(hashNumbers) {
        if (this.running) this.stop();

        this.initContext();
        this.extractAudioParams(hashNumbers);

        if (this.ctx.state === 'suspended') this.ctx.resume();

        this.startTambouraDrone();
        this.startHeartbeat();
        this.startTablaRhythm();
        this.startSitarHarmonic();

        this.running = true;
        this.muted   = false;
    }

    // Stops all audio layers and nulls references for garbage collection.
    // Always call before starting a new intention's soundscape.
    stop() {
        if (this.droneOscillator)  { try { this.droneOscillator.stop();  } catch(e) {} this.droneOscillator  = null; }
        if (this.droneOscillator2) { try { this.droneOscillator2.stop(); } catch(e) {} this.droneOscillator2 = null; }
        if (this.heartbeatInterval) { clearInterval(this.heartbeatInterval); this.heartbeatInterval = null; }
        if (this.tablaInterval)     { clearInterval(this.tablaInterval);     this.tablaInterval     = null; }
        if (this.sitarInterval)     { clearInterval(this.sitarInterval);     this.sitarInterval     = null; }

        this.running = false;
    }

    // Toggles mute by ramping master gain smoothly to prevent audible clicks.
    // Preferred over stop/start because rhythm timing is preserved when unmuted.
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
