# Supabase → Firebase migration

**Lakshya:** Supabase poori tarah hat jaaye. Firebase Auth = app ka login,
Firestore = poora database (profiles, posts, DMs, communities, notifications).
Chat API (RagGita Lambda) pehle se Firebase token maangta hai, to sab kuch ek hi
identity par aa jaata hai.

**Firebase project:** `sarrthi-d81d3`

---

## Sabse zaroori idea

Firebase import ke waqt **UID hum khud choose karte hain**, isliye har purane
Supabase user ko **usi UUID** ke saath import kiya jaata hai. Nateeja: posts,
messages, follows, notifications ke saare `user_id` bilkul waise hi kaam karte
rehte hain — kisi id ko remap karne ki zaroorat nahi.

---

## Files

| File | Kaam | Status |
|---|---|---|
| `01_export_users.sql` | Supabase se users nikalo | ✅ chahiye |
| `02_build_firebase_import.js` | Firebase auth import file banao (localId = purana UUID) | ✅ chahiye |
| `03_schema_migration.sql` | Postgres schema ko Firebase auth ke layak banao | ⛔ **ab zaroorat nahi** |
| `04_export_data.sql` | Saara app data nikalo | ✅ chahiye |
| `05_import_to_firestore.js` | Data Firestore me daalo | ✅ chahiye |
| `FIRESTORE_MODEL.md` | Naya data model | 📖 |

> `03` tab likha gaya tha jab plan Supabase ko *database* ke roop me rakhne ka
> tha. Ab database bhi Firestore par ja raha hai, isliye wo file ab nahi
> chalani. (Reference ke liye rakhi hai — asli Postgres par test ki hui hai.)

---

## Kadam-dar-kadam

### 0. Backup
Supabase → Database → Backups → on-demand backup.
Ye migration purana data mitata nahi, par phir bhi.

### 1. Firebase taiyaar karo
Firebase Console → `sarrthi-d81d3`:

- **Authentication → Sign-in method**: **Email/Password** aur **Google** enable karo
- **Google** wale panel me **"Web SDK configuration"** kholo, wahan se
  **Web client ID** copy karo → `.env` me daalo:
  ```
  EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=...apps.googleusercontent.com
  ```
- **Firestore Database** banao (production mode)
- **Project settings → General** me Android app add karo, package
  `com.dharmaai.innerbalance`, aur Google sign-in ke liye SHA-1 fingerprint daalo

### 2. Security rules deploy karo
```bash
firebase deploy --only firestore:rules --project sarrthi-d81d3
```
Pehle test chala lo:
```bash
cd firestore-tests && cp ../firestore.rules . && npm install && npm test
```

### 3. Users migrate karo
```bash
# a) 01_export_users.sql Supabase SQL Editor me chalao
#    result → firebase-migration/supabase_users.json

# b) import file banao
node firebase-migration/02_build_firebase_import.js

# c) PEHLE EK USER PAR TEST KARO, phir poori file
firebase auth:import firebase-migration/firebase_users.json \
  --hash-algo=BCRYPT --project=sarrthi-d81d3
```
Test: us user ke **purane password** se app me sign-in karke dekho.

### 4. Data migrate karo
```bash
# a) 04_export_data.sql ki har query chalao,
#    har result → firebase-migration/data/<naam>.json

# b) service account key: Firebase Console → Project settings →
#    Service accounts → Generate new private key
#    → firebase-migration/service-account.json   (GIT ME MAT DAALO)

npm i firebase-admin

# c) pehle dry run
node firebase-migration/05_import_to_firestore.js

# d) counts theek lagen to asli import
node firebase-migration/05_import_to_firestore.js --write
```
Script idempotent hai — dobara chalane par duplicate nahi banenge.

### 5. App code
Ye ho chuka hai:

| File | Kya hai |
|---|---|
| `services/firebase.ts` | Firebase app, auth (AsyncStorage persistence), Firestore |
| `services/db.ts` | Poora data layer — 7 services, wahi naam aur return shapes |
| `services/supabase.ts` | Sirf compatibility shim, taaki purane imports chalte rahen |
| `firestore.rules` | 28 RLS policies ka replacement |
| `config.ts` | Firebase config + Google web client ID |

`AuthContext.tsx`, `AuthScreen.tsx`, `Reflections.tsx`, `Inbox.tsx`,
`DirectMessage.tsx` — **inme kuch nahi badla**. Shim `supabase.auth.getSession()`,
`onAuthStateChange()`, `signInWithOAuth()` ko Firebase par map kar deta hai.

```bash
npx expo install firebase@10.12.2
npx expo start -c
```

### 6. Composite indexes
Pehli baar kuch queries fail hongi aur console me seedha index banane ka link
degi — click karke bana lena. Jinke liye chahiye hongi:

- `posts` : `user_id` + `created_at desc`
- `posts` : `community_id` + `created_at desc`
- `communities` : `category` + `member_count desc`

---

## Testing order (yahi order rakhna)

1. Rules test pass ho
2. Ek naye account se signup → profile bane
3. Purane account se (purana password) login ho
4. Google sign-in chale
5. Post banao, like karo, comment karo → counts sahi badhen
6. DM bhejo → dono taraf dikhe, unread count sahi ho
7. Notification aaye
8. App band karke kholo → logged in raho (persistence)

Har kadam par console dekho.

---

## Rollback

App code git me hai, to `git checkout` se purana version wapas.
Supabase ka data chhua nahi gaya — wo waise ka waisa pada hai.
Firestore ka data delete karna ho to Firebase Console se collections hata do.

---

## Jo abhi bhi open hai

- **bcrypt hash encoding** — ek user par test kiye bina poora import mat karna
- **Denormalized `user`** — profile update hone par purane posts me purana naam
  dikhega; `FIRESTORE_MODEL.md` me dono raaste likhe hain
- **`realtimeSocket.ts`** — abhi bhi apne socket server par hai, usse alag se
  dekhna hoga
- **`@supabase/supabase-js`** — `AuthContext.tsx` abhi bhi isse types import
  karta hai, isliye package abhi rehne do. Baad me types apne banakar hata dena.
- **Supabase project** — sab kuch 1-2 hafte theek chalne ke baad hi delete karna
