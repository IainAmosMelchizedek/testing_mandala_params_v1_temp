// hash-encoder.js - Cryptographic foundation for the Intention Keeper
// Responsible for: SHA-256 hashing, coordinate generation, and 2D projection.
// All visual variation in the mandala traces back to deterministic math applied to hash bytes.

// Generates a SHA-256 hex string from any input text.
// The same intention always produces the same hash — this is what makes each mandala unique and reproducible.
async function generateHash(text) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Converts a hex hash string into an array of 32 integers (0–255).
// Each integer represents one byte of the SHA-256 output.
// These bytes are the raw material for all coordinate and parameter calculations.
function hexToNumbers(hexString) {
    const numbers = [];
    for (let i = 0; i < hexString.length; i += 2) {
        numbers.push(parseInt(hexString.substr(i, 2), 16));
    }
    return numbers;
}

// Golden angle in degrees — derived from the golden ratio (phi ≈ 1.618).
// Sunflowers and pine cones use this angle for efficient, non-repeating packing.
// Applying it here ensures points never cluster or align predictably.
const GOLDEN_ANGLE = 137.50776405003785;

// Converts hash bytes into spherical coordinates for one geometry point.
// Uses 5 bytes per point (up from 3) to give finer variation across longitude, latitude, and radius.
// Golden angle offset is added to longitude so consecutive points spiral outward naturally.
function hashToSphericalCoords(hashNumbers, index) {
    // Stride by 5 bytes per point so each point draws from a distinct region of the hash.
    // Modulo 32 wraps safely within the 32-byte SHA-256 output.
    const offset = (index * 5) % 32;

    const val1 = hashNumbers[offset % 32];
    const val2 = hashNumbers[(offset + 1) % 32];
    const val3 = hashNumbers[(offset + 2) % 32];
    const val4 = hashNumbers[(offset + 3) % 32];
    const val5 = hashNumbers[(offset + 4) % 32];

    // Combine two bytes for longitude (16-bit precision = 65536 steps vs 256 with one byte).
    // This eliminates the banding/clustering visible when only 8 bits drive angular position.
    let longitude = (val1 * 256 + val2) / 65535 * 360;

    // Golden angle offset rotates each successive point by ~137.5°.
    // This is the same principle that gives sunflower seeds their spiral packing.
    longitude = (longitude + index * GOLDEN_ANGLE) % 360;

    // Two-byte latitude gives smooth pole-to-pole distribution rather than coarse jumps.
    const latitude = ((val3 * 256 + val4) / 65535 * 180) - 90;

    // Radius controls how far from center the point sits.
    // Range 0.7–1.3 keeps points visible but adds meaningful depth variation.
    const radius = 0.7 + (val5 / 255) * 0.6;

    return { longitude, latitude, radius };
}

// Projects spherical coordinates onto a 2D canvas plane using orthographic projection.
// Orthographic was chosen because it preserves the circular, mandala-like appearance
// without the distortion of perspective projection.
function sphericalToCartesian(lon, lat, radius, centerX, centerY, scale) {
    const phi   = (90 - lat)  * (Math.PI / 180); // polar angle from north pole
    const theta = (lon + 180) * (Math.PI / 180); // azimuthal angle

    const x = centerX + (radius * Math.sin(phi) * Math.cos(theta) * scale);
    const y = centerY + (radius * Math.sin(phi) * Math.sin(theta) * scale);

    return { x, y };
}
