// mandala.js - Sacred geometry renderer for the Intention Keeper
//
// FOUNDATION (unchanged):
// All point positions derive from SHA-256 hash bytes mapped to spherical coordinates
// (longitude, latitude, radius) using the navigator's celestial sphere model and
// golden ratio distribution. The MERIDIAN-HASH provenance is immutable.
//
// 3D ROTATION LAYER (new):
// Points are now rotated on all three axes before projection to screen:
//   X axis — tilt forward/backward (nodding motion)
//   Y axis — tilt left/right (shaking motion)
//   Z axis — spin counterclockwise (existing rotation)
//
// All three rotation speeds and phases are hash-seeded so each intention
// tumbles through space in its own unique orbital pattern.
//
// The 3D rotation uses a standard rotation matrix applied to each point's
// Cartesian coordinates before the final 2D screen projection. This preserves
// all existing geometry — spherical coords, golden ratio, parallax depth —
// while adding the third dimensional axis of movement.

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
        this.projectionType    = 0;
        this.lissajousA        = 3;
        this.lissajousB        = 2;
        this.lissajousDelta    = 0;

        // 3D rotation angles — all three axes, all hash-seeded speeds
        this.rotX = 0; // tilt forward/backward
        this.rotY = 0; // tilt left/right
        this.rotZ = 0; // spin counterclockwise (existing)

        // Hash-seeded rotation speeds for each axis.
        // Z is negative for counterclockwise. X and Y oscillate to create
        // a tumbling rather than a continuous roll on those axes.
        this.speedX = 0;
        this.speedY = 0;
        this.speedZ = -0.005; // base counterclockwise Z speed

        // Tilt amplitude — how far the mandala tilts on X and Y axes.
        // Expressed in radians. Small values (0.1-0.4) look cosmic and subtle.
        // Large values (>0.6) would make it flip completely — too disorienting.
        this.tiltAmplitudeX = 0.2;
        this.tiltAmplitudeY = 0.2;

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

    // Extracts all visual and motion parameters from hash bytes.
    // Bytes 0-4: structure. Bytes 5-9: infinite geometry. Bytes 10-11: breathing.
    // Bytes 15-19: 3D rotation speeds and tilt amplitudes.
    async generate(intentionText) {
        this.intentionText = intentionText;
        const hash         = await generateHash(intentionText);
        this.hashNumbers   = hexToNumbers(hash);
        this.fullHash      = hash;

        // Structural parameters
        const numPoints          = 8  + (this.hashNumbers[0] % 8);
        this.numRings            = 3  + (this.hashNumbers[1] % 5);
        this.primarySymmetry     = [6, 8, 12, 16][this.hashNumbers[2] % 4];
        this.baseHue             = this.hashNumbers[3] % 360;
        this.complexity          = 1  + (this.hashNumbers[4] % 3);

        // Infinite geometry parameters
        this.connectionSkip    = 1 + (this.hashNumbers[5] % 7);
        this.secondarySymmetry = [3, 5, 7, 9][this.hashNumbers[6] % 4];
        this.projectionType    = this.hashNumbers[7] % 3;
        const lissajousPairs   = [[3,2],[4,3],[5,4],[5,3],[7,4],[6,5]];
        const pair             = lissajousPairs[this.hashNumbers[8] % lissajousPairs.length];
        this.lissajousA        = pair[0];
        this.lissajousB        = pair[1];
        this.lissajousDelta    = (this.hashNumbers[9] / 255) * Math.PI;

        // Breathing parameters
        this.pulseAmplitude = 0.05 + (this.hashNumbers[10] / 255) * 0.15;
        this.pulseSpeed     = 0.015 + (this.hashNumbers[11] / 255) * 0.03;

        // 3D rotation parameters — each intention tumbles at its own unique rate.
        // X and Y speeds are small so the tilt feels like drifting in space,
        // not like a spinning top. Divided by 2000 keeps them in the 0.0005-0.001 range.
        this.speedX = (this.hashNumbers[15] / 255) * 0.0008 + 0.0002;
        this.speedY = (this.hashNumbers[16] / 255) * 0.0008 + 0.0002;

        // Tilt amplitude — how far it tilts. Range 0.15-0.45 radians.
        // This keeps the tilt visible but never flips the mandala upside down.
        this.tiltAmplitudeX = 0.15 + (this.hashNumbers[17] / 255) * 0.30;
        this.tiltAmplitudeY = 0.15 + (this.hashNumbers[18] / 255) * 0.30;

        // Phase offset between X and Y tilts — prevents them from syncing up
        // into a simple back-and-forth. Creates more complex orbital motion.
        this.tiltPhaseOffset = (this.hashNumbers[19] / 255) * Math.PI * 2;

        // Reset all rotation angles for fresh start
        this.rotX = 0;
        this.rotY = 0;
        this.rotZ = 0;

        this.points = [];
        for (let i = 0; i < numPoints; i++) {
            this.points.push(hashToSphericalCoords(this.hashNumbers, i));
        }

        return hash;
    }

    // Applies a full 3D rotation matrix to a point in Cartesian space.
    // Rotation order: X first, then Y, then Z.
    // Returns the final 2D screen coordinates after perspective projection.
    // perspectiveDistance controls how strong the perspective effect is —
    // higher values = flatter (more orthographic), lower = more dramatic perspective.
    rotate3D(x, y, z, rotX, rotY, rotZ) {
        // --- X axis rotation (tilt forward/backward) ---
        const cosX = Math.cos(rotX);
        const sinX = Math.sin(rotX);
        const y1   = y * cosX - z * sinX;
        const z1   = y * sinX + z * cosX;

        // --- Y axis rotation (tilt left/right) ---
        const cosY = Math.cos(rotY);
        const sinY = Math.sin(rotY);
        const x2   = x  * cosY + z1 * sinY;
        const z2   = -x * sinY + z1 * cosY;

        // --- Z axis rotation (counterclockwise spin) ---
        const cosZ = Math.cos(rotZ);
        const sinZ = Math.sin(rotZ);
        const x3   = x2 * cosZ - y1 * sinZ;
        const y3   = x2 * sinZ + y1 * cosZ;

        // Perspective projection — objects further away (positive z2) appear smaller.
        // perspectiveDistance of 800 gives a subtle but clear depth effect.
        const perspectiveDistance = 800;
        const perspective = perspectiveDistance / (perspectiveDistance + z2);

        return {
            x: x3 * perspective,
            y: y3 * perspective,
            z: z2,           // preserved for depth sorting and size scaling
            perspective      // scaling factor — smaller when further away
        };
    }

    // Projects one spherical point using the hash-selected projection type,
    // then applies the full 3D rotation matrix.
    projectAndRotate3D(lon, lat, radius, scale, rotX, rotY, rotZ) {
        const phi   = (90 - lat)  * (Math.PI / 180);
        const theta = (lon + 180) * (Math.PI / 180);

        let x, y, z;

        if (this.projectionType === 1) {
            // Stereographic
            const k = 2 / (1 + Math.cos(phi));
            x = k * Math.sin(phi) * Math.cos(theta) * scale * radius;
            y = k * Math.sin(phi) * Math.sin(theta) * scale * radius;
            z = 0;
        } else if (this.projectionType === 2) {
            // Cylindrical
            x = theta / Math.PI * scale * radius;
            y = Math.log(Math.tan(phi / 2 + 0.001)) * scale * radius * 0.3;
            z = 0;
        } else {
            // Orthographic — preserves the 3D sphere structure most naturally
            // for 3D rotation, since points already have implied depth from radius
            x = Math.sin(phi) * Math.cos(theta) * scale * radius;
            y = Math.sin(phi) * Math.sin(theta) * scale * radius;
            z = Math.cos(phi) * scale * radius; // depth from sphere surface
        }

        return this.rotate3D(x, y, z, rotX, rotY, rotZ);
    }

    // Draws the Lissajous overlay with 3D rotation applied.
    drawLissajous(pulse, hue, rotX, rotY, rotZ) {
        const steps = 200;
        const scale = Math.min(this.canvas.width, this.canvas.height) * 0.35 * pulse;
        const alpha = 0.25;

        this.ctx.beginPath();
        for (let i = 0; i <= steps; i++) {
            const t    = (i / steps) * Math.PI * 2;
            const rawX = Math.sin(this.lissajousA * t + this.lissajousDelta) * scale;
            const rawY = Math.sin(this.lissajousB * t) * scale;

            // Apply 3D rotation to Lissajous points at slower rate for visual separation
            const p = this.rotate3D(rawX, rawY, 0, rotX * 0.5, rotY * 0.5, rotZ * 0.7);

            const screenX = this.centerX + p.x;
            const screenY = this.centerY + p.y;

            if (i === 0) this.ctx.moveTo(screenX, screenY);
            else         this.ctx.lineTo(screenX, screenY);
        }

        this.ctx.strokeStyle = `hsla(${(hue + 120) % 360}, 60%, 55%, ${alpha})`;
        this.ctx.lineWidth   = 1.5;
        this.ctx.shadowBlur  = 8;
        this.ctx.shadowColor = `hsla(${(hue + 120) % 360}, 70%, 65%, ${alpha})`;
        this.ctx.stroke();
        this.ctx.shadowBlur  = 0;
    }

    // Renders one frame with full 3D rotation applied to all geometry.
    drawMandala(pulse) {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.95)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        const scale = Math.min(this.canvas.width, this.canvas.height) / 3;
        const hue   = (this.baseHue + this.time * 10) % 360;

        // Draw Lissajous first so main geometry renders on top
        this.drawLissajous(pulse, hue, this.rotX, this.rotY, this.rotZ);

        for (let ring = this.numRings - 1; ring >= 0; ring--) {
            const ringRadius = (ring + 1) / this.numRings;
            const alpha      = 0.3 + (ring / this.numRings) * 0.5;
            const ringHue    = (hue + ring * 30) % 360;

            // Parallax depth — inner rings rotate faster on all three axes
            const depth       = ring / (this.numRings - 1);
            const depthFactor = 0.3 + depth * 1.5;

            // Each ring gets its own rotation angles scaled by depth factor
            const ringRotX = this.rotX * depthFactor;
            const ringRotY = this.rotY * depthFactor;
            const ringRotZ = this.rotZ * depthFactor;

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

                        // Get 3D rotated position
                        const p3d = this.projectAndRotate3D(
                            point.longitude, point.latitude,
                            point.radius * ringRadius * pulse,
                            scale, ringRotX, ringRotY, ringRotZ
                        );

                        // Apply symmetry rotation in 2D after 3D projection
                        const sx = p3d.x * cosS - p3d.y * sinS;
                        const sy = p3d.x * sinS + p3d.y * cosS;

                        const screenX = this.centerX + sx;
                        const screenY = this.centerY + sy;

                        // Scale dot size by perspective — points further away appear smaller
                        const depthSize = (2 + this.complexity) * pulse *
                                          (0.7 + depth * 0.6) * p3d.perspective;

                        this.ctx.beginPath();
                        this.ctx.arc(screenX, screenY, Math.max(0.5, depthSize), 0, Math.PI * 2);
                        this.ctx.fillStyle   = `hsla(${layerHue}, 70%, 60%, ${layerAlpha})`;
                        this.ctx.shadowBlur  = 10 * pulse * (0.5 + depth * 0.8);
                        this.ctx.shadowColor = `hsla(${layerHue}, 80%, 70%, ${layerAlpha})`;
                        this.ctx.fill();

                        // Variable skip connections with 3D perspective scaling
                        const targetIdx = (i + this.connectionSkip) % this.points.length;
                        if (targetIdx !== i) {
                            const tp = this.points[targetIdx];
                            const tp3d = this.projectAndRotate3D(
                                tp.longitude, tp.latitude,
                                tp.radius * ringRadius * pulse,
                                scale, ringRotX, ringRotY, ringRotZ
                            );

                            const tx = tp3d.x * cosS - tp3d.y * sinS;
                            const ty = tp3d.x * sinS + tp3d.y * cosS;

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

    // Animation loop with hash-seeded breathing and full 3D rotation.
    // X and Y axes use sine wave oscillation — the mandala tilts and returns
    // rather than rolling continuously, creating a drifting orbital quality.
    // Z axis decrements continuously for counterclockwise spin.
    startBreathing() {
        const animate = () => {
            this.time += this.pulseSpeed;

            // Z axis: continuous counterclockwise spin
            this.rotZ += this.speedZ;

            // X and Y axes: sinusoidal oscillation creates drifting tilt.
            // Phase offset between X and Y prevents them locking into simple patterns.
            this.rotX = Math.sin(this.time * this.speedX * 100) * this.tiltAmplitudeX;
            this.rotY = Math.sin(this.time * this.speedY * 100 + this.tiltPhaseOffset) * this.tiltAmplitudeY;

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

    // Spiral dissolve with 3D rotation accelerating as it collapses inward
    spiralDissolve(duration) {
        this.stopBreathing();

        const steps    = 60;
        const interval = duration / steps;
        let   step     = 0;

        const dissolve = setInterval(() => {
            step++;
            const scale = Math.max(0.001, 1 - (step / steps));

            // Accelerate all three rotation axes during dissolve
            this.rotZ -= step * 0.01;
            this.rotX += step * 0.005;
            this.rotY += step * 0.005;

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

