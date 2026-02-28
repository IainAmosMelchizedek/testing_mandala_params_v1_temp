// mandala.js - Sacred geometry renderer for the Intention Keeper
//
// FOUNDATION (unchanged):
// All point positions derive from SHA-256 hash bytes mapped to spherical coordinates
// (longitude, latitude, radius) using the navigator's celestial sphere model and
// golden ratio distribution. The MERIDIAN-HASH provenance is immutable.
//
// 4D ROTATION LAYER (new):
// Each point is extended into 4D space by adding a W coordinate derived from
// its position on the sphere. The geometry is then rotated through three 4D planes:
//   XW plane — geometry folds in ways impossible in 3D
//   YW plane — a second impossible fold
//   ZW plane — produces alien geometric transformations
//
// After 4D rotation, points are projected back to 3D via perspective division
// on the W axis, then projected again to 2D for screen rendering.
// This double projection is what produces the morphing, folding quality —
// the viewer sees a 2D shadow of a 4D object rotating through hyperspace.
//
// All 4D rotation speeds and the W coordinate generation are hash-seeded,
// so each intention produces its own unique hyperspace signature.

class MandalaGenerator {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx    = canvas.getContext('2d');
        this.animationFrame = null;
        this.time   = 0;
        this.points = [];

        // Structural parameters
        this.numRings          = 0;
        this.primarySymmetry   = 0;
        this.secondarySymmetry = 0;
        this.baseHue           = 0;
        this.complexity        = 0;
        this.connectionSkip    = 1;
        this.projectionType    = 0;
        this.lissajousA        = 3;
        this.lissajousB        = 2;
        this.lissajousDelta    = 0;

        // 3D rotation angles
        this.rotX = 0;
        this.rotY = 0;
        this.rotZ = 0;

        // 4D rotation angles — three additional rotation planes in hyperspace
        this.rotXW = 0; // XW plane rotation
        this.rotYW = 0; // YW plane rotation
        this.rotZW = 0; // ZW plane rotation

        // Hash-seeded rotation speeds
        this.speedX  = 0;
        this.speedY  = 0;
        this.speedZ  = -0.005;
        this.speedXW = 0; // how fast geometry folds through XW plane
        this.speedYW = 0;
        this.speedZW = 0;

        this.tiltAmplitudeX  = 0.2;
        this.tiltAmplitudeY  = 0.2;
        this.tiltPhaseOffset = 0;

        // W coordinate scale — controls how much the 4D dimension affects the shape.
        // Higher values = more dramatic 4D morphing.
        // Hash-seeded so each intention has its own hyperspace depth.
        this.wScale = 0.5;

        this.hashNumbers   = [];
        this.fullHash      = '';
        this.intentionText = '';
        this.showHash      = true;
        this.pulseAmplitude = 0.10;
        this.pulseSpeed     = 0.02;

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

    // Extracts all parameters from hash bytes.
    // Bytes 0-4: structure. Bytes 5-9: infinite geometry. Bytes 10-11: breathing.
    // Bytes 15-19: 3D motion. Bytes 20-25: 4D hyperspace parameters.
    async generate(intentionText) {
        this.intentionText = intentionText;
        const hash         = await generateHash(intentionText);
        this.hashNumbers   = hexToNumbers(hash);
        this.fullHash      = hash;

        // Structural
        const numPoints          = 8  + (this.hashNumbers[0] % 8);
        this.numRings            = 3  + (this.hashNumbers[1] % 5);
        this.primarySymmetry     = [6, 8, 12, 16][this.hashNumbers[2] % 4];
        this.baseHue             = this.hashNumbers[3] % 360;
        this.complexity          = 1  + (this.hashNumbers[4] % 3);

        // Infinite geometry
        this.connectionSkip    = 1 + (this.hashNumbers[5] % 7);
        this.secondarySymmetry = [3, 5, 7, 9][this.hashNumbers[6] % 4];
        this.projectionType    = this.hashNumbers[7] % 3;
        const lissajousPairs   = [[3,2],[4,3],[5,4],[5,3],[7,4],[6,5]];
        const pair             = lissajousPairs[this.hashNumbers[8] % lissajousPairs.length];
        this.lissajousA        = pair[0];
        this.lissajousB        = pair[1];
        this.lissajousDelta    = (this.hashNumbers[9] / 255) * Math.PI;

        // Breathing
        this.pulseAmplitude = 0.05 + (this.hashNumbers[10] / 255) * 0.15;
        this.pulseSpeed     = 0.015 + (this.hashNumbers[11] / 255) * 0.03;

        // 3D motion
        this.speedX          = (this.hashNumbers[15] / 255) * 0.0008 + 0.0002;
        this.speedY          = (this.hashNumbers[16] / 255) * 0.0008 + 0.0002;
        this.tiltAmplitudeX  = 0.15 + (this.hashNumbers[17] / 255) * 0.30;
        this.tiltAmplitudeY  = 0.15 + (this.hashNumbers[18] / 255) * 0.30;
        this.tiltPhaseOffset = (this.hashNumbers[19] / 255) * Math.PI * 2;

        // 4D hyperspace parameters.
        // Speeds are kept very small — 4D rotation is visually powerful even at low speeds.
        // Too fast and the morphing becomes disorienting rather than hypnotic.
        this.speedXW = (this.hashNumbers[20] / 255) * 0.003 + 0.0005;
        this.speedYW = (this.hashNumbers[21] / 255) * 0.003 + 0.0005;
        this.speedZW = (this.hashNumbers[22] / 255) * 0.002 + 0.0003;

        // wScale: how far each point extends into the 4th dimension.
        // Range 0.3-0.8 — lower = subtle morphing, higher = dramatic folding.
        this.wScale = 0.3 + (this.hashNumbers[23] / 255) * 0.5;

        // Reset all rotation angles
        this.rotX = 0; this.rotY = 0; this.rotZ = 0;
        this.rotXW = 0; this.rotYW = 0; this.rotZW = 0;

        this.points = [];
        for (let i = 0; i < numPoints; i++) {
            this.points.push(hashToSphericalCoords(this.hashNumbers, i));
        }

        return hash;
    }

    // Rotates a 4D point through all six rotation planes and projects to 3D.
    // The W coordinate is what makes this 4D — it is the fourth spatial dimension.
    // After rotation, perspective division on W projects the 4D point to 3D.
    // Then standard 3D perspective division projects to 2D screen coordinates.
    //
    // The morphing effect occurs because as rotXW/rotYW/rotZW change, the W
    // component shifts, causing the perspective division to produce different
    // 3D positions from the same original point — geometry literally changes shape.
    rotate4D(x, y, z, w) {
        // --- XW plane rotation ---
        // Mixes X and W coordinates — X position influenced by 4th dimension
        const cosXW = Math.cos(this.rotXW);
        const sinXW = Math.sin(this.rotXW);
        const x1    = x * cosXW - w * sinXW;
        const w1    = x * sinXW + w * cosXW;

        // --- YW plane rotation ---
        const cosYW = Math.cos(this.rotYW);
        const sinYW = Math.sin(this.rotYW);
        const y1    = y * cosYW - w1 * sinYW;
        const w2    = y * sinYW + w1 * cosYW;

        // --- ZW plane rotation ---
        const cosZW = Math.cos(this.rotZW);
        const sinZW = Math.sin(this.rotZW);
        const z1    = z * cosZW - w2 * sinZW;
        const w3    = z * sinZW + w2 * cosZW;

        // --- XY plane rotation (Z axis spin) ---
        const cosZ = Math.cos(this.rotZ);
        const sinZ = Math.sin(this.rotZ);
        const x2   = x1 * cosZ - y1 * sinZ;
        const y2   = x1 * sinZ + y1 * cosZ;

        // --- XZ plane rotation (Y axis tilt) ---
        const cosY = Math.cos(this.rotY);
        const sinY = Math.sin(this.rotY);
        const x3   = x2 * cosY + z1 * sinY;
        const z2   = -x2 * sinY + z1 * cosY;

        // --- YZ plane rotation (X axis tilt) ---
        const cosX = Math.cos(this.rotX);
        const sinX = Math.sin(this.rotX);
        const y3   = y2 * cosX - z2 * sinX;
        const z3   = y2 * sinX + z2 * cosX;

        // 4D → 3D perspective projection via W axis.
        // wDistance controls the "camera distance" from the 4D object.
        // Points with larger W values appear further away in the 4th dimension.
        const wDistance  = 2.0;
        const wPerspective = wDistance / (wDistance - w3);

        const px = x3 * wPerspective;
        const py = y3 * wPerspective;
        const pz = z3 * wPerspective;

        // 3D → 2D perspective projection
        const perspectiveDistance = 800;
        const zPerspective = perspectiveDistance / (perspectiveDistance + pz);

        return {
            x:           px * zPerspective,
            y:           py * zPerspective,
            z:           pz,
            perspective: zPerspective * wPerspective // combined depth scaling
        };
    }

    // Projects a spherical point to 4D space by adding a W coordinate,
    // then applies the full 4D rotation and returns 2D screen coordinates.
    // The W coordinate is derived from the point's latitude — points near
    // the poles extend further into the 4th dimension than equatorial points.
    // This gives the 4D morphing a structured relationship to the sphere geometry.
    projectAndRotate4D(lon, lat, radius, scale) {
        const phi   = (90 - lat)  * (Math.PI / 180);
        const theta = (lon + 180) * (Math.PI / 180);

        // Base 3D position from spherical coordinates (orthographic)
        const x = Math.sin(phi) * Math.cos(theta) * scale * radius;
        const y = Math.sin(phi) * Math.sin(theta) * scale * radius;
        const z = Math.cos(phi) * scale * radius;

        // W coordinate — the 4th dimension.
        // Using cos(phi) means polar points have maximum W extension,
        // equatorial points have zero W. This creates a structured 4D shape
        // rather than arbitrary extension into hyperspace.
        const w = Math.cos(phi) * scale * radius * this.wScale;

        return this.rotate4D(x, y, z, w);
    }

    // Lissajous overlay with 4D rotation applied
    drawLissajous(pulse, hue) {
        const steps = 200;
        const scale = Math.min(this.canvas.width, this.canvas.height) * 0.35 * pulse;
        const alpha = 0.2;

        this.ctx.beginPath();
        for (let i = 0; i <= steps; i++) {
            const t    = (i / steps) * Math.PI * 2;
            const rawX = Math.sin(this.lissajousA * t + this.lissajousDelta) * scale;
            const rawY = Math.sin(this.lissajousB * t) * scale;
            // W=0 for Lissajous — it lives in 3D space, not extended into 4D
            const p    = this.rotate4D(rawX, rawY, 0, 0);

            if (i === 0) this.ctx.moveTo(this.centerX + p.x, this.centerY + p.y);
            else         this.ctx.lineTo(this.centerX + p.x, this.centerY + p.y);
        }

        this.ctx.strokeStyle = `hsla(${(hue + 120) % 360}, 60%, 55%, ${alpha})`;
        this.ctx.lineWidth   = 1.5;
        this.ctx.shadowBlur  = 8;
        this.ctx.shadowColor = `hsla(${(hue + 120) % 360}, 70%, 65%, ${alpha})`;
        this.ctx.stroke();
        this.ctx.shadowBlur  = 0;
    }

    drawMandala(pulse) {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.95)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        const scale = Math.min(this.canvas.width, this.canvas.height) / 3;
        const hue   = (this.baseHue + this.time * 10) % 360;

        this.drawLissajous(pulse, hue);

        for (let ring = this.numRings - 1; ring >= 0; ring--) {
            const ringRadius = (ring + 1) / this.numRings;
            const alpha      = 0.3 + (ring / this.numRings) * 0.5;
            const ringHue    = (hue + ring * 30) % 360;

            // Parallax depth applied to all rotation axes including 4D planes
            const depth       = ring / (this.numRings - 1);
            const depthFactor = 0.3 + depth * 1.5;

            // Scale all rotation angles by depth for parallax on every axis
            const savedRotX  = this.rotX;  const savedRotY  = this.rotY;
            const savedRotZ  = this.rotZ;
            const savedRotXW = this.rotXW; const savedRotYW = this.rotYW;
            const savedRotZW = this.rotZW;

            this.rotX  = savedRotX  * depthFactor;
            this.rotY  = savedRotY  * depthFactor;
            this.rotZ  = savedRotZ  * depthFactor;
            this.rotXW = savedRotXW * depthFactor;
            this.rotYW = savedRotYW * depthFactor;
            this.rotZW = savedRotZW * depthFactor;

            const symmetries = [this.primarySymmetry, this.secondarySymmetry];

            symmetries.forEach((symmetry, symLayerIdx) => {
                const layerHue   = symLayerIdx === 0 ? ringHue : (ringHue + 180) % 360;
                const layerAlpha = symLayerIdx === 0 ? alpha : alpha * 0.5;

                for (let sym = 0; sym < symmetry; sym++) {
                    const symAngle = (Math.PI * 2 * sym) / symmetry;
                    const cosS     = Math.cos(symAngle);
                    const sinS     = Math.sin(symAngle);

                    for (let i = 0; i < this.points.length; i++) {
                        const point = this.points[i];

                        const p4d = this.projectAndRotate4D(
                            point.longitude, point.latitude,
                            point.radius * ringRadius * pulse,
                            scale
                        );

                        const sx = p4d.x * cosS - p4d.y * sinS;
                        const sy = p4d.x * sinS + p4d.y * cosS;

                        const screenX = this.centerX + sx;
                        const screenY = this.centerY + sy;

                        const depthSize = (2 + this.complexity) * pulse *
                                          (0.7 + depth * 0.6) * Math.abs(p4d.perspective);

                        this.ctx.beginPath();
                        this.ctx.arc(screenX, screenY, Math.max(0.5, depthSize), 0, Math.PI * 2);
                        this.ctx.fillStyle   = `hsla(${layerHue}, 70%, 60%, ${layerAlpha})`;
                        this.ctx.shadowBlur  = 10 * pulse * (0.5 + depth * 0.8);
                        this.ctx.shadowColor = `hsla(${layerHue}, 80%, 70%, ${layerAlpha})`;
                        this.ctx.fill();

                        const targetIdx = (i + this.connectionSkip) % this.points.length;
                        if (targetIdx !== i) {
                            const tp    = this.points[targetIdx];
                            const tp4d  = this.projectAndRotate4D(
                                tp.longitude, tp.latitude,
                                tp.radius * ringRadius * pulse,
                                scale
                            );
                            const tx = tp4d.x * cosS - tp4d.y * sinS;
                            const ty = tp4d.x * sinS + tp4d.y * cosS;

                            const cpX = (screenX + this.centerX + tx) / 2 * (0.85 - ring * 0.03) +
                                        this.centerX * (1 - (0.85 - ring * 0.03));
                            const cpY = (screenY + this.centerY + ty) / 2 * (0.85 - ring * 0.03) +
                                        this.centerY * (1 - (0.85 - ring * 0.03));

                            this.ctx.beginPath();
                            this.ctx.moveTo(screenX, screenY);
                            this.ctx.quadraticCurveTo(cpX, cpY, this.centerX + tx, this.centerY + ty);
                            this.ctx.strokeStyle = `hsla(${layerHue}, 60%, 50%, ${layerAlpha * 0.5})`;
                            this.ctx.lineWidth   = 1;
                            this.ctx.shadowBlur  = 5;
                            this.ctx.stroke();
                        }
                    }
                }
            });

            // Restore master rotation angles after depth scaling
            this.rotX  = savedRotX;  this.rotY  = savedRotY;  this.rotZ  = savedRotZ;
            this.rotXW = savedRotXW; this.rotYW = savedRotYW; this.rotZW = savedRotZW;
        }

        // Center dot
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

    // Animation loop — advances all six rotation planes simultaneously.
    // 4D planes advance at hash-seeded speeds, creating continuous hyperspace rotation.
    // X and Y use sine oscillation for drifting tilt. Z and 4D planes advance continuously.
    startBreathing() {
        const animate = () => {
            this.time += this.pulseSpeed;

            // 3D rotations
            this.rotZ += this.speedZ;
            this.rotX  = Math.sin(this.time * this.speedX * 100) * this.tiltAmplitudeX;
            this.rotY  = Math.sin(this.time * this.speedY * 100 + this.tiltPhaseOffset) * this.tiltAmplitudeY;

            // 4D hyperspace rotations — continuous advancement through hyperspace
            this.rotXW += this.speedXW;
            this.rotYW += this.speedYW;
            this.rotZW += this.speedZW;

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

    // Spiral dissolve — accelerates all six rotation planes during collapse
    spiralDissolve(duration) {
        this.stopBreathing();

        const steps    = 60;
        const interval = duration / steps;
        let   step     = 0;

        const dissolve = setInterval(() => {
            step++;
            const scale = Math.max(0.001, 1 - (step / steps));

            this.rotZ  -= step * 0.01;
            this.rotX  += step * 0.005;
            this.rotY  += step * 0.005;
            this.rotXW += step * 0.008; // 4D planes accelerate faster during dissolve
            this.rotYW += step * 0.006;
            this.rotZW += step * 0.007;

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
