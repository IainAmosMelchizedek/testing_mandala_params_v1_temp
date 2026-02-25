// mandala.js - Sacred geometry renderer for the Intention Keeper
// Converts a SHA-256 hash into deterministic geometric patterns on an HTML5 canvas.
// Animation runs continuously via requestAnimationFrame after generate() is called.

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

        // Resize canvas to fit screen on load and whenever window size changes
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    // Scales canvas to the smaller of window width or 600px.
    // Keeps the mandala square and prevents horizontal overflow on mobile.
    resizeCanvas() {
        const maxSize = Math.min(window.innerWidth - 40, 600);
        this.canvas.width = maxSize;
        this.canvas.height = maxSize;
        this.centerX = this.canvas.width / 2;
        this.centerY = this.canvas.height / 2;
    }

    // Hashes the intention text and extracts numeric parameters that
    // deterministically control ring count, symmetry, color, and complexity.
    // Same intention always produces the same mandala.
    async generate(intentionText) {
        this.intentionText = intentionText;
        const hash = await generateHash(intentionText);
        this.hashNumbers = hexToNumbers(hash);
        this.fullHash = hash;

        // Use specific byte positions in the hash to seed visual parameters
        const numPoints = 8 + (this.hashNumbers[0] % 8);   // 8–16 points
        this.numRings = 3 + (this.hashNumbers[1] % 5);      // 3–8 rings
        this.symmetry = [6, 8, 12, 16][this.hashNumbers[2] % 4]; // Sacred geometry symmetry values
        this.baseHue = this.hashNumbers[3] % 360;            // Full color wheel
        this.complexity = 1 + (this.hashNumbers[4] % 3);    // 1–3 pattern complexity levels

        // Convert hash bytes to spherical coordinates for each point
        this.points = [];
        for (let i = 0; i < numPoints; i++) {
            this.points.push(hashToSphericalCoords(this.hashNumbers, i));
        }

        return hash;
    }

    // Renders one frame of the mandala.
    // pulse: breathing scale factor (oscillates ~0.8–1.1)
    // rotation: cumulative clockwise rotation in radians
    drawMandala(pulse, rotation) {
        // Near-opaque black fill creates motion trail effect as frames stack
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.95)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        const scale = Math.min(this.canvas.width, this.canvas.height) / 3;

        // Apply global rotation around canvas center
        this.ctx.save();
        this.ctx.translate(this.centerX, this.centerY);
        this.ctx.rotate(rotation);
        this.ctx.translate(-this.centerX, -this.centerY);

        // Draw rings from back to front so outer rings appear behind inner ones
        for (let ring = this.numRings - 1; ring >= 0; ring--) {
            const ringRadius = (ring + 1) / this.numRings;
            const alpha = 0.3 + (ring / this.numRings) * 0.5;
            // Hue shifts per ring and over time, creating color cycling animation
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

                    // Draw glowing dot at each geometry point
                    const size = (2 + this.complexity) * pulse;
                    this.ctx.beginPath();
                    this.ctx.arc(cart.x, cart.y, size, 0, Math.PI * 2);
                    this.ctx.fillStyle = `hsla(${hue}, 70%, 60%, ${alpha})`;
                    this.ctx.shadowBlur = 10 * pulse;
                    this.ctx.shadowColor = `hsla(${hue}, 80%, 70%, ${alpha})`;
                    this.ctx.fill();

                    // Connect consecutive points with semi-transparent lines
                    if (i > 0) {
                        const prev = this.points[i - 1];
                        const prevCart = sphericalToCartesian(
                            prev.longitude, prev.latitude,
                            prev.radius * ringRadius * pulse,
                            0, 0, scale
                        );
                        this.ctx.beginPath();
                        this.ctx.moveTo(prevCart.x, prevCart.y);
                        this.ctx.lineTo(cart.x, cart.y);
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

        // Pulsing center dot anchors the mandala visually
        this.ctx.beginPath();
        this.ctx.arc(this.centerX, this.centerY, 5 * pulse, 0, Math.PI * 2);
        this.ctx.fillStyle = `hsl(${this.baseHue}, 80%, 70%)`;
        this.ctx.shadowBlur = 15 * pulse;
        this.ctx.shadowColor = `hsl(${this.baseHue}, 80%, 70%)`;
        this.ctx.fill();
        this.ctx.shadowBlur = 0;

        // --- TOP RIGHT: Cryptographic signature (MERIDIAN-HASH) ---
        // Placed here to identify the mandala without interfering with the artwork center
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
        // Rendered after the mandala so it always appears on top of the animation.
        // Word-wrapped to stay within canvas bounds. Max 50 words enforced upstream in app.js.
        if (this.intentionText) {
            this.ctx.save();
            const fontSize = Math.max(9, Math.floor(this.canvas.width / 55));
            this.ctx.font = `${fontSize}px monospace`;
            this.ctx.fillStyle = 'rgba(149, 165, 166, 0.85)';
            this.ctx.textAlign = 'left';

            const lineH = fontSize + 3;
            const padding = 10;
            // Estimate max characters per line based on canvas width and monospace char width
            const maxChars = Math.floor((this.canvas.width - padding * 2) / (fontSize * 0.6));

            // Word-wrap the intention into lines
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

            // Draw label then wrapped lines, anchored to bottom left
            const totalLines = lines.length + 1; // +1 for the label
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

    // Drives the breathing and rotation animation loop.
    // Pulse oscillates between ~0.8 and 1.1 using a sine wave.
    // Rotation is a steady clockwise increment each frame.
    startBreathing() {
        const speed = 0.02;
        const animate = () => {
            this.time += speed;
            const pulse = 0.95 + Math.sin(this.time) * 0.15;
            const rotation = this.time * 0.25;
            this.drawMandala(pulse, rotation);
            this.animationFrame = requestAnimationFrame(animate);
        };
        animate();
    }

    // Cancels the animation loop. Call before generating a new mandala
    // to avoid multiple loops running simultaneously.
    stopBreathing() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
    }

    // Returns raw pixel data for the current frame — used for PNG/GIF export
    getCurrentFrame() {
        return this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    }
}
