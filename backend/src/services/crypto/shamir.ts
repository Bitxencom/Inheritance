import secrets from "secrets.js-grempe";

export type ShamirConfig = {
  totalShares: number;
  threshold: number;
};

export const splitKey = (key: Buffer, config: ShamirConfig) => {
  const hexKey = key.toString("hex");
  return secrets.share(
    hexKey,
    config.totalShares,
    config.threshold,
    undefined,
  );
};

export const combineShares = (shares: string[]): Buffer => {
  const hex = secrets.combine(shares);
  return Buffer.from(hex, "hex");
};

