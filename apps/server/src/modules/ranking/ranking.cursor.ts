export type RankingCursorPayload = { rating: number; id: string };

export function encodeRankingCursor(payload: RankingCursorPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodeRankingCursor(encoded: string): RankingCursorPayload | null {
  try {
    const raw = Buffer.from(encoded, "base64url").toString("utf8");
    const o = JSON.parse(raw) as unknown;
    if (!o || typeof o !== "object") return null;
    const rec = o as Record<string, unknown>;
    const rating = rec.rating;
    const id = rec.id;
    if (typeof rating !== "number" || !Number.isFinite(rating) || typeof id !== "string" || id.length === 0) {
      return null;
    }
    return { rating, id };
  } catch {
    return null;
  }
}
