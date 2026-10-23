import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ActivityIndicator, TouchableOpacity, Text, Modal, Platform, PermissionsAndroid, Alert, FlatList, ListRenderItem } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Mic, MicOff, Video as VideoIcon, VideoOff } from 'lucide-react-native';
import { AudioSession, LiveKitRoom, TrackReferenceOrPlaceholder, VideoTrack, isTrackReference, useLocalParticipant, useTracks } from '@livekit/react-native';
import { Track } from 'livekit-client';
import { useTheme } from '../context/ThemeContext';
import { Config } from '../config';
import { getIdToken } from '../services/firebase';

interface VideoRoomProps {
    roomName: string;
    visible: boolean;
    onClose: () => void;
    userInfo?: {
        displayName?: string;
        email?: string;
        avatar?: string;
    };
    /** Optional: name of the friend for 1-on-1 calls */
    friendName?: string;
}

// Sanitize room name: only lowercase alphanumeric and hyphens, max 30 chars
function sanitizeRoomName(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .slice(0, 30) || 'dharmaroom';
}

type JoinInfo = { token: string; url: string };

// Inside LiveKitRoom: participant grid plus mic/camera toggles
const CallView: React.FC<{ onLeave: () => void }> = ({ onLeave }) => {
    const { theme } = useTheme();
    const tracks = useTracks([Track.Source.Camera]);
    const { localParticipant, isMicrophoneEnabled, isCameraEnabled } = useLocalParticipant();

    React.useEffect(() => {
        let active = true;
        void Promise.all([
            localParticipant.setMicrophoneEnabled(true),
            localParticipant.setCameraEnabled(true),
        ]).catch((mediaError) => {
            if (active) {
                console.warn('LiveKit media could not start:', mediaError);
            }
        });
        return () => {
            active = false;
        };
    }, [localParticipant]);

    const renderTrack: ListRenderItem<TrackReferenceOrPlaceholder> = ({ item }) => {
        if (isTrackReference(item)) {
            return <VideoTrack trackRef={item} style={styles.participantView} />;
        }
        return <View style={styles.participantView} />;
    };

    return (
        <View style={styles.callContainer}>
            <FlatList
                data={tracks}
                keyExtractor={(item) => `${item.participant.identity}-${item.source}`}
                renderItem={renderTrack}
                style={{ flex: 1 }}
            />
            <View style={[styles.controls, { borderTopColor: theme.colors.border }]}>
                <TouchableOpacity
                    onPress={() => localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)}
                    style={[styles.controlButton, { backgroundColor: isMicrophoneEnabled ? 'rgba(255,255,255,0.15)' : '#ef4444' }]}
                >
                    {isMicrophoneEnabled ? <Mic color="#fff" size={22} /> : <MicOff color="#fff" size={22} />}
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => localParticipant.setCameraEnabled(!isCameraEnabled)}
                    style={[styles.controlButton, { backgroundColor: isCameraEnabled ? 'rgba(255,255,255,0.15)' : '#ef4444' }]}
                >
                    {isCameraEnabled ? <VideoIcon color="#fff" size={22} /> : <VideoOff color="#fff" size={22} />}
                </TouchableOpacity>
                <TouchableOpacity onPress={onLeave} style={[styles.controlButton, { backgroundColor: '#ef4444' }]}>
                    <X color="#fff" size={22} />
                </TouchableOpacity>
            </View>
        </View>
    );
};

export const VideoRoomCore: React.FC<VideoRoomProps> = ({ roomName, visible, onClose, userInfo, friendName }) => {
    const { theme } = useTheme();
    const [permissionGranted, setPermissionGranted] = useState(false);
    const [joinInfo, setJoinInfo] = useState<JoinInfo | null>(null);
    const [error, setError] = useState<string | null>(null);

    const displayName = userInfo?.displayName || 'Friend';
    const cleanRoom = sanitizeRoomName(roomName);

    // Request Android permissions before joining
    const requestPermissions = useCallback(async () => {
        if (Platform.OS === 'android') {
            try {
                const grants = await PermissionsAndroid.requestMultiple([
                    PermissionsAndroid.PERMISSIONS.CAMERA,
                    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
                ]);
                const cameraOk = grants[PermissionsAndroid.PERMISSIONS.CAMERA] === PermissionsAndroid.RESULTS.GRANTED;
                const audioOk = grants[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === PermissionsAndroid.RESULTS.GRANTED;
                if (!cameraOk || !audioOk) {
                    Alert.alert(
                        'Permissions Required',
                        'Camera and microphone access are needed for video calls. Please grant them in Settings.',
                        [{ text: 'OK' }]
                    );
                }
                setPermissionGranted(cameraOk && audioOk);
            } catch (err) {
                console.warn('Permission request error:', err);
                setPermissionGranted(true);
            }
        } else {
            // iOS prompts for permissions automatically when the room connects
            setPermissionGranted(true);
        }
    }, []);

    // Ask the backend for a room token. The LiveKit API secret stays on the server.
    const fetchToken = useCallback(async () => {
        setError(null);
        setJoinInfo(null);
        try {
            const token = await getIdToken();
            if (!token) throw new Error('You must be signed in to start a video call.');
            const res = await fetch(`${Config.BACKEND_URL}/api/livekit/token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ roomName: cleanRoom, name: displayName }),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            if (!data.token || !data.url) throw new Error('Missing token');
            setJoinInfo({ token: data.token, url: data.url });
        } catch (err) {
            console.warn('LiveKit token error:', err);
            setError('Could not start the call. Check your connection and try again.');
        }
    }, [cleanRoom, displayName]);

    // Request permissions on modal show, then fetch the room token
    React.useEffect(() => {
        if (visible) {
            requestPermissions();
        } else {
            setPermissionGranted(false);
            setJoinInfo(null);
            setError(null);
        }
    }, [visible, requestPermissions]);

    // Only auto-join once per open; "Try again" handles retries
    React.useEffect(() => {
        if (visible && permissionGranted) {
            fetchToken();
        }
    }, [visible, permissionGranted, fetchToken]);

    // Native audio session only while the call is on screen
    React.useEffect(() => {
        if (!joinInfo) return;
        let active = true;
        void AudioSession.startAudioSession().catch((audioError) => {
            if (active) {
                console.warn('LiveKit audio session could not start:', audioError);
            }
        });
        return () => {
            active = false;
            void AudioSession.stopAudioSession().catch((audioError) => {
                console.warn('LiveKit audio session could not stop:', audioError);
            });
        };
    }, [joinInfo]);

    const headerTitle = friendName ? `Call: ${friendName}` : 'Community Circle';

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={false}
            onRequestClose={onClose}
        >
            <SafeAreaView style={[styles.container, { backgroundColor: '#000' }]}>
                <View style={[styles.header, { backgroundColor: theme.colors.surfaceHighlight, borderBottomColor: theme.colors.border }]}>
                    <View style={styles.headerLeft}>
                        <View style={[styles.liveIndicator, { backgroundColor: 'rgba(74, 222, 128, 0.2)' }]}>
                            <View style={styles.liveDot} />
                            <Text style={styles.liveText}>LIVE</Text>
                        </View>
                        <Text style={[styles.title, { color: theme.colors.text }]} numberOfLines={1}>{headerTitle}</Text>
                    </View>
                    <TouchableOpacity onPress={onClose} style={[styles.closeButton, { backgroundColor: 'rgba(239,68,68,0.15)' }]}>
                        <X color="#ef4444" size={20} />
                        <Text style={styles.closeText}>Leave</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.webContainer}>
                    {error ? (
                        <View style={styles.loading}>
                            <Text style={[styles.loadingText, { color: theme.colors.text }]}>{error}</Text>
                            <TouchableOpacity
                                onPress={fetchToken}
                                style={[styles.retryButton, { borderColor: theme.colors.accent }]}
                            >
                                <Text style={[styles.loadingSubtext, { color: theme.colors.accent }]}>Try again</Text>
                            </TouchableOpacity>
                        </View>
                    ) : joinInfo ? (
                        <LiveKitRoom
                            serverUrl={joinInfo.url}
                            token={joinInfo.token}
                            connect={true}
                            audio={false}
                            video={false}
                            onDisconnected={onClose}
                            onError={(e) => {
                                console.warn('LiveKit error:', e);
                                setError('The call dropped. Check your connection and try again.');
                                setJoinInfo(null);
                            }}
                        >
                            <CallView onLeave={onClose} />
                        </LiveKitRoom>
                    ) : (
                        <View style={styles.loading}>
                            <ActivityIndicator size="large" color={theme.colors.accent} />
                            <Text style={[styles.loadingText, { color: theme.colors.text }]}>
                                {permissionGranted
                                    ? (friendName ? `Connecting call with ${friendName}...` : 'Connecting to Dharma Circle...')
                                    : 'Requesting camera & mic access...'}
                            </Text>
                            {permissionGranted && (
                                <Text style={[styles.loadingSubtext, { color: theme.colors.muted }]}>
                                    Please allow camera & microphone when prompted
                                </Text>
                            )}
                        </View>
                    )}
                </View>
            </SafeAreaView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        height: 60,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        borderBottomWidth: 1,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        gap: 10,
    },
    liveIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 12,
        gap: 5,
    },
    liveDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#4ade80',
    },
    liveText: {
        color: '#4ade80',
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 1,
    },
    title: {
        fontSize: 16,
        fontWeight: '600',
        flex: 1,
    },
    closeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 20,
        gap: 6,
    },
    closeText: {
        color: '#ef4444',
        fontWeight: '600',
        fontSize: 14,
    },
    webContainer: {
        flex: 1,
        backgroundColor: '#000',
    },
    callContainer: {
        flex: 1,
    },
    participantView: {
        height: 300,
    },
    controls: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 20,
        paddingVertical: 16,
        borderTopWidth: 1,
    },
    controlButton: {
        width: 52,
        height: 52,
        borderRadius: 26,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loading: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#000',
        padding: 24,
    },
    loadingText: {
        marginTop: 15,
        fontSize: 16,
        fontWeight: '500',
        textAlign: 'center',
    },
    loadingSubtext: {
        marginTop: 8,
        fontSize: 13,
    },
    retryButton: {
        marginTop: 16,
        borderWidth: 1,
        borderRadius: 20,
        paddingVertical: 8,
        paddingHorizontal: 16,
    },
});
