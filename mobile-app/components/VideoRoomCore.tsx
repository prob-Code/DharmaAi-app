import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, StyleSheet, ActivityIndicator, TouchableOpacity, Text, Modal, Platform, PermissionsAndroid, Alert, FlatList, ListRenderItem } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Mic, MicOff, Video as VideoIcon, VideoOff } from 'lucide-react-native';
import {
    ChannelProfileType,
    ClientRoleType,
    createAgoraRtcEngine,
    IRtcEngine,
    IRtcEngineEventHandler,
    RenderModeType,
    RtcSurfaceView,
    VideoSourceType,
} from 'react-native-agora';
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
    appId: string;
    channelName: string;
    userAccount: string;
};

type Tile = { key: string; uid: number; isLocal: boolean };

// Sanitize room name: only lowercase alphanumeric, max 30 chars
function sanitizeRoomName(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .slice(0, 30) || 'dharmaroom';
}

// Owns the Agora engine. Mounted only while a call is active, so the engine is released
// as soon as the user leaves. Mic and camera stay off until the user turns them on.
const CallView: React.FC<{
    joinInfo: JoinInfo;
    onLeave: () => void;
    onFailed: (message: string) => void;
}> = ({ joinInfo, onLeave, onFailed }) => {
    const { theme } = useTheme();
    const engineRef = useRef<IRtcEngine | null>(null);
    const onFailedRef = useRef(onFailed);
    onFailedRef.current = onFailed;

    const [joined, setJoined] = useState(false);
    const [localUid, setLocalUid] = useState(0);
    const [remoteUids, setRemoteUids] = useState<number[]>([]);
    const [micOn, setMicOn] = useState(false);
    const [camOn, setCamOn] = useState(false);

    useEffect(() => {
        let engine: IRtcEngine | null = null;
        let joinedOk = false;
        const handler: IRtcEngineEventHandler = {
            onJoinChannelSuccess: (connection) => {
                joinedOk = true;
                setJoined(true);
                setLocalUid(connection.localUid ?? 0);
            },
            onUserJoined: (_connection, remoteUid) => {
                setRemoteUids((prev) => (prev.includes(remoteUid) ? prev : [...prev, remoteUid]));
            },
            onUserOffline: (_connection, remoteUid) => {
                setRemoteUids((prev) => prev.filter((uid) => uid !== remoteUid));
            },
            onError: (err, msg) => {
                console.warn('Agora error:', err, msg);
                // Errors before the channel is joined mean the call never started.
                if (!joinedOk) onFailedRef.current(`Could not join the call (code ${err}). ${msg || ''}`.trim());
            },
        };

        try {
            engine = createAgoraRtcEngine();
            engine.registerEventHandler(handler);
            const initResult = engine.initialize({
                appId: joinInfo.appId,
                channelProfile: ChannelProfileType.ChannelProfileCommunication,
            });
            if (initResult < 0) throw new Error(`Video engine failed to start (code ${initResult}).`);

            engine.enableVideo();
            const joinResult = engine.joinChannelWithUserAccount(
                joinInfo.token,
                joinInfo.channelName,
                joinInfo.userAccount,
                {
                    channelProfile: ChannelProfileType.ChannelProfileCommunication,
                    clientRoleType: ClientRoleType.ClientRoleBroadcaster,
                    publishMicrophoneTrack: false,
                    publishCameraTrack: false,
                    autoSubscribeAudio: true,
                    autoSubscribeVideo: true,
                }
            );
            if (joinResult < 0) throw new Error(`Could not join the call (code ${joinResult}).`);
            engineRef.current = engine;
        } catch (error: any) {
            console.warn('Agora start failed:', error);
            onFailedRef.current(error?.message || 'Video calling could not start on this device.');
        }

        return () => {
            try {
                if (engine) {
                    engine.unregisterEventHandler(handler);
                    engine.leaveChannel();
                    engine.release();
                }
            } catch (error) {
                console.warn('Agora cleanup failed:', error);
            }
            engineRef.current = null;
        };
    }, [joinInfo]);

    const toggleMicrophone = () => {
        const engine = engineRef.current;
        if (!engine) return;
        const next = !micOn;
        try {
            engine.enableLocalAudio(next);
            engine.updateChannelMediaOptions({ publishMicrophoneTrack: next });
            setMicOn(next);
        } catch (error) {
            console.warn('Microphone could not change:', error);
        }
    };

    const toggleCamera = () => {
        const engine = engineRef.current;
        if (!engine) return;
        const next = !camOn;
        try {
            if (next) {
                engine.enableLocalVideo(true);
                engine.startPreview();
            } else {
                engine.stopPreview();
                engine.enableLocalVideo(false);
            }
            engine.updateChannelMediaOptions({ publishCameraTrack: next });
            setCamOn(next);
        } catch (error) {
            console.warn('Camera could not change:', error);
        }
    };

    const tiles: Tile[] = [
        { key: 'local', uid: localUid, isLocal: true },
        ...remoteUids.map((uid) => ({ key: String(uid), uid, isLocal: false })),
    ];

    const renderTile: ListRenderItem<Tile> = ({ item }) => {
        if (item.isLocal && !camOn) {
            return (
                <View style={[styles.participantView, styles.cameraOff]}>
                    <Text style={styles.cameraOffText}>Camera off</Text>
                </View>
            );
        }
        return (
            <RtcSurfaceView
                style={styles.participantView}
                canvas={{
                    uid: item.isLocal ? 0 : item.uid,
                    renderMode: RenderModeType.RenderModeHidden,
                    sourceType: item.isLocal ? VideoSourceType.VideoSourceCamera : undefined,
                }}
                connection={{ channelId: joinInfo.channelName, localUid }}
            />
        );
    };

    return (
        <View style={styles.callContainer}>
            <FlatList
                data={joined ? tiles : []}
                keyExtractor={(item) => item.key}
                renderItem={renderTile}
                style={{ flex: 1 }}
            />
            <View style={[styles.controls, { borderTopColor: theme.colors.border }]}>
                <TouchableOpacity
                    onPress={toggleMicrophone}
                    style={[styles.controlButton, { backgroundColor: micOn ? 'rgba(255,255,255,0.15)' : '#ef4444' }]}
                >
                    {micOn ? <Mic color="#fff" size={22} /> : <MicOff color="#fff" size={22} />}
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={toggleCamera}
                    style={[styles.controlButton, { backgroundColor: camOn ? 'rgba(255,255,255,0.15)' : '#ef4444' }]}
                >
                    {camOn ? <VideoIcon color="#fff" size={22} /> : <VideoOff color="#fff" size={22} />}
                </TouchableOpacity>
                <TouchableOpacity onPress={onLeave} style={[styles.controlButton, { backgroundColor: '#ef4444' }]}>
                    <X color="#fff" size={22} />
                </TouchableOpacity>
            </View>
        </View>
    );
};

export const VideoRoomCore: React.FC<VideoRoomProps> = ({ roomName, visible, onClose, friendName }) => {
    const { theme } = useTheme();
    const [permissionGranted, setPermissionGranted] = useState(false);
    const [joinInfo, setJoinInfo] = useState<JoinInfo | null>(null);
    const [error, setError] = useState<string | null>(null);

    const cleanRoom = sanitizeRoomName(roomName);

    // Request Android permissions before joining
    const requestPermissions = useCallback(async () => {
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
            // iOS prompts for camera and microphone the first time they are used
            setPermissionGranted(true);
        }
    }, []);

    // Ask the backend for a call token. The Agora App Certificate stays on the server.
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
            if (!data.token || !data.appId || !data.channelName || !data.userAccount) {
                throw new Error('Incomplete call details from server');
            }
            setJoinInfo({
                token: data.token,
                appId: data.appId,
                channelName: data.channelName,
                userAccount: data.userAccount,
            });
        } catch (err) {
            console.warn('Video token error:', err);
            setError('Could not start the call. Check your connection and try again.');
        }
    }, [cleanRoom]);

    // Request permissions on modal show, then fetch the call token
    useEffect(() => {
        if (visible) {
            requestPermissions();
        } else {
            setPermissionGranted(false);
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
                    ) : joinInfo ? (
                        <CallView joinInfo={joinInfo} onLeave={closeRoom} onFailed={handleCallFailed} />
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
