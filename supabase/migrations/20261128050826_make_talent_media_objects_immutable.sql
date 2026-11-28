-- Prevent approved Talent media from being replaced without a new moderation pass.
-- The upload flow uses unique timestamped paths and upsert=false, so UPDATE is
-- not required. A replacement must be uploaded as a new object and registered
-- as a new pending talent_media row.
DROP POLICY IF EXISTS talent_media_bucket_owner_update ON storage.objects;
