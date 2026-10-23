import { Router } from "express";
import { requireFirebaseUser } from "../middleware/firebaseAuth";
import { getSocialStore } from "../services/socialStore";

export const socialRouter = Router();
socialRouter.use(requireFirebaseUser);

function uid(req: Express.Request) {
  if (!req.firebaseUser) throw new Error("Authenticated user is required.");
  return req.firebaseUser.uid;
}

async function ensureProfile(req: Express.Request) {
  const user = req.firebaseUser!;
  const store = getSocialStore();
  const { error } = await store.from("profiles").upsert({
    id: user.uid,
    display_name: user.name ?? user.email?.split("@")[0] ?? "Friend",
    avatar_url: user.picture ?? null
  }, { onConflict: "id", ignoreDuplicates: true });
  if (error) throw error;
}

socialRouter.get("/posts", async (req, res, next) => {
  try {
    await ensureProfile(req);
    const store = getSocialStore();
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    let postsQuery = store
      .from("posts")
      .select("*, profiles!posts_user_id_fkey(id, username, display_name, avatar_url)")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (typeof req.query.communityId === "string" && req.query.communityId) {
      postsQuery = postsQuery.eq("community_id", req.query.communityId);
    }
    const { data, error } = await postsQuery;
    if (error) throw error;
    const postIds = (data ?? []).map((post) => post.id);
    const { data: likes, error: likesError } = await store
      .from("likes")
      .select("post_id")
      .eq("user_id", uid(req))
      .in("post_id", postIds.length ? postIds : ["00000000-0000-0000-0000-000000000000"]);
    if (likesError) throw likesError;
    const liked = new Set((likes ?? []).map((like) => like.post_id));
    res.json((data ?? []).map((post) => ({ ...post, user: post.profiles, isLiked: liked.has(post.id), profiles: undefined })));
  } catch (error) {
    next(error);
  }
});

socialRouter.post("/posts", async (req, res, next) => {
  try {
    await ensureProfile(req);
    const content = typeof req.body.content === "string" ? req.body.content.trim() : "";
    if (!content || content.length > 300) {
      res.status(400).json({ error: "Content is required and must be 300 characters or fewer." });
      return;
    }
    const { data, error } = await getSocialStore().from("posts").insert({
      user_id: uid(req), content, mood_tag: req.body.moodTag ?? null,
      is_anonymous: Boolean(req.body.isAnonymous), image_url: req.body.imageUrl ?? null
    }).select("*, profiles!posts_user_id_fkey(id, username, display_name, avatar_url)").single();
    if (error) throw error;
    res.status(201).json({ ...data, user: data.profiles, isLiked: false, profiles: undefined });
  } catch (error) {
    next(error);
  }
});

socialRouter.delete("/posts/:postId", async (req, res, next) => {
  try {
    const store = getSocialStore();
    const { error } = await store.from("posts").delete().eq("id", req.params.postId).eq("user_id", uid(req));
    if (error) throw error;
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

socialRouter.post("/posts/:postId/likes/toggle", async (req, res, next) => {
  try {
    const store = getSocialStore();
    const userId = uid(req);
    const { data: existing, error: findError } = await store.from("likes").select("id").eq("post_id", req.params.postId).eq("user_id", userId).maybeSingle();
    if (findError) throw findError;
    if (existing) {
      const { error } = await store.from("likes").delete().eq("id", existing.id);
      if (error) throw error;
      res.json({ liked: false });
      return;
    }
    const { error } = await store.from("likes").insert({ post_id: req.params.postId, user_id: userId });
    if (error) throw error;
    res.json({ liked: true });
  } catch (error) {
    next(error);
  }
});

socialRouter.get("/posts/:postId/comments", async (req, res, next) => {
  try {
    const { data, error } = await getSocialStore().from("comments")
      .select("*, profiles!comments_user_id_fkey(id, username, display_name, avatar_url)")
      .eq("post_id", req.params.postId).order("created_at", { ascending: true });
    if (error) throw error;
    res.json((data ?? []).map((comment) => ({ ...comment, user: comment.profiles, profiles: undefined })));
  } catch (error) {
    next(error);
  }
});

socialRouter.post("/posts/:postId/comments", async (req, res, next) => {
  try {
    const content = typeof req.body.content === "string" ? req.body.content.trim() : "";
    if (!content || content.length > 500) {
      res.status(400).json({ error: "Comment is required and must be 500 characters or fewer." });
      return;
    }
    const { data, error } = await getSocialStore().from("comments").insert({
      post_id: req.params.postId, user_id: uid(req), content, is_anonymous: Boolean(req.body.isAnonymous)
    }).select("*, profiles!comments_user_id_fkey(id, username, display_name, avatar_url)").single();
    if (error) throw error;
    res.status(201).json({ ...data, user: data.profiles, profiles: undefined });
  } catch (error) {
    next(error);
  }
});

socialRouter.delete("/posts/:postId/comments/:commentId", async (req, res, next) => {
  try {
    const { error } = await getSocialStore().from("comments").delete()
      .eq("id", req.params.commentId).eq("post_id", req.params.postId).eq("user_id", uid(req));
    if (error) throw error;
    res.status(204).send();
  } catch (error) { next(error); }
});

socialRouter.post("/messages", async (req, res, next) => {
  try {
    await ensureProfile(req);
    const content = typeof req.body.content === "string" ? req.body.content.trim() : "";
    if (!req.body.receiverId || req.body.receiverId === uid(req) || !content || content.length > 1000) {
      res.status(400).json({ error: "A valid receiver and message up to 1000 characters are required." });
      return;
    }
    const { data, error } = await getSocialStore().from("messages")
      .insert({ sender_id: uid(req), receiver_id: req.body.receiverId, content })
      .select("*").single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (error) { next(error); }
});

socialRouter.get("/messages", async (req, res, next) => {
  try {
    const userId = uid(req);
    const { data, error } = await getSocialStore().from("messages").select("*")
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .order("created_at", { ascending: false });
    if (error) throw error;
    const conversations = new Map<string, any>();
    for (const message of data ?? []) {
      const otherId = message.sender_id === userId ? message.receiver_id : message.sender_id;
      if (!conversations.has(otherId)) conversations.set(otherId, {
        otherUser: { id: otherId }, lastMessage: message,
        unreadCount: 0
      });
      if (message.receiver_id === userId && !message.is_read) conversations.get(otherId).unreadCount++;
    }
    res.json([...conversations.values()]);
  } catch (error) { next(error); }
});

socialRouter.get("/messages/:userId", async (req, res, next) => {
  try {
    const userId = uid(req);
    const store = getSocialStore();
    const { data, error } = await store.from("messages").select("*")
      .or(`and(sender_id.eq.${userId},receiver_id.eq.${req.params.userId}),and(sender_id.eq.${req.params.userId},receiver_id.eq.${userId})`)
      .order("created_at", { ascending: true });
    if (error) throw error;
    await store.from("messages").update({ is_read: true }).eq("sender_id", req.params.userId).eq("receiver_id", userId).eq("is_read", false);
    res.json(data ?? []);
  } catch (error) { next(error); }
});

socialRouter.patch("/messages/:messageId/read", async (req, res, next) => {
  try {
    const { error } = await getSocialStore().from("messages").update({ is_read: true })
      .eq("id", req.params.messageId).eq("receiver_id", uid(req));
    if (error) throw error;
    res.status(204).send();
  } catch (error) { next(error); }
});

socialRouter.post("/communities", async (req, res, next) => {
  try {
    await ensureProfile(req);
    const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
    if (!name) { res.status(400).json({ error: "Community name is required." }); return; }
    const store = getSocialStore();
    const { data, error } = await store.from("communities")
      .insert({ name, description: req.body.description ?? null, category: req.body.category ?? null, is_private: Boolean(req.body.isPrivate), creator_id: uid(req) })
      .select("*").single();
    if (error) throw error;
    await store.from("community_members").insert({ community_id: data.id, user_id: uid(req), role: "admin" });
    res.status(201).json(data);
  } catch (error) { next(error); }
});

socialRouter.get("/communities", async (req, res, next) => {
  try {
    let query = getSocialStore().from("communities").select("*").order("member_count", { ascending: false });
    if (typeof req.query.category === "string" && req.query.category) query = query.eq("category", req.query.category);
    const { data, error } = await query;
    if (error) throw error;
    res.json(data ?? []);
  } catch (error) { next(error); }
});

socialRouter.post("/communities/:communityId/join", async (req, res, next) => {
  try {
    const store = getSocialStore();
    const { data: existing } = await store.from("community_members").select("id").eq("community_id", req.params.communityId).eq("user_id", uid(req)).maybeSingle();
    if (existing) { res.json({ joined: false }); return; }
    const { error } = await store.from("community_members").insert({ community_id: req.params.communityId, user_id: uid(req) });
    if (error) throw error;
    res.json({ joined: true });
  } catch (error) { next(error); }
});

socialRouter.delete("/communities/:communityId/membership", async (req, res, next) => {
  try {
    const { error } = await getSocialStore().from("community_members").delete().eq("community_id", req.params.communityId).eq("user_id", uid(req));
    if (error) throw error;
    res.status(204).send();
  } catch (error) { next(error); }
});
