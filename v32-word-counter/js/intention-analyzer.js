// Intention Analyzer - Consciousness Analyzer System
// Analyzes intentions against conscious patterns and confronts unconscious patterns
// Foundational Framework: Dhammapada - Attention and effort as the lens: Conscious attention focuses on positive, beneficial states that lead to progress, peace, and kindness. Unconscious patterns are those that are self-centered, malicious, stir up the mind, or draw downward, causing suffering.
const IntentionAnalyzer = {
    // Conscious patterns (universal conscious values, including Dhammapada-inspired terms)
    // These keywords represent positive, mindful states that lead to progress and benefit others
    consciousPatterns: [
        'love', 'joy', 'peace', 'patience', 'forbearance', 'kindness', 'goodness',
        'faithfulness', 'gentleness', 'self-control', 'impartial', 'unconditional',
        'equality', 'humanity', 'forgiveness', 'healing', 'growth', 'connection',
        'courage', 'abundance', 'compassion', 'service', 'unity', 'wholeness',
        'everyone', 'all people', 'collective', 'community', 'selfless',
        'attention', 'mindful', 'dharma', 'positive', 'benefits others', 'peace of mind', 'progress'
    ],
    // Unconscious/selfish patterns (acts of the flesh + modern unconsciousness, including Dhammapada-inspired terms)
    // These keywords represent negative, self-centered states that cause suffering and draw downward
    unconsciousPatterns: [
        'hate', 'hatred', 'anger', 'revenge', 'selfish', 'greed', 'jealousy',
        'envy', 'rage', 'discord', 'division', 'hierarchy', 'partiality',
        'idolatry', 'consumption', 'retaliation', 'ambition', 'drunkenness',
        'impurity', 'debauchery', 'money', 'wealth', 'power over', 'control others',
        'my family', 'my friends', 'my success', 'i want', 'give me', 'make me',
        'better than', 'deserve more', 'fuck', 'destroy', 'hurt', 'punish',
        'politics', 'political', 'politicking', 'politicians',
        'unruly mind', 'suffers', 'causes suffering', 'negative', 'self-centered', 'malicious', 'stirs up', 'draw downward'
    ],
    // Transcendent indicators (language of ego-transcendence, allowing override for paradoxical intentions)
    // These keywords indicate potential transcendent state, boosting positive score and potentially overriding unconscious patterns
    transcendentIndicators: [
        'transcend', 'transcendent', 'beyond ego', 'non-dual', 'nondual', 'detached',
        'ego death', 'awakened', 'enlightened', 'unity consciousness', 'no self',
        'emptiness', 'void', 'absolute', 'nothingness', 'all is one', 'impersonal',
        'beyond good and evil', 'paradoxical', 'from source', 'divine will',
        'for the whole', 'serves all without attachment'
    ],
    /**
     * Analyze intention and provide firm, direct feedback
     * @param {string} intention - The user's intention text
     * @returns {Object} Analysis result with score, counts, feedback, severity, and matches
     */
    analyze(intention) {
        const text = intention.toLowerCase().trim();
       
        if (!text) {
            return {
                score: 0,
                positiveCount: 0,
                negativeCount: 0,
                transcendentCount: 0,
                isConscious: false,
                feedback: 'No intention provided.',
                severity: 'neutral'
            };
        }
        // Count conscious patterns
        const positiveMatches = this.consciousPatterns.filter(keyword =>
            new RegExp(`\\b${keyword.replace(/\s+/g, '\\s+')}\\b`, 'i').test(text)
        );
        let positiveScore = positiveMatches.length;
        // Count unconscious patterns
        const negativeMatches = this.unconsciousPatterns.filter(keyword =>
            new RegExp(`\\b${keyword.replace(/\s+/g, '\\s+')}\\b`, 'i').test(text)
        );
        let negativeScore = negativeMatches.length;
        // Count transcendent indicators
        const transcendentMatches = this.transcendentIndicators.filter(keyword =>
            new RegExp(`\\b${keyword.replace(/\s+/g, '\\s+')}\\b`, 'i').test(text)
        );
        const transcendentScore = transcendentMatches.length * 3; // Heavy boost for transcendence
        const hasTranscendent = transcendentScore > 0;
        // Additional scoring heuristics
        // Excessive possessiveness ("my" without higher good)
        const myCount = (text.match(/\bmy\b/gi) || []).length;
        if (myCount > 2 && positiveScore < 2) {
            negativeScore += 2;
        }
        // "I want" without "will" or positive context
        if (text.includes('i want') && !text.includes('will') && positiveScore < 1) {
            negativeScore += 1;
        }
        // Calculate overall score
        const totalScore = positiveScore + transcendentScore - negativeScore;
        const isConscious = totalScore >= 0;
        let feedback = '';
        let severity = 'neutral';
        if (negativeScore > (positiveScore + transcendentScore) && negativeScore >= 3 && !hasTranscendent) {
            // FIRM CONFRONTATION
            severity = 'unconscious';
            feedback = `⚠️ THIS INTENTION REVEALS UNCONSCIOUS PATTERNS ⚠️

Your words show signs of: ${negativeMatches.slice(0, 3).join(', ')}.

This perpetuates harm—to others, to society, and ultimately to yourself. Words are spells that ripple through generations. Selfishness, partiality, and division are acts of the flesh that break humanity into hierarchies.

It's time to confront this: Shift from "my circle first" to impartial love for ALL. Move from consumption to contribution. From ego to equality.

Humanity—especially younger generations—needs conscious intentions now more than ever.

Your intention has been REFRAMED to align with conscious patterns. Meditate on this transformed version instead.`;
        } else if (positiveScore >= 2 || hasTranscendent) {
            // AFFIRM CONSCIOUSNESS
            severity = 'conscious';
            if (hasTranscendent) {
                feedback = `🌌 POSSIBLE TRANSCENDENT INTENTION DETECTED 🌌

Your words include: ${transcendentMatches.slice(0, 3).join(', ')}.

If this arises from a state beyond ego/duality, it carries profound power—even if it appears paradoxical or "selfish" on the surface. Reflect: Does this serve impartial wholeness without attachment?

If so, beautiful—let it unfold as is. If not, consider reframing for clarity.`;
            } else {
                feedback = `✨ THIS INTENTION ALIGNS WITH CONSCIOUS PATTERNS ✨

Beautiful. Your words carry: ${positiveMatches.slice(0, 3).join(', ')}.

This is conscious intention—rooted in impartiality, love, and service to humanity. Keep cultivating this awareness. Your words ripple outward as positive transformation.

Meditate on this intention. Let it embed deeply in your subconscious.`;
            }
        } else {
            // NEUTRAL - GENTLE GUIDANCE
            severity = 'neutral';
            feedback = `🔵 NEUTRAL INTENTION DETECTED 🔵

Your intention is neither clearly conscious nor unconscious. To amplify its power and align with conscious patterns, consider infusing it with:
- Impartial love (beyond "my" circle)
- Service to all humanity (not just personal gain)
- Peace, kindness, or equality

Note: If this intention arises from a transcendent state (beyond personal gain or duality), it may hold deeper wisdom despite surface appearances.

Transform "I want X" into "It is my will to embody X for the good of all."`;
        }
        return {
            score: totalScore,
            positiveCount: positiveScore,
            negativeCount: negativeScore,
            transcendentCount: transcendentMatches.length,
            isConscious: isConscious,
            feedback: feedback,
            severity: severity,
            positiveMatches: positiveMatches,
            negativeMatches: negativeMatches,
            transcendentMatches: transcendentMatches
        };
    },
    /**
     * Reframe any intention to positive, conscious form
     * @param {string} intention - The original intention text
     * @returns {string} The reframed intention
     */
    reframe(intention) {
        let reframed = intention;
        // Replace negative keywords with positive equivalents
        const replacements = {
            'hate': 'love',
            'hatred': 'compassion',
            'anger': 'peace',
            'revenge': 'forgiveness',
            'selfish': 'selfless service',
            'jealousy': 'celebration of others',
            'envy': 'gratitude',
            'rage': 'calm strength',
            'discord': 'harmony',
            'division': 'unity',
            'destroy': 'heal',
            'hurt': 'help',
            'punish': 'guide',
            'my family': 'all families',
            'my friends': 'all beings',
            'i want': 'it is my will to embody',
            'give me': 'i offer to all',
            'make me': 'i become for the good of humanity'
        };
        for (const [negative, positive] of Object.entries(replacements)) {
            const regex = new RegExp(`\\b${negative.replace(/\s+/g, '\\s+')}\\b`, 'gi');
            reframed = reframed.replace(regex, positive);
        }
        // Ensure it starts with empowering frame
        if (!reframed.match(/^(it is my will|i am|i embody)/i)) {
            reframed = `IT IS MY WILL TO EMBODY IMPARTIAL LOVE AND ${reframed.toUpperCase()}`;
        }
        // Add "for all humanity" if not present
        if (!reframed.match(/(for all|humanity|everyone|collective)/i)) {
            reframed += ' FOR THE GOOD OF ALL HUMANITY';
        }
        return reframed.trim();
    }
};

// Make available globally
window.IntentionAnalyzer = IntentionAnalyzer;
