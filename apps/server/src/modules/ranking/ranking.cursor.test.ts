import { describe, it, expect } from "vitest";
import { decodeRankingCursor, encodeRankingCursor } from "./ranking.cursor.js";

describe("encodeRankingCursor / decodeRankingCursor", () => {
  it("roundtrips a valid payload", () => {
    const encoded = encodeRankingCursor({ rating: 1624, id: "team_abc" });
    expect(decodeRankingCursor(encoded)).toEqual({ rating: 1624, id: "team_abc" });
  });

  it("returns null for invalid base64 or JSON", () => {
    expect(decodeRankingCursor("not-valid-base64!!!")).toBeNull();
    expect(decodeRankingCursor("")).toBeNull();
  });

  it("returns null when rating or id are not valid", () => {
    const badRating = Buffer.from(JSON.stringify({ rating: "nope", id: "x" }), "utf8").toString("base64url");
    expect(decodeRankingCursor(badRating)).toBeNull();
    const badId = Buffer.from(JSON.stringify({ rating: 1500, id: "" }), "utf8").toString("base64url");
    expect(decodeRankingCursor(badId)).toBeNull();
  });
});
