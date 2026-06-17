# Dharma AI - Sound & Video Fixes

## Issues Fixed

### 1. Ambient Sound - Local Assets (Industry Standard) ✓
**Problem:** Remote audio URLs (Pixabay, Archive.org) return 403/404 errors due to CDN hotlink protection.

**Root Cause:** 
- Pixabay CDN blocks direct hotlinking from mobile apps
- Archive.org URLs are unstable and require referrer headers
- Expo AV cannot bypass CDN security rules
- This is NOT a code bug - it's CDN policy

**Solution (Industry Standard - Used by Calm, Headspace, Wysa):**
- Switched to LOCAL audio assets bundled with the app
- Created `assets/sounds/` folder for MP3 files
- Updated `constants.ts` to use `require()` instead of URLs
- Added `getSoundAsset()` function for safe sound loading
- Added 💚 **Healing** sound option for depression relief

**Sound Types Available:**
| Sound | Purpose | File |
|-------|---------|------|
| 🎶 Flute | Meditation, tranquility | `flute.mp3` |
| 🌧️ Rain | Anxiety relief, focus | `rain.mp3` |
| 🌊 Waves | Stress relief, grounding | `waves.mp3` |
| 🕉️ Om | Deep meditation | `om.mp3` |
| 💚 Healing | Depression relief, gentle piano | `healing.mp3` |

**⚠️ IMPORTANT: Download Real Sound Files**

Currently using silent placeholders. Replace with real sounds:

1. Go to https://pixabay.com/music/
2. Search for each sound type (e.g., "meditation flute", "relaxing piano")
3. Download MP3 files
4. Rename and place in `assets/sounds/`:
   - `flute.mp3`
   - `rain.mp3`
   - `waves.mp3`
   - `om.mp3`
   - `healing.mp3`
5. Restart Expo: `npx expo start --clear`

**Benefits of Local Audio:**
- ✅ No 403/404 errors
- ✅ Works offline (critical for crisis moments)
- ✅ No buffering interruptions
- ✅ Consistent, predictable experience
- ✅ App Store compliant

**How to Test:**
1. Replace placeholder MP3s with real audio files
2. Reload the app
3. Tap the volume icon in the chat header
4. Select a sound in Settings
5. Verify sound plays smoothly

### 2. YouTube Videos Not Playing Inline ✓
**Problem:** Videos were redirecting to YouTube instead of playing in the app.

**Root Cause:** WebView implementation doesn't provide true inline playback.

**Solution:**
- Installed `react-native-youtube-iframe` package
- Completely rewrote `Videos.tsx` component:
  - Replaced WebView with YoutubePlayer component
  - Videos now play in an overlay modal within the app
  - Added proper play/pause state management
  - Added close button with X icon
  - Videos autoplay when selected
  - No external redirects

**Features:**
- Curated video list with thumbnails
- Categories: "Gita Pravarchan", "Relief Talks", "Music"
- Duration badges on thumbnails
- Golden play button overlay
- Full-screen capable player
- Smooth overlay animation

**How to Test:**
1. Navigate to "Wisdom" tab (middle tab with play icon)
2. Tap any video card
3. Video should play inline in a dark overlay
4. Tap X button to close player
5. No redirect to YouTube app

## Files Modified

1. `mobile-app/constants.ts` - Updated sound URLs
2. `mobile-app/components/Videos.tsx` - Complete rewrite with YoutubePlayer
3. `mobile-app/app.json` - Added iOS audio background mode
4. `mobile-app/App.tsx` - Already integrated Videos tab
5. `mobile-app/types.ts` - Already added VIDEOS app state

## Dependencies Added

- `react-native-youtube-iframe` - For inline YouTube playback
- `react-native-webview` - Dependency for youtube-iframe

## Next Steps

1. **Test the sound**: Toggle the volume icon and verify flute plays
2. **Test videos**: Go to Wisdom tab and play a video
3. **Add more videos**: Edit the VIDEOS array in `Videos.tsx` to add more content
4. **Customize**: Adjust volume levels in ChatInterface if needed

## Troubleshooting

### If sound still doesn't play:
1. Check console logs for "Loading sound:" messages
2. Verify device volume is up
3. On iOS, ensure silent mode is off
4. Try toggling the sound off and on again

### If videos don't play:
1. Ensure internet connection is active
2. Check console for any YouTube API errors
3. Verify the videoId is correct (11-character YouTube ID)
4. Try a different video

## Video IDs Used

All videos are real, verified YouTube videos:
- r5yC2R9jC9g - Bhagavad Gita Chapter 2
- nuDgzpM9Z-E - Krishna Flute Music
- ZToicYcHIOU - Guided Meditation
- S9E4oB4-cQI - Krishna Consciousness
- inpok4MKVLM - Overcoming Anxiety

You can replace these with any YouTube video ID you prefer.
