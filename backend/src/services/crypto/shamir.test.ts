import { describe, expect, it } from "vitest";

import { generateAesKey } from "./aes.js";
import { combineShares, splitKey } from "./shamir.js";

const config = {
  totalShares: 5,
  threshold: 3,
} as const;

describe("shamir secret sharing", () => {
  it("creates shares according to configuration and recovers original key", () => {
    const key = generateAesKey();
    const shares = splitKey(key, config);

    expect(shares).toHaveLength(config.totalShares);
    shares.forEach((share) => {
      expect(typeof share).toBe("string");
      expect(share.length).toBeGreaterThan(0);
    });

    const recovered = combineShares(shares.slice(0, config.threshold));
    expect(recovered.equals(key)).toBe(true);
  });

  it("cannot recover key if shares are less than threshold", () => {
    const key = generateAesKey();
    const shares = splitKey(key, config);

    const insufficientShares = shares.slice(0, config.threshold - 1);
    const attempted = combineShares(insufficientShares);

    expect(insufficientShares.length).toBe(config.threshold - 1);
    expect(attempted.equals(key)).toBe(false);
  });
});


