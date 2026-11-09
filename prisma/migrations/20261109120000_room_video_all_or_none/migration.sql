ALTER TABLE "Room"
  ADD CONSTRAINT "Room_video_all_or_none"
  CHECK (
    ("videoSource" IS NULL AND "embedUrl" IS NULL AND "videoSourceUrl" IS NULL)
    OR ("videoSource" IS NOT NULL AND "embedUrl" IS NOT NULL AND "videoSourceUrl" IS NOT NULL)
  ) NOT VALID;
