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
  likes: number;
  likedByMe: boolean;
  comments: CommunityComment[];
}

type PostRow = Omit<CommunityPost, 'likes' | 'likedByMe' | 'comments'> & {
  community_likes: { user_id: string }[];
  community_comments: CommunityComment[];
};

export async function loadCommunityPosts(currentUserId: string | null): Promise<CommunityPost[]> {
  const { data, error } = await supabase
    .from('community_posts')
    .select('id, author_id, author_display_name, body, topic, created_at, community_likes(user_id), community_comments(id, author_id, author_display_name, body, created_at)')
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) throw error;

  return ((data || []) as unknown as PostRow[]).map((post) => ({
    id: post.id,
    author_id: post.author_id,
    author_display_name: post.author_display_name,
    body: post.body,
    topic: post.topic,
    created_at: post.created_at,
    likes: post.community_likes?.length || 0,
    likedByMe: Boolean(currentUserId && post.community_likes?.some((like) => like.user_id === currentUserId)),
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
