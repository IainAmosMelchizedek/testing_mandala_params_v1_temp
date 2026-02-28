// mandala.js - Sacred geometry renderer for the Intention Keeper
// Converts a SHA-256 hash into a deterministic, animated geometric mandala.
// Counterclockwise rotation is achieved by directly offsetting point coordinates.
// Depth-of-field parallax: outer rings rotate slower than inner rings, creating
// the illusion of three-dimensional depth — like looking into a spinning galaxy.
// Includes spiral dissolve effect triggered at the end of a meditation session.

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

        // Breathing parameters seeded from hash in generate().
        this.pulseAmplitude = 0.10;
        this.pulseSpeed = 0.02;

        // Master rotation angle — decremented each frame for counterclockwise movement.
        // Each ring gets its own rotation offset derived from this base angle,
        // scaled by a depth factor so outer rings lag behind inner rings.
        this.rotationAngle = 0;

        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    // Scales canvas to fit screen without horizontal overflow.
    resizeCanvas() {
        const maxSize = Math.min(window.innerWidth - 40, 600);
        this.canvas.width = maxSize;
        this.canvas.height = maxSize;
        this.centerX = this.canvas.width / 2;
        this.centerY = this.canvas.height / 2;
    }

    // Hashes the intention and extracts visual parameters.
    // Same intention always produces the same mandala — deterministic by design.
    async generate(intentionText) {
        this.intentionText = intentionText;
        const hash = await generateHash(intentionText);
        this.hashNumbers = hexToNumbers(hash);
        this.fullHash = hash;

        const numPoints     = 8  + (this.hashNumbers[0] % 8);
        this.numRings       = 3  + (this.hashNumbers[1] % 5);
        this.symmetry       = [6, 8, 12, 16][this.hashNumbers[2] % 4];
        this.baseHue        = this.hashNumbers[3] % 360;
        this.complexity     = 1  + (this.hashNumbers[4] % 3);
        this.pulseAmplitude = 0.05 + (this.hashNumbers[10] / 255) * 0.15;
        this.pulseSpeed     = 0.015 + (this.hashNumbers[11] / 255) * 0.03;
        this.rotationAngle  = 0;

        this.points = [];
        for (let i = 0; i < numPoints; i++) {
            this.points.push(hashToSphericalCoords(this.hashNumbers, i));
        }

        return hash;
    }

    // Rotates a 2D point around the canvas center by a given angle.
    // Used for both symmetry placement and the per-ring parallax rotation.
    rotatePoint(x, y, angle) {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const dx  = x - this.centerX;
        const dy  = y - this.centerY;
        return {
            x: this.centerX + dx * cos - dy * sin,
            y: this.centerY + dx * sin + dy * cos
        };
    }

    // Renders one frame of the mandala.
    // pulse: breathing scale multiplier
    // Parallax depth: each ring's rotation is scaled by a depth factor.
    // Inner rings (higher ring index) rotate faster — outer rings lag behind.
    // This creates the illusion that inner rings are closer and spinning faster,
    // while outer rings recede into the distance and drift more slowly.
    drawMandala(pulse) {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.95)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        const scale = Math.min(this.canvas.width, this.canvas.height) / 3;

        for (let ring = this.numRings - 1; ring >= 0; ring--) {
            const ringRadius = (ring + 1) / this.numRings;
            const alpha = 0.3 + (ring / this.numRings) * 0.5;
            const hue   = (this.baseHue + ring * 30 + this.time * 10) % 360;

            // PARALLAX DEPTH FACTOR:
            // Normalized ring depth from 0.0 (outermost) to 1.0 (innermost).
            // Outer rings use a fraction of the master rotation angle (slow, distant).
            // Inner rings use a larger multiple (fast, close).
            // Range 0.3 to 1.8 gives a 6x speed difference between outermost and innermost.
            const depth        = ring / (this.numRings - 1); // 0.0 = outer, 1.0 = inner
            const depthFactor  = 0.3 + depth * 1.5;
            const ringRotation = this.rotationAngle * depthFactor;

            for (let sym = 0; sym < this.symmetry; sym++) {
                const symAngle = (Math.PI * 2 * sym) / this.symmetry;

                for (let i = 0; i < this.points.length; i++) {
                    const point = this.points[i];

                    const base = sphericalToCartesian(
                        point.longitude, point.latitude,
                        point.radius * ringRadius * pulse,
                        0, 0, scale
                    );

                    // Apply symmetry rotation
                    const symRotated = this.rotatePoint(
                        this.centerX + base.x,
                        this.centerY + base.y,
                        symAngle
                    );

                    // Apply per-ring parallax rotation instead of the flat global rotation.
                    // Each ring now has its own rotation speed based on its depth.
                    const final = this.rotatePoint(
                        symRotated.x,
                        symRotated.y,
                        ringRotation
                    );

                    // Glowing dot — size slightly larger for inner rings to enhance depth illusion
                    const depthSize = (2 + this.complexity) * pulse * (0.7 + depth * 0.6);
                    this.ctx.beginPath();
                    this.ctx.arc(final.x, final.y, depthSize, 0, Math.PI * 2);
                    this.ctx.fillStyle = `hsla(${hue}, 70%, 60%, ${alpha})`;
                    this.ctx.shadowBlur = 10 * pulse * (0.5 + depth * 0.8);
                    this.ctx.shadowColor = `hsla(${hue}, 80%, 70%, ${alpha})`;
                    this.ctx.fill();

                    // Connecting curves between consecutive points
                    if (i > 0) {
                        const prevPoint = this.points[i - 1];
                        const prevBase  = sphericalToCartesian(
                            prevPoint.longitude, prevPoint.latitude,
                            prevPoint.radius * ringRadius * pulse,
                            0, 0, scale
                        );
                        const prevSymRotated = this.rotatePoint(
                            this.centerX + prevBase.x,
                            this.centerY + prevBase.y,
                            symAngle
                        );
                        const prevFinal = this.rotatePoint(
                            prevSymRotated.x,
                            prevSymRotated.y,
                            ringRotation
                        );

                        const cpX = (final.x + prevFinal.x) / 2 * (0.85 - ring * 0.03) +
                                    this.centerX * (1 - (0.85 - ring * 0.03));
                        const cpY = (final.y + prevFinal.y) / 2 * (0.85 - ring * 0.03) +
                                    this.centerY * (1 - (0.85 - ring * 0.03));

                        this.ctx.beginPath();
                        this.ctx.moveTo(prevFinal.x, prevFinal.y);
                        this.ctx.quadraticCurveTo(cpX, cpY, final.x, final.y);
                        this.ctx.strokeStyle = `hsla(${hue}, 60%, 50%, ${alpha * 0.5})`;
                        this.ctx.lineWidth = 1;
                        this.ctx.shadowBlur = 5;
                        this.ctx.stroke();
                    }
                }
            }
        }

        // Pulsing center dot — brightest point, anchors the depth illusion
        this.ctx.beginPath();
        this.ctx.arc(this.centerX, this.centerY, 5 * pulse, 0, Math.PI * 2);
        this.ctx.fillStyle = `hsl(${this.baseHue}, 80%, 70%)`;
        this.ctx.shadowBlur = 15 * pulse;
        this.ctx.shadowColor = `hsl(${this.baseHue}, 80%, 70%)`;
        this.ctx.fill();
        this.ctx.shadowBlur = 0;

        // --- TOP RIGHT: Cryptographic signature ---
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

        // --- BOTTOM LEFT: Intention text ---
        if (this.intentionText) {
            this.ctx.save();
            const fontSize = Math.max(9, Math.floor(this.canvas.width / 55));
            this.ctx.font = `${fontSize}px monospace`;
            this.ctx.fillStyle = 'rgba(149, 165, 166, 0.85)';
            this.ctx.textAlign = 'left';

            const lineH   = fontSize + 3;
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

    // Animation loop with hash-seeded breathing and parallax rotation.
    // rotationAngle decrements each frame — all rings rotate counterclockwise
    // but at different speeds based on their depth factor in drawMandala().
    startBreathing() {
        const rotationStep = -0.005;

        const animate = () => {
            this.time += this.pulseSpeed;
            this.rotationAngle += rotationStep;

            const pulse = 1.0 +
                Math.sin(this.time) * this.pulseAmplitude +
                Math.sin(this.time * 1.6) * (this.pulseAmplitude * 0.2);

            this.drawMandala(pulse);
            this.animationFrame = requestAnimationFrame(animate);
        };
        animate();
    }

    // Stops the breathing animation loop.
    stopBreathing() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
    }

    // Spiral dissolve — shrinks and rotates mandala inward over the given duration.
    // Called by app.js when the meditation timer completes.
    spiralDissolve(duration) {
        this.stopBreathing();

        const steps    = 60;
        const interval = duration / steps;
        let   step     = 0;

        const dissolve = setInterval(() => {
            step++;
            const scale        = Math.max(0.001, 1 - (step / steps));
            const extraRotation = step * 0.15;
            this.rotationAngle -= extraRotation * 0.01;

            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

            this.ctx.save();
            this.ctx.translate(this.centerX, this.centerY);
            this.ctx.scale(scale, scale);
            this.ctx.translate(-this.centerX, -this.centerY);
            this.drawMandala(scale);
            this.ctx.restore();

            if (step >= steps) {
                clearInterval(dissolve);
                this.ctx.fillStyle = 'rgba(0, 0, 0, 1)';
                this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            }
        }, interval);
    }

    // Returns current frame pixel data for PNG/GIF export
    getCurrentFrame() {
        return this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    }
}
