// mandala.js - Sacred geometry renderer for the Intention Keeper
// Converts a SHA-256 hash into a deterministic, animated geometric mandala.
// Every visual property — color, complexity, breathing speed, rotation — is seeded
// from the hash so the same intention always produces the same mandala.

class MandalaGenerator {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.animationFrame = null;
        this.time = 0;
        this.points = [];
        this.numRings = 0;
        this.symmetry = 0;
        this.baseHue = 0;
        this.complexity = 0;
        this.hashNumbers = [];
        this.fullHash = '';
        this.intentionText = '';
        this.showHash = true;

        // Breathing parameters are set in generate() from hash bytes.
        // Defaults here are overwritten before any animation runs.
        this.pulseAmplitude = 0.10;
        this.pulseSpeed = 0.02;

        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    // Scales the canvas to fit the screen without horizontal overflow.
    // Square canvas keeps the mandala's circular symmetry intact on all devices.
    resizeCanvas() {
        const maxSize = Math.min(window.innerWidth - 40, 600);
        this.canvas.width = maxSize;
        this.canvas.height = maxSize;
        this.centerX = this.canvas.width / 2;
        this.centerY = this.canvas.height / 2;
    }

    // Hashes the intention and extracts all visual parameters from specific byte positions.
    // Bytes 0–4 control structure; bytes 10–11 control breathing behavior.
    // Using named byte positions (not sequential) reduces correlation between parameters.
    async generate(intentionText) {
        this.intentionText = intentionText;
        const hash = await generateHash(intentionText);
        this.hashNumbers = hexToNumbers(hash);
        this.fullHash = hash;

        // Structural parameters — determine the shape and complexity of the mandala
        const numPoints   = 8 + (this.hashNumbers[0] % 8);
        this.numRings     = 3 + (this.hashNumbers[1] % 5);
        this.symmetry     = [6, 8, 12, 16][this.hashNumbers[2] % 4];
        this.baseHue      = this.hashNumbers[3] % 360;
        this.complexity   = 1 + (this.hashNumbers[4] % 3);

        // Breathing parameters — each intention breathes at its own rhythm.
        // Amplitude range 0.05–0.20 keeps the pulse subtle but perceptible.
        // Speed range 0.015–0.045 prevents the animation from feeling mechanical.
        this.pulseAmplitude = 0.05 + (this.hashNumbers[10] / 255) * 0.15;
        this.pulseSpeed     = 0.015 + (this.hashNumbers[11] / 255) * 0.03;

        // Generate geometry points using the evolved spherical coordinate system
        this.points = [];
        for (let i = 0; i < numPoints; i++) {
            this.points.push(hashToSphericalCoords(this.hashNumbers, i));
        }

        return hash;
    }

    // Renders one frame. Called on every animation tick with current pulse and rotation values.
    // pulse: scale multiplier that breathes the mandala in and out
    // rotation: cumulative angle in radians — negative value drives counterclockwise movement
    drawMandala(pulse, rotation) {
        // Near-opaque fill rather than full clear creates a subtle motion trail.
        // Reducing opacity here would make trails longer and more visible.
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.95)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        const scale = Math.min(this.canvas.width, this.canvas.height) / 3;

        // Rotate the entire mandala around its center point
        this.ctx.save();
        this.ctx.translate(this.centerX, this.centerY);
        this.ctx.rotate(rotation);
        this.ctx.translate(-this.centerX, -this.centerY);

        // Outer rings drawn first so inner rings render on top
        for (let ring = this.numRings - 1; ring >= 0; ring--) {
            const ringRadius = (ring + 1) / this.numRings;
            const alpha = 0.3 + (ring / this.numRings) * 0.5;
            // Hue shifts per ring and advances over time for continuous color cycling
            const hue = (this.baseHue + ring * 30 + this.time * 10) % 360;

            for (let sym = 0; sym < this.symmetry; sym++) {
                const angle = (Math.PI * 2 * sym) / this.symmetry;
                this.ctx.save();
                this.ctx.translate(this.centerX, this.centerY);
                this.ctx.rotate(angle);

                for (let i = 0; i < this.points.length; i++) {
                    const point = this.points[i];
                    const cart = sphericalToCartesian(
                        point.longitude, point.latitude,
                        point.radius * ringRadius * pulse,
                        0, 0, scale
                    );

                    // Glowing dot at each geometry point
                    const size = (2 + this.complexity) * pulse;
                    this.ctx.beginPath();
                    this.ctx.arc(cart.x, cart.y, size, 0, Math.PI * 2);
                    this.ctx.fillStyle = `hsla(${hue}, 70%, 60%, ${alpha})`;
                    this.ctx.shadowBlur = 10 * pulse;
                    this.ctx.shadowColor = `hsla(${hue}, 80%, 70%, ${alpha})`;
                    this.ctx.fill();

                    // Connect points with quadratic bezier curves instead of straight lines.
                    // The control point is offset toward the canvas center, creating an inward
                    // arc that mimics the curvature of great circles on a sphere.
                    if (i > 0) {
                        const prev = this.points[i - 1];
                        const prevCart = sphericalToCartesian(
                            prev.longitude, prev.latitude,
                            prev.radius * ringRadius * pulse,
                            0, 0, scale
                        );

                        // Control point pulls the curve toward center — curvature scales with ring depth
                        const cpX = (cart.x + prevCart.x) / 2 * (0.85 - ring * 0.03);
                        const cpY = (cart.y + prevCart.y) / 2 * (0.85 - ring * 0.03);

                        this.ctx.beginPath();
                        this.ctx.moveTo(prevCart.x, prevCart.y);
                        this.ctx.quadraticCurveTo(cpX, cpY, cart.x, cart.y);
                        this.ctx.strokeStyle = `hsla(${hue}, 60%, 50%, ${alpha * 0.5})`;
                        this.ctx.lineWidth = 1;
                        this.ctx.shadowBlur = 5;
                        this.ctx.stroke();
                    }
                }
                this.ctx.restore();
            }
        }

        this.ctx.restore();

        // Pulsing center dot — visual anchor and heartbeat of the mandala
        this.ctx.beginPath();
        this.ctx.arc(this.centerX, this.centerY, 5 * pulse, 0, Math.PI * 2);
        this.ctx.fillStyle = `hsl(${this.baseHue}, 80%, 70%)`;
        this.ctx.shadowBlur = 15 * pulse;
        this.ctx.shadowColor = `hsl(${this.baseHue}, 80%, 70%)`;
        this.ctx.fill();
        this.ctx.shadowBlur = 0;

        // --- TOP RIGHT: Cryptographic signature ---
        // Identifies the mandala's hash without interfering with the central artwork
        if (this.showHash && this.fullHash) {
            this.ctx.save();
            const fontSize = Math.max(8, Math.floor(this.canvas.width / 60));
            this.ctx.font = `${fontSize}px monospace`;
            this.ctx.fillStyle = 'rgba(149, 165, 166, 0.8)';
            this.ctx.textAlign = 'right';

            const x = this.canvas.width - 10;
            this.ctx.fillText('MERIDIAN-HASH:', x, fontSize + 10);
            this.ctx.fillText(this.fullHash.substring(0, 32), x, fontSize * 2 + 15);
            this.ctx.fillText(this.fullHash.substring(32), x, fontSize * 3 + 20);
            this.ctx.restore();
        }

        // --- BOTTOM LEFT: User's intention text ---
        // Rendered last so it always sits on top of the animation.
        // Word-wrapped to stay within canvas bounds.
        // 50-word maximum is enforced upstream in app.js before this is ever called.
        if (this.intentionText) {
            this.ctx.save();
            const fontSize = Math.max(9, Math.floor(this.canvas.width / 55));
            this.ctx.font = `${fontSize}px monospace`;
            this.ctx.fillStyle = 'rgba(149, 165, 166, 0.85)';
            this.ctx.textAlign = 'left';

            const lineH = fontSize + 3;
            const padding = 10;
            const maxChars = Math.floor((this.canvas.width - padding * 2) / (fontSize * 0.6));

            // Word-wrap intention into display lines
            const words = this.intentionText.split(' ');
            let lines = [];
            let currentLine = '';
            for (let word of words) {
                const test = currentLine ? currentLine + ' ' + word : word;
                if (test.length > maxChars && currentLine) {
                    lines.push(currentLine);
                    currentLine = word;
                } else {
                    currentLine = test;
                }
            }
            if (currentLine) lines.push(currentLine);

            // Anchor text block to bottom left — label first, then wrapped lines
            const totalLines = lines.length + 1;
            let y = this.canvas.height - padding - (totalLines - 1) * lineH;
            this.ctx.fillText('INTENTION:', padding, y);
            y += lineH;
            for (let line of lines) {
                this.ctx.fillText(line, padding, y);
                y += lineH;
            }

            this.ctx.restore();
        }
    }

    // Drives the animation loop using hash-seeded breathing parameters.
    // Negative rotation multiplier produces counterclockwise movement.
    // Each intention has its own pulse rhythm because pulseAmplitude and pulseSpeed
    // are derived from that intention's unique hash bytes.
    startBreathing() {
        const animate = () => {
            this.time += this.pulseSpeed;

            // Sine wave oscillation — amplitude controls how much the mandala expands/contracts
            const pulse = 1.0 + Math.sin(this.time) * this.pulseAmplitude;

            // Negative value = counterclockwise. Magnitude kept subtle so rotation
            // feels meditative rather than mechanical.
            const rotation = -(this.time * -2.0);

            this.drawMandala(pulse, rotation);
            this.animationFrame = requestAnimationFrame(animate);
        };
        animate();
    }

    // Stops the animation loop. Always call this before generating a new mandala
    // to prevent multiple loops from running simultaneously and causing visual glitches.
    stopBreathing() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
    }

    // Returns raw pixel data for the current frame — used by PNG and GIF export functions
    getCurrentFrame() {
        return this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    }
}
