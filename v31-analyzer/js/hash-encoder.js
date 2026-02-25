// hash-encoder.js - SHA-256 cryptographic hash generator

async function generateHash(text) {
    // Convert text to bytes
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    
    // Generate SHA-256 hash
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    
    // Convert to hex string
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    return hashHex;
}

// Convert hex hash to array of numbers (0-255)
function hexToNumbers(hexString) {
    const numbers = [];
    for (let i = 0; i < hexString.length; i += 2) {
        const hex = hexString.substr(i, 2);
        numbers.push(parseInt(hex, 16));
    }
    return numbers;
}

// Convert hash numbers to spherical coordinates (your 360° system)
function hashToSphericalCoords(hashNumbers, index) {
    // Use 3 bytes (24 bits) per coordinate point
    const startIdx = (index * 3) % hashNumbers.length;
    
    // Get three consecutive numbers
    const val1 = hashNumbers[startIdx];
    const val2 = hashNumbers[(startIdx + 1) % hashNumbers.length];
    const val3 = hashNumbers[(startIdx + 2) % hashNumbers.length];
    
    // Combine into larger number space
    const combined = (val1 << 16) | (val2 << 8) | val3;
    const max = 16777215; // 2^24 - 1
    
    // Longitude: 0 to 360 degrees
    const longitude = (combined / max) * 360;
    
    // Latitude: -90 to 90 degrees
    const latitude = ((val2 / 255) * 180) - 90;
    
    // Radius variation: 0.7 to 1.3
    const radius = 0.7 + ((val3 / 255) * 0.6);
    
    return { longitude, latitude, radius };
}

// Convert spherical to Cartesian coordinates (for 2D drawing)
function sphericalToCartesian(lon, lat, radius, centerX, centerY, scale) {
    // Convert degrees to radians
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);
    
    // Project onto 2D plane (orthographic projection)
    const x = centerX + (radius * Math.sin(phi) * Math.cos(theta) * scale);
    const y = centerY + (radius * Math.sin(phi) * Math.sin(theta) * scale);
    
    return { x, y };
}
