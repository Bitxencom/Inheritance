import dotenv from "dotenv";

dotenv.config();

// Default gateway: Arweave Mainnet
const getDefaultArweaveGateway = () => {
  return "https://arweave.net";
};

export const appEnv = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.BACKEND_PORT ?? process.env.PORT ?? 7002),
  arweaveGateway: process.env.ARWEAVE_GATEWAY ?? getDefaultArweaveGateway(),
  unlockPolicySecret: process.env.UNLOCK_POLICY_SECRET ?? "dev-insecure-unlock-policy-secret",
  // Shamir Secret Sharing: 3-of-5 threshold scheme
  shamirThreshold: 3,
  shamirTotalShares: 5,
};

export const isProduction = appEnv.nodeEnv === "production";
