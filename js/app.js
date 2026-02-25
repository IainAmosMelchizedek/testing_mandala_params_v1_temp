// app.js - Main application with consciousness guardian and GIF recording

let mandalaGen = null;
let currentIntention = '';
let currentHash = '';

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    const canvas = document.getElementById('mandalaCanvas');
    mandalaGen = new MandalaGenerator(canvas);
    
    const analyzeBtn = document.getElementById('analyzeBtn');
    const acceptReframeBtn = document.getElementById('acceptReframeBtn');
    const keepOriginalBtn = document.getElementById('keepOriginalBtn');
    const generateDirectBtn = document.getElementById('generateDirectBtn');
    const downloadPngBtn = document.getElementById('downloadPngBtn');
    const downloadGifBtn = document.getElementById('downloadGifBtn');
    const intentionInput = document.getElementById('intentionInput');
    
    // Analyze button - THE GUARDIAN
    analyzeBtn.addEventListener('click', async function() {
        const intention = intentionInput.value.trim();
        
        if (!intention) {
            alert('Please enter an intention first.');
            return;
        }
        
        // Show analysis section
        const analysisSection = document.getElementById('analysisSection');
        analysisSection.style.display = 'block';
        analysisSection.scrollIntoView({ behavior: 'smooth' });
        
        // Analyze the intention
        await analyzeIntention(intention);
    });
    
    // Accept reframed intention
    acceptReframeBtn.addEventListener('click', async function() {
        const reframedText = document.getElementById('reframedText').textContent;
        await generateMandala(reframedText);
    });
    
    // Keep original (only for soft warnings)
    keepOriginalBtn.addEventListener('click', async function() {
        await generateMandala(currentIntention);
    });
    
    // Direct generate (for conscious intentions)
    generateDirectBtn.addEventListener('click', async function() {
        await generateMandala(currentIntention);
    });
    
    // Download PNG button
    downloadPngBtn.addEventListener('click', function() {
        const link = document.createElement('a');
        link.download = `intention-mandala-${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    });
    
    // Download GIF button
    downloadGifBtn.addEventListener('click', async function() {
        await recordGif();
    });
});

// CONSCIOUSNESS ANALYZER - THE GUARDIAN
async function analyzeIntention(intention) {
    currentIntention = intention;
    const feedbackDiv = document.getElementById('feedbackMessage');
    const reframedSection = document.getElementById('reframedSection');
    const directGenerateSection = document.getElementById('directGenerateSection');
    const reframedText = document.getElementById('reframedText');
    const keepOriginalBtn = document.getElementById('keepOriginalBtn');
    
    // HARD BLOCKS - Harmful intentions (NO PASS)
    const hardBlockPatterns = [
        // Violence
        /\b(kill|murder|hurt|destroy|attack|harm|weapon|blood|die|death|stab|shoot|bomb|torture)\b/i,
        // Sexual harm
        /\b(rape|molest|abuse|exploit|seduce)\b/i,
        // Hate/discrimination
        /\b(hate|racist|bigot|supremacy|genocide|exterminate|inferior)\b/i,
        // Self-harm
        /\b(suicide|kill myself|end it all|cut myself|worthless|better off dead)\b/i,
        // Domination/control
        /\b(enslave|subjugate|dominate|manipulate|control)\b/i
    ];
    
    // SOFT BLOCKS - Limiting beliefs (WARNING but allow override)
    const softBlockPatterns = [
        /\b(can't|cannot|never|impossible|failure|failed|fear|anger|anxiety)\b/i,
        /\b(lack|lose|losing|poverty|empty|broken|damaged)\b/i,
        /\b(won't|shouldn't|couldn't|wouldn't)\b/i
    ];
    
    // Check for HARD BLOCKS
    let isHardBlock = false;
    for (const pattern of hardBlockPatterns) {
        if (pattern.test(intention)) {
            isHardBlock = true;
            break;
        }
    }
    
    if (isHardBlock) {
        // HARD BLOCK - Force reframe, no option to keep
        feedbackDiv.className = 'feedback-message feedback-harmful';
        feedbackDiv.innerHTML = `<strong>⛔ INTENTION BLOCKED</strong><br><br>This intention contains harmful patterns that are against humanity.<br><br>No cryptographic signature will be generated for harmful content.<br><br>You must accept the reframed version below to proceed.`;
        
        const reframed = reframeIntention(intention);
        reframedText.textContent = reframed;
        reframedSection.style.display = 'block';
        keepOriginalBtn.style.display = 'none'; // NO KEEP OPTION
        directGenerateSection.style.display = 'none';
        return;
    }
    
    // Check for SOFT BLOCKS
    let isSoftBlock = false;
    for (const pattern of softBlockPatterns) {
        if (pattern.test(intention)) {
            isSoftBlock = true;
            break;
        }
    }
    
    if (isSoftBlock) {
        // SOFT BLOCK - Suggest reframe but allow override
        feedbackDiv.className = 'feedback-message feedback-warning';
        feedbackDiv.innerHTML = `<strong>⚠️ LIMITING PATTERNS DETECTED</strong><br><br>Your intention contains limiting language that may not serve your highest good.<br><br>We suggest the reframed version below, but you may keep your original if you understand the limitation.`;
        
        const reframed = reframeIntention(intention);
        reframedText.textContent = reframed;
        reframedSection.style.display = 'block';
        keepOriginalBtn.style.display = 'inline-block'; // ALLOW KEEP OPTION
        directGenerateSection.style.display = 'none';
        return;
    }
    
    // CONSCIOUS INTENTION - Green light!
    feedbackDiv.className = 'feedback-message feedback-conscious';
    feedbackDiv.innerHTML = `<strong>✓ INTENTION ALIGNED</strong><br><br>Your intention is positively aligned with consciousness.<br><br>Ready to generate your sacred geometry.`;
    
    reframedSection.style.display = 'none';
    directGenerateSection.style.display = 'block';
}

// REFRAME ENGINE - 180° reversal
function reframeIntention(intention) {
    let reframed = intention
        // Violence → Peace
        .replace(/\bkill\b/gi, 'bring peace to')
        .replace(/\bmurder\b/gi, 'transform')
        .replace(/\bhurt\b/gi, 'heal')
        .replace(/\bdestroy\b/gi, 'rebuild')
        .replace(/\battack\b/gi, 'embrace')
        .replace(/\bharm\b/gi, 'help')
        .replace(/\bdie\b/gi, 'transform')
        .replace(/\bdeath\b/gi, 'rebirth')
        
        // Hate → Love
        .replace(/\bhate\b/gi, 'release and transform')
        .replace(/\banger\b/gi, 'peace')
        
        // Self-harm → Self-love
        .replace(/\bsuicide\b/gi, 'transformation')
        .replace(/\bkill myself\b/gi, 'love myself')
        .replace(/\bworthless\b/gi, 'worthy')
        
        // Control → Freedom
        .replace(/\bcontrol\b/gi, 'guide')
        .replace(/\bdominate\b/gi, 'collaborate with')
        .replace(/\bmanipulate\b/gi, 'inspire')
        
        // Limiting beliefs → Empowerment
        .replace(/\bcan't\b/gi, 'am learning to')
        .replace(/\bcannot\b/gi, 'am developing the ability to')
        .replace(/\bnever\b/gi, 'will eventually')
        .replace(/\bimpossible\b/gi, 'challenging but achievable')
        .replace(/\bfailure\b/gi, 'learning')
        .replace(/\bfear\b/gi, 'courage')
        
        // Scarcity → Abundance
        .replace(/\black\b/gi, 'abundance of')
        .replace(/\blose\b/gi, 'release to gain')
        .replace(/\bpoverty\b/gi, 'prosperity')
        .replace(/\bempty\b/gi, 'open to receive');
    
    // Ensure positive framing
    if (!reframed.match(/^I am|^I embody|^I manifest|^I choose|^I create/i)) {
        reframed = 'I am aligned with ' + reframed.toLowerCase();
    }
    
    return reframed.charAt(0).toUpperCase() + reframed.slice(1);
}

// Generate and display mandala (ONLY called after passing guardian)
async function generateMandala(intentionText) {
    const mandalaSection = document.getElementById('mandalaSection');
    const hashDisplay = document.getElementById('hashDisplay');
    
    // Show mandala section
    mandalaSection.style.display = 'block';
    mandalaSection.scrollIntoView({ behavior: 'smooth' });
    
    // Generate mandala with perfect velocity
    const hash = await mandalaGen.generate(intentionText);
    currentHash = hash;
    
    // Display hash
    hashDisplay.textContent = hash.substring(0, 16) + '...';
    
    // Start breathing animation with perfect velocity
    mandalaGen.startBreathing();
}

// Record 5-second GIF with MERIDIAN-HASH (FIXED version)
async function recordGif() {
    const gifStatus = document.getElementById('gifStatus');
    const downloadGifBtn = document.getElementById('downloadGifBtn');
    
    // Disable button during recording
    downloadGifBtn.disabled = true;
    gifStatus.style.display = 'block';
    gifStatus.textContent = '⏳ Preparing GIF encoder...';
    
    try {
        // Create GIF encoder with optimized settings
        const gif = new GIF({
            workers: 2,
            quality: 15, // Slightly lower quality for faster processing
            width: mandalaGen.canvas.width,
            height: mandalaGen.canvas.height,
            workerScript: 'https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.worker.js',
            dither: false // Disable dithering for speed
        });
        
        // Record fewer frames for reliability: 5 seconds at 20fps (100 frames total)
        const fps = 20;
        const duration = 5;
        const totalFrames = fps * duration;
        const frameDelay = 1000 / fps; // 50ms per frame
        
        gifStatus.textContent = '⏳ Recording frames (0%)...';
        
        // Capture all frames first
        const frames = [];
        for (let i = 0; i < totalFrames; i++) {
            // Capture frame
            const imageData = mandalaGen.ctx.getImageData(0, 0, mandalaGen.canvas.width, mandalaGen.canvas.height);
            frames.push(imageData);
            
            // Update progress
            const progress = Math.round(((i + 1) / totalFrames) * 100);
            gifStatus.textContent = `⏳ Recording frames (${progress}%)...`;
            
            // Wait for next frame
            await new Promise(resolve => setTimeout(resolve, frameDelay));
        }
        
        gifStatus.textContent = '🎨 Adding frames to GIF...';
        
        // Add all frames to GIF
        frames.forEach((frame, index) => {
            gif.addFrame(frame, { delay: frameDelay, copy: true });
            if (index % 20 === 0) {
                const progress = Math.round(((index + 1) / frames.length) * 100);
                gifStatus.textContent = `🎨 Processing (${progress}%)...`;
            }
        });
        
        gifStatus.textContent = '🎨 Rendering GIF (this may take 10-20 seconds)...';
        
        // Set up completion handler BEFORE rendering
        gif.on('finished', function(blob) {
            const link = document.createElement('a');
            link.download = `intention-mandala-${Date.now()}.gif`;
            link.href = URL.createObjectURL(blob);
            link.click();
            
            // Reset UI
            gifStatus.textContent = '✅ GIF downloaded!';
            setTimeout(() => {
                gifStatus.style.display = 'none';
            }, 3000);
            downloadGifBtn.disabled = false;
        });
        
        gif.on('progress', function(p) {
            const percent = Math.round(p * 100);
            gifStatus.textContent = `🎨 Rendering GIF (${percent}%)...`;
        });
        
        // Start rendering
        gif.render();
        
    } catch (error) {
        console.error('GIF creation error:', error);
        gifStatus.textContent = '❌ GIF creation failed. Try again.';
        gifStatus.style.color = '#ff4444';
        setTimeout(() => {
            gifStatus.style.display = 'none';
            gifStatus.style.color = '#f39c12';
        }, 5000);
        downloadGifBtn.disabled = false;
    }
}
