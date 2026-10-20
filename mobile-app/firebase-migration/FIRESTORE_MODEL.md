# Firestore data model — Supabase tables ka naya roop

Postgres me joins hote hain, Firestore me nahi. Isliye do cheezein badalti hain:

1. **Child rows subcollections ban jaate hain** — comments post ke andar, members community ke andar.
   Isse security rules chhoti aur sakht ho jaati hain.
2. **Author ka profile post/comment me denormalize hota hai** (`user` field).
   Kyunki `select(*, user:profiles(*))` jaisa join Firestore me possible nahi. Isse UI components
   ka return shape bilkul wahi rehta hai jo abhi hai — yaani `Reflections.tsx`, `Inbox.tsx`,
   `DirectMessage.tsx` me kuch badalna nahi padta.

---

## Mapping

| Supabase table | Firestore path | Note |
|---|---|---|
| `profiles` | `profiles/{uid}` | doc id = Firebase UID |
| `posts` | `posts/{postId}` | `user` denormalized |
| `comments` | `posts/{postId}/comments/{commentId}` | subcollection |
| `likes` | `posts/{postId}/likes/{uid}` | **doc id = uid** → duplicate like namumkin |
| `follows` | `profiles/{uid}/following/{targetUid}` + `profiles/{uid}/followers/{srcUid}` | dono taraf, taaki count fast ho |
| `messages` | `conversations/{convId}/messages/{msgId}` | `convId` = dono uid sort karke `_` se joined |
| `communities` | `communities/{communityId}` | |
| `community_members` | `communities/{communityId}/members/{uid}` | doc id = uid |
| `notifications` | `notifications/{uid}/items/{notifId}` | per-user subtree → rule bilkul airtight |
| `push_tokens` | `pushTokens/{uid}/tokens/{tokenId}` | |

---

## Document shapes

```
profiles/{uid}
  username, display_name, avatar_url, bio, is_anonymous, website, updated_at

posts/{postId}
  user_id, content, mood_tag, is_anonymous, image_url, community_id,
  likes_count, comments_count, created_at,
  user: { id, username, display_name, avatar_url }      ← denormalized

posts/{postId}/comments/{commentId}
  user_id, content, is_anonymous, created_at,
  user: { id, username, display_name, avatar_url }

posts/{postId}/likes/{uid}
  created_at

conversations/{convId}
  participants: [uidA, uidB], last_message, updated_at
conversations/{convId}/messages/{msgId}
  sender_id, receiver_id, content, is_read, created_at

communities/{communityId}
  name, description, category, is_private, creator_id, member_count, created_at
communities/{communityId}/members/{uid}
  role, joined_at

notifications/{uid}/items/{notifId}
  type, content, data, is_read, created_at

pushTokens/{uid}/tokens/{tokenId}
  token, platform, created_at
```

---

## Counters

`increment_likes` / `decrement_likes` jaise RPC ab Firestore ke atomic
`increment(1)` / `increment(-1)` se hote hain. Rules me ek alag raasta rakha gaya
hai: koi bhi signed-in user post ka **sirf** `likes_count` / `comments_count`
badal sakta hai, content nahi. Isi tarah community ka `member_count`.

---

## Jo dhyan rakhna hai

**Denormalized `user` stale ho sakta hai.** Agar koi apna display name ya avatar
badalta hai, to purane posts me purana naam dikhega. Do raaste:

- Chhote scale par: profile update hone par us user ke posts batch-update kar do
- Baad me: Cloud Function jo `profiles/{uid}` par write hone par fan-out kare

Abhi ke liye pehla raasta theek hai — tumhare users itne nahi hain ki batch mehnga pade.

**Feed query.** Abhi `getFeed` saare posts newest-first laata hai (follow filter
lagta nahi hai). Firestore me wahi behaviour seedha `orderBy('created_at','desc')`
se milta hai — koi composite index nahi chahiye. Jab sach me "sirf followed users"
wala feed chahiye hoga, tab either fan-out feed banana padega ya `in` query
(30 uid tak ki limit ke saath).

**Composite indexes.** `posts` par `community_id` + `created_at` wali query
(`communitiesService.getPosts`) ke liye ek composite index chahiye hoga. Firestore
pehli baar query fail hone par console me seedha link deta hai — click karke bana lena.
