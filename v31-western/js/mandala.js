// mandala.js - Sacred geometry generator from cryptographic hash

class MandalaGenerator {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.centerX = canvas.width / 2;
        this.centerY = canvas.height / 2;
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
    }
    
    // Generate mandala from hash
    async generate(intentionText) {
        // Store intention text for display
        this.intentionText = intentionText;
        
        // Generate hash
        const hash = await generateHash(intentionText);
        this.hashNumbers = hexToNumbers(hash);
        this.fullHash = hash;
        
        // Extract parameters from hash
        const numPoints = 8 + (this.hashNumbers[0] % 8); // 8-16 points
        this.numRings = 3 + (this.hashNumbers[1] % 5); // 3-8 rings
        this.symmetry = [6, 8, 12, 16][this.hashNumbers[2] % 4]; // Sacred numbers
        this.baseHue = this.hashNumbers[3] % 360; // Base color
        this.complexity = 1 + (this.hashNumbers[4] % 3); // Pattern complexity
        
        // Generate points using spherical coordinates
        this.points = [];
        for (let i = 0; i < numPoints; i++) {
            const coords = hashToSphericalCoords(this.hashNumbers, i);
            this.points.push(coords);
        }
        
        return hash;
    }
    
    // Draw the mandala pattern with animation parameters
    drawMandala(pulse, rotation) {
        // Clear with fade effect
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.95)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        const scale = Math.min(this.canvas.width, this.canvas.height) / 3;
        
        // Save context for rotation
        this.ctx.save();
        this.ctx.translate(this.centerX, this.centerY);
        this.ctx.rotate(rotation);
        this.ctx.translate(-this.centerX, -this.centerY);
        
        // Draw from back to front
        for (let ring = this.numRings - 1; ring >= 0; ring--) {
            const ringRadius = (ring + 1) / this.numRings;
            const alpha = 0.3 + (ring / this.numRings) * 0.5;
            const hue = (this.baseHue + ring * 30 + this.time * 10) % 360;
            
            // Draw symmetric pattern
            for (let sym = 0; sym < this.symmetry; sym++) {
                const angle = (Math.PI * 2 * sym) / this.symmetry;
                
                this.ctx.save();
                this.ctx.translate(this.centerX, this.centerY);
                this.ctx.rotate(angle);
                
                // Draw pattern elements
                for (let i = 0; i < this.points.length; i++) {
                    const point = this.points[i];
                    const cart = sphericalToCartesian(
                        point.longitude,
                        point.latitude,
                        point.radius * ringRadius * pulse,
                        0, 0,
                        scale
                    );
                    
                    // Draw geometric shapes with glow
                    const size = (2 + this.complexity) * pulse;
                    this.ctx.beginPath();
                    this.ctx.arc(cart.x, cart.y, size, 0, Math.PI * 2);
                    this.ctx.fillStyle = `hsla(${hue}, 70%, 60%, ${alpha})`;
                    this.ctx.shadowBlur = 10 * pulse;
                    this.ctx.shadowColor = `hsla(${hue}, 80%, 70%, ${alpha})`;
                    this.ctx.fill();
                    
                    // Connect points with lines
                    if (i > 0) {
                        const prevPoint = this.points[i - 1];
                        const prevCart = sphericalToCartesian(
                            prevPoint.longitude,
                            prevPoint.latitude,
                            prevPoint.radius * ringRadius * pulse,
                            0, 0,
                            scale
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
        
        // Draw center point with pulse
        this.ctx.beginPath();
        this.ctx.arc(this.centerX, this.centerY, 5 * pulse, 0, Math.PI * 2);
        this.ctx.fillStyle = `hsl(${this.baseHue}, 80%, 70%)`;
        this.ctx.shadowBlur = 15 * pulse;
        this.ctx.shadowColor = `hsl(${this.baseHue}, 80%, 70%)`;
        this.ctx.fill();
        this.ctx.shadowBlur = 0;
        
        // Draw MERIDIAN-HASH signature in top right corner
        if (this.showHash && this.fullHash) {
            this.ctx.save();
            
            // Responsive font size based on canvas width
            const fontSize = Math.max(8, Math.floor(this.canvas.width / 60));
            this.ctx.font = `${fontSize}px monospace`;
            this.ctx.fillStyle = 'rgba(149, 165, 166, 0.8)';
            this.ctx.textAlign = 'right';
            
            // Algorithm label
            this.ctx.fillText('MERIDIAN-HASH', this.canvas.width - 10, fontSize + 10);
            
            // Full hash (wrapped if needed)
            const hashPart1 = this.fullHash.substring(0, 32);
            const hashPart2 = this.fullHash.substring(32);
            this.ctx.fillText(hashPart1, this.canvas.width - 10, fontSize * 2 + 15);
            this.ctx.fillText(hashPart2, this.canvas.width - 10, fontSize * 3 + 18);
            
            this.ctx.restore();
        }
        
        // Draw INTENTION TEXT in bottom left corner (mobile-optimized with safe margins)
        if (this.intentionText) {
            this.ctx.save();
            
            // Responsive font size
            const fontSize = Math.max(8, Math.floor(this.canvas.width / 60));
            this.ctx.font = `${fontSize}px monospace`;
            this.ctx.fillStyle = 'rgba(149, 165, 166, 0.8)';
            this.ctx.textAlign = 'left';
            
            // Calculate safe bottom margin (ensure we stay within canvas)
            const bottomMargin = fontSize * 5; // Leave room for label + 2 lines of text
            
            // Label
            this.ctx.fillText('INTENTION:', 10, this.canvas.height - bottomMargin + fontSize);
            
            // Smart truncation based on canvas width
            const maxCharsPerLine = Math.floor(this.canvas.width / (fontSize * 0.6));
            let displayText = this.intentionText;
            
            // Max 2 lines on mobile for safety
            const maxLines = 2;
            const maxTotalChars = maxCharsPerLine * maxLines;
            if (displayText.length > maxTotalChars) {
                displayText = displayText.substring(0, maxTotalChars - 3) + '...';
            }
            
            // Word wrap
            const words = displayText.split(' ');
            let currentLine = '';
            let yPos = this.canvas.height - bottomMargin + (fontSize * 2) + 2;
            let lineCount = 0;
            
            for (let word of words) {
                const testLine = currentLine + word + ' ';
                if (testLine.length > maxCharsPerLine && currentLine.length > 0) {
                    this.ctx.fillText(currentLine.trim(), 10, yPos);
                    currentLine = word + ' ';
                    yPos += fontSize + 2;
                    lineCount++;
                    if (lineCount >= maxLines) break;
                } else {
                    currentLine = testLine;
                }
            }
            if (currentLine.trim().length > 0 && lineCount < maxLines) {
                this.ctx.fillText(currentLine.trim(), 10, yPos);
            }
            
            this.ctx.restore();
        }
    }
    
    // Start breathing animation with 4x subtle (clearly visible CLOCKWISE rotation)
    startBreathing() {
        const speed = 0.02;
        
        const animate = () => {
            this.time += speed;
            
            // Breathing pulse (0.9 to 1.1)
            const pulse = 0.95 + Math.sin(this.time) * 0.15;
            
            // CLOCKWISE rotation - 4x subtle speed (0.25 = very visible)
            const rotation = this.time * 0.25;
            
            // Redraw with animation
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
    
    // Get current frame as image data for GIF recording
    getCurrentFrame() {
        return this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    }
}
