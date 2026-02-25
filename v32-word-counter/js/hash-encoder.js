// hash-encoder.js - Cryptographic foundation for the Intention Keeper
// Responsible for SHA-256 hashing, spherical coordinate generation, and 2D projection.
// SHA-256 produces 32 bytes (256 bits). We extract meaning from as many of those
// bytes as possible to maximize visual variation between different intentions.

// Generates a SHA-256 hex string from any input text.
// The same intention always produces the same hash — this is what makes
// each mandala unique, reproducible, and cryptographically tied to its intention.
async function generateHash(text) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Converts a hex hash string into an array of 32 integers (0-255).
// Each integer is one byte of the SHA-256 output and serves as a seed
// for a specific visual parameter in the mandala.
function hexToNumbers(hexString) {
    const numbers = [];
    for (let i = 0; i < hexString.length; i += 2) {
        numbers.push(parseInt(hexString.substr(i, 2), 16));
    }
    return numbers;
}

// Golden angle in degrees — derived from the golden ratio (phi ≈ 1.618).
// Found in sunflowers, pinecones, and nautilus shells.
// Using it to offset point positions creates natural, non-repeating spiral distributions
// that feel organic rather than mechanically uniform.
const GOLDEN_ANGLE = 137.50776405003785;

// Converts hash bytes into spherical coordinates for one geometry point.
// Uses up to 15 bytes per point by combining multiple byte pairs for higher precision.
// Wraps safely within the 32-byte SHA-256 output using modulo arithmetic.
// More bytes = finer variation = more unique mandalas for similar intentions.
function hashToSphericalCoords(hashNumbers, index) {
    const len = hashNumbers.length; // always 32 for SHA-256

    // Stride by 5 bytes per point. With up to 16 points, we touch all 32 bytes
    // multiple times but with different offsets, extracting maximum variation.
    const offset = (index * 5) % len;

    const v1 = hashNumbers[offset % len];
    const v2 = hashNumbers[(offset + 1) % len];
    const v3 = hashNumbers[(offset + 2) % len];
    const v4 = hashNumbers[(offset + 3) % len];
    const v5 = hashNumbers[(offset + 4) % len];

    // Use additional bytes further into the hash for secondary variation.
    // These bytes add subtle modulation to color and size without affecting structure.
    const v6  = hashNumbers[(offset + 6)  % len];
    const v7  = hashNumbers[(offset + 7)  % len];
    const v8  = hashNumbers[(offset + 8)  % len];
    const v9  = hashNumbers[(offset + 9)  % len];
    const v10 = hashNumbers[(offset + 10) % len];
    const v11 = hashNumbers[(offset + 11) % len];
    const v12 = hashNumbers[(offset + 12) % len];
    const v13 = hashNumbers[(offset + 13) % len];
    const v14 = hashNumbers[(offset + 14) % len];

    // Two-byte longitude gives 65536 steps vs 256 with one byte.
    // Eliminates the visible banding/clustering from low-precision angular placement.
    let longitude = (v1 * 256 + v2) / 65535 * 360;

    // Golden angle offset rotates each successive point by ~137.5 degrees.
    // This is the same spacing principle that gives sunflower seeds their
    // efficient, non-overlapping spiral packing.
    longitude = (longitude + index * GOLDEN_ANGLE) % 360;

    // Two-byte latitude gives smooth pole-to-pole variation.
    const latitude = ((v3 * 256 + v4) / 65535 * 180) - 90;

    // Radius controls depth. Range 0.5-1.4 gives more dramatic depth variation
    // than the original 0.7-1.3, making inner/outer ring contrast more pronounced.
    const radius = 0.5 + (v5 / 255) * 0.9;

    // Secondary modulation values — available for use in mandala.js for
    // per-point color shift, size variation, or glow intensity.
    // Normalized to 0.0-1.0 range for easy multiplication against any parameter.
    const colorShift   = (v6  * 256 + v7)  / 65535; // fine hue offset per point
    const sizeVariance = (v8  * 256 + v9)  / 65535; // subtle per-point size difference
    const glowStrength = (v10 * 256 + v11) / 65535; // per-point glow intensity
    const twistFactor  = (v12 * 256 + v13) / 65535; // secondary spiral influence
    const depthBias    = v14 / 255;                  // pushes point toward front or back

    return {
        longitude,
        latitude,
        radius,
        colorShift,
        sizeVariance,
        glowStrength,
        twistFactor,
        depthBias
    };
}

// Projects spherical coordinates onto a 2D canvas plane using orthographic projection.
// Orthographic chosen because it preserves the circular, mandala-like appearance
// without the distortion introduced by perspective projection.
function sphericalToCartesian(lon, lat, radius, centerX, centerY, scale) {
    const phi   = (90 - lat)  * (Math.PI / 180); // polar angle from north pole
    const theta = (lon + 180) * (Math.PI / 180); // azimuthal angle

    const x = centerX + (radius * Math.sin(phi) * Math.cos(theta) * scale);
    const y = centerY + (radius * Math.sin(phi) * Math.sin(theta) * scale);

    return { x, y };
}
