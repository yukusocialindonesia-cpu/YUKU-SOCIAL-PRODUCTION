import { supabase } from '../lib/supabase';

export type CommunityTopic = 'Pertemanan' | 'Kuliner' | 'Travel & Aktivitas' | 'Hobi' | 'Gaming';

export interface CommunityComment {
  id: string;
  author_id: string;
  author_display_name: string;
  body: string;
  created_at: string;
}

export interface CommunityPost {
  id: string;
  author_id: string;
  author_display_name: string;
  body: string;
  topic: CommunityTopic;
  created_at: string;
  likes_count: number;
  comments_count: number;
  likedByMe: boolean;
  comments: CommunityComment[];
}

type PostRow = Omit<CommunityPost, 'likedByMe' | 'comments'> & {
  community_comments: CommunityComment[] | null;
};

export async function loadCommunityPosts(currentUserId: string | null): Promise<CommunityPost[]> {
  const { data, error } = await supabase
    .from('community_posts')
    .select('id, author_id, author_display_name, body, topic, created_at, likes_count, comments_count, community_comments(id, author_id, author_display_name, body, created_at)')
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) throw error;

  const rows = (data || []) as unknown as PostRow[];
  const postIds = rows.map((post) => post.id);
  let likedPostIds = new Set<string>();

  if (currentUserId && postIds.length > 0) {
    const { data: likes, error: likesError } = await supabase
      .from('community_likes')
      .select('post_id')
      .eq('user_id', currentUserId)
      .in('post_id', postIds);

    if (likesError) throw likesError;
    likedPostIds = new Set((likes || []).map((like) => like.post_id));
  }

  return rows.map((post) => ({
    ...post,
    likes_count: post.likes_count || 0,
    comments_count: post.comments_count || 0,
    likedByMe: likedPostIds.has(post.id),
    comments: post.community_comments || [],
  }));
}

export async function createCommunityPost(userId: string, body: string, topic: CommunityTopic) {
  const { error } = await supabase.from('community_posts').insert({
    author_id: userId,
    body: body.trim(),
    topic,
  });
  if (error) throw error;
}

export async function toggleCommunityLike(postId: string, userId: string, currentlyLiked: boolean) {
  if (currentlyLiked) {
    const { error } = await supabase.from('community_likes').delete()
      .eq('post_id', postId).eq('user_id', userId);
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from('community_likes').insert({
    post_id: postId,
    user_id: userId,
  });
  if (error) throw error;
}

export async function createCommunityComment(postId: string, userId: string, body: string) {
  const { error } = await supabase.from('community_comments').insert({
    post_id: postId,
    author_id: userId,
    body: body.trim(),
  });
  if (error) throw error;
}

export async function reportCommunityPost(postId: string, userId: string, reason: string) {
  const { error } = await supabase.from('community_reports').insert({
    post_id: postId,
    reporter_id: userId,
    reason,
  });
  if (error) throw error;
}
