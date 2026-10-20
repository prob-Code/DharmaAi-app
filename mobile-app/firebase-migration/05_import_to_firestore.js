#!/usr/bin/env node
/**
 * ============================================================
 *  STEP 5 — Supabase ka data Firestore me daalo
 * ============================================================
 *
 *  Pehle:
 *    npm i firebase-admin
 *    Firebase Console → Project settings → Service accounts →
 *      "Generate new private key" → firebase-migration/service-account.json
 *      (ISE GIT ME KABHI COMMIT MAT KARNA)
 *
 *  Chalao:
 *    node firebase-migration/05_import_to_firestore.js           # dry run
 *    node firebase-migration/05_import_to_firestore.js --write   # asli import
 *
 *  Input: firebase-migration/data/*.json  (step 4 ka output)
 *
 *  Ye script IDEMPOTENT hai — dobara chalane par duplicate nahi banenge,
 *  kyunki har doc apni purani id par hi likha jaata hai.
 */

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const DIR = __dirname;
const DATA = path.join(DIR, 'data');
const WRITE = process.argv.includes('--write');

/* ---------------- setup ---------------- */

const keyPath = path.join(DIR, 'service-account.json');
if (!fs.existsSync(keyPath)) {
    console.error('❌ service-account.json nahi mila:', keyPath);
    process.exit(1);
}
admin.initializeApp({ credential: admin.credential.cert(require(keyPath)) });
const db = admin.firestore();

function load(name) {
    const p = path.join(DATA, `${name}.json`);
    if (!fs.existsSync(p)) {
        console.warn(`⚠️  ${name}.json nahi mila — skip`);
        return [];
    }
    const rows = JSON.parse(fs.readFileSync(p, 'utf8'));
    return Array.isArray(rows) ? rows : [];
}

function tsOf(v) {
    if (!v) return admin.firestore.FieldValue.serverTimestamp();
    const d = new Date(v);
    return isNaN(d.getTime())
        ? admin.firestore.FieldValue.serverTimestamp()
        : admin.firestore.Timestamp.fromDate(d);
}

/** 400-write batches me commit — Firestore ki limit 500 hai. */
class Batcher {
    constructor() { this.ops = []; this.written = 0; }
    set(ref, data) { this.ops.push({ ref, data }); }
    async flush() {
        if (!WRITE) { this.written += this.ops.length; this.ops = []; return; }
        while (this.ops.length) {
            const chunk = this.ops.splice(0, 400);
            const batch = db.batch();
            chunk.forEach(({ ref, data }) => batch.set(ref, data, { merge: true }));
            await batch.commit();
            this.written += chunk.length;
        }
    }
}

const convId = (a, b) => [a, b].sort().join('_');

/* ---------------- run ---------------- */

(async () => {
    console.log(WRITE ? '🚀 ASLI IMPORT\n' : '🧪 DRY RUN (kuch nahi likha jayega) — --write se asli chalao\n');

    const profiles = load('profiles');
    const posts = load('posts');
    const comments = load('comments');
    const likes = load('likes');
    const follows = load('follows');
    const messages = load('messages');
    const communities = load('communities');
    const members = load('community_members');
    const notifications = load('notifications');
    const pushTokens = load('push_tokens');

    // author lookup — posts/comments me denormalize karne ke liye
    const byId = new Map(profiles.map(p => [p.id, p]));
    const authorOf = (uid) => {
        const p = byId.get(uid);
        return {
            id: uid,
            username: p?.username ?? null,
            display_name: p?.display_name ?? null,
            avatar_url: p?.avatar_url ?? null,
        };
    };

    const b = new Batcher();
    const counts = {};
    const warn = [];

    // ---- profiles ----
    profiles.forEach(p => {
        b.set(db.doc(`profiles/${p.id}`), {
            username: p.username ?? null,
            display_name: p.display_name ?? null,
            avatar_url: p.avatar_url ?? null,
            bio: p.bio ?? null,
            is_anonymous: !!p.is_anonymous,
            website: p.website ?? null,
            updated_at: tsOf(p.updated_at),
            created_at: tsOf(p.updated_at),
        });
    });
    counts.profiles = profiles.length;
    await b.flush();

    // ---- posts ----
    posts.forEach(p => {
        b.set(db.doc(`posts/${p.id}`), {
            user_id: p.user_id,
            content: p.content ?? '',
            mood_tag: p.mood_tag ?? null,
            is_anonymous: !!p.is_anonymous,
            image_url: p.image_url ?? null,
            community_id: p.community_id ?? null,
            likes_count: p.likes_count ?? 0,
            comments_count: p.comments_count ?? 0,
            created_at: tsOf(p.created_at),
            user: authorOf(p.user_id),
        });
    });
    counts.posts = posts.length;
    await b.flush();

    // ---- comments (post ke andar) ----
    comments.forEach(c => {
        if (!c.post_id) { warn.push(`comment ${c.id}: post_id missing`); return; }
        b.set(db.doc(`posts/${c.post_id}/comments/${c.id}`), {
            post_id: c.post_id,
            user_id: c.user_id,
            content: c.content ?? '',
            is_anonymous: !!c.is_anonymous,
            created_at: tsOf(c.created_at),
            user: authorOf(c.user_id),
        });
    });
    counts.comments = comments.length;
    await b.flush();

    // ---- likes (doc id = user id) ----
    likes.forEach(l => {
        if (!l.post_id || !l.user_id) { warn.push(`like ${l.id}: post_id/user_id missing`); return; }
        b.set(db.doc(`posts/${l.post_id}/likes/${l.user_id}`), { created_at: tsOf(l.created_at) });
    });
    counts.likes = likes.length;
    await b.flush();

    // ---- follows (dono taraf) ----
    follows.forEach(f => {
        if (!f.follower_id || !f.following_id) { warn.push(`follow ${f.id}: ids missing`); return; }
        b.set(db.doc(`profiles/${f.follower_id}/following/${f.following_id}`), { created_at: tsOf(f.created_at) });
        b.set(db.doc(`profiles/${f.following_id}/followers/${f.follower_id}`), { created_at: tsOf(f.created_at) });
    });
    counts.follows = follows.length * 2;
    await b.flush();

    // ---- messages → conversations ----
    const convLast = new Map();
    messages.forEach(m => {
        if (!m.sender_id || !m.receiver_id) { warn.push(`message ${m.id}: ids missing`); return; }
        const cid = convId(m.sender_id, m.receiver_id);
        b.set(db.doc(`conversations/${cid}/messages/${m.id}`), {
            sender_id: m.sender_id,
            receiver_id: m.receiver_id,
            content: m.content ?? '',
            is_read: !!m.is_read,
            created_at: tsOf(m.created_at),
        });
        const prev = convLast.get(cid);
        if (!prev || new Date(m.created_at) > new Date(prev.created_at)) {
            convLast.set(cid, { ...m, participants: [m.sender_id, m.receiver_id].sort() });
        }
    });
    convLast.forEach((m, cid) => {
        b.set(db.doc(`conversations/${cid}`), {
            participants: m.participants,
            last_message: m.content ?? '',
            updated_at: tsOf(m.created_at),
        });
    });
    counts.messages = messages.length;
    counts.conversations = convLast.size;
    await b.flush();

    // ---- communities + members ----
    communities.forEach(c => {
        b.set(db.doc(`communities/${c.id}`), {
            name: c.name ?? '',
            description: c.description ?? null,
            category: c.category ?? null,
            is_private: !!c.is_private,
            creator_id: c.creator_id ?? null,
            member_count: c.member_count ?? 0,
            created_at: tsOf(c.created_at),
        });
    });
    counts.communities = communities.length;

    members.forEach(m => {
        if (!m.community_id || !m.user_id) { warn.push(`member ${m.id}: ids missing`); return; }
        b.set(db.doc(`communities/${m.community_id}/members/${m.user_id}`), {
            role: m.role ?? 'member',
            joined_at: tsOf(m.created_at),
        });
    });
    counts.community_members = members.length;
    await b.flush();

    // ---- notifications (per-user subtree) ----
    notifications.forEach(n => {
        if (!n.user_id) { warn.push(`notification ${n.id}: user_id missing`); return; }
        b.set(db.doc(`notifications/${n.user_id}/items/${n.id}`), {
            type: n.type ?? 'info',
            content: n.content ?? '',
            data: n.data ?? {},
            is_read: !!n.is_read,
            created_at: tsOf(n.created_at),
        });
    });
    counts.notifications = notifications.length;
    await b.flush();

    // ---- push tokens ----
    pushTokens.forEach(t => {
        if (!t.user_id || !t.token) { warn.push(`push token ${t.id}: missing fields`); return; }
        const id = String(t.token).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 100) || t.id;
        b.set(db.doc(`pushTokens/${t.user_id}/tokens/${id}`), {
            token: t.token,
            platform: t.platform ?? null,
            created_at: tsOf(t.created_at),
        });
    });
    counts.push_tokens = pushTokens.length;
    await b.flush();

    /* ---------------- report ---------------- */
    console.log('Documents', WRITE ? 'likhe gaye' : 'likhe jaate', ':');
    Object.entries(counts).forEach(([k, v]) => console.log(`  ${k.padEnd(20)} ${v}`));
    console.log(`  ${'TOTAL'.padEnd(20)} ${b.written}`);

    if (warn.length) {
        console.log(`\n⚠️  Skip hui rows (${warn.length}):`);
        warn.slice(0, 20).forEach(w => console.log('   -', w));
        if (warn.length > 20) console.log(`   ... aur ${warn.length - 20}`);
    }

    if (!WRITE) console.log('\n🧪 Ye dry run tha. Asli import: --write lagao.');
    else console.log('\n✅ Import poora. Ab Firebase Console → Firestore me counts milaa lo.');

    process.exit(0);
})().catch(e => {
    console.error('❌ Import fail:', e);
    process.exit(1);
});
