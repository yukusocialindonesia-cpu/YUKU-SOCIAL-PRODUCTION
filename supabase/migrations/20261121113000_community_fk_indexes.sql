-- Index foreign-key columns used by account cleanup and moderation lookups.
CREATE INDEX IF NOT EXISTS community_comments_author_idx
  ON public.community_comments (author_id);
CREATE INDEX IF NOT EXISTS community_comments_moderated_by_idx
  ON public.community_comments (moderated_by);
CREATE INDEX IF NOT EXISTS community_likes_user_idx
  ON public.community_likes (user_id);
CREATE INDEX IF NOT EXISTS community_posts_moderated_by_idx
  ON public.community_posts (moderated_by);
CREATE INDEX IF NOT EXISTS community_reports_comment_idx
  ON public.community_reports (comment_id);
CREATE INDEX IF NOT EXISTS community_reports_post_idx
  ON public.community_reports (post_id);
CREATE INDEX IF NOT EXISTS community_reports_reviewed_by_idx
  ON public.community_reports (reviewed_by);
