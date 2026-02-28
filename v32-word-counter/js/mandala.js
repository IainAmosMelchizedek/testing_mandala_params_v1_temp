// mandala.js - Sacred geometry renderer for the Intention Keeper
//
// FOUNDATION (unchanged):
// All point positions derive from SHA-256 hash bytes mapped to spherical coordinates
// (longitude, latitude, radius) using the navigator's celestial sphere model and
// golden ratio distribution. This navigational mathematics is the immutable core.
//
// INFINITE GEOMETRY LAYER (new):
// Four additional hash-seeded decisions multiply geometric variety exponentially:
//   1. Variable connection skip — hash selects how many points to skip when connecting,
//      producing different polygon families (consecutive, star, complex, alien)
//   2. Mixed symmetry — hash selects two symmetry values drawn simultaneously,
//      creating interference patterns impossible with single symmetry
//   3. Variable projection — hash selects between orthographic, stereographic,
//      and cylindrical projection of the same spherical points
//   4. Lissajous overlay — a second geometric layer using sine wave mathematics
//      seeded from the hash, producing figure-8s, spirals, and knot forms
//
// The same intention always produces the same mandala — all decisions are
// deterministic functions of the SHA-256 hash. No randomness is introduced.

class MandalaGenerator {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx    = canvas.getContext('2d');
        this.animationFrame = null;
        this.time   = 0;
        this.points = [];

        // Structural parameters — all seeded from hash in generate()
        this.numRings        = 0;
        this.primarySymmetry = 0;
        this.secondarySymmetry = 0; // second symmetry layer for interference patterns
        this.baseHue         = 0;
        this.complexity      = 0;
        this.connectionSkip  = 1;   // how many points to skip when drawing connections
        this.projectionType  = 0;   // 0=orthographic, 1=stereographic, 2=cylindrical
        this.lissajousA      = 3;   // Lissajous frequency ratio numerator
        this.lissajousB      = 2;   // Lissajous frequency ratio denominator
        this.lissajousDelta  = 0;   // Lissajous phase offset

        this.hashNumbers  = [];
        this.fullHash     = '';
        this.intentionText = '';
        this.showHash     = true;

        this.pulseAmplitude = 0.10;
        this.pulseSpeed     = 0.02;
        this.rotationAngle  = 0;

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

    // Extracts all visual parameters from specific hash byte positions.
    // Bytes 0-4: structure. Bytes 5-9: infinite geometry layer. Bytes 10-11: breathing.
    // Using non-sequential byte positions reduces correlation between parameters.
    async generate(intentionText) {
        this.intentionText = intentionText;
        const hash         = await generateHash(intentionText);
        this.hashNumbers   = hexToNumbers(hash);
        this.fullHash      = hash;

        // --- Structural parameters (navigational foundation) ---
        const numPoints          = 8  + (this.hashNumbers[0] % 8);
        this.numRings            = 3  + (this.hashNumbers[1] % 5);
        this.primarySymmetry     = [6, 8, 12, 16][this.hashNumbers[2] % 4];
        this.baseHue             = this.hashNumbers[3] % 360;
        this.complexity          = 1  + (this.hashNumbers[4] % 3);

        // --- Infinite geometry parameters ---

        // Connection skip: 1-7. Skip 1=consecutive lines, 2=star polygons,
        // 3-4=complex overlapping forms, 5-7=alien geometric families.
        // Higher skips create forms that have no common name in geometry.
        this.connectionSkip = 1 + (this.hashNumbers[5] % 7);

        // Secondary symmetry creates interference with primary symmetry.
        // Chosen from a different set than primary to maximize visual contrast.
        this.secondarySymmetry = [3, 5, 7, 9][this.hashNumbers[6] % 4];

        // Projection type determines how spherical coordinates map to 2D.
        // Same points, radically different shapes depending on projection chosen.
        this.projectionType = this.hashNumbers[7] % 3;

        // Lissajous parameters — frequency ratios produce different knot families.
        // Ratio 3:2 = trefoil, 4:3 = quadrefoil, 5:4 = complex knot, etc.
        const lissajousPairs = [[3,2],[4,3],[5,4],[5,3],[7,4],[6,5]];
        const pair           = lissajousPairs[this.hashNumbers[8] % lissajousPairs.length];
        this.lissajousA      = pair[0];
        this.lissajousB      = pair[1];
        this.lissajousDelta  = (this.hashNumbers[9] / 255) * Math.PI; // 0 to π phase

        // --- Breathing parameters ---
        this.pulseAmplitude = 0.05 + (this.hashNumbers[10] / 255) * 0.15;
        this.pulseSpeed     = 0.015 + (this.hashNumbers[11] / 255) * 0.03;
        this.rotationAngle  = 0;

        this.points = [];
        for (let i = 0; i < numPoints; i++) {
            this.points.push(hashToSphericalCoords(this.hashNumbers, i));
        }

        return hash;
    }

    // Projects one spherical point to 2D using the hash-selected projection type.
    // Orthographic preserves circular form. Stereographic stretches outer points outward.
    // Cylindrical wraps the sphere onto a cylinder, producing very different edge behavior.
    projectPoint(lon, lat, radius, scale) {
        const phi   = (90 - lat)  * (Math.PI / 180);
        const theta = (lon + 180) * (Math.PI / 180);

        if (this.projectionType === 1) {
            // Stereographic — outer points stretched away from center
            const k = 2 / (1 + Math.cos(phi));
            return {
                x: k * Math.sin(phi) * Math.cos(theta) * scale * radius,
                y: k * Math.sin(phi) * Math.sin(theta) * scale * radius
            };
        } else if (this.projectionType === 2) {
            // Cylindrical — longitude maps linearly, latitude compresses poles
            return {
                x: theta / Math.PI * scale * radius,
                y: Math.log(Math.tan(phi / 2 + 0.001)) * scale * radius * 0.3
            };
        } else {
            // Orthographic — the original navigational projection (default)
            return {
                x: Math.sin(phi) * Math.cos(theta) * scale * radius,
                y: Math.sin(phi) * Math.sin(theta) * scale * radius
            };
        }
    }

    // Rotates a 2D point counterclockwise around canvas center.
    // Applied directly to coordinates rather than canvas context to prevent
    // the optical illusion that plagued the earlier ctx.rotate() approach.
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

    // Draws the Lissajous overlay — a second geometric layer independent of the
    // spherical point system. Lissajous curves are parametric curves defined by
    // x = sin(a·t + δ), y = sin(b·t), where a:b ratio determines the knot family.
    // The hash seeds a, b, and δ so each intention gets a unique knot form.
    drawLissajous(pulse, hue) {
        const steps  = 200;
        const scale  = Math.min(this.canvas.width, this.canvas.height) * 0.35 * pulse;
        const alpha  = 0.25; // subtle — supports rather than dominates the main geometry

        this.ctx.beginPath();
        for (let i = 0; i <= steps; i++) {
            const t = (i / steps) * Math.PI * 2;
            const rawX = Math.sin(this.lissajousA * t + this.lissajousDelta) * scale;
            const rawY = Math.sin(this.lissajousB * t) * scale;

            const rotated = this.rotatePoint(
                this.centerX + rawX,
                this.centerY + rawY,
                this.rotationAngle * 0.7 // rotates slightly slower than main geometry
            );

            if (i === 0) this.ctx.moveTo(rotated.x, rotated.y);
            else         this.ctx.lineTo(rotated.x, rotated.y);
        }

        this.ctx.strokeStyle = `hsla(${(hue + 120) % 360}, 60%, 55%, ${alpha})`;
        this.ctx.lineWidth   = 1.5;
        this.ctx.shadowBlur  = 8;
        this.ctx.shadowColor = `hsla(${(hue + 120) % 360}, 70%, 65%, ${alpha})`;
        this.ctx.stroke();
        this.ctx.shadowBlur  = 0;
    }

    // Renders one frame. Depth-of-field parallax applies per-ring rotation scaling.
    // Two symmetry layers draw simultaneously, creating interference geometry.
    // Connection skip determines which point pairs are connected.
    drawMandala(pulse) {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.95)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        const scale = Math.min(this.canvas.width, this.canvas.height) / 3;
        const hue   = (this.baseHue + this.time * 10) % 360;

        // Draw Lissajous overlay first so main geometry renders on top
        this.drawLissajous(pulse, hue);

        for (let ring = this.numRings - 1; ring >= 0; ring--) {
            const ringRadius = (ring + 1) / this.numRings;
            const alpha      = 0.3 + (ring / this.numRings) * 0.5;
            const ringHue    = (hue + ring * 30) % 360;

            // Parallax depth factor — inner rings rotate faster than outer rings
            const depth        = ring / (this.numRings - 1);
            const depthFactor  = 0.3 + depth * 1.5;
            const ringRotation = this.rotationAngle * depthFactor;

            // Draw both symmetry layers — primary and secondary simultaneously
            const symmetries = [this.primarySymmetry, this.secondarySymmetry];

            symmetries.forEach((symmetry, symLayerIdx) => {
                // Secondary layer uses complementary hue and lower alpha for distinction
                const layerHue   = symLayerIdx === 0 ? ringHue : (ringHue + 180) % 360;
                const layerAlpha = symLayerIdx === 0 ? alpha : alpha * 0.5;

                for (let sym = 0; sym < symmetry; sym++) {
                    const symAngle = (Math.PI * 2 * sym) / symmetry;

                    for (let i = 0; i < this.points.length; i++) {
                        const point = this.points[i];

                        const base = this.projectPoint(
                            point.longitude, point.latitude,
                            point.radius * ringRadius * pulse,
                            scale
                        );

                        const symRotated = this.rotatePoint(
                            this.centerX + base.x,
                            this.centerY + base.y,
                            symAngle
                        );

                        const final = this.rotatePoint(
                            symRotated.x, symRotated.y,
                            ringRotation
                        );

                        // Dot size and glow scale with depth for 3D illusion
                        const depthSize = (2 + this.complexity) * pulse * (0.7 + depth * 0.6);
                        this.ctx.beginPath();
                        this.ctx.arc(final.x, final.y, depthSize, 0, Math.PI * 2);
                        this.ctx.fillStyle  = `hsla(${layerHue}, 70%, 60%, ${layerAlpha})`;
                        this.ctx.shadowBlur = 10 * pulse * (0.5 + depth * 0.8);
                        this.ctx.shadowColor = `hsla(${layerHue}, 80%, 70%, ${layerAlpha})`;
                        this.ctx.fill();

                        // Variable skip connections — the skip value determines
                        // which point pairs connect, producing different polygon families.
                        // Wraps around using modulo so all points remain connected in a cycle.
                        const targetIdx = (i + this.connectionSkip) % this.points.length;
                        if (targetIdx !== i) {
                            const targetPoint = this.points[targetIdx];
                            const targetBase  = this.projectPoint(
                                targetPoint.longitude, targetPoint.latitude,
                                targetPoint.radius * ringRadius * pulse,
                                scale
                            );
                            const targetSymRotated = this.rotatePoint(
                                this.centerX + targetBase.x,
                                this.centerY + targetBase.y,
                                symAngle
                            );
                            const targetFinal = this.rotatePoint(
                                targetSymRotated.x, targetSymRotated.y,
                                ringRotation
                            );

                            // Bezier control point pulled toward center approximates geodesic curvature
                            const cpX = (final.x + targetFinal.x) / 2 * (0.85 - ring * 0.03) +
                                        this.centerX * (1 - (0.85 - ring * 0.03));
                            const cpY = (final.y + targetFinal.y) / 2 * (0.85 - ring * 0.03) +
                                        this.centerY * (1 - (0.85 - ring * 0.03));

                            this.ctx.beginPath();
                            this.ctx.moveTo(final.x, final.y);
                            this.ctx.quadraticCurveTo(cpX, cpY, targetFinal.x, targetFinal.y);
                            this.ctx.strokeStyle = `hsla(${layerHue}, 60%, 50%, ${layerAlpha * 0.5})`;
                            this.ctx.lineWidth   = 1;
                            this.ctx.shadowBlur  = 5;
                            this.ctx.stroke();
                        }
                    }
                }
            });
        }

        // Center dot — visual anchor, brightest point in the composition
        this.ctx.beginPath();
        this.ctx.arc(this.centerX, this.centerY, 5 * pulse, 0, Math.PI * 2);
        this.ctx.fillStyle  = `hsl(${this.baseHue}, 80%, 70%)`;
        this.ctx.shadowBlur = 15 * pulse;
        this.ctx.shadowColor = `hsl(${this.baseHue}, 80%, 70%)`;
        this.ctx.fill();
        this.ctx.shadowBlur = 0;

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
        // Rendered last so it always sits above the animation layers.
        // 50-word limit enforced upstream in app.js.
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

    // Animation loop — hash-seeded breathing with depth-of-field parallax rotation.
    // rotationAngle decrements each frame for counterclockwise movement.
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

    // Stops animation. Always call before generating a new mandala to prevent
    // multiple loops running simultaneously.
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
