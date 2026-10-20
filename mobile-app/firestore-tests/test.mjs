import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, updateDoc, deleteDoc, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';

const ALPHA = 'alpha-uid';
const BETA = 'beta-uid';
const CONV = [ALPHA, BETA].sort().join('_');

let pass = 0, fail = 0;
const results = [];

async function check(name, shouldPass, fn) {
    try {
        await (shouldPass ? assertSucceeds(fn()) : assertFails(fn()));
        pass++; results.push(`  PASS  ${name}`);
    } catch (e) {
        fail++; results.push(`  FAIL  ${name}\n        ${String(e).split('\n')[0]}`);
    }
}

const testEnv = await initializeTestEnvironment({
    projectId: 'saarthi-rules-test',
    firestore: { rules: fs.readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8571 },
});

await testEnv.clearFirestore();

// ---- seed (rules bypass) ----
await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'profiles', ALPHA), { username: 'alpha' });
    await setDoc(doc(db, 'profiles', BETA), { username: 'beta' });
    await setDoc(doc(db, 'posts', 'postA'), { user_id: ALPHA, content: 'alpha post', likes_count: 0, comments_count: 0 });
    await setDoc(doc(db, 'posts', 'postA', 'comments', 'c1'), { user_id: BETA, content: 'beta comment' });
    await setDoc(doc(db, 'conversations', CONV), { participants: [ALPHA, BETA] });
    await setDoc(doc(db, 'conversations', CONV, 'messages', 'm1'), { sender_id: ALPHA, receiver_id: BETA, content: 'hi', is_read: false });
    await setDoc(doc(db, 'communities', 'comm1'), { name: 'Gita', creator_id: ALPHA, member_count: 1 });
    await setDoc(doc(db, 'notifications', ALPHA, 'items', 'n1'), { type: 'like', content: 'x', is_read: false });
    await setDoc(doc(db, 'pushTokens', ALPHA, 'tokens', 't1'), { token: 'abc' });
});

const alpha = testEnv.authenticatedContext(ALPHA).firestore();
const beta = testEnv.authenticatedContext(BETA).firestore();
const anon = testEnv.unauthenticatedContext().firestore();

console.log('\n--- PROFILES ---');
await check('koi bhi profile padh sakta hai', true, () => getDoc(doc(anon, 'profiles', ALPHA)));
await check('alpha apna profile update kare', true, () => updateDoc(doc(alpha, 'profiles', ALPHA), { bio: 'hi' }));
await check('beta ALPHA ka profile update NA kare', false, () => updateDoc(doc(beta, 'profiles', ALPHA), { bio: 'hacked' }));

console.log('\n--- POSTS ---');
await check('post feed sabko dikhe', true, () => getDocs(collection(anon, 'posts')));
await check('alpha apne naam se post kare', true, () => setDoc(doc(alpha, 'posts', 'p2'), { user_id: ALPHA, content: 'x', likes_count: 0, comments_count: 0 }));
await check('beta ALPHA ke naam se post NA kare', false, () => setDoc(doc(beta, 'posts', 'p3'), { user_id: ALPHA, content: 'fake', likes_count: 0, comments_count: 0 }));
await check('post fake likes_count ke saath NA bane', false, () => setDoc(doc(alpha, 'posts', 'p4'), { user_id: ALPHA, content: 'x', likes_count: 999, comments_count: 0 }));
await check('beta sirf likes_count bump kare', true, () => updateDoc(doc(beta, 'posts', 'postA'), { likes_count: 1 }));
await check('beta ALPHA ki post ka content NA badle', false, () => updateDoc(doc(beta, 'posts', 'postA'), { content: 'defaced' }));
await check('beta ALPHA ki post NA delete kare', false, () => deleteDoc(doc(beta, 'posts', 'postA')));
await check('alpha apni post delete kare', true, () => deleteDoc(doc(alpha, 'posts', 'p2')));

console.log('\n--- LIKES ---');
await check('beta apni id se like kare', true, () => setDoc(doc(beta, 'posts', 'postA', 'likes', BETA), { created_at: 1 }));
await check('beta ALPHA ke naam se like NA kare', false, () => setDoc(doc(beta, 'posts', 'postA', 'likes', ALPHA), { created_at: 1 }));
await check('beta apna like hata sake', true, () => deleteDoc(doc(beta, 'posts', 'postA', 'likes', BETA)));

console.log('\n--- COMMENTS ---');
await check('beta apna comment kare', true, () => setDoc(doc(beta, 'posts', 'postA', 'comments', 'c2'), { user_id: BETA, content: 'nice' }));
await check('beta ALPHA ke naam se comment NA kare', false, () => setDoc(doc(beta, 'posts', 'postA', 'comments', 'c3'), { user_id: ALPHA, content: 'fake' }));
await check('post-maalik alpha doosre ka comment hata sake', true, () => deleteDoc(doc(alpha, 'posts', 'postA', 'comments', 'c1')));

console.log('\n--- DIRECT MESSAGES ---');
await check('alpha apni conversation padhe', true, () => getDoc(doc(alpha, 'conversations', CONV)));
await check('beta message bheje', true, () => setDoc(doc(beta, 'conversations', CONV, 'messages', 'm2'), { sender_id: BETA, receiver_id: ALPHA, content: 'hello', is_read: false }));
await check('beta ALPHA ke naam se message NA bheje', false, () => setDoc(doc(beta, 'conversations', CONV, 'messages', 'm3'), { sender_id: ALPHA, receiver_id: BETA, content: 'fake', is_read: false }));
await check('receiver beta is_read toggle kare', true, () => updateDoc(doc(beta, 'conversations', CONV, 'messages', 'm1'), { is_read: true }));
await check('receiver message ka content NA badle', false, () => updateDoc(doc(beta, 'conversations', CONV, 'messages', 'm1'), { content: 'edited' }));

// teesra banda — conversation me shaamil nahi
const CARL = 'carl-uid';
const carl = testEnv.authenticatedContext(CARL).firestore();
await check('baahar ka banda DM NA padhe', false, () => getDoc(doc(carl, 'conversations', CONV, 'messages', 'm1')));
await check('baahar ka banda conversation NA padhe', false, () => getDoc(doc(carl, 'conversations', CONV)));

console.log('\n--- COMMUNITIES ---');
await check('communities sabko dikhen', true, () => getDocs(collection(anon, 'communities')));
await check('beta apne aap ko join kare', true, () => setDoc(doc(beta, 'communities', 'comm1', 'members', BETA), { role: 'member' }));
await check('beta ALPHA ko zabardasti join NA karaye', false, () => setDoc(doc(beta, 'communities', 'comm1', 'members', ALPHA), { role: 'member' }));
await check('creator alpha member hata sake', true, () => deleteDoc(doc(alpha, 'communities', 'comm1', 'members', BETA)));
await check('beta community ka naam NA badle', false, () => updateDoc(doc(beta, 'communities', 'comm1'), { name: 'hacked' }));

console.log('\n--- NOTIFICATIONS ---');
await check('alpha apni notifications padhe', true, () => getDocs(collection(alpha, 'notifications', ALPHA, 'items')));
await check('beta ALPHA ki notifications NA padhe', false, () => getDocs(collection(beta, 'notifications', ALPHA, 'items')));
await check('beta ALPHA ko notification bhej sake', true, () => setDoc(doc(beta, 'notifications', ALPHA, 'items', 'n2'), { type: 'like', content: 'beta liked', is_read: false }));
await check('alpha apni notif read mark kare', true, () => updateDoc(doc(alpha, 'notifications', ALPHA, 'items', 'n1'), { is_read: true }));
await check('beta ALPHA ki notif NA badle', false, () => updateDoc(doc(beta, 'notifications', ALPHA, 'items', 'n1'), { content: 'x' }));

console.log('\n--- PUSH TOKENS ---');
await check('alpha apna token padhe', true, () => getDoc(doc(alpha, 'pushTokens', ALPHA, 'tokens', 't1')));
await check('beta ALPHA ka token NA padhe', false, () => getDoc(doc(beta, 'pushTokens', ALPHA, 'tokens', 't1')));

console.log('\n--- ANONYMOUS / CATCH-ALL ---');
await check('bina login post NA bane', false, () => setDoc(doc(anon, 'posts', 'p9'), { user_id: ALPHA, content: 'x', likes_count: 0, comments_count: 0 }));
await check('anjaan collection band ho', false, () => setDoc(doc(alpha, 'secret_stuff', 'x'), { a: 1 }));
await check('anjaan collection padhi NA jaye', false, () => getDoc(doc(alpha, 'secret_stuff', 'x')));

console.log(results.join('\n'));
console.log(`\n================  ${pass} passed, ${fail} failed  ================`);
await testEnv.cleanup();
process.exit(fail ? 1 : 0);
