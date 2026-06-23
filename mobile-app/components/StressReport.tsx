import React, { useMemo } from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    Modal,
    Dimensions,
    ActivityIndicator,
    Platform,
    Alert,
} from 'react-native';
import { X, TrendingUp, TrendingDown, Minus, Heart, Brain, AlertTriangle, Smile, Shield, Download } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { LineChart } from 'react-native-chart-kit';
import { StressAnalysisResult } from '../services/stressAnalysis';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Props {
    visible: boolean;
    onClose: () => void;
    data: StressAnalysisResult | null;
    isLoading: boolean;
    error: string | null;
}

// Emoji map for emotions
const EMOTION_EMOJI: Record<string, string> = {
    joy: '😊',
    sadness: '😢',
    anger: '😠',
    fear: '😰',
    surprise: '😲',
    disgust: '🤢',
    neutral: '😐',
    love: '❤️',
};

// Color map for stress levels
const STRESS_COLORS: Record<string, string> = {
    low: '#4CAF50',
    moderate: '#FFC107',
    high: '#FF9800',
    critical: '#F44336',
};

export const StressReport: React.FC<Props> = ({ visible, onClose, data, isLoading, error }) => {
    const { theme } = useTheme();

    const dynamicStyles = useMemo(() => ({
        modalBg: { backgroundColor: theme.isDark ? 'rgba(0,0,0,0.95)' : 'rgba(255,255,255,0.98)' },
        cardBg: { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)' },
        textPrimary: { color: theme.colors.text },
        textMuted: { color: theme.colors.muted },
        accent: theme.colors.accent,
        border: { borderColor: theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' },
    }), [theme]);

    const stressColor = data ? (STRESS_COLORS[data.overall_stress_level] || '#999') : '#999';

    const TrendIcon = data?.mood_trend === 'improving' ? TrendingUp
        : data?.mood_trend === 'declining' ? TrendingDown
        : Minus;

    const trendColor = data?.mood_trend === 'improving' ? '#4CAF50'
        : data?.mood_trend === 'declining' ? '#F44336'
        : '#FFC107';

    const generatePDF = async () => {
        if (!data) return;

        // Prepare data for Chart.js in the PDF
        const chartLabels = data.stress_trend.map((_, i) => `Msg ${i + 1}`);
        const chartData = data.stress_trend.map(val => Math.round(val * 100));
        
        // Generate static chart image using QuickChart
        const chartConfig = {
            type: 'line',
            data: {
                labels: chartLabels,
                datasets: [{
                    label: 'Stress %',
                    data: chartData,
                    borderColor: trendColor,
                    backgroundColor: `${trendColor}33`, // 20% opacity hex
                    borderWidth: 3,
                    fill: true,
                    pointBackgroundColor: trendColor,
                    pointRadius: 4
                }]
            },
            options: {
                legend: { display: false },
                scales: {
                    yAxes: [{
                        ticks: { beginAtZero: true, max: 100 },
                        gridLines: { color: '#EDF2F7' }
                    }],
                    xAxes: [{
                        gridLines: { display: false }
                    }]
                }
            }
        };
        const quickChartUrl = `https://quickchart.io/chart?w=600&h=300&c=${encodeURIComponent(JSON.stringify(chartConfig))}`;

        const html = `
            <!DOCTYPE html>
            <html>
                <head>
                    <meta charset="utf-8">
                    <style>
                        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;800&display=swap');
                        body { 
                            font-family: 'Inter', sans-serif; 
                            padding: 40px; 
                            color: #2D3748; 
                            background-color: #F7FAFC;
                        }
                        .header {
                            text-align: center;
                            margin-bottom: 40px;
                            padding-bottom: 20px;
                            border-bottom: 2px solid #E2E8F0;
                        }
                        .header h1 { 
                            color: #2D3748; 
                            margin: 0 0 10px 0;
                            font-size: 32px;
                        }
                        .header p { 
                            color: #718096; 
                            margin: 0;
                            font-size: 14px;
                        }
                        .card { 
                            background: #FFFFFF; 
                            padding: 24px; 
                            margin-bottom: 24px; 
                            border-radius: 12px; 
                            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05); 
                        }
                        .grid-2 {
                            display: flex;
                            justify-content: space-between;
                            gap: 20px;
                        }
                        .metric-box {
                            flex: 1;
                            text-align: center;
                            padding: 20px;
                            border-radius: 12px;
                            background: #F7FAFC;
                        }
                        .metric-box h2 {
                            font-size: 14px;
                            text-transform: uppercase;
                            letter-spacing: 1px;
                            color: #718096;
                            margin: 0 0 10px 0;
                        }
                        .metric-value {
                            font-size: 32px;
                            font-weight: 800;
                        }
                        .section-title { 
                            color: #4A5568; 
                            font-size: 18px;
                            margin-top: 0;
                            margin-bottom: 16px;
                            border-bottom: 2px solid #EDF2F7; 
                            padding-bottom: 8px; 
                        }
                        ul { 
                            line-height: 1.8; 
                            padding-left: 20px;
                            color: #4A5568;
                            margin: 0;
                        }
                        li { margin-bottom: 8px; }
                        .tag {
                            display: inline-block;
                            padding: 4px 12px;
                            border-radius: 20px;
                            background: #EDF2F7;
                            font-weight: 600;
                            font-size: 14px;
                        }
                        .footer {
                            margin-top: 60px;
                            text-align: center;
                            font-size: 12px;
                            color: #A0AEC0;
                            font-style: italic;
                        }
                        .chart-container {
                            width: 100%;
                            text-align: center;
                            margin-top: 20px;
                        }
                        .chart-container img {
                            max-width: 100%;
                            height: auto;
                        }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>🧠 DharmaAI Inner Balance Report</h1>
                        <p>Generated on: ${new Date(data.analyzed_at).toLocaleString()}</p>
                    </div>
                    
                    <div class="grid-2" style="margin-bottom: 24px;">
                        <div class="metric-box">
                            <h2>Overall Stress Level</h2>
                            <div class="metric-value" style="color: ${stressColor};">
                                ${data.overall_stress_level.toUpperCase()} <span style="font-size: 20px;">(${Math.round(data.stress_score * 100)}%)</span>
                            </div>
                        </div>
                        <div class="metric-box">
                            <h2>Wellness Score</h2>
                            <div class="metric-value" style="color: #4CAF50;">
                                ${data.wellness_score}<span style="font-size: 20px; color:#A0AEC0;">/10</span>
                            </div>
                        </div>
                    </div>

                    <div class="card">
                        <h2 class="section-title">Session Stress Trend</h2>
                        <p style="font-weight: 600; color: ${trendColor};">
                            Mood Trajectory: ${data.mood_trend === 'improving' ? '📈 Improving' : data.mood_trend === 'declining' ? '📉 Declining' : '➡️ Stable'}
                        </p>
                        <div class="chart-container">
                            <img src="${quickChartUrl}" alt="Stress Trend Graph" />
                        </div>
                    </div>

                    <div class="grid-2">
                        <div class="card" style="flex: 1;">
                            <h2 class="section-title">Dominant Emotions</h2>
                            <ul>
                                ${data.dominant_emotions.map(e => `<li><span style="font-weight:600; text-transform:capitalize;">${e}</span>: ${data.emotion_breakdown[e]}%</li>`).join('')}
                            </ul>
                        </div>
                        <div class="card" style="flex: 1.5;">
                            <h2 class="section-title">Detected Patterns</h2>
                            <ul>
                                ${data.key_patterns.map(p => `<li>${p}</li>`).join('')}
                            </ul>
                        </div>
                    </div>

                    <div class="card">
                        <h2 class="section-title">Personalized Recommendations</h2>
                        <ul>
                            ${data.recommendations.map(r => `<li>${r}</li>`).join('')}
                        </ul>
                    </div>
                    
                    <div class="footer">
                        ⓘ This analysis is generated by AI models based on your chat session and is for personal reflection only. It is not a medical diagnosis.
                    </div>
                </body>
            </html>
        `;

        try {
            const { uri } = await Print.printToFileAsync({ html });
            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
            } else {
                Alert.alert("Success", "PDF generated, but sharing is not available on this device.");
            }
        } catch (err) {
            console.error("PDF generation error:", err);
            Alert.alert("Error", "Failed to generate PDF.");
        }
    };

    const renderStressGauge = () => {
        if (!data) return null;
        const percentage = Math.round(data.stress_score * 100);
        const wellnessPercentage = Math.round((1 - data.stress_score) * 100);

        return (
            <View style={[styles.card, dynamicStyles.cardBg, dynamicStyles.border]}>
                <View style={styles.gaugeHeader}>
                    <Brain size={20} color={stressColor} />
                    <Text style={[styles.cardTitle, dynamicStyles.textPrimary]}>Stress Level</Text>
                </View>

                {/* Circular-like display */}
                <View style={styles.gaugeCenter}>
                    <View style={[styles.gaugeCircle, { borderColor: stressColor }]}>
                        <Text style={[styles.gaugeNumber, { color: stressColor }]}>{percentage}%</Text>
                        <Text style={[styles.gaugeLabel, dynamicStyles.textMuted]}>
                            {data.overall_stress_level.toUpperCase()}
                        </Text>
                    </View>
                </View>

                {/* Wellness score */}
                <View style={styles.wellnessRow}>
                    <Shield size={16} color="#4CAF50" />
                    <Text style={[styles.wellnessText, dynamicStyles.textMuted]}>
                        Wellness Score: <Text style={{ color: '#4CAF50', fontWeight: '700' }}>{data.wellness_score}/10</Text>
                    </Text>
                </View>

                {/* Stats row */}
                <View style={styles.statsRow}>
                    <View style={styles.statItem}>
                        <Text style={[styles.statNumber, dynamicStyles.textPrimary]}>{data.user_messages_analyzed}</Text>
                        <Text style={[styles.statLabel, dynamicStyles.textMuted]}>Messages</Text>
                    </View>
                    <View style={[styles.statDivider, dynamicStyles.border]} />
                    <View style={styles.statItem}>
                        <Text style={[styles.statNumber, { color: stressColor }]}>{data.stressed_message_count}</Text>
                        <Text style={[styles.statLabel, dynamicStyles.textMuted]}>Stressed</Text>
                    </View>
                    <View style={[styles.statDivider, dynamicStyles.border]} />
                    <View style={styles.statItem}>
                        <Text style={[styles.statNumber, { color: trendColor }]}>{data.stressed_percentage}%</Text>
                        <Text style={[styles.statLabel, dynamicStyles.textMuted]}>Rate</Text>
                    </View>
                </View>
            </View>
        );
    };

    const renderMoodTrend = () => {
        if (!data) return null;

        return (
            <View style={[styles.card, dynamicStyles.cardBg, dynamicStyles.border]}>
                <View style={styles.gaugeHeader}>
                    <TrendIcon size={20} color={trendColor} />
                    <Text style={[styles.cardTitle, dynamicStyles.textPrimary]}>Mood Trend</Text>
                </View>

                <Text style={[styles.trendText, { color: trendColor }]}>
                    {data.mood_trend === 'improving' ? '📈 Improving' :
                     data.mood_trend === 'declining' ? '📉 Declining' : '➡️ Stable'}
                </Text>

                {data.stress_trend.length > 1 && (
                    <View style={{ alignItems: 'center', marginTop: 10 }}>
                        <LineChart
                            data={{
                                labels: data.stress_trend.map((_, i) => `Msg ${i + 1}`),
                                datasets: [{ data: data.stress_trend }]
                            }}
                            width={SCREEN_WIDTH - 80}
                            height={180}
                            yAxisSuffix="%"
                            formatYLabel={(value) => Math.round(parseFloat(value) * 100).toString()}
                            chartConfig={{
                                backgroundColor: 'transparent',
                                backgroundGradientFrom: theme.isDark ? '#1a1a1a' : '#ffffff',
                                backgroundGradientTo: theme.isDark ? '#1a1a1a' : '#ffffff',
                                decimalPlaces: 0,
                                color: (opacity = 1) => `rgba(${theme.isDark ? '255, 255, 255' : '0, 0, 0'}, ${opacity})`,
                                labelColor: (opacity = 1) => `rgba(${theme.isDark ? '255, 255, 255' : '0, 0, 0'}, ${opacity})`,
                                style: { borderRadius: 16 },
                                propsForDots: {
                                    r: "4",
                                    strokeWidth: "2",
                                    stroke: trendColor
                                }
                            }}
                            bezier
                            style={{ marginVertical: 8, borderRadius: 16 }}
                            withInnerLines={false}
                        />
                    </View>
                )}
                <Text style={[styles.chartLabel, dynamicStyles.textMuted]}>Stress variation over the session history</Text>
            </View>
        );
    };

    const renderEmotions = () => {
        if (!data) return null;

        return (
            <View style={[styles.card, dynamicStyles.cardBg, dynamicStyles.border]}>
                <View style={styles.gaugeHeader}>
                    <Heart size={20} color="#E91E63" />
                    <Text style={[styles.cardTitle, dynamicStyles.textPrimary]}>Emotion Breakdown</Text>
                </View>

                {Object.entries(data.emotion_breakdown).map(([emotion, pct]) => (
                    <View key={emotion} style={styles.emotionRow}>
                        <Text style={styles.emotionEmoji}>{EMOTION_EMOJI[emotion] || '🔹'}</Text>
                        <Text style={[styles.emotionName, dynamicStyles.textPrimary]}>
                            {emotion.charAt(0).toUpperCase() + emotion.slice(1)}
                        </Text>
                        <View style={styles.emotionBarBg}>
                            <View
                                style={[
                                    styles.emotionBarFill,
                                    {
                                        width: `${Math.min(pct as number, 100)}%`,
                                        backgroundColor: ['anger', 'fear', 'sadness', 'disgust'].includes(emotion)
                                            ? '#F44336'
                                            : ['joy', 'love'].includes(emotion)
                                            ? '#4CAF50'
                                            : '#FFC107',
                                    },
                                ]}
                            />
                        </View>
                        <Text style={[styles.emotionPct, dynamicStyles.textMuted]}>{pct}%</Text>
                    </View>
                ))}
            </View>
        );
    };

    const renderPatterns = () => {
        if (!data || !data.key_patterns.length) return null;

        return (
            <View style={[styles.card, dynamicStyles.cardBg, dynamicStyles.border]}>
                <View style={styles.gaugeHeader}>
                    <AlertTriangle size={20} color="#FF9800" />
                    <Text style={[styles.cardTitle, dynamicStyles.textPrimary]}>Patterns Detected</Text>
                </View>

                {data.key_patterns.map((pattern, i) => (
                    <View key={i} style={styles.patternRow}>
                        <Text style={styles.patternBullet}>•</Text>
                        <Text style={[styles.patternText, dynamicStyles.textPrimary]}>{pattern}</Text>
                    </View>
                ))}
            </View>
        );
    };

    const renderRecommendations = () => {
        if (!data || !data.recommendations.length) return null;

        return (
            <View style={[styles.card, dynamicStyles.cardBg, dynamicStyles.border]}>
                <View style={styles.gaugeHeader}>
                    <Smile size={20} color="#4CAF50" />
                    <Text style={[styles.cardTitle, dynamicStyles.textPrimary]}>Recommendations</Text>
                </View>

                {data.recommendations.map((rec, i) => (
                    <View key={i} style={styles.recRow}>
                        <Text style={[styles.recText, dynamicStyles.textPrimary]}>{rec}</Text>
                    </View>
                ))}
            </View>
        );
    };

    return (
        <Modal visible={visible} animationType="slide" transparent={false}>
            <View style={[styles.container, dynamicStyles.modalBg]}>
                {/* Header */}
                <View style={[styles.header, dynamicStyles.border]}>
                    <Text style={[styles.headerTitle, dynamicStyles.textPrimary]}>🧠 Stress Analysis Report</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        {data && !isLoading && !error && (
                            <TouchableOpacity onPress={generatePDF} style={[styles.closeBtn, { marginRight: 10 }]}>
                                <Download size={24} color={theme.colors.accent} />
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                            <X size={24} color={theme.colors.muted} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Content */}
                {isLoading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={dynamicStyles.accent} />
                        <Text style={[styles.loadingText, dynamicStyles.textMuted]}>
                            Analyzing your conversations...
                        </Text>
                        <Text style={[styles.loadingSubtext, dynamicStyles.textMuted]}>
                            Our ML models are processing your chat history
                        </Text>
                    </View>
                ) : error ? (
                    <View style={styles.loadingContainer}>
                        <Text style={styles.errorEmoji}>⚠️</Text>
                        <Text style={[styles.errorText, dynamicStyles.textPrimary]}>{error}</Text>
                        <TouchableOpacity onPress={onClose} style={[styles.retryBtn, { backgroundColor: dynamicStyles.accent }]}>
                            <Text style={styles.retryBtnText}>Close</Text>
                        </TouchableOpacity>
                    </View>
                ) : data ? (
                    <ScrollView
                        style={styles.scrollContent}
                        contentContainerStyle={styles.scrollInner}
                        showsVerticalScrollIndicator={false}
                    >
                        {/* Timestamp */}
                        <Text style={[styles.timestamp, dynamicStyles.textMuted]}>
                            Generated: {new Date(data.analyzed_at).toLocaleString()}
                        </Text>

                        {renderStressGauge()}
                        {renderMoodTrend()}
                        {renderEmotions()}
                        {renderPatterns()}
                        {renderRecommendations()}

                        {/* Disclaimer */}
                        <View style={[styles.disclaimer, dynamicStyles.border]}>
                            <Text style={[styles.disclaimerText, dynamicStyles.textMuted]}>
                                ⓘ This analysis is generated by ML models and is for informational purposes only. 
                                It is not a medical diagnosis. If you're experiencing severe stress, please consult 
                                a mental health professional.
                            </Text>
                        </View>

                        <View style={{ height: 40 }} />
                    </ScrollView>
                ) : null}
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'web' ? 20 : 55,
        paddingBottom: 15,
        borderBottomWidth: 1,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
    closeBtn: {
        padding: 8,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    loadingText: {
        marginTop: 20,
        fontSize: 16,
        fontWeight: '600',
        textAlign: 'center',
    },
    loadingSubtext: {
        marginTop: 8,
        fontSize: 13,
        textAlign: 'center',
    },
    errorEmoji: {
        fontSize: 48,
        marginBottom: 16,
    },
    errorText: {
        fontSize: 15,
        textAlign: 'center',
        marginBottom: 20,
        lineHeight: 22,
    },
    retryBtn: {
        paddingHorizontal: 28,
        paddingVertical: 12,
        borderRadius: 20,
    },
    retryBtnText: {
        color: '#FFF',
        fontWeight: '600',
        fontSize: 14,
    },
    scrollContent: {
        flex: 1,
    },
    scrollInner: {
        padding: 16,
    },
    timestamp: {
        fontSize: 12,
        textAlign: 'center',
        marginBottom: 16,
    },
    card: {
        borderRadius: 16,
        padding: 18,
        marginBottom: 14,
        borderWidth: 1,
    },
    gaugeHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 16,
    },
    cardTitle: {
        fontSize: 15,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
    gaugeCenter: {
        alignItems: 'center',
        marginBottom: 16,
    },
    gaugeCircle: {
        width: 120,
        height: 120,
        borderRadius: 60,
        borderWidth: 4,
        justifyContent: 'center',
        alignItems: 'center',
    },
    gaugeNumber: {
        fontSize: 32,
        fontWeight: '800',
    },
    gaugeLabel: {
        fontSize: 11,
        fontWeight: '600',
        letterSpacing: 1,
        marginTop: 2,
    },
    wellnessRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        marginBottom: 16,
    },
    wellnessText: {
        fontSize: 14,
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
    },
    statItem: {
        alignItems: 'center',
        flex: 1,
    },
    statNumber: {
        fontSize: 20,
        fontWeight: '700',
    },
    statLabel: {
        fontSize: 11,
        marginTop: 2,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    statDivider: {
        width: 1,
        height: 30,
        borderRightWidth: 1,
    },
    trendText: {
        fontSize: 20,
        fontWeight: '700',
        textAlign: 'center',
        marginBottom: 16,
    },
    chartContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'center',
        height: 70,
        gap: 3,
        marginBottom: 8,
        paddingHorizontal: 10,
    },
    chartBarWrapper: {
        flex: 1,
        maxWidth: 20,
        alignItems: 'center',
        justifyContent: 'flex-end',
        height: '100%',
    },
    chartBar: {
        width: '80%',
        borderRadius: 3,
        minHeight: 4,
    },
    chartLabel: {
        fontSize: 10,
        textAlign: 'center',
        marginTop: 4,
    },
    emotionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
        gap: 8,
    },
    emotionEmoji: {
        fontSize: 18,
        width: 28,
        textAlign: 'center',
    },
    emotionName: {
        fontSize: 13,
        fontWeight: '500',
        width: 70,
    },
    emotionBarBg: {
        flex: 1,
        height: 8,
        borderRadius: 4,
        backgroundColor: 'rgba(128,128,128,0.15)',
        overflow: 'hidden',
    },
    emotionBarFill: {
        height: '100%',
        borderRadius: 4,
    },
    emotionPct: {
        fontSize: 12,
        fontWeight: '600',
        width: 40,
        textAlign: 'right',
    },
    patternRow: {
        flexDirection: 'row',
        marginBottom: 8,
        gap: 8,
        paddingRight: 8,
    },
    patternBullet: {
        color: '#FF9800',
        fontSize: 16,
        fontWeight: '700',
        marginTop: -1,
    },
    patternText: {
        flex: 1,
        fontSize: 13,
        lineHeight: 20,
    },
    recRow: {
        marginBottom: 10,
        paddingLeft: 4,
    },
    recText: {
        fontSize: 13,
        lineHeight: 20,
    },
    disclaimer: {
        borderTopWidth: 1,
        paddingTop: 14,
        marginTop: 6,
    },
    disclaimerText: {
        fontSize: 11,
        lineHeight: 17,
        textAlign: 'center',
        fontStyle: 'italic',
    },
});
