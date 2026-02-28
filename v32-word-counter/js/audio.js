// audio.js - Hash-seeded water soundscape engine for the Intention Keeper
//
// CONCEPT:
// Replaces the heartbeat/sitar layers with a flowing water soundscape.
// The 7.83 Hz Schumann Resonance is expressed as a gentle volume modulation —
// the water breathes at Earth's electromagnetic frequency rather than thumping it.
// This creates a felt resonance rather than a heard beat.
//
// AUDIO ARCHITECTURE:
// White noise → Low-pass filter → Gain modulation → Compressor → Master gain
//
// White noise contains all frequencies equally. The low-pass filter removes
// high frequencies, leaving the warm rushing quality of water or wind.
// Slowly modulating the filter cutoff frequency creates the ebb and flow
// of water movement — rising and receding like waves or a stream.
//
// HASH-SEEDED ELEMENTS (unique per intention):
// - Filter cutoff frequency: determines whether it sounds like distant ocean,
//   rushing stream, or gentle rain
// - Modulation depth: how dramatically the water rises and falls
// - Secondary tone: a barely audible sine wave at the hash-derived frequency
//   adds a subtle tonal character beneath the water — like a resonant cave
//   or the hum of a deep river
//
// FIXED ELEMENTS (same for all intentions):
// - Schumann Resonance modulation rate: 7.83 Hz — Earth's heartbeat expressed
//   as the breathing rhythm of the water volume

class IntentionAudioEngine {
    constructor() {
        // AudioContext deferred until first user gesture (browser autoplay policy)
        this.ctx        = null;
        this.masterGain = null;
        this.compressor = null;

        // Noise source and filter nodes
        this.noiseSource    = null;
        this.noiseFilter    = null;
        this.noiseGain      = null;

        // Secondary resonant tone beneath the water
        this.resonantOsc    = null;
        this.resonantGain   = null;

        // Schumann modulation — LFO that makes the water breathe at 7.83 Hz
        this.schumannLFO    = null;
        this.schumannGain   = null;

        this.muted   = false;
        this.running = false;

        // CLINICAL CONSTANT: 7.83 Hz Schumann Resonance.
        // Applied as LFO modulation rate on the water volume —
        // the water breathes at Earth's electromagnetic heartbeat.
        this.SCHUMANN_HZ = 7.83;

        // Hash-derived parameters — set in extractAudioParams() before audio starts
        this.filterCutoff      = 800;  // Hz — controls water character
        this.modulationDepth   = 400;  // Hz — how much the filter sweeps
        this.resonantFrequency = 110;  // Hz — subtle tonal undertone
    }

    // Initializes AudioContext and the signal chain.
    // Chain: Sources → Compressor → MasterGain → Speakers
    initContext() {
        if (this.ctx) return;
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();

        this.compressor = this.ctx.createDynamicsCompressor();
        this.compressor.threshold.setValueAtTime(-18, this.ctx.currentTime);
        this.compressor.knee.setValueAtTime(6,    this.ctx.currentTime);
        this.compressor.ratio.setValueAtTime(4,   this.ctx.currentTime);
        this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
        this.compressor.release.setValueAtTime(0.25,  this.ctx.currentTime);

        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(0.85, this.ctx.currentTime);

        this.compressor.connect(this.masterGain);
        this.masterGain.connect(this.ctx.destination);
    }

    // Derives water character from hash bytes 12-14.
    // These bytes are distant from the visual parameter bytes (0-11) to keep
    // audio and visual feeling independent despite sharing the same hash source.
    extractAudioParams(hashNumbers) {
        // Filter cutoff: 400-1200 Hz range
        // Low values (400-600 Hz) = deep ocean or heavy rain
        // Mid values (600-900 Hz) = rushing stream or waterfall
        // High values (900-1200 Hz) = light rain or gentle brook
        this.filterCutoff = 400 + (hashNumbers[12] / 255) * 800;

        // Modulation depth: how dramatically the filter sweeps up and down.
        // Wider sweep = more dramatic wave-like motion.
        // Narrower sweep = steadier, more meditative flow.
        this.modulationDepth = 200 + (hashNumbers[13] / 255) * 500;

        // Resonant undertone: a barely audible sine wave that gives the water
        // a subtle tonal identity — each intention has its own resonant note.
        // Range 80-220 Hz keeps it below the water noise, felt more than heard.
        this.resonantFrequency = 80 + (hashNumbers[14] / 255) * 140;
    }

    // Generates white noise using a WebAudio AudioBuffer filled with random values.
    // White noise contains equal energy at all frequencies — the raw material
    // for all synthesized natural sounds including water, wind, and rain.
    createNoiseSource() {
        // Buffer length: 2 seconds of noise at the sample rate.
        // Looping a 2-second buffer is inaudible to the human ear.
        const bufferSize  = this.ctx.sampleRate * 2;
        const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data        = noiseBuffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            // Random values between -1 and 1 produce white noise
            data[i] = Math.random() * 2 - 1;
        }

        const source  = this.ctx.createBufferSource();
        source.buffer = noiseBuffer;
        source.loop   = true; // loop seamlessly for continuous sound
        return source;
    }

    // Builds and starts the water soundscape.
    // Signal chain: Noise → Low-pass filter → Gain → Compressor
    // The Schumann LFO modulates the filter cutoff at 7.83 Hz.
    startWater() {
        // --- Noise source ---
        this.noiseSource = this.createNoiseSource();

        // --- Low-pass filter ---
        // Removes high frequencies from white noise, leaving warm rushing sound.
        // Q value of 1.5 adds slight resonance at the cutoff — more water-like.
        this.noiseFilter = this.ctx.createBiquadFilter();
        this.noiseFilter.type            = 'lowpass';
        this.noiseFilter.frequency.value = this.filterCutoff;
        this.noiseFilter.Q.value         = 1.5;

        // --- Noise gain ---
        // Controls the overall water volume before it hits the compressor
        this.noiseGain = this.ctx.createGain();
        this.noiseGain.gain.setValueAtTime(0.7, this.ctx.currentTime);

        // Connect noise chain
        this.noiseSource.connect(this.noiseFilter);
        this.noiseFilter.connect(this.noiseGain);
        this.noiseGain.connect(this.compressor);

        // --- Schumann LFO ---
        // A sine wave oscillator at 7.83 Hz modulates the filter cutoff frequency.
        // This makes the water breathe — rising and falling at Earth's heartbeat.
        // The LFO output is connected to the filter frequency AudioParam, not to audio output.
        this.schumannLFO  = this.ctx.createOscillator();
        this.schumannLFO.type            = 'sine';
        this.schumannLFO.frequency.value = this.SCHUMANN_HZ;

        // schumannGain scales the LFO output to the desired modulation depth in Hz.
        // A gain of 400 means the filter cutoff swings ±400 Hz around the center value.
        this.schumannGain = this.ctx.createGain();
        this.schumannGain.gain.value = this.modulationDepth;

        // LFO → gain → filter frequency parameter (not audio output)
        this.schumannLFO.connect(this.schumannGain);
        this.schumannGain.connect(this.noiseFilter.frequency);

        this.noiseSource.start();
        this.schumannLFO.start();
    }

    // Adds a barely audible resonant sine tone beneath the water.
    // This gives the soundscape a subtle tonal identity unique to each intention.
    // Volume is kept very low (0.08) so it supports rather than dominates the water.
    startResonantTone() {
        this.resonantOsc  = this.ctx.createOscillator();
        this.resonantOsc.type            = 'sine';
        this.resonantOsc.frequency.value = this.resonantFrequency;

        this.resonantGain = this.ctx.createGain();
        this.resonantGain.gain.setValueAtTime(0.08, this.ctx.currentTime);

        this.resonantOsc.connect(this.resonantGain);
        this.resonantGain.connect(this.compressor);
        this.resonantOsc.start();
    }

    // Starts the full soundscape. Called automatically when the mandala appears.
    // The Generate button click satisfies the browser user-gesture requirement.
    start(hashNumbers) {
        if (this.running) this.stop();

        this.initContext();
        this.extractAudioParams(hashNumbers);

        if (this.ctx.state === 'suspended') this.ctx.resume();

        this.startWater();
        this.startResonantTone();

        this.running = true;
        this.muted   = false;
    }

    // Stops all audio and releases nodes for garbage collection.
    // Always call before generating a new mandala to prevent overlapping soundscapes.
    stop() {
        const nodes = [
            this.noiseSource, this.schumannLFO,
            this.resonantOsc
        ];
        nodes.forEach(node => {
            if (node) { try { node.stop(); } catch(e) {} }
        });

        this.noiseSource  = null;
        this.noiseFilter  = null;
        this.noiseGain    = null;
        this.schumannLFO  = null;
        this.schumannGain = null;
        this.resonantOsc  = null;
        this.resonantGain = null;

        this.running = false;
    }

    // Toggles mute with smooth gain ramping to prevent audible clicks.
    // Rhythm timing is irrelevant here since water is continuous — but smooth
    // ramping still prevents the jarring click of an instant volume cut.
    toggleMute() {
        if (!this.masterGain) return;

        this.muted = !this.muted;

        if (this.muted) {
            this.masterGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.3);
        } else {
            if (this.ctx.state === 'suspended') this.ctx.resume();
            this.masterGain.gain.linearRampToValueAtTime(0.85, this.ctx.currentTime + 0.3);
        }

        return this.muted;
    }
}
