import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, Platform, TextInput, Modal, ActivityIndicator, useWindowDimensions } from 'react-native';
import { Play, X, Search } from 'lucide-react-native';
import YoutubePlayer from 'react-native-youtube-iframe';
import { COLORS, YOUTUBE_API_KEY, YOUTUBE_SEARCH_URL } from '../constants';
import { Config } from '../config';
import { UserSettings } from '../src/types';
import { getTranslation } from '../translations';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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

// Client-side search helper — matches query against all video metadata
const searchLocalVideos = (query: string, videos: YouTubeVideo[]): YouTubeVideo[] => {
    const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 0);
    if (terms.length === 0) return videos;

    return videos.filter(video => {
        const searchable = [
            video.title,
            video.author,
            video.category,
            ...(video.mood || []),
            ...(video.benefits || [])
        ].join(' ').toLowerCase();

        return terms.every(term => searchable.includes(term));
    });
};

// Curated video library — used for instant client-side search (no API needed)
const CURATED_VIDEOS: YouTubeVideo[] = [
    { id: '1', title: 'Relaxing Flute Music for Meditation', duration: '1:00:00', thumbnail: 'https://img.youtube.com/vi/lTRiuFIWV54/hqdefault.jpg', videoId: 'lTRiuFIWV54', author: 'Soothing Relaxation', category: 'Music', mood: ['calm', 'focus', 'meditation', 'flute'], benefits: ['relaxation', 'concentration', 'inner peace'] },
    { id: '2', title: 'Guided Meditation for Inner Peace', duration: '20:00', thumbnail: 'https://img.youtube.com/vi/z6X5oEIg6Ak/hqdefault.jpg', videoId: 'z6X5oEIg6Ak', author: 'Great Meditation', category: 'Guided', mood: ['peaceful', 'spiritual', 'grounded', 'guided'], benefits: ['inner peace', 'spiritual growth', 'anxiety relief'] },
    { id: '3', title: 'Om Meditation - Deep Relaxation', duration: '30:00', thumbnail: 'https://img.youtube.com/vi/ZToicYcHIOU/hqdefault.jpg', videoId: 'ZToicYcHIOU', author: 'Meditation Music', category: 'Mantra', mood: ['spiritual', 'meditative', 'deep', 'om', 'mantra'], benefits: ['vibration healing', 'chakra balancing', 'spiritual connection'] },
    { id: '4', title: 'Stress Relief Meditation Music', duration: '25:00', thumbnail: 'https://img.youtube.com/vi/SEfs5TJZ6Nk/hqdefault.jpg', videoId: 'SEfs5TJZ6Nk', author: 'Goodful', category: 'Relief', mood: ['stressed', 'anxious', 'overwhelmed', 'stress'], benefits: ['stress relief', 'relaxation', 'tension release'] },
    { id: '5', title: '5-Minute Meditation You Can Do Anywhere', duration: '5:36', thumbnail: 'https://img.youtube.com/vi/inpok4MKVLM/hqdefault.jpg', videoId: 'inpok4MKVLM', author: 'Goodful', category: 'Guided', mood: ['energized', 'positive', 'motivated', 'morning', 'quick'], benefits: ['energy boost', 'positivity', 'motivation', 'morning routine'] },
    { id: '6', title: 'Deep Sleep Meditation Music - Relaxing Music', duration: '3:00:00', thumbnail: 'https://img.youtube.com/vi/aEklYoWSGUE/hqdefault.jpg', videoId: 'aEklYoWSGUE', author: 'Yellow Brick Cinema', category: 'Sleep', mood: ['sleepy', 'tired', 'restful', 'sleep', 'night', 'insomnia'], benefits: ['sleep', 'insomnia relief', 'deep rest', 'recovery'] },
    { id: '7', title: 'Anxiety Relief - 10 Minute Guided Meditation', duration: '10:13', thumbnail: 'https://img.youtube.com/vi/O-6f5wQXSu8/hqdefault.jpg', videoId: 'O-6f5wQXSu8', author: 'The Mindful Movement', category: 'Relief', mood: ['anxious', 'worried', 'nervous', 'anxiety', 'panic'], benefits: ['anxiety relief', 'panic relief', 'calm', 'mindfulness'] },
    { id: '9', title: 'Bhagavad Gita Recitation - Complete', duration: '1:30:00', thumbnail: 'https://img.youtube.com/vi/C6luJJWSJKk/hqdefault.jpg', videoId: 'C6luJJWSJKk', author: 'Spiritual India', category: 'Gita', mood: ['spiritual', 'learning', 'wisdom', 'gita', 'bhagavad', 'krishna'], benefits: ['spiritual wisdom', 'life guidance', 'dharma'] },
    { id: '10', title: 'Healing Meditation Music - 432Hz', duration: '30:00', thumbnail: 'https://img.youtube.com/vi/1ZYbU82GVz4/hqdefault.jpg', videoId: '1ZYbU82GVz4', author: 'Meditation & Healing', category: 'Healing', mood: ['healing', 'recovery', 'renewal', '432hz'], benefits: ['healing', 'recovery', 'emotional release', 'restoration'] },
    { id: '11', title: 'Yoga For Complete Beginners - 20 Minute Home Yoga', duration: '23:06', thumbnail: 'https://img.youtube.com/vi/v7AYKMP6rOE/hqdefault.jpg', videoId: 'v7AYKMP6rOE', author: 'Yoga With Adriene', category: 'Yoga', mood: ['yoga', 'beginner', 'fitness', 'morning', 'stretch'], benefits: ['flexibility', 'strength', 'body awareness'] },
    { id: '12', title: 'Yoga for Stress Relief and Relaxation', duration: '28:00', thumbnail: 'https://img.youtube.com/vi/hJbRpHZr_d0/hqdefault.jpg', videoId: 'hJbRpHZr_d0', author: 'Yoga With Adriene', category: 'Yoga', mood: ['yoga', 'stress', 'relaxation', 'gentle'], benefits: ['stress relief', 'flexibility', 'calm'] },
    { id: '13', title: 'Krishna Flute Music - Divine Meditation', duration: '1:00:00', thumbnail: 'https://img.youtube.com/vi/0wErKgYOGW0/hqdefault.jpg', videoId: '0wErKgYOGW0', author: 'Meditation & Healing', category: 'Bhajan', mood: ['krishna', 'flute', 'divine', 'devotion', 'bhajan', 'spiritual'], benefits: ['devotion', 'peace', 'spiritual connection'] },
    { id: '14', title: 'Hare Krishna Maha Mantra - Beautiful Bhajan', duration: '45:00', thumbnail: 'https://img.youtube.com/vi/anPvEqaFVzA/hqdefault.jpg', videoId: 'anPvEqaFVzA', author: 'Madhavas Rock Band', category: 'Bhajan', mood: ['krishna', 'bhajan', 'mantra', 'hare', 'devotional', 'kirtan'], benefits: ['devotion', 'joy', 'spiritual uplift'] },
    { id: '15', title: 'Chakra Healing Meditation - Balance All 7 Chakras', duration: '35:00', thumbnail: 'https://img.youtube.com/vi/VFNuG-gKJSc/hqdefault.jpg', videoId: 'VFNuG-gKJSc', author: 'PowerThoughts Meditation', category: 'Healing', mood: ['chakra', 'healing', 'energy', 'balance', 'kundalini'], benefits: ['chakra balancing', 'energy healing', 'spiritual growth'] },
    { id: '16', title: 'Guided Sleep Meditation - Let Go of Anxiety', duration: '47:00', thumbnail: 'https://img.youtube.com/vi/aEqlQvczMJQ/hqdefault.jpg', videoId: 'aEqlQvczMJQ', author: 'Michael Sealey', category: 'Sleep', mood: ['sleep', 'anxiety', 'guided', 'night', 'insomnia', 'restful'], benefits: ['sleep', 'anxiety relief', 'relaxation'] },
    { id: '17', title: 'Pranayama Breathing Exercises for Beginners', duration: '15:00', thumbnail: 'https://img.youtube.com/vi/Yz7Ofr9z1co/hqdefault.jpg', videoId: 'Yz7Ofr9z1co', author: 'Yoga With Adriene', category: 'Yoga', mood: ['pranayama', 'breathing', 'yoga', 'beginner', 'breath'], benefits: ['breath control', 'calm', 'lung capacity'] },
    { id: '18', title: 'Gayatri Mantra 108 Times', duration: '54:00', thumbnail: 'https://img.youtube.com/vi/HszFeCNuc1I/hqdefault.jpg', videoId: 'HszFeCNuc1I', author: 'Sounds of Isha', category: 'Mantra', mood: ['gayatri', 'mantra', 'chanting', 'spiritual', 'vedic', 'prayer'], benefits: ['spiritual power', 'focus', 'purification'] },
    { id: '19', title: 'Mindfulness Meditation - Being Present', duration: '10:00', thumbnail: 'https://img.youtube.com/vi/ZToicYcHIOU/hqdefault.jpg', videoId: 'ZToicYcHIOU', author: 'Headspace', category: 'Guided', mood: ['mindfulness', 'present', 'awareness', 'focus', 'calm'], benefits: ['mindfulness', 'presence', 'mental clarity'] },
    { id: '20', title: 'Hanuman Chalisa - Full with Lyrics', duration: '10:00', thumbnail: 'https://img.youtube.com/vi/AETFvQonfV8/hqdefault.jpg', videoId: 'AETFvQonfV8', author: 'T-Series Bhakti Sagar', category: 'Bhajan', mood: ['hanuman', 'chalisa', 'bhajan', 'devotional', 'prayer', 'strength'], benefits: ['courage', 'devotion', 'protection'] },
    { id: '21', title: 'Body Scan Meditation for Deep Relaxation', duration: '20:00', thumbnail: 'https://img.youtube.com/vi/O-6f5wQXSu8/hqdefault.jpg', videoId: 'O-6f5wQXSu8', author: 'The Mindful Movement', category: 'Guided', mood: ['body scan', 'relaxation', 'guided', 'deep', 'calm'], benefits: ['deep relaxation', 'body awareness', 'tension release'] },
    { id: '22', title: 'Rain Sounds for Sleep and Relaxation', duration: '3:00:00', thumbnail: 'https://img.youtube.com/vi/mPZkdNFkNps/hqdefault.jpg', videoId: 'mPZkdNFkNps', author: 'Relaxing White Noise', category: 'Nature', mood: ['rain', 'sleep', 'nature', 'white noise', 'relax'], benefits: ['sleep', 'focus', 'relaxation'] },
    { id: '23', title: 'Surya Namaskar - Sun Salutation Step by Step', duration: '12:00', thumbnail: 'https://img.youtube.com/vi/73sjOu0g58M/hqdefault.jpg', videoId: '73sjOu0g58M', author: 'Yoga With Adriene', category: 'Yoga', mood: ['yoga', 'surya namaskar', 'morning', 'sun', 'fitness', 'stretch'], benefits: ['full body workout', 'flexibility', 'energy'] },
    { id: '24', title: 'Shiva Tandava Stotram - Powerful Mantra', duration: '8:00', thumbnail: 'https://img.youtube.com/vi/JCVxiU9MRGA/hqdefault.jpg', videoId: 'JCVxiU9MRGA', author: 'Uma Mohan', category: 'Mantra', mood: ['shiva', 'mantra', 'powerful', 'devotional', 'tandava'], benefits: ['inner strength', 'devotion', 'spiritual power'] },
    { id: '25', title: 'Focus Music for Work and Studying', duration: '1:00:00', thumbnail: 'https://img.youtube.com/vi/1ZYbU82GVz4/hqdefault.jpg', videoId: '1ZYbU82GVz4', author: 'Greenred Productions', category: 'Music', mood: ['focus', 'study', 'work', 'concentration', 'productivity'], benefits: ['concentration', 'productivity', 'mental clarity'] },
    { id: '26', title: 'Evening Meditation - Release the Day', duration: '18:00', thumbnail: 'https://img.youtube.com/vi/aEqlQvczMJQ/hqdefault.jpg', videoId: 'aEqlQvczMJQ', author: 'The Honest Guys', category: 'Guided', mood: ['evening', 'night', 'release', 'unwind', 'calm'], benefits: ['letting go', 'evening routine', 'peace'] },
    { id: '27', title: 'Om Namah Shivaya Chanting - 1 Hour', duration: '1:00:00', thumbnail: 'https://img.youtube.com/vi/VFNuG-gKJSc/hqdefault.jpg', videoId: 'VFNuG-gKJSc', author: 'Meditative Mind', category: 'Mantra', mood: ['om', 'shiva', 'chanting', 'mantra', 'devotional'], benefits: ['purification', 'devotion', 'inner peace'] },
    { id: '28', title: 'Yoga Nidra - Guided Deep Relaxation', duration: '25:00', thumbnail: 'https://img.youtube.com/vi/z6X5oEIg6Ak/hqdefault.jpg', videoId: 'z6X5oEIg6Ak', author: 'Yoga With Kassandra', category: 'Yoga', mood: ['yoga nidra', 'relaxation', 'deep', 'guided', 'sleep'], benefits: ['deep rest', 'rejuvenation', 'stress relief'] },
    { id: '29', title: 'Depression Help - Guided Meditation', duration: '15:00', thumbnail: 'https://img.youtube.com/vi/O-6f5wQXSu8/hqdefault.jpg', videoId: 'O-6f5wQXSu8', author: 'The Mindful Movement', category: 'Relief', mood: ['depression', 'sad', 'low', 'hope', 'healing'], benefits: ['mood lift', 'hope', 'emotional healing'] },
    { id: '30', title: 'Tibetan Singing Bowls - Meditation Music', duration: '1:00:00', thumbnail: 'https://img.youtube.com/vi/aEklYoWSGUE/hqdefault.jpg', videoId: 'aEklYoWSGUE', author: 'Nu Meditation Music', category: 'Music', mood: ['tibetan', 'singing bowl', 'healing', 'meditation', 'calm'], benefits: ['sound healing', 'deep meditation', 'relaxation'] },
];

// (YouTubeVideo interface moved above CURATED_VIDEOS)

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
    const { width: SCREEN_WIDTH } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
    const [playing, setPlaying] = useState(false);
    const [videos, setVideos] = useState<YouTubeVideo[]>(CURATED_VIDEOS);
    const [loading, setLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Calculate responsive thumbnail height based on screen width
    // aiming for ~16:9 aspect ratio with some padding
    const THUMBNAIL_HEIGHT = Math.round(SCREEN_WIDTH * 9 / 16);

    // Calculate card margin based on screen width for better spacing
    const CARD_MARGIN = Math.round(SCREEN_WIDTH * 0.04);

    // YouTube Search API integration — prioritizes local curated videos first for offline support and speed
    const searchYouTube = useCallback(async (query: string) => {
        console.log(`🔍 [Videos v2] searchYouTube called with query: "${query}"`);
        if (!query.trim()) {
            setVideos(CURATED_VIDEOS);
            setHasSearched(false);
            setError(null);
            return;
        }

        setLoading(true);
        setHasSearched(true);
        setError(null);

        try {
            // 1. Try local search first (instant, no API needed)
            const localResults = searchLocalVideos(query, CURATED_VIDEOS);

            // Keep the experience useful offline. If the curated library has
            // matches, do not make the user wait for remote providers.
            if (localResults.length > 0) {
                setVideos(localResults);
                setLoading(false);
                return;
            }

            // Add context to search for better spiritual/wellness results
            const enhancedQuery = query.includes('meditation') || query.includes('yoga') || query.includes('spiritual')
                ? query
                : `${query} meditation wellness`;

            console.log('📍 YouTube Search Query:', enhancedQuery);

            let data: any = null;
            let ytVideos: YouTubeVideo[] = [];

            // 2. Strategy 1: Try the backend proxy (more reliable on mobile, keeps API key server-side)
            const backendUrl = Config.BACKEND_URL;
            if (backendUrl) {
                try {
                    const proxyParams = new URLSearchParams({
                        q: enhancedQuery,
                        maxResults: '12',
                        language: settings.language === 'hi' ? 'hi' : 'en'
                    });
                    const proxyUrl = `${backendUrl}/api/youtube/search?${proxyParams.toString()}`;
                    console.log('🔗 Trying backend proxy:', proxyUrl);

                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 8000);

                    const proxyResponse = await fetch(proxyUrl, {
                        signal: controller.signal,
                    });
                    clearTimeout(timeoutId);

                    if (proxyResponse.ok) {
                        const proxyData = await proxyResponse.json();
                        if (proxyData.videos && proxyData.videos.length > 0) {
                            ytVideos = proxyData.videos.map((v: any) => ({
                                id: v.id,
                                title: v.title || 'Untitled',
                                duration: '▶ Video',
                                thumbnail: v.thumbnail || 'https://via.placeholder.com/320x180?text=No+Image',
                                videoId: v.id,
                                author: v.channelTitle || 'Unknown Channel',
                                category: 'YOUTUBE',
                                mood: [],
                                benefits: []
                            }));
                        }
                    } else {
                        console.warn('⚠️ Backend proxy returned:', proxyResponse.status);
                    }
                } catch (proxyError) {
                    console.warn('⚠️ Backend proxy unavailable, trying direct API:', proxyError);
                }
            }

            // 3. Strategy 2: Fall back to direct YouTube API call if backend failed and we have no local results
            if (ytVideos.length === 0 && YOUTUBE_API_KEY && YOUTUBE_API_KEY !== 'YOUR_YOUTUBE_API_KEY_HERE') {
                try {
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
                    console.log('🔗 Trying direct YouTube API');

                    const response = await fetch(url);
                    const apiData = await response.json();

                    if (response.ok && apiData?.items?.length > 0) {
                        ytVideos = apiData.items.map((item: any) => {
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
                    } else if (!response.ok) {
                        console.warn('⚠️ Direct API returned error:', apiData.error?.message || response.status);
                    }
                } catch (directError) {
                    console.warn('⚠️ Direct API failed:', directError);
                }
            }

            // 4. Strategy 3: Public Invidious API (No API key, No Local Backend needed!)
            // This guarantees search works even if quota is exceeded AND windows firewall blocks backend
            if (ytVideos.length === 0) {
                try {
                    console.log('🔗 Trying Invidious public proxy as ultimate fallback...');
                    const invidiousUrl = `https://vid.puffyan.us/api/v1/search?q=${encodeURIComponent(enhancedQuery)}`;
                    const response = await fetch(invidiousUrl);
                    if (response.ok) {
                        const invidiousData = await response.json();
                        ytVideos = invidiousData.filter((v: any) => v.type === 'video').map((v: any) => ({
                            id: v.videoId,
                            title: v.title || 'Untitled',
                            duration: '▶ Video',
                            thumbnail: v.videoThumbnails?.find((t: any) => t.quality === 'high')?.url ||
                                      v.videoThumbnails?.[0]?.url ||
                                      `https://img.youtube.com/vi/${v.videoId}/hqdefault.jpg`,
                            videoId: v.videoId,
                            author: v.author || 'Unknown Channel',
                            category: 'YOUTUBE',
                            mood: [],
                            benefits: []
                        })).slice(0, 12);
                        console.log(`✅ Found ${ytVideos.length} videos via Invidious proxy`);
                    }
                } catch (invidiousError) {
                    console.warn('⚠️ Invidious fallback failed:', invidiousError);
                }
            }

            // 4. Combine results (local first, then API)
            const combinedResults = [...localResults];

            // Add unique YouTube results
            ytVideos.forEach(ytVid => {
                if (!combinedResults.some(localVid => localVid.videoId === ytVid.videoId)) {
                    combinedResults.push(ytVid);
                }
            });

            if (combinedResults.length > 0) {
                setVideos(combinedResults);
                console.log(`✅ Found ${combinedResults.length} videos total`);
            } else {
                const noResultsMsg = getTranslation(settings.language, 'videos.noResults', { query: query });
                setError(noResultsMsg);
                setVideos(CURATED_VIDEOS);
            }
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            console.error('❌ YouTube Search Error:', errorMsg);

            // Always fallback to local search if available, even on error
            const localResults = searchLocalVideos(query, CURATED_VIDEOS);
            if (localResults.length > 0) {
                setVideos(localResults);
            } else {
                // Show the specific error if it's an API error, otherwise show generic connection error
                if (errorMsg.includes('YouTube API Error') || errorMsg.includes('API Error')) {
                    setError(`Error: ${errorMsg}`);
                } else {
                    setError(getTranslation(settings.language, 'errors.connection'));
                }
                setVideos(CURATED_VIDEOS);
            }
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
                setVideos(CURATED_VIDEOS);
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
            <View style={{ ...styles.thumbnailContainer, height: THUMBNAIL_HEIGHT }}>
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
                contentContainerStyle={{ ...styles.listContent, paddingBottom: SCREEN_WIDTH > 360 ? 100 : Math.round(SCREEN_WIDTH * 0.25) }}
                showsVerticalScrollIndicator={false}
                scrollEnabled={true}
                ListHeaderComponent={
                    <View style={[styles.headerContent, { paddingTop: Math.max(insets.top + 12, 24) }]}>
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
                    <View style={[styles.modalContent, { width: Math.max(280, SCREEN_WIDTH - 20) }]}>
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
                            <View style={{ width: Math.max(240, Math.min(SCREEN_WIDTH - 32, 640)), height: Math.min(300, Math.max(200, SCREEN_WIDTH * 0.5625)), borderRadius: 12, overflow: 'hidden', backgroundColor: '#000' }}>
                                <YoutubePlayer
                                    height={Math.min(300, Math.max(200, SCREEN_WIDTH * 0.5625))}
                                    width={Math.max(240, Math.min(SCREEN_WIDTH - 32, 640))}
                                    videoId={selectedVideo}
                                    play={playing}
                                    onChangeState={onStateChange}
                                    onError={(playerError: string) => setError(`YouTube player error: ${playerError}`)}
                                    forceAndroidAutoplay
                                    initialPlayerParams={{
                                        controls: true,
                                        rel: false,
                                        preventFullScreen: false,
                                    }}
                                />
                            </View>
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
        ...StyleSheet.absoluteFill,
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
