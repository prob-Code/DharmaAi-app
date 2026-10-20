# Saarthi / DharmaAI release report

## Current architecture

- **Mobile shell:** Expo SDK 57 + React Native 0.86.
- **Authentication:** Firebase Authentication (email/password and Google OAuth when the Google web client ID is configured).
- **Database:** Cloud Firestore. The old `services/supabase.ts` name is only a compatibility shim; it forwards to `services/db.ts` and `services/firebase.ts`.
- **Local device state:** AsyncStorage stores onboarding completion, preferences, and theme selection.
- **Chat:** the configured chat API, with the fallback URL configured in `config.ts`/environment.
- **Voice:** Sarvam Bulbul v3 through `backend/src/routes/tts.ts`. Sarvam is the only voice provider; if it is unavailable, the app stays silent.
- **Notifications:** Firestore notifications + realtime Socket.IO when a backend URL is configured + local Expo notifications on supported native builds.

## Page-by-page report

### Page 1 — Companion

Implemented: AI chat, multilingual greeting, keyboard-safe composer, ambient audio controls, Krishna visual mode, settings, and stress report action.

Reliability changes: the composer and header now respect safe-area insets; chat remains usable if the remote video/audio or chat backend is unavailable through an offline reflection response; Sarvam now uses the current Bulbul v3 request contract and valid speakers. Voice never switches to another provider.

Release dependency: set the chat API environment values in the EAS environment. Do not put provider secrets directly in the mobile bundle.

Sarvam release dependency: set `SARVAM_API_KEY` in `mobile-app/backend/.env` (or the deployed backend secret store), and keep the backend reachable at `EXPO_PUBLIC_BACKEND_URL`.

### Page 2 — Wisdom

Implemented: curated offline video library, responsive cards, local search, optional YouTube/backend search, and a responsive in-app YouTube player modal.

Reliability changes: matching curated content is returned immediately without waiting on a network provider. If all providers fail, the local library remains available.

Release dependency: YouTube search is optional. The page works without a YouTube key using the curated library.

### Page 3 — Reflections

Implemented: feed loading, pull-to-refresh, create reflection, mood tags, likes, replies/threads, delete own posts, messages, community video room, notification list, unread badge, and notification popup.

Reliability changes: notifications are written to the user subtree with `user_id`, notification hydration is reset per signed-in user, invalid notification dates no longer crash the list, individual notifications can be marked read, and video-call notifications can open the call room.

Release dependency: deploy `firestore.rules` and create the Firestore database before testing this page. A user must be authenticated to create posts, likes, replies, messages, or notifications.

## Where the database is stored

Open Firebase Console → project **sarrthi-d81d3** → **Build → Firestore Database → Data**.

Collections used by this app:

| Collection | Purpose |
| --- | --- |
| `profiles/{uid}` | user profile |
| `posts/{postId}` | reflections |
| `posts/{postId}/comments/{commentId}` | replies |
| `posts/{postId}/likes/{uid}` | likes |
| `conversations/{conversationId}/messages/{messageId}` | direct messages |
| `communities/{communityId}` | community data |
| `notifications/{uid}/items/{notificationId}` | in-app notifications |
| `pushTokens/{uid}/tokens/{tokenId}` | device push tokens |

The Firebase configuration in the mobile app is a public client configuration. Firestore rules and Firebase Authentication are the security boundary; never ship a service-account JSON file in the app.

## Firebase billing answer

This app only needs one standard Firestore database, Firebase Authentication, and Firebase Cloud Messaging. Firebase documents a no-cost Spark plan with no payment method required, and Firestore includes a daily free quota. You only need Blaze billing for higher usage or billing-only features such as additional databases, backups, PITR, TTL deletes, restore, or clone operations. See the current [Firebase pricing](https://firebase.google.com/pricing) and [Firestore billing/free quota](https://firebase.google.com/docs/firestore/pricing).

If Firebase is asking for billing, check that you are creating the first/default Firestore database and are not enabling one of the billing-only features. Do not create a second Firestore database just to bypass the prompt.

## Play Store release checklist

1. In Firebase, enable Email/Password and Google providers, create Firestore, and deploy `firestore.rules`.
2. Add `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` if Google sign-in is required.
3. Configure EAS environment variables for chat/backend services. The production profile no longer injects the placeholder `api.example.com` URL.
4. Configure Android push credentials in EAS if remote push notifications are required. In-app Firestore notifications and local notifications do not require a paid Firebase plan.
5. Build a preview APK, test sign-up/login, onboarding, all three tabs, reflection create/like/reply, notification popup, and video player on a small Android device and a large Android device.
6. Build the production AAB with `eas build --platform android --profile production`, then upload it to Play Console. The Android version code is now 6 and EAS production auto-increments future builds.
7. Complete Play Console privacy/data-safety declarations, account deletion testing, content moderation/support details, and the mental-wellness disclaimer before publishing.

## Verification performed

- Expo web production export completed successfully after the fixes.
- Mobile TypeScript check passed.
- Backend TypeScript build and typecheck passed.
- Android Gradle verification reached the Gradle plugin but was blocked by repeatedly modified machine-level Gradle Kotlin DSL workspaces, not by an app source error. Retry the Android build on a clean machine or after repairing/disabling the host Gradle cache instrumentation.
