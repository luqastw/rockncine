import { VideoPreset, type TrackPublishOptions } from "livekit-client";

export const BROADCAST_QUALITY = {
  preset: new VideoPreset({
    width: 1280,
    height: 720,
    maxBitrate: 4_000_000,
    maxFramerate: 60,
    priority: "medium",
  }),
};

export type BroadcastQuality = typeof BROADCAST_QUALITY;

export function broadcastPublishOptions(quality: BroadcastQuality): TrackPublishOptions {
  return {
    screenShareEncoding: quality.preset.encoding,
    degradationPreference: "maintain-framerate",
    simulcast: false,
  };
}
