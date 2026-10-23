
import { Platform } from 'react-native';

// Configure your API keys through Expo public env vars.
// In production, these should be set in EAS Secrets or .env file.
// NEVER commit actual API keys to source control.
const configuredBackendUrl = (
    process.env.EXPO_PUBLIC_BACKEND_URL
    ?? "https://dharmaai-app-blgs.onrender.com"
).replace(/\/+$/, "");
const DEPLOYED_BACKEND_URL = "https://dharmaai-app-blgs.onrender.com";
// Native builds always use the deployed backend. This prevents an EAS build
// from embedding a developer computer's LAN address into an installable app.
// The environment override remains available for web/local development.
const BACKEND_URL = Platform.OS === 'android'
    ? DEPLOYED_BACKEND_URL
    : configuredBackendUrl;

// --- Chat model (RagGita on AWS Lambda Function URL) ---
// BASE url only — koi trailing slash nahi. Endpoint path code me add hota hai (/chat, /health).
const CHAT_API_URL = (process.env.EXPO_PUBLIC_CHAT_API_URL
    ?? "https://lht7s7xvklyxrd46xwgi22x23i0ofhyn.lambda-url.ap-south-1.on.aws"
).replace(/\/+$/, "");

// --- Firebase public app configuration ---
// Firebase web configuration is public by design; provider API keys are not.
// Ye wahi project hai jo RagGita web app use karta hai: sarrthi-d81d3
// (Firebase web config public hoti hai by design — ye secret nahi hai.)
const FIREBASE_CONFIG = {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? "AIzaSyDiRGj-hlHnjnqRC21LeVikYw_l5MWqA50",
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "sarrthi-d81d3.firebaseapp.com",
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? "sarrthi-d81d3",
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "sarrthi-d81d3.firebasestorage.app",
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_SENDER_ID ?? "242606699113",
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? "1:242606699113:web:cdc4de0e404693d321e8f8",
};

// Google OAuth Web client ID — Firebase Console → Authentication →
// Sign-in method → Google → "Web SDK configuration" me milta hai.
// Iske bina Google sign-in nahi chalega.
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
    ?? "242606699113-scp4ikjbrj8t0ihdc6df7dhluq2dagi5.apps.googleusercontent.com";

export const Config = {
    GOOGLE_WEB_CLIENT_ID,
    BACKEND_URL,
    CHAT_API_URL,
    FIREBASE_CONFIG
};
