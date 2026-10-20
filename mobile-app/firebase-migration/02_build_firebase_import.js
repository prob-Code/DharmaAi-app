#!/usr/bin/env node
/**
 * ============================================================
 *  STEP 2 — Supabase export ko Firebase import format me badlo
 * ============================================================
 *
 *  Chalane ka tareeka:
 *      node firebase-migration/02_build_firebase_import.js
 *
 *  Input : firebase-migration/supabase_users.json   (step 1 ka output)
 *  Output: firebase-migration/firebase_users.json   (step 3 me import hoga)
 *
 *  SABSE ZAROORI BAAT:
 *  Har user ka `localId` wahi purana Supabase UUID rakha gaya hai.
 *  Isi wajah se database me ek bhi id badalni nahi padti — posts,
 *  messages, follows sab apne aap jude rehte hain.
 */

const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const INPUT = path.join(DIR, 'supabase_users.json');
const OUTPUT = path.join(DIR, 'firebase_users.json');

if (!fs.existsSync(INPUT)) {
    console.error(`❌ ${INPUT} nahi mila.`);
    console.error('   Pehle 01_export_users.sql chalao aur result JSON yahan save karo.');
    process.exit(1);
}

const rows = JSON.parse(fs.readFileSync(INPUT, 'utf8'));
if (!Array.isArray(rows)) {
    console.error('❌ supabase_users.json ek array hona chahiye.');
    process.exit(1);
}

const users = [];
const stats = { total: 0, withPassword: 0, googleOnly: 0, skipped: 0 };
const warnings = [];

for (const r of rows) {
    stats.total++;

    if (!r.uid) {
        warnings.push(`uid missing, row skipped: ${JSON.stringify(r).slice(0, 120)}`);
        stats.skipped++;
        continue;
    }

    const user = {
        // ⬇️ yahi wo line hai jo poore data ko bacha leti hai
        localId: String(r.uid),
        email: r.email || undefined,
        emailVerified: Boolean(r.email_verified),
        displayName: r.display_name || r.full_name || r.username || undefined,
        photoURL: r.avatar_url || r.oauth_avatar || undefined,
    };

    // --- password wale users ---
    if (r.encrypted_password && String(r.encrypted_password).startsWith('$2')) {
        // Firebase BCRYPT hashes ko base64 me maangta hai
        user.passwordHash = Buffer.from(String(r.encrypted_password), 'utf8').toString('base64');
        stats.withPassword++;
    }

    // --- Google wale users ---
    const provider = (r.provider || '').toLowerCase();
    if (provider.includes('google')) {
        user.providerUserInfo = [{
            providerId: 'google.com',
            // rawId = Google ka apna user id (sub). Na mile to email fallback.
            rawId: r.google_sub || r.email || String(r.uid),
            email: r.email || undefined,
            displayName: user.displayName,
            photoUrl: user.photoURL,
        }];
        if (!user.passwordHash) stats.googleOnly++;

        if (!r.google_sub) {
            warnings.push(`${r.email || r.uid}: google_sub missing — ye user ko dobara Google se sign-in karna pad sakta hai`);
        }
    }

    // undefined keys hata do, Firebase strict hai
    Object.keys(user).forEach(k => user[k] === undefined && delete user[k]);
    users.push(user);
}

fs.writeFileSync(OUTPUT, JSON.stringify({ users }, null, 2));

console.log('✅ Likha gaya:', OUTPUT);
console.log('   total rows      :', stats.total);
console.log('   password users  :', stats.withPassword);
console.log('   google-only     :', stats.googleOnly);
console.log('   skipped         :', stats.skipped);

if (warnings.length) {
    console.log('\n⚠️  Dhyan dene layak (' + warnings.length + '):');
    warnings.slice(0, 20).forEach(w => console.log('   -', w));
    if (warnings.length > 20) console.log(`   ... aur ${warnings.length - 20}`);
}

console.log(`
────────────────────────────────────────────────────────
AGLA KADAM — import karo:

  firebase auth:import firebase-migration/firebase_users.json \\
    --hash-algo=BCRYPT \\
    --project=sarrthi-d81d3

PEHLE EK USER PAR TEST KARO. firebase_users.json ki copy banao
jisme sirf ek password-wala user ho, usse import karo, phir us
user ke purane password se sign-in karke dekho. Password chal
gaya to poori file import karo.

Agar bcrypt verify fail ho, to hash encoding ka issue hai —
mujhe batana, main --hash-algo aur encoding adjust kar dunga.
────────────────────────────────────────────────────────`);
