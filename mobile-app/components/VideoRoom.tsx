import React, { useEffect, useState } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet } from 'react-native';

type CoreProps = React.ComponentProps<typeof import('./VideoRoomCore').VideoRoomCore>;
type CoreComponent = React.ComponentType<CoreProps>;

let cachedCore: CoreComponent | null = null;
let loadError: string | null = null;

// LiveKit uses a native WebRTC module that Expo Go does not include. Importing it at
// startup crashes the whole app, so it is only loaded the first time a call is opened.
function loadCore(): CoreComponent | null {
    if (cachedCore || loadError) return cachedCore;
    try {
        require('@livekit/react-native').registerGlobals();
        cachedCore = require('./VideoRoomCore').VideoRoomCore;
    } catch (e: any) {
        loadError = e?.message ?? String(e);
        // Expo Go intentionally does not ship the native WebRTC module. The
        // visible modal below explains the limitation to the user.
    }
    return cachedCore;
}

export const VideoRoom: React.FC<CoreProps> = (props) => {
    const [Core, setCore] = useState<CoreComponent | null>(cachedCore);
    const [initializationError, setInitializationError] = useState<string | null>(loadError);

    useEffect(() => {
        if (!props.visible || Core) return;
        try {
            setCore(loadCore());
            setInitializationError(loadError);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            setInitializationError(message);
        }
    }, [props.visible, Core]);

    if (Core) return <Core {...props} />;
    if (!props.visible) return null;

    return (
        <Modal visible transparent animationType="fade" onRequestClose={props.onClose}>
            <View style={styles.backdrop}>
                <View style={styles.card}>
                    <Text style={styles.title}>Video calls unavailable</Text>
                    <Text style={styles.body}>
                        {initializationError
                            ? 'Video calling could not start on this device. Check that you installed the latest APK and granted camera and microphone permissions.'
                            : 'Video calls need a development or production build of the app. They are not supported in Expo Go.'}
                    </Text>
                    <TouchableOpacity onPress={props.onClose} style={styles.button}>
                        <Text style={styles.buttonText}>Close</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        padding: 24,
    },
    card: {
        backgroundColor: '#121C1A',
        borderRadius: 16,
        padding: 20,
        gap: 12,
    },
    title: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
    },
    body: {
        color: '#d1d5db',
        fontSize: 14,
        lineHeight: 20,
    },
    button: {
        alignSelf: 'flex-end',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 8,
        backgroundColor: 'rgba(255,255,255,0.15)',
    },
    buttonText: {
        color: '#fff',
        fontWeight: '600',
    },
});
