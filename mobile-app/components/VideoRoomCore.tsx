import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, StyleSheet, ActivityIndicator, TouchableOpacity, Text, Modal, Platform, PermissionsAndroid, Linking, FlatList, ListRenderItem } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Mic, MicOff, Video as VideoIcon, VideoOff } from 'lucide-react-native';
import {
    Constants,
    MediaStream,
    RoomProvider,
    RTCView,
    useParticipant,
    useRoom,
} from '@videosdk.live/react-native-sdk';
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

// Shape returned by POST /api/video/token on the backend
type JoinInfo = {
    token: string;
    roomId: string;
    participantName: string;
};

// Sanitize room name: only lowercase alphanumeric, max 30 chars
function sanitizeRoomName(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .slice(0, 30) || 'dharmaroom';
}

// Turns VideoSDK error codes into messages a user can act on. Raw codes go to the console only.
function describeCallError(code: number | undefined): string {
    const errors = Constants.VideoSDKError;
    switch (code) {
        case errors.INVALID_API_KEY:
        case errors.ACCOUNT_DEACTIVATED:
        case errors.ACCOUNT_DISCONTINUED:
            return 'Video calling is not set up correctly yet. Please try again later.';
        case errors.INVALID_TOKEN:
            return 'Your call session has expired. Tap "Try again" to rejoin.';
        case errors.DUPLICATE_PARTICIPANT:
            return 'You are already in this call on another device.';
        default:
            return `The call could not start (code ${code ?? 'unknown'}). Check your connection and try again.`;
    }
}

// One video tile. Shows the camera when it is on, otherwise the participant's name.
const ParticipantTile: React.FC<{ participantId: string; isLocal: boolean }> = ({ participantId, isLocal }) => {
    const { webcamStream, webcamOn, displayName } = useParticipant(participantId);

    if (!webcamOn || !webcamStream) {
        return (
            <View style={[styles.participantView, styles.cameraOff]}>
                <Text style={styles.cameraOffText}>{displayName || 'Camera off'}</Text>
            </View>
        );
    }
    return (
        <RTCView
            streamURL={new MediaStream([webcamStream.track]).toURL()}
            objectFit="cover"
            setMirror={isLocal}
            style={styles.participantView}
        />
    );
};

// Lives inside RoomProvider. Mic and camera start off and are turned on by the user.
const CallView: React.FC<{
    onLeave: () => void;
    onFailed: (message: string) => void;
}> = ({ onLeave, onFailed }) => {
    const { theme } = useTheme();
    const [joined, setJoined] = useState(false);
    const [micOn, setMicOn] = useState(false);
    const [camOn, setCamOn] = useState(false);

    const onFailedRef = useRef(onFailed);
    onFailedRef.current = onFailed;

    const { leave, toggleMic, toggleCam, participants, localParticipant } = useRoom({
        onRoomJoined: () => setJoined(true),
        onError: (error) => {
            console.warn('VideoSDK error:', error?.code, error?.message);
            onFailedRef.current(describeCallError(error?.code));
        },
    });

    // Leave the room if this screen goes away without the Leave button (e.g. Android back)
    const leaveRef = useRef(leave);
    leaveRef.current = leave;
    useEffect(() => {
        return () => {
            leaveRef.current().catch(() => undefined);
        };
    }, []);

    const handleLeave = () => {
        leave().catch(() => undefined).finally(onLeave);
    };

    const handleToggleMic = async () => {
        try {
            await toggleMic();
            setMicOn((on) => !on);
        } catch (error) {
            console.warn('Microphone could not change:', error);
        }
    };

    const handleToggleCam = async () => {
        try {
            await toggleCam();
            setCamOn((on) => !on);
        } catch (error) {
            console.warn('Camera could not change:', error);
        }
    };

    const localId = localParticipant?.id;
    const tileIds = joined && localId ? [localId, ...Array.from(participants.keys())] : [];

    const renderTile: ListRenderItem<string> = ({ item }) => (
        <ParticipantTile participantId={item} isLocal={item === localId} />
    );

    return (
        <View style={styles.callContainer}>
            <FlatList
                data={tileIds}
                keyExtractor={(id) => id}
                renderItem={renderTile}
                style={{ flex: 1 }}
            />
            <View style={[styles.controls, { borderTopColor: theme.colors.border }]}>
                <TouchableOpacity
                    onPress={handleToggleMic}
                    style={[styles.controlButton, { backgroundColor: micOn ? 'rgba(255,255,255,0.15)' : '#ef4444' }]}
                >
                    {micOn ? <Mic color="#fff" size={22} /> : <MicOff color="#fff" size={22} />}
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={handleToggleCam}
                    style={[styles.controlButton, { backgroundColor: camOn ? 'rgba(255,255,255,0.15)' : '#ef4444' }]}
                >
                    {camOn ? <VideoIcon color="#fff" size={22} /> : <VideoOff color="#fff" size={22} />}
                </TouchableOpacity>
                <TouchableOpacity onPress={handleLeave} style={[styles.controlButton, { backgroundColor: '#ef4444' }]}>
                    <X color="#fff" size={22} />
                </TouchableOpacity>
            </View>
        </View>
    );
};

export const VideoRoomCore: React.FC<VideoRoomProps> = ({ roomName, visible, onClose, userInfo, friendName }) => {
    const { theme } = useTheme();
    const [permissionGranted, setPermissionGranted] = useState(false);
    const [permissionDenied, setPermissionDenied] = useState(false);
    const [joinInfo, setJoinInfo] = useState<JoinInfo | null>(null);
    const [error, setError] = useState<string | null>(null);

    const cleanRoom = sanitizeRoomName(roomName);
    const displayName = userInfo?.displayName || 'Friend';

    // Request Android permissions before joining
    const requestPermissions = useCallback(async () => {
        setPermissionDenied(false);
        if (Platform.OS === 'android') {
            try {
                // Android 12+ needs BLUETOOTH_CONNECT to list Bluetooth audio outputs. It is
                // requested with the others, but not required to join.
                const grants = await PermissionsAndroid.requestMultiple(
                    Platform.Version >= 31
                        ? [
                            PermissionsAndroid.PERMISSIONS.CAMERA,
                            PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
                            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
                        ]
                        : [
                            PermissionsAndroid.PERMISSIONS.CAMERA,
                            PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
                        ]
                );
                const cameraOk = grants[PermissionsAndroid.PERMISSIONS.CAMERA] === PermissionsAndroid.RESULTS.GRANTED;
                const audioOk = grants[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === PermissionsAndroid.RESULTS.GRANTED;
                // Denied is shown on screen with a way out. A silent spinner was the old dead end.
                setPermissionDenied(!(cameraOk && audioOk));
                setPermissionGranted(cameraOk && audioOk);
            } catch (err) {
                console.warn('Permission request error:', err);
                setPermissionGranted(true);
            }
        } else {
            // iOS prompts for camera and microphone the first time they are used
            setPermissionGranted(true);
        }
    }, []);

    // Ask the backend for a call token. The VideoSDK secret stays on the server.
    const fetchToken = useCallback(async () => {
        setError(null);
        setJoinInfo(null);
        try {
            const token = await getIdToken();
            if (!token) throw new Error('You must be signed in to start a video call.');
            const res = await fetch(`${Config.BACKEND_URL}/api/video/token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ roomName: cleanRoom }),
            });
            if (!res.ok) {
                const body = await res.json().catch(() => null);
                throw new Error(body?.error || `Video call service unavailable (${res.status})`);
            }
            const data = await res.json();
            if (!data.token || !data.roomId) {
                throw new Error('Incomplete call details from server');
            }
            setJoinInfo({ token: data.token, roomId: data.roomId, participantName: displayName });
        } catch (err) {
            console.warn('Video token error:', err);
            // Our own messages (sign-in, server configuration) are already user-facing.
            const message = err instanceof Error ? err.message : '';
            setError(
                message.includes('Network request failed')
                    ? 'Check your internet connection and try again.'
                    : message || 'The call could not start. Try again.'
            );
        }
    }, [cleanRoom, displayName]);

    // Request permissions on modal show, then fetch the call token
    useEffect(() => {
        if (visible) {
            requestPermissions();
        } else {
            setPermissionGranted(false);
            setPermissionDenied(false);
            setJoinInfo(null);
            setError(null);
        }
    }, [visible, requestPermissions]);

    // Only auto-join once per open; "Try again" handles retries
    useEffect(() => {
        if (visible && permissionGranted) {
            fetchToken();
        }
    }, [visible, permissionGranted, fetchToken]);

    const headerTitle = friendName ? `Call: ${friendName}` : 'Community Circle';
    const closeRoom = useCallback(() => {
        setJoinInfo(null);
        setPermissionGranted(false);
        onClose();
    }, [onClose]);

    const handleCallFailed = useCallback((message: string) => {
        setJoinInfo(null);
        setError(message);
    }, []);

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={false}
            onRequestClose={closeRoom}
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
                    <TouchableOpacity onPress={closeRoom} style={[styles.closeButton, { backgroundColor: 'rgba(239,68,68,0.15)' }]}>
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
                    ) : permissionDenied ? (
                        <View style={styles.loading}>
                            <Text style={[styles.loadingText, { color: theme.colors.text }]}>
                                Camera and microphone access is needed to join the call.
                            </Text>
                            <TouchableOpacity
                                onPress={requestPermissions}
                                style={[styles.retryButton, { borderColor: theme.colors.accent }]}
                            >
                                <Text style={[styles.loadingSubtext, { color: theme.colors.accent }]}>Allow access</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => Linking.openSettings()}
                                style={[styles.retryButton, { borderColor: theme.colors.accent }]}
                            >
                                <Text style={[styles.loadingSubtext, { color: theme.colors.accent }]}>Open settings</Text>
                            </TouchableOpacity>
                        </View>
                    ) : joinInfo ? (
                        <RoomProvider
                            config={{
                                roomId: joinInfo.roomId,
                                participantName: joinInfo.participantName,
                                micEnabled: false,
                                camEnabled: false,
                                defaultCamera: 'front',
                            }}
                            token={joinInfo.token}
                            joinWithoutUserInteraction={true}
                        >
                            <CallView onLeave={closeRoom} onFailed={handleCallFailed} />
                        </RoomProvider>
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
    cameraOff: {
        backgroundColor: '#111',
        alignItems: 'center',
        justifyContent: 'center',
    },
    cameraOffText: {
        color: '#9ca3af',
        fontSize: 14,
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
