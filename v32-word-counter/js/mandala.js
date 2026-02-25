// mandala.js - Sacred geometry generator from cryptographic hash

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
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    resizeCanvas() {
        const maxSize = Math.min(window.innerWidth - 40, 600);
        this.canvas.width = maxSize;
        this.canvas.height = maxSize;
        this.centerX = this.canvas.width / 2;
        this.centerY = this.canvas.height / 2;
    }

    async generate(intentionText) {
        this.intentionText = intentionText;
        const hash = await generateHash(intentionText);
        this.hashNumbers = hexToNumbers(hash);
        this.fullHash = hash;
        const numPoints = 8 + (this.hashNumbers[0] % 8);
        this.numRings = 3 + (this.hashNumbers[1] % 5);
        this.symmetry = [6, 8, 12, 16][this.hashNumbers[2] % 4];
        this.baseHue = this.hashNumbers[3] % 360;
        this.complexity = 1 + (this.hashNumbers[4] % 3);
        this.points = [];
        for (let i = 0; i < numPoints; i++) {
            const coords = hashToSphericalCoords(this.hashNumbers, i);
            this.points.push(coords);
        }
        return hash;
    }

    drawMandala(pulse, rotation) {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.95)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        const scale = Math.min(this.canvas.width, this.canvas.height) / 3;

        this.ctx.save();
        this.ctx.translate(this.centerX, this.centerY);
        this.ctx.rotate(rotation);
        this.ctx.translate(-this.centerX, -this.centerY);

        for (let ring = this.numRings - 1; ring >= 0; ring--) {
            const ringRadius = (ring + 1) / this.numRings;
            const alpha = 0.3 + (ring / this.numRings) * 0.5;
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
                    const size = (2 + this.complexity) * pulse;
                    this.ctx.beginPath();
                    this.ctx.arc(cart.x, cart.y, size, 0, Math.PI * 2);
                    this.ctx.fillStyle = `hsla(${hue}, 70%, 60%, ${alpha})`;
                    this.ctx.shadowBlur = 10 * pulse;
                    this.ctx.shadowColor = `hsla(${hue}, 80%, 70%, ${alpha})`;
                    this.ctx.fill();

                    if (i > 0) {
                        const prevPoint = this.points[i - 1];
                        const prevCart = sphericalToCartesian(
                            prevPoint.longitude, prevPoint.latitude,
                            prevPoint.radius * ringRadius * pulse,
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

        // Center point
        this.ctx.beginPath();
        this.ctx.arc(this.centerX, this.centerY, 5 * pulse, 0, Math.PI * 2);
        this.ctx.fillStyle = `hsl(${this.baseHue}, 80%, 70%)`;
        this.ctx.shadowBlur = 15 * pulse;
        this.ctx.shadowColor = `hsl(${this.baseHue}, 80%, 70%)`;
        this.ctx.fill();
        this.ctx.shadowBlur = 0;

        // Bottom left - intention text + cryptographic signature
        if (this.intentionText || (this.showHash && this.fullHash)) {
            this.ctx.save();
            const fontSize = Math.max(9, Math.floor(this.canvas.width / 55));
            this.ctx.font = `${fontSize}px monospace`;
            this.ctx.fillStyle = 'rgba(149, 165, 166, 0.85)';
            this.ctx.textAlign = 'left';

            const lineH = fontSize + 3;
            const maxChars = Math.floor((this.canvas.width - 20) / (fontSize * 0.6));
            const padding = 10;

            // Build lines bottom-up
            let lines = [];

            // Hash lines
            if (this.showHash && this.fullHash) {
                lines.push(this.fullHash.substring(32));
                lines.push(this.fullHash.substring(0, 32));
                lines.push('MERIDIAN-HASH:');
            }

            // Intention lines (word wrap, max 50 words enforced upstream)
            if (this.intentionText) {
                const words = this.intentionText.split(' ');
                let intentionLines = [];
                let currentLine = '';
                for (let word of words) {
                    const test = currentLine ? currentLine + ' ' + word : word;
                    if (test.length > maxChars && currentLine) {
                        intentionLines.push(currentLine);
                        currentLine = word;
                    } else {
                        currentLine = test;
                    }
                }
                if (currentLine) intentionLines.push(currentLine);
                intentionLines.push('INTENTION:');
                lines = lines.concat(intentionLines.reverse());
            }

            // Draw lines from bottom up
            let y = this.canvas.height - padding;
            for (let i = 0; i < lines.length; i++) {
                this.ctx.fillText(lines[i], padding, y);
                y -= lineH;
            }

            this.ctx.restore();
        }
    }

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

    stopBreathing() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
    }

    getCurrentFrame() {
        return this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    }
}
