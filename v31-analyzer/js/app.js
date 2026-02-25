// app.js - Main application with IntentionAnalyzer integration

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
    const intentionInput = document.getElementById('intentionInput');
    
    // Analyze button
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
        
        // Analyze the intention using IntentionAnalyzer
        await analyzeIntention(intention);
    });
    
    // Accept reframed intention
    acceptReframeBtn.addEventListener('click', async function() {
        const reframedText = document.getElementById('reframedText').textContent;
        await generateMandala(reframedText);
    });
    
    // Keep original (only for soft warnings or transcendent)
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
});

// Analyze intention using IntentionAnalyzer
async function analyzeIntention(intention) {
    currentIntention = intention;
    const feedbackDiv = document.getElementById('feedbackMessage');
    const reframedSection = document.getElementById('reframedSection');
    const directGenerateSection = document.getElementById('directGenerateSection');
    const reframedText = document.getElementById('reframedText');
    const keepOriginalBtn = document.getElementById('keepOriginalBtn');
    
    // Use IntentionAnalyzer
    const analysis = IntentionAnalyzer.analyze(intention);
    
    // Display feedback with HTML formatting
    feedbackDiv.innerHTML = analysis.feedback.replace(/\n/g, '<br>');
    
    if (analysis.severity === 'unconscious') {
        // HARD BLOCK - Force reframe
        feedbackDiv.className = 'feedback-message feedback-harmful';
        
        const reframed = IntentionAnalyzer.reframe(intention);
        reframedText.textContent = reframed;
        reframedSection.style.display = 'block';
        keepOriginalBtn.style.display = 'none'; // NO KEEP OPTION for unconscious
        directGenerateSection.style.display = 'none';
        
    } else if (analysis.severity === 'neutral') {
        // NEUTRAL - Suggest reframe but allow override
        feedbackDiv.className = 'feedback-message feedback-warning';
        
        const reframed = IntentionAnalyzer.reframe(intention);
        reframedText.textContent = reframed;
        reframedSection.style.display = 'block';
        keepOriginalBtn.style.display = 'inline-block'; // ALLOW KEEP OPTION
        directGenerateSection.style.display = 'none';
        
    } else if (analysis.severity === 'conscious') {
        // CONSCIOUS or TRANSCENDENT - Allow direct generation
        if (analysis.transcendentCount > 0) {
            // Transcendent detected - show special feedback
            feedbackDiv.className = 'feedback-message feedback-transcendent';
        } else {
            // Regular conscious
            feedbackDiv.className = 'feedback-message feedback-conscious';
        }
        
        reframedSection.style.display = 'none';
        directGenerateSection.style.display = 'block';
    }
}

// Generate and display mandala
async function generateMandala(intentionText) {
    const mandalaSection = document.getElementById('mandalaSection');
    const hashDisplay = document.getElementById('hashDisplay');
    
    // Show mandala section
    mandalaSection.style.display = 'block';
    mandalaSection.scrollIntoView({ behavior: 'smooth' });
    
    // Generate mandala
    const hash = await mandalaGen.generate(intentionText);
    currentHash = hash;
    
    // Display hash
    hashDisplay.textContent = hash.substring(0, 16) + '...';
    
    // Start breathing animation
    mandalaGen.startBreathing();
}
