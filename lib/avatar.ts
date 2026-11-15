export const DEFAULT_AVATAR_SRC = "/avatar-default.webp";

const USER_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export function isAvatarUserId(value: unknown): value is string {
  return typeof value === "string" && USER_ID_PATTERN.test(value);
}

export function parseAvatarVersion(value: unknown): number | undefined {
  if (typeof value !== "number") return undefined;
  if (!Number.isSafeInteger(value) || value <= 0) return undefined;
  return value;
}

export function avatarSrc(userId: unknown, version: unknown): string {
  const parsed = parseAvatarVersion(version);
  if (!isAvatarUserId(userId) || parsed === undefined) {
    return DEFAULT_AVATAR_SRC;
  }
  return `/api/avatar/${userId}?v=${parsed}`;
}
