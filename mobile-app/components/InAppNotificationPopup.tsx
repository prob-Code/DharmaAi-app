import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { X, Bell, Video, Phone } from 'lucide-react-native';

import { COLORS } from '../constants';
import { useNotifications } from '../context/NotificationsContext';
import { VideoRoom } from './VideoRoom';

export const InAppNotificationPopup: React.FC = () => {
  const { notifications } = useNotifications();

  const newest = notifications[0];
  const newestId = newest?.id ?? null;

  const anim = useRef(new Animated.Value(0)).current;
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastHandledIdRef = useRef<string | null>(null);
  const initializedRef = useRef(false);

  const [visible, setVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [currentNotification, setCurrentNotification] = useState<any>(null);
  const [showVideoRoom, setShowVideoRoom] = useState(false);
  const [videoRoomName, setVideoRoomName] = useState('');
  const [videoCallerName, setVideoCallerName] = useState('');

  const topOffset = useMemo(() => {
    return Platform.OS === 'android' ? 48 : 54;
  }, []);

  const isVideoCall = currentNotification?.type === 'video_call';

  const dismiss = () => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }

    Animated.timing(anim, {
      toValue: 0,
      duration: 160,
      useNativeDriver: true,
    }).start(() => setVisible(false));
  };

  const handleJoinCall = () => {
    if (currentNotification?.data?.roomName) {
      setVideoRoomName(currentNotification.data.roomName);
      setVideoCallerName(currentNotification.data.callerName || 'Friend');
      setShowVideoRoom(true);
      dismiss();
    }
  };

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!newest || !newestId) return;

    // On first load/hydration, don't pop old notifications.
    if (!initializedRef.current) {
      initializedRef.current = true;
      lastHandledIdRef.current = newestId;
      return;
    }

    if (lastHandledIdRef.current === newestId) return;
    lastHandledIdRef.current = newestId;

    setCurrentNotification(newest);
    setTitle(newest.title || 'New notification');
    setVisible(true);

    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();

    // Video call notifications stay longer (15s), regular ones auto-dismiss after 5s
    const timeout = newest.type === 'video_call' ? 15000 : 5000;
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(dismiss, timeout);
  }, [newest, newestId, anim]);

  return (
    <>
      {/* Video Room Modal - opens when user taps Join */}
      <VideoRoom
        visible={showVideoRoom}
        roomName={videoRoomName}
        onClose={() => setShowVideoRoom(false)}
        friendName={videoCallerName}
      />

      {visible && (
        <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
          <Animated.View
            style={[
              isVideoCall ? styles.videoCallContainer : styles.container,
              {
                top: topOffset,
                opacity: anim,
                transform: [
                  {
                    translateY: anim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-18, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            {isVideoCall ? (
              // Video call invitation UI
              <>
                <View style={styles.videoCallHeader}>
                  <View style={styles.videoCallIcon}>
                    <Phone size={18} color="#60a5fa" />
                  </View>
                  <View style={styles.videoCallInfo}>
                    <Text style={styles.videoCallTitle} numberOfLines={1}>
                      Incoming Video Call
                    </Text>
                    <Text style={styles.videoCallSubtitle} numberOfLines={1}>
                      {title}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={dismiss} style={styles.closeBtn} hitSlop={10}>
                    <X size={16} color={COLORS.muted} />
                  </TouchableOpacity>
                </View>
                <View style={styles.videoCallActions}>
                  <TouchableOpacity
                    style={styles.declineBtn}
                    onPress={dismiss}
                  >
                    <X size={16} color="#ef4444" />
                    <Text style={styles.declineText}>Decline</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.joinBtn}
                    onPress={handleJoinCall}
                  >
                    <Video size={16} color="#fff" />
                    <Text style={styles.joinText}>Join Call</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              // Regular notification UI
              <>
                <View style={styles.icon}>
                  <Bell size={18} color={COLORS.accent} />
                </View>
                <Text style={styles.text} numberOfLines={2}>
                  {title}
                </Text>
                <TouchableOpacity onPress={dismiss} style={styles.closeBtn} hitSlop={10}>
                  <X size={16} color={COLORS.muted} />
                </TouchableOpacity>
              </>
            )}
          </Animated.View>
        </View>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 14,
    right: 14,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  videoCallContainer: {
    position: 'absolute',
    left: 14,
    right: 14,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.3)',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  videoCallHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  videoCallIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(96, 165, 250, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoCallInfo: {
    flex: 1,
  },
  videoCallTitle: {
    color: '#60a5fa',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  videoCallSubtitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
  },
  videoCallActions: {
    flexDirection: 'row',
    gap: 10,
  },
  declineBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
  },
  declineText: {
    color: '#ef4444',
    fontWeight: '600',
    fontSize: 14,
  },
  joinBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#60a5fa',
  },
  joinText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  icon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.surfaceHighlight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
  },
  closeBtn: {
    padding: 4,
  },
});
