import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ActivityIndicator, TouchableOpacity, Text, SafeAreaView, Modal, Platform, PermissionsAndroid, Alert } from 'react-native';
import { WebView } from 'react-native-webview';
import { X } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';

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

export const VideoRoom: React.FC<VideoRoomProps> = ({ roomName, visible, onClose, userInfo, friendName }) => {
    const { theme } = useTheme();
    const [loading, setLoading] = useState(true);
    const [permissionGranted, setPermissionGranted] = useState(false);

    const displayName = userInfo?.displayName || 'Friend';
    const cleanRoom = sanitizeRoomName(roomName);

    // Build Jitsi URL — disable deep linking & app promo to stay in WebView
    const jitsiParams = [
        'config.prejoinPageEnabled=false',
        'config.disableDeepLinking=true',
        'config.disableThirdPartyRequests=true',
        'config.p2p.enabled=true',
        'config.enableWelcomePage=false',
        'config.enableClosePage=false',
        'interfaceConfig.MOBILE_APP_PROMO=false',
        'interfaceConfig.SHOW_JITSI_WATERMARK=false',
        'interfaceConfig.SHOW_BRAND_WATERMARK=false',
        'interfaceConfig.SHOW_POWERED_BY=false',
        'interfaceConfig.DISABLE_JOIN_LEAVE_NOTIFICATIONS=false',
        `userInfo.displayName=${encodeURIComponent(displayName)}`,
    ].join('&');

    const jitsiUrl = `https://meet.jit.si/${cleanRoom}#${jitsiParams}`;

    // JS injected into WebView to block app-store redirects
    const injectedJS = `
        (function() {
            window.open = function() { return null; };
            var origReplace = window.location.replace;
            window.location.replace = function(url) {
                if (url && (url.indexOf('play.google.com') !== -1 || url.indexOf('apps.apple.com') !== -1 || url.indexOf('itunes.apple.com') !== -1)) {
                    return;
                }
                origReplace.call(window.location, url);
            };
            true;
        })();
    `;

    // Request Android permissions before showing WebView
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
                // On Expo Go, PermissionsAndroid may not work — proceed anyway
                setPermissionGranted(true);
            }
        } else {
            // iOS handles permissions via WebView automatically
            setPermissionGranted(true);
        }
    }, []);

    // Request on modal show
    React.useEffect(() => {
        if (visible) {
            setLoading(true);
            requestPermissions();
        } else {
            setPermissionGranted(false);
        }
    }, [visible, requestPermissions]);

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
                    {permissionGranted ? (
                        <WebView
                            key={cleanRoom}
                            source={{ uri: jitsiUrl }}
                            style={styles.webview}
                            onLoad={() => setLoading(false)}
                            onError={(e) => {
                                console.warn('WebView error:', e.nativeEvent);
                                setLoading(false);
                            }}
                            // Audio & video permissions
                            mediaPlaybackRequiresUserAction={false}
                            allowsInlineMediaPlayback={true}
                            mediaCapturePermissionGrantType="grant"
                            allowsFullscreenVideo={true}
                            // JS & storage
                            javaScriptEnabled={true}
                            domStorageEnabled={true}
                            javaScriptCanOpenWindowsAutomatically={false}
                            // Android-specific
                            androidLayerType="hardware"
                            mixedContentMode="compatibility"
                            thirdPartyCookiesEnabled={true}
                            // Injected script
                            injectedJavaScript={injectedJS}
                            startInLoadingState={true}
                            originWhitelist={['*']}
                            // User agent override to avoid Jitsi mobile-app redirect
                            userAgent="Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
                            // Navigation filter
                            onShouldStartLoadWithRequest={(request) => {
                                const url = request.url;
                                // Block app store & intent redirects
                                if (
                                    url.includes('play.google.com') ||
                                    url.includes('apps.apple.com') ||
                                    url.includes('itunes.apple.com') ||
                                    url.startsWith('market://') ||
                                    url.startsWith('intent://')
                                ) {
                                    return false;
                                }
                                return true;
                            }}
                            renderLoading={() => (
                                <View style={[styles.loading, { backgroundColor: '#000' }]}>
                                    <ActivityIndicator size="large" color={theme.colors.accent} />
                                    <Text style={[styles.loadingText, { color: theme.colors.text }]}>
                                        {friendName ? `Connecting call with ${friendName}...` : 'Connecting to Dharma Circle...'}
                                    </Text>
                                    <Text style={[styles.loadingSubtext, { color: theme.colors.muted }]}>
                                        Please allow camera & microphone when prompted
                                    </Text>
                                </View>
                            )}
                        />
                    ) : (
                        <View style={styles.loading}>
                            <ActivityIndicator size="large" color={theme.colors.accent} />
                            <Text style={[styles.loadingText, { color: theme.colors.text }]}>
                                Requesting camera & mic access...
                            </Text>
                        </View>
                    )}

                    {/* Overlay loader while WebView is loading */}
                    {loading && permissionGranted && (
                        <View style={[styles.loadingOverlay]}>
                            <ActivityIndicator size="large" color={theme.colors.accent} />
                            <Text style={[styles.loadingText, { color: theme.colors.text }]}>
                                Connecting...
                            </Text>
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
    webview: {
        flex: 1,
        backgroundColor: '#000',
    },
    loading: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#000',
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.85)',
    },
    loadingText: {
        marginTop: 15,
        fontSize: 16,
        fontWeight: '500',
    },
    loadingSubtext: {
        marginTop: 8,
        fontSize: 13,
    },
});
