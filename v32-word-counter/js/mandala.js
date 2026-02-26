// mandala.js - Sacred geometry renderer for the Intention Keeper
// Converts a SHA-256 hash into a deterministic, animated geometric mandala.
// Counterclockwise rotation is achieved by directly offsetting point coordinates
// using a decrementing angle — no ctx.rotate() is used for animation direction,
// eliminating the optical illusion caused by canvas transform stacking.
// Includes a spiral dissolve effect triggered at the end of a meditation session.

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
        // Defaults prevent errors if drawMandala is called before generate().
        this.pulseAmplitude = 0.10;
        this.pulseSpeed = 0.02;

        // Master rotation angle, decremented each frame to drive counterclockwise movement.
        // Applied directly to point coordinates, not via ctx.rotate().
        this.rotationAngle = 0;

        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    // Scales canvas to fit screen without horizontal overflow.
    // Square shape preserves circular symmetry on all devices.
    resizeCanvas() {
        const maxSize = Math.min(window.innerWidth - 40, 600);
        this.canvas.width = maxSize;
        this.canvas.height = maxSize;
        this.centerX = this.canvas.width / 2;
        this.centerY = this.canvas.height / 2;
    }

    // Hashes the intention and extracts visual parameters from specific byte positions.
    // Same intention always produces the same mandala — deterministic by design.
    async generate(intentionText) {
        this.intentionText = intentionText;
        const hash = await generateHash(intentionText);
        this.hashNumbers = hexToNumbers(hash);
        this.fullHash = hash;

        // Structural parameters drawn from early bytes
        const numPoints     = 8 + (this.hashNumbers[0] % 8);
        this.numRings       = 3 + (this.hashNumbers[1] % 5);
        this.symmetry       = [6, 8, 12, 16][this.hashNumbers[2] % 4];
        this.baseHue        = this.hashNumbers[3] % 360;
        this.complexity     = 1 + (this.hashNumbers[4] % 3);

        // Breathing rhythm seeded from bytes 10-11 so it is independent of structure params.
        // Amplitude 0.05-0.20, speed 0.015-0.045 keeps animation meditative not mechanical.
        this.pulseAmplitude = 0.05 + (this.hashNumbers[10] / 255) * 0.15;
        this.pulseSpeed     = 0.015 + (this.hashNumbers[11] / 255) * 0.03;

        // Reset rotation so each new mandala starts from the same position
        this.rotationAngle = 0;

        this.points = [];
        for (let i = 0; i < numPoints; i++) {
            this.points.push(hashToSphericalCoords(this.hashNumbers, i));
        }

        return hash;
    }

    // Rotates a 2D point counterclockwise around the canvas center by a given angle.
    // Rotating coordinates directly rather than the canvas context guarantees
    // counterclockwise direction without optical illusion from transform stacking.
    rotatePoint(x, y, angle) {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const dx = x - this.centerX;
        const dy = y - this.centerY;
        return {
            x: this.centerX + dx * cos - dy * sin,
            y: this.centerY + dx * sin + dy * cos
        };
    }

    // Renders one frame of the mandala.
    // pulse: scale multiplier for the breathing effect
    // All rotation is applied via rotatePoint() using this.rotationAngle
    drawMandala(pulse) {
        // Near-opaque fill creates a subtle motion trail as frames stack
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.95)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        const scale = Math.min(this.canvas.width, this.canvas.height) / 3;

        // Draw rings from back to front so inner rings render on top
        for (let ring = this.numRings - 1; ring >= 0; ring--) {
            const ringRadius = (ring + 1) / this.numRings;
            const alpha = 0.3 + (ring / this.numRings) * 0.5;
            // Hue shifts per ring and over time for continuous color cycling
            const hue = (this.baseHue + ring * 30 + this.time * 10) % 360;

            for (let sym = 0; sym < this.symmetry; sym++) {
                const symAngle = (Math.PI * 2 * sym) / this.symmetry;

                for (let i = 0; i < this.points.length; i++) {
                    const point = this.points[i];

                    // Get base cartesian position from spherical coordinates
                    const base = sphericalToCartesian(
                        point.longitude, point.latitude,
                        point.radius * ringRadius * pulse,
                        0, 0, scale
                    );

                    // Apply symmetry rotation around center
                    const symRotated = this.rotatePoint(
                        this.centerX + base.x,
                        this.centerY + base.y,
                        symAngle
                    );

                    // Apply global counterclockwise rotation
                    const final = this.rotatePoint(
                        symRotated.x,
                        symRotated.y,
                        this.rotationAngle
                    );

                    // Glowing dot at final position
                    const size = (2 + this.complexity) * pulse;
                    this.ctx.beginPath();
                    this.ctx.arc(final.x, final.y, size, 0, Math.PI * 2);
                    this.ctx.fillStyle = `hsla(${hue}, 70%, 60%, ${alpha})`;
                    this.ctx.shadowBlur = 10 * pulse;
                    this.ctx.shadowColor = `hsla(${hue}, 80%, 70%, ${alpha})`;
                    this.ctx.fill();

                    // Quadratic bezier curves between points approximate great-circle arcs.
                    // Control point pulled toward center creates natural inward curvature.
                    if (i > 0) {
                        const prevPoint = this.points[i - 1];
                        const prevBase = sphericalToCartesian(
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
                            this.rotationAngle
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

        // Pulsing center dot — visual anchor of the mandala
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
        // Rendered last so it always appears on top of the animation.
        // 50-word limit enforced upstream in app.js.
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

    // Animation loop with hash-seeded breathing.
    // rotationAngle decrements each frame — guaranteed counterclockwise movement.
    startBreathing() {
        const rotationStep = -0.005;

        const animate = () => {
            this.time += this.pulseSpeed;
            this.rotationAngle += rotationStep;

            // Organic breathing with small harmonic overtone for natural feel
            const pulse = 1.0 +
                Math.sin(this.time) * this.pulseAmplitude +
                Math.sin(this.time * 1.6) * (this.pulseAmplitude * 0.2);

            this.drawMandala(pulse);
            this.animationFrame = requestAnimationFrame(animate);
        };
        animate();
    }

    // Stops the breathing animation loop.
    // Always call before generating a new mandala to prevent multiple loops running.
    stopBreathing() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
    }

    // Spiral dissolve effect triggered at the end of a meditation session.
    // Stops the breathing loop, then shrinks and rotates the mandala inward
    // over the given duration, creating the feeling of dissolving into the void.
    // duration: total dissolve time in milliseconds — should match audio fade duration.
    spiralDissolve(duration) {
        this.stopBreathing();

        const steps    = 60;
        const interval = duration / steps;
        let   step     = 0;

        const dissolve = setInterval(() => {
            step++;

            // Scale shrinks from 1.0 toward 0 as steps progress
            const scale = Math.max(0.001, 1 - (step / steps));

            // Rotation accelerates as mandala spirals inward — pulled into center feel
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

            // When dissolve completes, fill canvas with black — clean void state
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
