import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, Platform, TextInput, Modal, Dimensions, ActivityIndicator } from 'react-native';
import { Play, X, Search } from 'lucide-react-native';
import YoutubePlayer from 'react-native-youtube-iframe';
import { COLORS, YOUTUBE_API_KEY, YOUTUBE_SEARCH_URL } from '../constants';
import { UserSettings } from '../src/types';
import { getTranslation } from '../translations';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Fallback curated videos if API fails
const FALLBACK_VIDEOS = [
    {
        id: '1',
        title: 'Relaxing Flute Music for Meditation',
        duration: '1:00:00',
        thumbnail: 'https://img.youtube.com/vi/lTRiuFIWV54/hqdefault.jpg',
        videoId: 'lTRiuFIWV54',
        author: 'Soothing Relaxation',
        category: 'Music',
        mood: ['calm', 'focus', 'meditation'],
        benefits: ['relaxation', 'concentration', 'inner peace']
    },
    {
        id: '2',
        title: 'Guided Meditation for Inner Peace',
        duration: '20:00',
        thumbnail: 'https://img.youtube.com/vi/z6X5oEIg6Ak/hqdefault.jpg',
        videoId: 'z6X5oEIg6Ak',
        author: 'Great Meditation',
        category: 'Relief Talks',
        mood: ['peaceful', 'spiritual', 'grounded'],
        benefits: ['inner peace', 'spiritual growth', 'anxiety relief']
    },
    {
        id: '3',
        title: 'Om Meditation - Deep Relaxation',
        duration: '30:00',
        thumbnail: 'https://img.youtube.com/vi/ZToicYcHIOU/hqdefault.jpg',
        videoId: 'ZToicYcHIOU',
        author: 'Meditation Music',
        category: 'Relief Talks',
        mood: ['spiritual', 'meditative', 'deep'],
        benefits: ['vibration healing', 'chakra balancing', 'spiritual connection']
    },
    {
        id: '4',
        title: 'Stress Relief Meditation Music',
        duration: '25:00',
        thumbnail: 'https://img.youtube.com/vi/SEfs5TJZ6Nk/hqdefault.jpg',
        videoId: 'SEfs5TJZ6Nk',
        author: 'Goodful',
        category: 'Relief Talks',
        mood: ['stressed', 'anxious', 'overwhelmed'],
        benefits: ['stress relief', 'relaxation', 'tension release']
    },
    {
        id: '5',
        title: 'Morning Meditation for Positive Energy',
        duration: '15:00',
        thumbnail: 'https://img.youtube.com/vi/inpok4MKVLM/hqdefault.jpg',
        videoId: 'inpok4MKVLM',
        author: 'Great Meditation',
        category: 'Relief Talks',
        mood: ['energized', 'positive', 'motivated'],
        benefits: ['energy boost', 'positivity', 'motivation', 'morning routine']
    },
    {
        id: '6',
        title: 'Deep Sleep Meditation Music',
        duration: '3:00:00',
        thumbnail: 'https://img.youtube.com/vi/aEklYoWSGUE/hqdefault.jpg',
        videoId: 'aEklYoWSGUE',
        author: 'Yellow Brick Cinema',
        category: 'Music',
        mood: ['sleepy', 'tired', 'restful'],
        benefits: ['sleep', 'insomnia relief', 'deep rest', 'recovery']
    },
    {
        id: '7',
        title: 'Anxiety Relief Meditation',
        duration: '20:00',
        thumbnail: 'https://img.youtube.com/vi/O-6f5wQXSu8/hqdefault.jpg',
        videoId: 'O-6f5wQXSu8',
        author: 'The Mindful Movement',
        category: 'Relief Talks',
        mood: ['anxious', 'worried', 'nervous'],
        benefits: ['anxiety relief', 'panic relief', 'calm', 'mindfulness']
    },
    {
        id: '8',
        title: 'Peaceful Piano Music for Meditation',
        duration: '45:00',
        thumbnail: 'https://img.youtube.com/vi/lTRiuFIWV54/hqdefault.jpg',
        videoId: 'lTRiuFIWV54',
        author: 'Soothing Relaxation',
        category: 'Music',
        mood: ['contemplative', 'peaceful', 'reflective'],
        benefits: ['reflection', 'relaxation', 'focus']
    },
    {
        id: '9',
        title: 'Bhagavad Gita Recitation',
        duration: '1:30:00',
        thumbnail: 'https://img.youtube.com/vi/C6luJJWSJKk/hqdefault.jpg',
        videoId: 'C6luJJWSJKk',
        author: 'Spiritual India',
        category: 'Gita Pravarchan',
        mood: ['spiritual', 'learning', 'wisdom'],
        benefits: ['spiritual wisdom', 'life guidance', 'dharma']
    },
    {
        id: '10',
        title: 'Healing Meditation Music',
        duration: '30:00',
        thumbnail: 'https://img.youtube.com/vi/1ZYbU82GVz4/hqdefault.jpg',
        videoId: '1ZYbU82GVz4',
        author: 'Meditation & Healing',
        category: 'Relief Talks',
        mood: ['healing', 'recovery', 'renewal'],
        benefits: ['healing', 'recovery', 'emotional release', 'restoration']
    }
];

interface YouTubeVideo {
    id: string;
    title: string;
    duration: string;
    thumbnail: string;
    videoId: string;
    author: string;
    category: string;
    mood?: string[];
    benefits?: string[];
}

interface Props {
    settings: UserSettings;
}

// Quick search suggestions
const SEARCH_SUGGESTIONS = {
    en: [
        'meditation',
        'chakra healing',
        'guided meditation',
        'sleep meditation',
        'yoga',
        'krishna',
        'bhagavad gita',
        'spiritual wisdom',
        'anxiety relief',
        'stress relief'
    ],
    hi: [
        'ध्यान',
        'कृष्ण',
        'भगवद गीता',
        'योग',
        'भजन',
        'आध्यात्मिक ज्ञान',
        'चिंता मुक्ति',
        'गहरा ध्यान',
        'शांति योग',
        'मन की शांति'
    ]
};

export const Videos: React.FC<Props> = ({ settings }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
    const [playing, setPlaying] = useState(false);
    const [videos, setVideos] = useState<YouTubeVideo[]>(FALLBACK_VIDEOS);
    const [loading, setLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // YouTube Search API integration with improved error handling
    const searchYouTube = useCallback(async (query: string) => {
        if (!query.trim()) {
            setVideos(FALLBACK_VIDEOS);
            setHasSearched(false);
            setError(null);
            return;
        }

        setLoading(true);
        setHasSearched(true);
        setError(null);

        try {
            // Add context to search for better spiritual/wellness results
            const enhancedQuery = query.includes('meditation') || query.includes('yoga') || query.includes('spiritual')
                ? query
                : `${query} meditation wellness`;

            const params = new URLSearchParams({
                part: 'snippet',
                q: enhancedQuery,
                key: YOUTUBE_API_KEY,
                maxResults: '12',
                type: 'video',
                order: 'relevance',
                relevanceLanguage: settings.language === 'hi' ? 'hi' : 'en'
            });

            const url = `${YOUTUBE_SEARCH_URL}?${params.toString()}`;
            console.log('📍 YouTube Search Query:', enhancedQuery);
            console.log('🔗 API URL:', url.substring(0, url.lastIndexOf('key=')));

            const response = await fetch(url, {
                headers: {
                    'Referer': 'http://localhost'
                }
            });
            const data = await response.json();
            
            console.log('📦 API Response Status:', response.status);
            console.log('📦 API Response Data:', JSON.stringify(data, null, 2));
            
            if (!response.ok) {
                throw new Error(`API Error ${response.status}: ${data.error?.message || response.statusText}`);
            }

            if (data.error) {
                const errorDetails = typeof data.error === 'object' 
                    ? `${data.error.code}: ${data.error.message}` 
                    : data.error;
                throw new Error(`YouTube API Error - ${errorDetails}`);
            }

            if (data.items && data.items.length > 0) {
                const ytVideos: YouTubeVideo[] = data.items.map((item: any) => {
                    // Safely extract video data
                    const videoId = item.id?.videoId;
                    if (!videoId) return null;

                    return {
                        id: videoId,
                        title: item.snippet?.title || 'Untitled',
                        duration: '▶ Video',
                        thumbnail: item.snippet?.thumbnails?.high?.url || 
                                  item.snippet?.thumbnails?.medium?.url ||
                                  item.snippet?.thumbnails?.default?.url ||
                                  'https://via.placeholder.com/320x180?text=No+Image',
                        videoId: videoId,
                        author: item.snippet?.channelTitle || 'Unknown Channel',
                        category: 'YOUTUBE',
                        mood: [],
                        benefits: []
                    };
                }).filter(Boolean) as YouTubeVideo[];

                if (ytVideos.length > 0) {
                    setVideos(ytVideos);
                    console.log(`✅ Found ${ytVideos.length} videos`);
                } else {
                    const processErrorMsg = getTranslation(settings.language, 'errors.connection');
                    setError(processErrorMsg);
                    setVideos(FALLBACK_VIDEOS);
                }
            } else {
                const noResultsMsg = getTranslation(settings.language, 'videos.noResults', { query: query });
                setError(noResultsMsg);
                setVideos(FALLBACK_VIDEOS);
            }
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            console.error('❌ YouTube Search Error:', errorMsg);
            console.error('Full error:', error);
            const searchErrorMsg = `${getTranslation(settings.language, 'errors.connection')}`;
            setError(searchErrorMsg);
            setVideos(FALLBACK_VIDEOS);
        } finally {
            setLoading(false);
        }
    }, [settings.language]);

    // Diagnostic function to test API
    const testYouTubeAPI = useCallback(async () => {
        console.log('\n🧪 Testing YouTube API Connection...');
        console.log('API Key:', YOUTUBE_API_KEY);
        
        try {
            const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=test&type=video&maxResults=1&key=${YOUTUBE_API_KEY}`;
            console.log('Testing URL:', url.substring(0, url.lastIndexOf('key=')));
            
            const response = await fetch(url, {
                headers: {
                    'Referer': 'http://localhost'
                }
            });
            const data = await response.json();
            
            console.log('✅ API Response received');
            console.log('Status:', response.status);
            
            if (data.error) {
                console.error('❌ API Error:', data.error);
                alert(`API Error: ${data.error.code}\n${data.error.message}`);
            } else if (data.items) {
                console.log(`✅ Success! Found ${data.items.length} results`);
                alert(`✅ YouTube API is working! Found ${data.items.length} results`);
            } else {
                console.log('Response data:', data);
                alert('⚠️ Unexpected response format');
            }
        } catch (error) {
            console.error('❌ Connection Error:', error);
            alert(`Connection Error: ${error instanceof Error ? error.message : 'Unknown'}`);
        }
    }, []);

    // Debounced search with improved performance
    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchQuery.length > 1) {
                searchYouTube(searchQuery);
            } else if (searchQuery.length === 0) {
                setVideos(FALLBACK_VIDEOS);
                setHasSearched(false);
                setError(null);
            }
        }, 400); // Slightly faster debounce for better UX

        return () => clearTimeout(timer);
    }, [searchQuery, searchYouTube]);

    // Handle quick search suggestions
    const handleQuickSearch = (suggestion: string) => {
        setSearchQuery(suggestion);
    };

    // Expose diagnostic function to browser console for debugging
    useEffect(() => {
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
            (window as any).testYouTubeAPI = testYouTubeAPI;
            console.log('💡 Type window.testYouTubeAPI() in console to test YouTube API connection');
        }
    }, [testYouTubeAPI]);

    const onStateChange = useCallback((state: string) => {
        if (state === 'ended') {
            setPlaying(false);
        }
    }, []);

    const handlePlayVideo = (videoId: string) => {
        setSelectedVideo(videoId);
        setPlaying(true);
    };

    const handleClosePlayer = () => {
        setSelectedVideo(null);
        setPlaying(false);
    };

    // YouTube search already filters results, no additional filtering needed
    const displayVideos = videos;

    const renderItem = ({ item }: { item: YouTubeVideo }) => (
        <TouchableOpacity
            style={styles.card}
            onPress={() => handlePlayVideo(item.videoId)}
            activeOpacity={0.7}
        >
            <View style={styles.thumbnailContainer}>
                <Image
                    source={{ uri: item.thumbnail }}
                    style={styles.thumbnail}
                    resizeMode="cover"
                />
                <View style={styles.playOverlay}>
                    <View style={styles.playButton}>
                        <Play fill="#000" size={24} color="#000" style={{ marginLeft: 4 }} />
                    </View>
                </View>
                <View style={styles.durationBadge}>
                    <Text style={styles.durationText}>{item.duration}</Text>
                </View>
            </View>

            <View style={styles.cardContent}>
                <View style={styles.tagContainer}>
                    <Text style={styles.tagText}>{item.category.toUpperCase()}</Text>
                </View>
                <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
                <Text style={styles.cardAuthor}>{item.author}</Text>
            </View>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <FlatList
                data={displayVideos}
                renderItem={renderItem}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                scrollEnabled={true}
                ListHeaderComponent={
                    <View style={styles.headerContent}>
                        <Text style={styles.title}>{getTranslation(settings.language, 'videos.title')}</Text>
                        <Text style={styles.subtitle}>{getTranslation(settings.language, 'videos.subtitle')}</Text>

                        {/* Search Bar */}
                        <View style={styles.searchContainer}>
                            <Search color={COLORS.muted} size={20} />
                            <TextInput
                                style={styles.searchInput}
                                placeholder={getTranslation(settings.language, 'videos.search')}
                                placeholderTextColor={COLORS.muted}
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                editable={!loading}
                            />
                            {searchQuery.length > 0 && !loading && (
                                <TouchableOpacity onPress={() => {
                                    setSearchQuery('');
                                    setError(null);
                                }}>
                                    <X color={COLORS.muted} size={20} />
                                </TouchableOpacity>
                            )}
                            {loading && (
                                <ActivityIndicator size="small" color={COLORS.accent} />
                            )}
                        </View>

                        {/* Error Message */}
                        {error && (
                            <View style={styles.errorBanner}>
                                <Text style={styles.errorText}>{error}</Text>
                            </View>
                        )}

                        {/* Loading & Results Counter */}
                        {loading ? (
                            <View style={styles.resultsInfo}>
                                <ActivityIndicator color={COLORS.accent} />
                                <Text style={styles.resultsText}>
                                    {getTranslation(settings.language, 'videos.searching')}
                                </Text>
                            </View>
                        ) : hasSearched && !error ? (
                            <View style={styles.resultsInfo}>
                                <Text style={styles.resultsText}>
                                    ✨ {getTranslation(settings.language, 'videos.foundVideos', { 
                                        count: String(videos.length),
                                        plural: videos.length === 1 ? '' : 'े'
                                    })}
                                </Text>
                            </View>
                        ) : null}

                        {/* Quick Search Suggestions */}
                        {searchQuery.length === 0 && !hasSearched && (
                            <View style={styles.suggestionsContainer}>
                                <Text style={styles.suggestionsTitle}>
                                    {getTranslation(settings.language, 'videos.quickSearch')}
                                </Text>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                                    {SEARCH_SUGGESTIONS[settings.language as keyof typeof SEARCH_SUGGESTIONS]?.slice(0, 5).map((suggestion) => (
                                        <TouchableOpacity
                                            key={suggestion}
                                            onPress={() => handleQuickSearch(suggestion)}
                                            style={styles.suggestionChip}
                                        >
                                            <Text style={styles.suggestionChipText}>{suggestion}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        )}
                    </View>
                }
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>{getTranslation(settings.language, 'videos.noVideos')}</Text>
                        <Text style={styles.emptySubtext}>{getTranslation(settings.language, 'videos.tryDifferent')}</Text>
                    </View>
                }
            />

            {/* Video Player Modal */}
            <Modal
                visible={selectedVideo !== null}
                animationType="slide"
                transparent={true}
                onRequestClose={handleClosePlayer}
            >
                <View style={styles.modalContainer}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{getTranslation(settings.language, 'videos.nowPlaying')}</Text>
                            <TouchableOpacity
                                onPress={handleClosePlayer}
                                style={styles.closeButton}
                            >
                                <X color="#fff" size={24} />
                            </TouchableOpacity>
                        </View>

                        {selectedVideo && (
                            <YoutubePlayer
                                height={220}
                                width={SCREEN_WIDTH - 40}
                                play={playing}
                                videoId={selectedVideo}
                                onChangeState={onStateChange}
                            />
                        )}

                        <TouchableOpacity
                            style={styles.closeModalButton}
                            onPress={handleClosePlayer}
                        >
                            <Text style={styles.closeModalButtonText}>
                                {getTranslation(settings.language, 'videos.closePlayer')}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#121C1A',
    },
    headerContent: {
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 20,
        alignItems: 'center',
    },
    title: {
        fontSize: 32,
        color: COLORS.accent,
        fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
        marginBottom: 10,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    subtitle: {
        color: '#768783',
        textAlign: 'center',
        marginBottom: 15,
        fontSize: 14,
        letterSpacing: 1,
    },
    infoBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(197, 160, 89, 0.1)',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        marginBottom: 15,
        gap: 8,
    },
    infoText: {
        color: COLORS.accent,
        fontSize: 12,
        fontWeight: '500',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#111625',
        borderRadius: 12,
        paddingHorizontal: 15,
        paddingVertical: 12,
        width: '100%',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
        gap: 10,
    },
    searchInput: {
        flex: 1,
        color: COLORS.text,
        fontSize: 16,
    },
    resultsInfo: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        backgroundColor: 'rgba(212, 180, 131, 0.1)',
        marginBottom: 15,
        borderRadius: 8,
        borderLeftWidth: 3,
        borderLeftColor: COLORS.accent,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10
    },
    resultsText: {
        color: COLORS.accent,
        fontSize: 14,
        fontWeight: '600',
    },
    errorBanner: {
        paddingHorizontal: 15,
        paddingVertical: 12,
        backgroundColor: 'rgba(239, 68, 68, 0.15)',
        marginBottom: 15,
        borderRadius: 8,
        borderLeftWidth: 3,
        borderLeftColor: '#ef4444',
    },
    errorText: {
        color: '#fca5a5',
        fontSize: 13,
        fontWeight: '500',
    },
    suggestionsContainer: {
        paddingHorizontal: 15,
        paddingVertical: 12,
        marginBottom: 15,
        backgroundColor: 'rgba(100, 116, 139, 0.1)',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(148, 163, 184, 0.2)',
    },
    suggestionsTitle: {
        color: COLORS.accent,
        fontSize: 13,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    suggestionChip: {
        backgroundColor: 'rgba(212, 180, 131, 0.2)',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: COLORS.accent,
    },
    suggestionChipText: {
        color: COLORS.accent,
        fontSize: 12,
        fontWeight: '500',
    },
    listContent: {
        paddingHorizontal: 20,
        paddingTop: 0,
        paddingBottom: 100,
    },
    card: {
        backgroundColor: '#111625',
        borderRadius: 24,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
        overflow: 'hidden',
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    thumbnailContainer: {
        height: 200,
        width: '100%',
        position: 'relative',
        backgroundColor: '#1a1f2e',
    },
    thumbnail: {
        width: '100%',
        height: '100%',
    },
    playOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    playButton: {
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: COLORS.accent,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 5,
        shadowColor: COLORS.accent,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.5,
        shadowRadius: 4,
    },
    durationBadge: {
        position: 'absolute',
        bottom: 10,
        right: 10,
        backgroundColor: 'rgba(0,0,0,0.8)',
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 4,
    },
    durationText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold',
    },
    externalBadge: {
        position: 'absolute',
        top: 10,
        right: 10,
        backgroundColor: 'rgba(0,0,0,0.6)',
        padding: 6,
        borderRadius: 4,
    },
    cardContent: {
        padding: 20,
    },
    tagContainer: {
        backgroundColor: 'rgba(197, 160, 89, 0.1)',
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: 8,
        alignSelf: 'flex-start',
        marginBottom: 10,
    },
    tagText: {
        color: COLORS.accent,
        fontSize: 10,
        fontWeight: 'bold',
        letterSpacing: 0.5,
    },
    cardTitle: {
        fontSize: 18,
        color: '#e2e8f0',
        fontWeight: 'bold',
        marginBottom: 8,
        lineHeight: 24,
    },
    cardAuthor: {
        fontSize: 14,
        color: '#94a3b8',
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
    },
    emptyText: {
        color: COLORS.text,
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    emptySubtext: {
        color: COLORS.muted,
        fontSize: 14,
    },
    modalContainer: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        backgroundColor: '#111625',
        borderRadius: 20,
        padding: 20,
        width: SCREEN_WIDTH - 20,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
        marginBottom: 15,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: COLORS.accent,
    },
    closeButton: {
        padding: 8,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 20,
    },
    closeModalButton: {
        marginTop: 20,
        backgroundColor: COLORS.accent,
        paddingVertical: 12,
        paddingHorizontal: 30,
        borderRadius: 25,
    },
    closeModalButtonText: {
        color: '#000',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
