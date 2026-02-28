// mandala.js - Sacred geometry renderer for the Intention Keeper
//
// FOUNDATION (unchanged across both styles):
// All point positions derive from SHA-256 hash bytes mapped to spherical coordinates
// (longitude, latitude, radius) using the navigator's celestial sphere model and
// golden ratio distribution. The MERIDIAN-HASH provenance is immutable.
// Depth-of-field parallax: outer rings rotate slower than inner rings.
// Counterclockwise rotation via direct coordinate math (not ctx.rotate).
//
// SACRED style — stable, clean, navigational
//   Single symmetry, consecutive connections, smaller dots.
//   The same geometric form breathes and rotates — a fixed constellation
//   for the user to meditate on.
//
// COSMIC style — evolving, infinite
//   Same foundation but connection skip slowly cycles through polygon families,
//   secondary symmetry layer adds interference patterns, Lissajous overlay
//   morphs continuously. New geometric forms emerge from the same intention
//   over time without ever repeating exactly.

class MandalaGenerator {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx    = canvas.getContext('2d');
        this.animationFrame = null;
        this.time   = 0;
        this.points = [];

        // Structural parameters — seeded from hash in generate()
        this.numRings          = 0;
        this.primarySymmetry   = 0;
        this.secondarySymmetry = 0;
        this.baseHue           = 0;
        this.complexity        = 0;
        this.connectionSkip    = 1;
        this.lissajousA        = 3;
        this.lissajousB        = 2;
        this.lissajousDelta    = 0;

        // Cosmic evolution speeds — seeded from hash, unique per intention
        this.skipEvolutionSpeed      = 0.001;
        this.lissajousEvolutionSpeed = 0.003;
        this.symmetryEvolutionSpeed  = 0.0005;

        this.hashNumbers   = [];
        this.fullHash      = '';
        this.intentionText = '';
        this.showHash      = true;

        this.pulseAmplitude = 0.10;
        this.pulseSpeed     = 0.02;

        // Master rotation angle — decremented each frame for counterclockwise movement.
        // Applied directly to point coordinates, not via ctx.rotate().
        this.rotationAngle = 0;

        // Active style — 'sacred' or 'cosmic'. Default is sacred.
        this.style = 'sacred';

        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    resizeCanvas() {
        const maxSize      = Math.min(window.innerWidth - 40, 600);
        this.canvas.width  = maxSize;
        this.canvas.height = maxSize;
        this.centerX       = this.canvas.width  / 2;
        this.centerY       = this.canvas.height / 2;
    }

    // Hashes the intention and extracts all visual parameters.
    // Both styles share the same hash and point positions.
    async generate(intentionText) {
        this.intentionText = intentionText;
        const hash         = await generateHash(intentionText);
        this.hashNumbers   = hexToNumbers(hash);
        this.fullHash      = hash;

        // Structural — shared by both styles
        const numPoints          = 8  + (this.hashNumbers[0] % 8);
        this.numRings            = 3  + (this.hashNumbers[1] % 5);
        this.primarySymmetry     = [6, 8, 12, 16][this.hashNumbers[2] % 4];
        this.baseHue             = this.hashNumbers[3] % 360;
        this.complexity          = 1  + (this.hashNumbers[4] % 3);

        // Cosmic parameters — extracted always, rendered only in Cosmic style
        this.connectionSkip    = 1 + (this.hashNumbers[5] % 7);
        this.secondarySymmetry = [3, 5, 7, 9][this.hashNumbers[6] % 4];
        const lissajousPairs   = [[3,2],[4,3],[5,4],[5,3],[7,4],[6,5]];
        const pair             = lissajousPairs[this.hashNumbers[8] % lissajousPairs.length];
        this.lissajousA        = pair[0];
        this.lissajousB        = pair[1];
        this.lissajousDelta    = (this.hashNumbers[9] / 255) * Math.PI;

        // Breathing — shared by both styles
        this.pulseAmplitude = 0.05 + (this.hashNumbers[10] / 255) * 0.15;
        this.pulseSpeed     = 0.015 + (this.hashNumbers[11] / 255) * 0.03;

        // Cosmic evolution speeds — each intention evolves at its own rate
        this.skipEvolutionSpeed      = 0.0005 + (this.hashNumbers[20] / 255) * 0.001;
        this.lissajousEvolutionSpeed = 0.001  + (this.hashNumbers[21] / 255) * 0.004;
        this.symmetryEvolutionSpeed  = 0.0002 + (this.hashNumbers[22] / 255) * 0.0008;

        this.rotationAngle = 0;
        this.time          = 0;

        this.points = [];
        for (let i = 0; i < numPoints; i++) {
            this.points.push(hashToSphericalCoords(this.hashNumbers, i));
        }

        return hash;
    }

    // Switches rendering style without re-hashing.
    // app.js calls this when the user clicks Sacred or Cosmic button.
    setStyle(styleName) {
        this.style = styleName;
    }

    // Orthographic projection — the navigational celestial sphere projection.
    // Used by both styles. Preserves circular mandala appearance.
    projectPoint(lon, lat, radius, scale) {
        const phi   = (90 - lat)  * (Math.PI / 180);
        const theta = (lon + 180) * (Math.PI / 180);
        return {
            x: Math.sin(phi) * Math.cos(theta) * scale * radius,
            y: Math.sin(phi) * Math.sin(theta) * scale * radius
        };
    }

    // Direct coordinate rotation around canvas center.
    // Prevents the clockwise optical illusion caused by ctx.rotate() stacking.
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

    // Lissajous overlay — Cosmic style only.
    // lissajousPhase advances over time so the knot form continuously morphs.
    // Kept subtle (alpha 0.2) so it supports rather than dominates the main geometry.
    drawLissajous(pulse, hue, lissajousPhase) {
        const steps = 200;
        const scale = Math.min(this.canvas.width, this.canvas.height) * 0.3 * pulse;
        const alpha = 0.2;

        this.ctx.beginPath();
        for (let i = 0; i <= steps; i++) {
            const t    = (i / steps) * Math.PI * 2;
            const rawX = Math.sin(this.lissajousA * t + this.lissajousDelta + lissajousPhase) * scale;
            const rawY = Math.sin(this.lissajousB * t + lissajousPhase * 0.7) * scale;
            const rotated = this.rotatePoint(
                this.centerX + rawX,
                this.centerY + rawY,
                this.rotationAngle * 0.5
            );
            if (i === 0) this.ctx.moveTo(rotated.x, rotated.y);
            else         this.ctx.lineTo(rotated.x, rotated.y);
        }

        this.ctx.strokeStyle = `hsla(${(hue + 120) % 360}, 60%, 55%, ${alpha})`;
        this.ctx.lineWidth   = 1;
        this.ctx.shadowBlur  = 6;
        this.ctx.shadowColor = `hsla(${(hue + 120) % 360}, 70%, 65%, ${alpha})`;
        this.ctx.stroke();
        this.ctx.shadowBlur  = 0;
    }

    // Renders one frame using the parallax depth-of-field system.
    // evolvedSkip and evolvedSymmetry are time-driven in Cosmic style,
    // fixed in Sacred style.
    drawMandala(pulse) {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.95)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        const scale = Math.min(this.canvas.width, this.canvas.height) / 3;
        const hue   = (this.baseHue + this.time * 10) % 360;

        // Cosmic time-driven evolution — parameters shift slowly over time
        // producing continuously new geometric forms from the same intention
        const evolvedSkip = this.style === 'cosmic'
            ? 1 + ((Math.sin(this.time * this.skipEvolutionSpeed * 100) + 1) / 2) * 6
            : 1;
        const evolvedSymmetry = this.style === 'cosmic'
            ? this.secondarySymmetry + Math.sin(this.time * this.symmetryEvolutionSpeed * 100) * 2
            : this.secondarySymmetry;
        const lissajousPhase = this.style === 'cosmic'
            ? this.time * this.lissajousEvolutionSpeed * 100
            : 0;

        // Lissajous only in Cosmic — drawn first so main geometry sits on top
        if (this.style === 'cosmic') {
            this.drawLissajous(pulse, hue, lissajousPhase);
        }

        // Draw rings back to front for correct depth ordering
        for (let ring = this.numRings - 1; ring >= 0; ring--) {
            const ringRadius = (ring + 1) / this.numRings;
            const alpha      = 0.3 + (ring / this.numRings) * 0.5;
            const ringHue    = (hue + ring * 30) % 360;

            // PARALLAX DEPTH FACTOR — inner rings rotate faster, outer rings slower.
            // This is the core of the depth-of-field effect that made the version
            // you loved look so dimensional. Range 0.3-1.8 gives 6x speed difference.
            const depth        = ring / (this.numRings - 1 || 1);
            const depthFactor  = 0.3 + depth * 1.5;
            const ringRotation = this.rotationAngle * depthFactor;

            // Sacred: primary symmetry only. Cosmic: adds evolving secondary layer.
            const symmetries = this.style === 'cosmic'
                ? [this.primarySymmetry, Math.max(3, Math.round(evolvedSymmetry))]
                : [this.primarySymmetry];

            // Sacred: consecutive connections. Cosmic: slowly cycling skip value.
            const skip = this.style === 'cosmic'
                ? Math.max(1, Math.round(evolvedSkip))
                : 1;

            symmetries.forEach((symmetry, symLayerIdx) => {
                const layerHue   = symLayerIdx === 0 ? ringHue : (ringHue + 180) % 360;
                const layerAlpha = symLayerIdx === 0 ? alpha : alpha * 0.4;

                for (let sym = 0; sym < symmetry; sym++) {
                    const symAngle = (Math.PI * 2 * sym) / symmetry;

                    for (let i = 0; i < this.points.length; i++) {
                        const point = this.points[i];

                        const base = this.projectPoint(
                            point.longitude, point.latitude,
                            point.radius * ringRadius * pulse, scale
                        );

                        const symRotated = this.rotatePoint(
                            this.centerX + base.x,
                            this.centerY + base.y,
                            symAngle
                        );

                        const final = this.rotatePoint(
                            symRotated.x, symRotated.y, ringRotation
                        );

                        // Sacred dots smaller and crisper.
                        // Cosmic dots slightly larger with stronger glow.
                        const dotScale  = this.style === 'sacred' ? 0.6 : 0.9;
                        const depthSize = (2 + this.complexity) * pulse *
                                          (0.7 + depth * 0.6) * dotScale;

                        this.ctx.beginPath();
                        this.ctx.arc(final.x, final.y, depthSize, 0, Math.PI * 2);
                        this.ctx.fillStyle   = `hsla(${layerHue}, 70%, 60%, ${layerAlpha})`;
                        this.ctx.shadowBlur  = (this.style === 'sacred' ? 6 : 9) *
                                               pulse * (0.5 + depth * 0.8);
                        this.ctx.shadowColor = `hsla(${layerHue}, 80%, 70%, ${layerAlpha})`;
                        this.ctx.fill();

                        // Connect to target point using bezier curve
                        const targetIdx = (i + skip) % this.points.length;
                        if (targetIdx !== i) {
                            const tp    = this.points[targetIdx];
                            const tBase = this.projectPoint(
                                tp.longitude, tp.latitude,
                                tp.radius * ringRadius * pulse, scale
                            );
                            const tSymRotated = this.rotatePoint(
                                this.centerX + tBase.x,
                                this.centerY + tBase.y,
                                symAngle
                            );
                            const tFinal = this.rotatePoint(
                                tSymRotated.x, tSymRotated.y, ringRotation
                            );

                            // Control point pulled toward center approximates geodesic curvature
                            const cpX = (final.x + tFinal.x) / 2 * (0.85 - ring * 0.03) +
                                        this.centerX * (1 - (0.85 - ring * 0.03));
                            const cpY = (final.y + tFinal.y) / 2 * (0.85 - ring * 0.03) +
                                        this.centerY * (1 - (0.85 - ring * 0.03));

                            this.ctx.beginPath();
                            this.ctx.moveTo(final.x, final.y);
                            this.ctx.quadraticCurveTo(cpX, cpY, tFinal.x, tFinal.y);
                            this.ctx.strokeStyle = `hsla(${layerHue}, 60%, 50%, ${layerAlpha * 0.5})`;
                            this.ctx.lineWidth   = 1;
                            this.ctx.shadowBlur  = 4;
                            this.ctx.stroke();
                        }
                    }
                }
            });
        }

        // Center dot — visual anchor, same in both styles
        this.ctx.beginPath();
        this.ctx.arc(this.centerX, this.centerY, 5 * pulse, 0, Math.PI * 2);
        this.ctx.fillStyle   = `hsl(${this.baseHue}, 80%, 70%)`;
        this.ctx.shadowBlur  = 15 * pulse;
        this.ctx.shadowColor = `hsl(${this.baseHue}, 80%, 70%)`;
        this.ctx.fill();
        this.ctx.shadowBlur  = 0;

        // --- TOP RIGHT: Cryptographic signature ---
        if (this.showHash && this.fullHash) {
            this.ctx.save();
            const fontSize = Math.max(8, Math.floor(this.canvas.width / 60));
            this.ctx.font      = `${fontSize}px monospace`;
            this.ctx.fillStyle = 'rgba(149, 165, 166, 0.8)';
            this.ctx.textAlign = 'right';
            const x = this.canvas.width - 10;
            this.ctx.fillText('MERIDIAN-HASH:', x, fontSize + 10);
            this.ctx.fillText(this.fullHash.substring(0, 32), x, fontSize * 2 + 15);
            this.ctx.fillText(this.fullHash.substring(32),    x, fontSize * 3 + 20);
            this.ctx.restore();
        }

        // --- BOTTOM LEFT: Intention text ---
        if (this.intentionText) {
            this.ctx.save();
            const fontSize = Math.max(9, Math.floor(this.canvas.width / 55));
            this.ctx.font      = `${fontSize}px monospace`;
            this.ctx.fillStyle = 'rgba(149, 165, 166, 0.85)';
            this.ctx.textAlign = 'left';

            const lineH    = fontSize + 3;
            const padding  = 10;
            const maxChars = Math.floor((this.canvas.width - padding * 2) / (fontSize * 0.6));

            const words = this.intentionText.split(' ');
            let lines = [], currentLine = '';
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

    // Animation loop — counterclockwise rotation with hash-seeded breathing.
    // this.time drives both breathing and Cosmic evolution parameters.
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

    stopBreathing() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
    }

    // Spiral dissolve at meditation session end.
    spiralDissolve(duration) {
        this.stopBreathing();
        const steps    = 60;
        const interval = duration / steps;
        let   step     = 0;

        const dissolve = setInterval(() => {
            step++;
            const scale = Math.max(0.001, 1 - (step / steps));
            this.rotationAngle -= step * 0.01;

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

    getCurrentFrame() {
        return this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    }
}
