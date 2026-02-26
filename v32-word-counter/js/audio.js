// audio.js - Two-layer sacred audio engine for the Intention Keeper
//
// LAYER 1: Heartbeat pulse at 7.83 Hz — the Schumann Resonance.
// Earth's natural electromagnetic frequency, often called the planet's heartbeat.
// Associated with grounding, autonomic nervous system calming, and meditative states.
// Source: Siever & Collura, "Audio-Visual Entrainment" (Elsevier, 2017);
//         Balser & Wagner (1960), Nature.
//
// LAYER 2: Sitar harmonic at 852 Hz — the Third Eye Chakra (Ajna) frequency.
// Associated with spiritual insight, awakening intuition, and return to spiritual order.
// Chosen specifically for an intention-setting tool because the act of setting an
// intention is itself an act of inner vision and directed consciousness.
// Source: Solfeggio frequency tradition; Belle Health review (2025).
//
// The harmonic interval applied to 852 Hz is hash-derived — so each intention
// produces a unique overtone while remaining rooted in the same sacred frequency.

class IntentionAudioEngine {
    constructor() {
        // AudioContext deferred until first user gesture (browser autoplay policy)
        this.ctx        = null;
        this.masterGain = null;
        this.compressor = null;

        // Interval handles — cleared on stop()
        this.heartbeatInterval = null;
        this.sitarInterval     = null;

        this.muted   = false;
        this.running = false;

        // CLINICAL CONSTANT: 7.83 Hz — Schumann Resonance, Earth's electromagnetic heartbeat.
        // Kept fixed across all intentions — this is the grounding anchor of the soundscape.
        this.ENTRAINMENT_HZ = 7.83;

        // SACRED CONSTANT: 852 Hz — Third Eye Chakra (Ajna) Solfeggio frequency.
        // Promotes spiritual insight and intuitive clarity — aligned with intention setting.
        // Kept fixed so the spiritual resonance is consistent across all intentions.
        this.THIRD_EYE_HZ = 53.25;

        // Hash-derived harmonic interval — set in extractAudioParams().
        // Varies per intention so each sitar tone is unique while staying consonant with 852 Hz.
        this.harmonicInterval = 1.5;
    }

    // Initializes AudioContext and processing chain: Layers → Compressor → MasterGain → Speakers.
    // Called once on first use. Subsequent calls are no-ops.
    initContext() {
        if (this.ctx) return;
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();

        // Compressor prevents clipping when both layers fire simultaneously
        this.compressor = this.ctx.createDynamicsCompressor();
        this.compressor.threshold.setValueAtTime(-12, this.ctx.currentTime);
        this.compressor.knee.setValueAtTime(6,    this.ctx.currentTime);
        this.compressor.ratio.setValueAtTime(3,   this.ctx.currentTime);
        this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
        this.compressor.release.setValueAtTime(0.25,  this.ctx.currentTime);

        // Master gain at 0.75 — slightly lower than before since we only have two layers
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(1.5, this.ctx.currentTime);

        this.compressor.connect(this.masterGain);
        this.masterGain.connect(this.ctx.destination);
    }

    // Extracts only the hash-derived harmonic interval.
    // The two sacred frequencies (7.83 Hz and 852 Hz) are fixed.
    // Only the sitar's harmonic relationship to 852 Hz varies per intention.
    extractAudioParams(hashNumbers) {
        // Selects from Indian classical raga-compatible consonant intervals.
        // Applied as a divisor rather than multiplier to keep the sitar
        // in a lower, more meditative register relative to 852 Hz.
        // 1.5 = perfect fifth, 1.333 = perfect fourth,
        // 1.25 = major third, 1.125 = major second
        const intervals = [1.5, 1.333, 1.25, 1.125];
        this.harmonicInterval = intervals[hashNumbers[14] % 4];
    }

    // Heartbeat pulse locked to 7.83 Hz Schumann Resonance.
    // A soft sine wave burst — felt more than heard, like a distant drum.
    // Pitch bend downward on attack gives it organic, drum-like quality.
    // Lower frequency (852 * 0.15 = ~128 Hz) keeps it deep and grounding.
    startHeartbeat() {
        const intervalMs = 1000 / this.ENTRAINMENT_HZ; // ~128ms at 7.83 Hz

        this.heartbeatInterval = setInterval(() => {
            if (!this.ctx || this.muted) return;

            const osc  = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            // Bass hit tuned to a sub-harmonic of 852 Hz for tonal coherence
            const hitFreq = this.THIRD_EYE_HZ * 0.15; // ~128 Hz — warm bass thud
            osc.type = 'sine';
            osc.frequency.setValueAtTime(hitFreq * 1.3, this.ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(hitFreq, this.ctx.currentTime + 0.06);

            // Soft attack, medium decay — more like a felt pulse than a sharp drum hit
            gain.gain.setValueAtTime(0, this.ctx.currentTime);
            gain.gain.linearRampToValueAtTime(1.5, this.ctx.currentTime + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.5);

            osc.connect(gain);
            gain.connect(this.compressor);
            osc.start(this.ctx.currentTime);
            osc.stop(this.ctx.currentTime + 0.55);

        }, intervalMs);
    }

    // Sitar-inspired harmonic tone rooted at 852 Hz — Third Eye Chakra frequency.
    // Fires on every other heartbeat for a slow, contemplative rhythm.
    // Triangle wave approximates the warm, bright quality of a plucked sitar string.
    // The harmonic interval shifts the pitch slightly per intention via hash bytes,
    // keeping each meditation session tonally unique while staying consonant with 852 Hz.
    startSitarHarmonic() {
        const beatMs     = 1000 / this.ENTRAINMENT_HZ;
        const intervalMs = beatMs * 2; // fires every other heartbeat

        // Small offset so sitar lands just after the heartbeat — call and response feel
        setTimeout(() => {
            this.sitarInterval = setInterval(() => {
                if (!this.ctx || this.muted) return;

                const osc  = this.ctx.createOscillator();
                const gain = this.ctx.createGain();

                osc.type = 'triangle';
                // Divide by harmonic interval to bring frequency down into comfortable range.
                // 852 / 1.5 = 568 Hz, 852 / 1.333 = 639 Hz, etc. — all meditative ranges.
                osc.frequency.setValueAtTime(
                    this.THIRD_EYE_HZ / this.harmonicInterval,
                    this.ctx.currentTime
                );

                // Plucked string envelope: fast attack, slow decay
                gain.gain.setValueAtTime(0, this.ctx.currentTime);
                gain.gain.linearRampToValueAtTime(1.5, this.ctx.currentTime + 0.008);
                gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.8);

                osc.connect(gain);
                gain.connect(this.compressor);
                osc.start(this.ctx.currentTime);
                osc.stop(this.ctx.currentTime + 0.85);

            }, intervalMs);
        }, 100); // 100ms after heartbeat
    }

    // Starts both audio layers simultaneously.
    // Called automatically when the mandala appears — the Generate button click
    // satisfies the browser user-gesture requirement for AudioContext.
    start(hashNumbers) {
        if (this.running) this.stop();

        this.initContext();
        this.extractAudioParams(hashNumbers);

        if (this.ctx.state === 'suspended') this.ctx.resume();

        this.startHeartbeat();
        this.startSitarHarmonic();

        this.running = true;
        this.muted   = false;
    }

    // Stops both layers and clears all intervals.
    // Always call before generating a new mandala to prevent overlapping soundscapes.
    stop() {
        if (this.heartbeatInterval) { clearInterval(this.heartbeatInterval); this.heartbeatInterval = null; }
        if (this.sitarInterval)     { clearInterval(this.sitarInterval);     this.sitarInterval     = null; }
        this.running = false;
    }

    // Toggles mute with smooth gain ramping to prevent audible clicks.
    // Rhythm timing is preserved so both layers resume in sync when unmuted.
    toggleMute() {
        if (!this.masterGain) return;

        this.muted = !this.muted;

        if (this.muted) {
            this.masterGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.1);
        } else {
            if (this.ctx.state === 'suspended') this.ctx.resume();
            this.masterGain.gain.linearRampToValueAtTime(0.75, this.ctx.currentTime + 0.1);
        }

        return this.muted;
    }
}
