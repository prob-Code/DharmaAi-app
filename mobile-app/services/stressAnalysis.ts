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

// ─── API Call ───
export async function analyzeStress(
    messages: Array<{ role: string; content: string }>
): Promise<StressAnalysisResult> {
    const apiUrl = Config.STRESS_API_URL;
    const apiKey = Config.STRESS_API_KEY;

    if (!apiUrl) {
        throw new Error('Stress API URL not configured');
    }

    console.log('🧠 Sending chat history for stress analysis...');

    const res = await fetch(`${apiUrl}/analyze`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-API-Key': apiKey,
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
        
        // Try to parse FastAPI's detailed error message
        let errorDetail = `Analysis failed: ${res.status}`;
        try {
            const errorJson = JSON.parse(errorText);
            if (errorJson.detail) {
                errorDetail = errorJson.detail;
            }
        } catch (e) {
            // Ignore parse errors
        }
        
        throw new Error(errorDetail);
    }

    const data: StressAnalysisResult = await res.json();
    console.log('✅ Stress analysis complete:', data.overall_stress_level);
    return data;
}
