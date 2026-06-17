# 🔧 Fixing "Bot Not Responding" Issue

## ❌ Problem
The bot is not giving answers because the **OpenRouter API key is not configured**.

## ✅ Solution

### Step 1: Get an OpenRouter API Key

1. Go to **https://openrouter.ai/keys**
2. Sign up or log in
3. Click "Create Key"
4. Copy your API key (starts with `sk-or-v1-...`)

### Step 2: Add the Key to Your App

1. Open `mobile-app/config.ts`
2. Replace this line:
   ```typescript
   const OPENROUTER_API_KEY = "sk-or-v1-YOUR_OPENROUTER_KEY_HERE";
   ```
   
   With your actual key:
   ```typescript
   const OPENROUTER_API_KEY = "sk-or-v1-abc123..."; // Your real key
   ```

3. Save the file

### Step 3: Reload the App

The app will automatically reload (hot reload). If not:
- Press `r` in the terminal where `npx expo start` is running
- Or shake your phone and tap "Reload"

## 🧪 Test It

1. Open the app
2. Type a message like "Hello"
3. You should now get a response!

## 📝 What Was Wrong?

The old config had:
```typescript
const OPENROUTER_API_KEY = "AIzaSy..."; // ❌ This is a Google API key!
```

OpenRouter needs its own key that starts with `sk-or-v1-`

## 💡 Current Status

**With the updated code:**
- ✅ Better error messages
- ✅ Clear instructions in config.ts
- ✅ Console logs to help debug
- ✅ Helpful error shown in chat if key is missing
- ✅ **Using FREE model** (Google Gemini Flash 1.5)

**Error message you'll see if key is not set:**
> "Please add your OpenRouter API key in config.ts. Visit https://openrouter.ai/keys to get one."

## 🎯 Next Steps

1. Get your OpenRouter API key
2. Add it to `config.ts`
3. Reload the app
4. Start chatting!

## 💰 OpenRouter Pricing

**Current Model: Google Gemini Flash 1.5**
- ✅ **100% FREE!**
- No cost per message
- Great quality responses
- Fast

**Other Free Models Available:**
- `google/gemini-flash-1.5` (current)
- `google/gemini-flash-1.5-8b`
- `meta-llama/llama-3.2-3b-instruct:free`
- `nousresearch/hermes-3-llama-3.1-405b:free`

**To change model:**
Edit `mobile-app/services/gemini.ts` line 44:
```typescript
model: "google/gemini-flash-1.5", // Change this
```

See all free models at: https://openrouter.ai/models?max_price=0

## 🔒 Security Note

For production, move API keys to:
- Environment variables
- `expo-secure-store`
- Backend API

Never commit real API keys to git!
