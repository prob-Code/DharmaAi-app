import { Config } from '../config';

// ─── Types ───
export interface StressMessageDetail {
    content_preview: string;
    stress_label: string;
    stress_score: number;
    top_emotion: string;
    emotions: Record<string, number>;
}

export interface StressAnalysisResult {
    overall_stress_level: string;
    stress_score: number;
    wellness_score: number;
    dominant_emotions: string[];
    emotion_breakdown: Record<string, number>;
    mood_trend: string;
    stress_trend: number[];
    total_messages: number;
    user_messages_analyzed: number;
    stressed_message_count: number;
    stressed_percentage: number;
    key_patterns: string[];
    recommendations: string[];
    message_details: StressMessageDetail[];
    analyzed_at: string;
    model_version: string;
}

function localStressAnalysis(messages: Array<{ role: string; content: string }>): StressAnalysisResult {
    const userMessages = messages.filter(message => message.role !== 'ai' && message.content.trim());
    const stressWords = /stress|anxious|anxiety|panic|overwhelmed|worried|worry|sad|lonely|angry|tired|hopeless|depress|तनाव|चिंता|उदास|अकेला|घबर/gi;
    const positiveWords = /calm|peace|grateful|hopeful|happy|better|good|relaxed|शांत|खुश|आशा|बेहतर|धन्यवाद/gi;
    const scores = userMessages.map(message => {
        const stressHits = (message.content.match(stressWords) || []).length;
        const positiveHits = (message.content.match(positiveWords) || []).length;
        return Math.max(0, Math.min(1, 0.35 + stressHits * 0.12 - positiveHits * 0.08));
    });
    const stressScore = scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0.35;
    const stressedCount = scores.filter(score => score >= 0.55).length;
    const level = stressScore >= 0.8 ? 'critical' : stressScore >= 0.6 ? 'high' : stressScore >= 0.42 ? 'moderate' : 'low';
    const trend = scores.length > 1 && scores[scores.length - 1] < scores[0] - 0.08 ? 'improving'
        : scores.length > 1 && scores[scores.length - 1] > scores[0] + 0.08 ? 'declining' : 'stable';

    return {
        overall_stress_level: level,
        stress_score: Number(stressScore.toFixed(2)),
        wellness_score: Number(Math.max(0, Math.min(10, (1 - stressScore) * 10)).toFixed(1)),
        dominant_emotions: level === 'low' ? ['calm'] : ['stress', 'fatigue'],
        emotion_breakdown: { stress: Math.round(stressScore * 100), calm: Math.round((1 - stressScore) * 100) },
        mood_trend: trend,
        stress_trend: scores.length ? scores : [stressScore],
        total_messages: messages.length,
        user_messages_analyzed: userMessages.length,
        stressed_message_count: stressedCount,
        stressed_percentage: userMessages.length ? Math.round((stressedCount / userMessages.length) * 100) : 0,
        key_patterns: userMessages.length ? ['This is an offline estimate based on the words in your recent messages.'] : ['Not enough messages for a detailed pattern estimate.'],
        recommendations: [
            'Take three slow breaths and notice your body before responding to the next thought.',
            'If this feeling is intense or persistent, speak with someone you trust or a qualified professional.',
        ],
        message_details: userMessages.map(message => ({
            content_preview: message.content.slice(0, 120),
            stress_label: /stress|anxious|panic|sad|lonely|तनाव|चिंता|उदास/.test(message.content.toLowerCase()) ? 'stressed' : 'neutral',
            stress_score: stressScore,
            top_emotion: level === 'low' ? 'calm' : 'stress',
            emotions: { stress: stressScore, calm: 1 - stressScore },
        })),
        analyzed_at: new Date().toISOString(),
        model_version: 'offline-heuristic-v1',
    };
}

// ─── API Call ───
export async function analyzeStress(
    messages: Array<{ role: string; content: string }>
): Promise<StressAnalysisResult> {
    if (!Config.BACKEND_URL) {
        return localStressAnalysis(messages);
    }

    console.log('🧠 Sending chat history for stress analysis...');

    try {
        const res = await fetch(`${Config.BACKEND_URL}/api/stress/analyze`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                messages: messages.map(m => ({
                    role: m.role === 'ai' ? 'ai' : 'user',
                    content: m.content,
                })),
            }),
        });

        if (!res.ok) {
            const errorText = await res.text();
            console.error('❌ Stress analysis error:', res.status, errorText);

            let errorDetail = `Analysis failed: ${res.status}`;
            try {
                const errorJson = JSON.parse(errorText);
                if (errorJson.detail || errorJson.error) {
                    errorDetail = errorJson.detail || errorJson.error;
                }
            } catch {
                // Ignore parse errors and use the status message.
            }

            console.warn('Falling back to local stress analysis:', errorDetail);
            return localStressAnalysis(messages);
        }

        const data: StressAnalysisResult = await res.json();
        console.log('✅ Stress analysis complete:', data.overall_stress_level);
        return data;
    } catch (error) {
        console.warn('Stress analysis backend unavailable; using local analysis.', error);
        return localStressAnalysis(messages);
    }
}
