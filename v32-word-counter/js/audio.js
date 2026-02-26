// audio.js - Hash-seeded Indian meditation audio engine for the Intention Keeper
// Generates a layered soundscape inspired by Indian classical meditation music.
// Four audio layers, all derived deterministically from the intention's hash:
//   1. Heartbeat bass drum — steady foundational pulse, the anchor of the soundscape
//   2. Tambura drone — continuous low hum, like a tanpura string instrument
//   3. Tabla-like rhythm — syncopated secondary beat layered over the heartbeat
//   4. Sitar-like harmonic — bright plucked overtone on the beat
// Volume set high (0.85) for full immersive experience.

class IntentionAudioEngine {
    constructor() {
        // AudioContext is the Web Audio API entry point.
        // Deferred until first user gesture to comply with browser autoplay policy.
        this.ctx = null;

        // Master gain controls overall volume — all layers route through this.
        // Set to 0.85 for loud, immersive experience.
        this.masterGain = null;

        // Compressor prevents audio clipping when multiple loud layers play simultaneously
        this.compressor = null;

        // Continuous oscillator nodes — stopped and nulled on engine stop
        this.droneOscillator = null;
        this.droneOscillator2 = null;

        // Interval handles for rhythmic layers — cleared on engine stop
        this.heartbeatInterval = null;
        this.tablaInterval = null;
        this.sitarInterval = null;

        this.muted = false;
        this.running = false;

        // Hash-derived parameters — set in extractAudioParams() before audio starts
        this.rootFrequency = 60;      // Hz — bass root note of the intention
        this.heartbeatRate = 1.0;     // beats per second
        this.harmonicInterval = 1.5;  // musical interval ratio above root
    }

    // Initializes AudioContext and master processing chain on first call.
    // Compressor → MasterGain → Speakers prevents distortion at high volumes.
    initContext() {
        if (this.ctx) return;
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();

        // Compressor smooths out peaks when multiple layers hit simultaneously
        this.compressor = this.ctx.createDynamicsCompressor();
        this.compressor.threshold.setValueAtTime(-12, this.ctx.currentTime);
        this.compressor.knee.setValueAtTime(6, this.ctx.currentTime);
        this.compressor.ratio.setValueAtTime(3, this.ctx.currentTime);
        this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
        this.compressor.release.setValueAtTime(0.25, this.ctx.currentTime);

        // Master gain at 0.85 — loud and immersive without clipping
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(0.85, this.ctx.currentTime);

        this.compressor.connect(this.masterGain);
        this.masterGain.connect(this.ctx.destination);
    }

    // Derives all audio parameters from hash bytes 12–20.
    // Uses different bytes than the visual parameters (0–11) so audio
    // feels independent yet is mathematically tied to the same intention.
    extractAudioParams(hashNumbers) {
        // Root frequency: 50–90 Hz — deep meditative bass range
        // Indian classical music is grounded in a root drone (Sa) — this is that note
        this.rootFrequency = 50 + (hashNumbers[12] / 255) * 40;

        // Heartbeat rate: 0.8–1.3 BPS (48–78 BPM) — resting to meditative heart rate range
        this.heartbeatRate = 0.8 + (hashNumbers[13] / 255) * 0.5;

        // Harmonic interval: selects from Indian classical raga-compatible intervals
        // 1.5 = perfect fifth (Pa), 1.333 = perfect fourth (Ma), 1.25 = major third (Ga)
        const intervals = [1.5, 1.333, 1.25, 1.125];
        this.harmonicInterval = intervals[hashNumbers[14] % 4];
    }

    // Creates a short percussive burst — reused for both heartbeat and tabla layers.
    // frequency: pitch of the drum hit
    // gainPeak: how loud the hit is at its peak
    // decayTime: how quickly it fades (shorter = snappier, longer = resonant)
    createDrumHit(frequency, gainPeak, decayTime) {
        const osc  = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        // Pitch bend downward on attack — gives the thud quality of a tabla or bass drum
        osc.frequency.setValueAtTime(frequency * 1.5, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(frequency, this.ctx.currentTime + 0.05);

        // Sharp attack, exponential decay — the envelope that defines percussive sound
        gain.gain.setValueAtTime(0, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(gainPeak, this.ctx.currentTime + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + decayTime);

        osc.connect(gain);
        gain.connect(this.compressor);

        osc.start(this.ctx.currentTime);
        osc.stop(this.ctx.currentTime + decayTime + 0.05);
    }

    // Steady heartbeat bass drum — the foundational pulse of the soundscape.
    // Deep, resonant hits at the hash-derived tempo.
    // This layer never changes rhythm — it is the anchor everything else floats over.
    startHeartbeat() {
        const intervalMs = 1000 / this.heartbeatRate;

        this.heartbeatInterval = setInterval(() => {
            if (!this.ctx || this.muted) return;
            // Deep bass hit — low frequency, high gain, long decay for resonance
            this.createDrumHit(this.rootFrequency * 0.8, 0.9, 0.5);
        }, intervalMs);
    }

    // Tabla-inspired syncopated rhythm layered over the heartbeat.
    // Plays at 1.5x the heartbeat rate with a higher pitch and shorter decay —
    // creates the characteristic off-beat pattern of Indian tabla playing.
    startTablaRhythm() {
        const intervalMs = (1000 / this.heartbeatRate) / 1.5;

        // Offset start by half a heartbeat interval to land on the off-beat
        setTimeout(() => {
            this.tablaInterval = setInterval(() => {
                if (!this.ctx || this.muted) return;
                // Higher pitch, medium gain, short decay — tabla mid-tone (Na/Tin sound)
                this.createDrumHit(this.rootFrequency * 2.2, 0.6, 0.2);
            }, intervalMs);
        }, (1000 / this.heartbeatRate) * 0.5);
    }

    // Tambura drone — continuous low hum that anchors the tonal center.
    // Inspired by the tanpura, which provides the continuous harmonic backdrop
    // in Indian classical music. Two slightly detuned oscillators create the
    // characteristic beating/shimmer of a real stringed instrument.
    startTambouraDrone() {
        // Primary drone on the root frequency
        this.droneOscillator = this.ctx.createOscillator();
        this.droneOscillator.type = 'sawtooth'; // richer harmonic content than sine
        this.droneOscillator.frequency.setValueAtTime(this.rootFrequency, this.ctx.currentTime);

        const droneGain = this.ctx.createGain();
        droneGain.gain.setValueAtTime(0.25, this.ctx.currentTime);

        // Secondary drone slightly detuned (+3 cents) — creates natural shimmer/beating
        this.droneOscillator2 = this.ctx.createOscillator();
        this.droneOscillator2.type = 'sawtooth';
        this.droneOscillator2.frequency.setValueAtTime(this.rootFrequency * 1.0017, this.ctx.currentTime);

        const droneGain2 = this.ctx.createGain();
        droneGain2.gain.setValueAtTime(0.2, this.ctx.currentTime);

        this.droneOscillator.connect(droneGain);
        droneGain.connect(this.compressor);

        this.droneOscillator2.connect(droneGain2);
        droneGain2.connect(this.compressor);

        this.droneOscillator.start();
        this.droneOscillator2.start();
    }

    // Sitar-inspired harmonic pluck on every other heartbeat.
    // A short bright tone at the harmonic interval above the root,
    // with a fast decay that mimics the plucked quality of a sitar string.
    startSitarHarmonic() {
        const intervalMs = (1000 / this.heartbeatRate) * 2; // every other beat

        // Offset to land slightly after the heartbeat — traditional Indian phrasing
        setTimeout(() => {
            this.sitarInterval = setInterval(() => {
                if (!this.ctx || this.muted) return;

                const osc  = this.ctx.createOscillator();
                const gain = this.ctx.createGain();

                // Triangle wave approximates the warm but bright quality of a sitar
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(
                    this.rootFrequency * this.harmonicInterval * 4, // 2 octaves up in harmonic range
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
        }, 80); // 80ms offset after heartbeat
    }

    // Starts the full layered soundscape.
    // Called automatically when the mandala appears — the Generate button click
    // satisfies the browser user-gesture requirement for AudioContext.
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

    // Stops all audio layers and cleans up nodes.
    // Called before starting a new intention's soundscape.
    stop() {
        if (this.droneOscillator)  { try { this.droneOscillator.stop();  } catch(e) {} this.droneOscillator  = null; }
        if (this.droneOscillator2) { try { this.droneOscillator2.stop(); } catch(e) {} this.droneOscillator2 = null; }
        if (this.heartbeatInterval) { clearInterval(this.heartbeatInterval); this.heartbeatInterval = null; }
        if (this.tablaInterval)     { clearInterval(this.tablaInterval);     this.tablaInterval     = null; }
        if (this.sitarInterval)     { clearInterval(this.sitarInterval);     this.sitarInterval     = null; }

        this.running = false;
    }

    // Toggles mute by ramping master gain to 0 or back to 0.85.
    // Smooth ramping prevents audible clicks on mute/unmute transitions.
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
