function read(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

export function liveblocksSecretKey(): string | null {
  return read("LIVEBLOCKS_SECRET_KEY");
}
