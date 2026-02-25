// mandala.js - Sacred geometry renderer for the Intention Keeper
// Converts a SHA-256 hash into a deterministic, animated geometric mandala.
// Every visual property — color, complexity, breathing speed, rotation — is seeded
// from the hash so the same intention always produces the same mandala.
// Rotation is counterclockwise, achieved by decrementing the angle over time.

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

        // Breathing parameters are overwritten in generate() from hash bytes.
        // Defaults here prevent errors if drawMandala is somehow called before generate().
        this.pulseAmplitude = 0.10;
        this.pulseSpeed = 0.02;

        // Track total rotation angle separately so we can decrement it for counterclockwise.
        // Using a dedicated variable avoids sign confusion with this.time.
        this.rotationAngle = 0;

        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    // Scales the canvas to fit the screen without horizontal overflow.
    // Square canvas preserves the mandala's circular symmetry on all devices.
    resizeCanvas() {
        const maxSize = Math.min(window.innerWidth - 40, 600);
        this.canvas.width = maxSize;
        this.canvas.height = maxSize;
        this.centerX = this.canvas.width / 2;
        this.centerY = this.canvas.height / 2;
    }

    // Hashes the intention and extracts all visual parameters from specific byte positions.
    // Using non-sequential byte positions reduces correlation between visual parameters.
    async generate(intentionText) {
        this.intentionText = intentionText;
        const hash = await generateHash(intentionText);
        this.hashNumbers = hexToNumbers(hash);
        this.fullHash = hash;

        // Structural parameters — determine shape and complexity of the mandala
        const numPoints   = 8 + (this.hashNumbers[0] % 8);
        this.numRings     = 3 + (this.hashNumbers[1] % 5);
        this.symmetry     = [6, 8, 12, 16][this.hashNumbers[2] % 4];
        this.baseHue      = this.hashNumbers[3] % 360;
        this.complexity   = 1 + (this.hashNumbers[4] % 3);

        // Breathing parameters — each intention breathes at its own unique rhythm
        // Amplitude range 0.05–0.20 keeps pulse subtle but perceptible
        // Speed range 0.015–0.045 prevents animation from feeling mechanical
        this.pulseAmplitude = 0.05 + (this.hashNumbers[10] / 255) * 0.15;
        this.pulseSpeed     = 0.015 + (this.hashNumbers[11] / 255) * 0.03;

        // Reset rotation so each new mandala starts fresh
        this.rotationAngle = 0;

        // Generate geometry points using the evolved spherical coordinate system
        this.points = [];
        for (let i = 0; i < numPoints; i++) {
            this.points.push(hashToSphericalCoords(this.hashNumbers, i));
        }

        return hash;
    }

    // Renders one frame.
    // pulse: scale multiplier that breathes the mandala in and out
    // rotationAngle: current rotation in radians — decremented each frame for counterclockwise
    drawMandala(pulse) {
        // Near-opaque fill creates a subtle motion trail as frames stack
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.95)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        const scale = Math.min(this.canvas.width, this.canvas.height) / 3;

        // Apply counterclockwise rotation around canvas center.
        // Translating to center before rotating ensures rotation pivots correctly.
        this.ctx.save();
        this.ctx.translate(this.centerX, this.centerY);
        this.ctx.rotate(this.rotationAngle); // rotationAngle is always negative = counterclockwise
        this.ctx.translate(-this.centerX, -this.centerY);

        // Draw rings from back to front so inner rings render on top of outer rings
        for (let ring = this.numRings - 1; ring >= 0; ring--) {
            const ringRadius = (ring + 1) / this.numRings;
            const alpha = 0.3 + (ring / this.numRings) * 0.5;
            // Hue shifts per ring and advances over time for continuous color cycling
            const hue = (this.baseHue + ring * 30 + this.time * 10) % 360;

            for (let sym = 0; sym < this.symmetry; sym++) {
                // Positive angle here distributes segments evenly around the circle.
                // The counterclockwise effect comes from the global rotation above, not here.
                const angle = -(Math.PI * 2 * sym) / this.symmetry;
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

                    // Quadratic bezier curves between points approximate great-circle arcs.
                    // Control point pulled toward center creates natural inward curvature.
                    if (i > 0) {
                        const prev = this.points[i - 1];
                        const prevCart = sphericalToCartesian(
                            prev.longitude, prev.latitude,
                            prev.radius * ringRadius * pulse,
                            0, 0, scale
                        );

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
        // Placed in corner to identify the mandala without overlapping the artwork
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
        // Rendered last so it always appears on top of the animation.
        // Word-wrapped to stay within canvas bounds.
        // 50-word maximum is enforced upstream in app.js before this is called.
        if (this.intentionText) {
            this.ctx.save();
            const fontSize = Math.max(9, Math.floor(this.canvas.width / 55));
            this.ctx.font = `${fontSize}px monospace`;
            this.ctx.fillStyle = 'rgba(149, 165, 166, 0.85)';
            this.ctx.textAlign = 'left';

            const lineH = fontSize + 3;
            const padding = 10;
            const maxChars = Math.floor((this.canvas.width - padding * 2) / (fontSize * 0.6));

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

    // Animation loop driven by hash-seeded breathing parameters.
    // rotationAngle decrements by a fixed step each frame — this is what guarantees
    // counterclockwise movement independently of any other rotation in the draw calls.
    startBreathing() {
        // Rotation step per frame — negative value is the sole driver of counterclockwise direction
        const rotationStep = -0.008;

        const animate = () => {
            this.time += this.pulseSpeed;

            // Decrement rotation angle each frame — guaranteed counterclockwise
            this.rotationAngle += rotationStep;

            // Sine wave pulse — amplitude and speed are unique to each intention's hash
            const pulse = 1.0 + Math.sin(this.time) * this.pulseAmplitude;

            this.drawMandala(pulse);
            this.animationFrame = requestAnimationFrame(animate);
        };
        animate();
    }

    // Stops the animation loop. Must be called before generating a new mandala
    // to prevent multiple animation loops running simultaneously.
    stopBreathing() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
    }

    // Returns raw pixel data for the current frame — used by PNG and GIF export
    getCurrentFrame() {
        return this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    }
}
