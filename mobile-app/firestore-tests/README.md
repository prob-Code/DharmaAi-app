# Firestore security rules — test suite

Ye suite un 28 Supabase RLS policies ki jagah aayi Firestore rules ko verify karta hai.
39 checks hain: kaun kya padh sakta hai, kaun kya likh sakta hai, aur kya kisi aur
ke naam se kuch kiya ja sakta hai.

## Chalane ka tareeka

```bash
cd firestore-tests
cp ../firestore.rules .        # rules yahan chahiye
npm install
npm test
```

Java chahiye (emulator ke liye) aur `firebase-tools`:

```bash
npm i -g firebase-tools
```

Sab pass hone par exit code 0 milega. Koi FAIL aaye to uska naam aur wajah
output me dikhegi — mujhe bhej dena.

## Kya test hota hai

| Area | Checks |
|---|---|
| profiles | public read, sirf apna write |
| posts | apne naam se post, counters alag se, doosre ki post safe |
| likes | doc id = uid, isliye duplicate/fake like namumkin |
| comments | apna comment, post-maalik doosre ka comment hata sake |
| DMs | sirf do participants, sender spoof nahi, receiver sirf is_read |
| communities | khud join/leave, creator hi manage kare |
| notifications | sirf apni padho, koi bhi bhej sake, sirf tum read-mark karo |
| push tokens | sirf apne |
| anonymous | bina login kuch nahi |
| catch-all | anjaan collections band |
