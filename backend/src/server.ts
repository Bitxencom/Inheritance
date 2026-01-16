import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import Arweave from "arweave";

import { appEnv } from "./config/env.js";
import { vaultRouter } from "./routes/vault.js";
import { ragRouter } from "./routes/rag.js";
import { aiQualityRouter } from "./routes/ai-quality.js";

const app = express();

// CORS configuration
app.use(cors({
  origin: appEnv.nodeEnv === "development" 
    ? true // Allow all origins in development
    : [
        "http://localhost:7000",
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
      ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
}));

app.use(express.json({ limit: "50mb" }));

app.get("/health", async (_req, res) => {
  const healthStatus = {
    status: "ok",
    environment: appEnv.nodeEnv,
    timestamp: new Date().toISOString(),
    services: {
      backend: true,
      arweave: {
        available: false,
        gateway: appEnv.arweaveGateway,
        // hasJwk: !!appEnv.arweaveJwk, // JWK removed
        // walletFunded: false, // Wallet check removed
        // walletBalance: null as string | null, // Wallet check removed
        // walletAddress: null as string | null, // Wallet check removed
        error: null as string | null,
      },
    },
  };

  // Check Arweave availability
  try {
    const gatewayUrl = appEnv.arweaveGateway;
    const url = new URL(gatewayUrl);
    // Use url.origin to avoid port duplication
    // url.origin already includes protocol, hostname, and port
    const healthCheckUrl = `${url.origin}/info`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 seconds timeout
    
    try {
      const response = await fetch(healthCheckUrl, {
        method: "GET",
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      
      if (response.ok) {
        healthStatus.services.arweave.available = true;
        
        healthStatus.services.arweave.available = true;
        
        // JWK and Wallet checks removed as we use Client-Side Upload
        // If Arweave is available and has JWK, check wallet balance
        /*
        if (appEnv.arweaveJwk) {
            // ... (legacy check removed)
        }
        */
      } else {
        healthStatus.services.arweave.error = `HTTP ${response.status}`;
      }
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error) {
        if (error.name === "AbortError") {
          healthStatus.services.arweave.error = "Timeout - Blockchain storage not responding";
        } else {
          healthStatus.services.arweave.error = error.message;
        }
      } else {
        healthStatus.services.arweave.error = "Unknown error";
      }
    }
  } catch (error) {
    healthStatus.services.arweave.error = error instanceof Error ? error.message : "Invalid gateway URL";
  }

  // If Arweave is unavailable, set status to warning
  if (!healthStatus.services.arweave.available) {
    healthStatus.status = "warning";
  }

  res.json(healthStatus);
});

app.use("/api/v1/vaults", vaultRouter);
app.use("/api/v1/rag", ragRouter);
app.use("/api/v1/ai-quality", aiQualityRouter);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error("❌ Backend error", err);
  
  // Handle Zod validation errors
  if (err && typeof err === 'object' && 'issues' in err) {
    const zodError = err as { issues: Array<{ path: string[]; message: string }> };
    const errorMessages = zodError.issues.map(issue => {
      const path = issue.path.join('.');
      return `${path}: ${issue.message}`;
    });
    
    return res.status(400).json({
      success: false,
      error: errorMessages.join(', '),
      details: zodError.issues,
    });
  }
  
  res.status(500).json({
    success: false,
    error: err instanceof Error ? err.message : "Unknown error",
  });
});

app.listen(appEnv.port, () => {
  console.log(`🚀 Inheritance backend listening on port ${appEnv.port}`);
});

