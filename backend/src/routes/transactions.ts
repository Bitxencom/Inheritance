import express, { Request, Response } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const transactionRouter = express.Router();

// Path to transaction log file
const LOG_DIR = path.join(__dirname, "../../logs");
const LOG_FILE = path.join(LOG_DIR, "transactions.json");

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Initialize log file if it doesn't exist
if (!fs.existsSync(LOG_FILE)) {
  fs.writeFileSync(LOG_FILE, JSON.stringify({ transactions: [] }, null, 2));
}

interface TransactionLog {
  id: string;
  vaultId: string;
  txHash: string;
  chainId: string;
  chainName: string;
  contractAddress: string;
  fromAddress: string;
  dataHash: string;
  storageURI: string;
  fee: string;
  timestamp: string;
  blockExplorerUrl?: string;
}

interface TransactionLogFile {
  transactions: TransactionLog[];
}

/**
 * POST /api/v1/transactions/log
 * Log a successful blockchain transaction
 */
transactionRouter.post("/log", (req: Request, res: Response) => {
  try {
    const {
      vaultId,
      txHash,
      chainId,
      chainName,
      contractAddress,
      fromAddress,
      dataHash,
      storageURI,
      fee,
      blockExplorerUrl,
    } = req.body;

    // Validate required fields
    if (!vaultId || !txHash || !chainId) {
      res.status(400).json({
        success: false,
        error: "Missing required fields: vaultId, txHash, chainId",
      });
      return;
    }

    // Read existing logs
    const logsData: TransactionLogFile = JSON.parse(fs.readFileSync(LOG_FILE, "utf-8"));

    // Create new log entry
    const newLog: TransactionLog = {
      id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      vaultId,
      txHash,
      chainId,
      chainName: chainName || "Unknown",
      contractAddress: contractAddress || "",
      fromAddress: fromAddress || "",
      dataHash: dataHash || "",
      storageURI: storageURI || "",
      fee: fee || "0",
      timestamp: new Date().toISOString(),
      blockExplorerUrl: blockExplorerUrl || undefined,
    };

    // Add to logs
    logsData.transactions.push(newLog);

    // Save to file
    fs.writeFileSync(LOG_FILE, JSON.stringify(logsData, null, 2));

    console.log(`📝 Transaction logged: ${txHash.slice(0, 10)}... for vault ${vaultId}`);

    res.json({
      success: true,
      message: "Transaction logged successfully",
      log: newLog,
    });
  } catch (error) {
    console.error("❌ Error logging transaction:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to log transaction",
    });
  }
});

/**
 * GET /api/v1/transactions
 * Get all transaction logs
 */
transactionRouter.get("/", (_req: Request, res: Response) => {
  try {
    const logsData: TransactionLogFile = JSON.parse(fs.readFileSync(LOG_FILE, "utf-8"));
    res.json({
      success: true,
      count: logsData.transactions.length,
      transactions: logsData.transactions,
    });
  } catch (error) {
    console.error("❌ Error reading transaction logs:", error);
    res.status(500).json({
      success: false,
      error: "Failed to read transaction logs",
    });
  }
});

/**
 * GET /api/v1/transactions/:vaultId
 * Get transaction logs for a specific vault
 */
transactionRouter.get("/:vaultId", (req: Request, res: Response) => {
  try {
    const { vaultId } = req.params;
    const logsData: TransactionLogFile = JSON.parse(fs.readFileSync(LOG_FILE, "utf-8"));
    
    const vaultTransactions = logsData.transactions.filter(
      (tx: TransactionLog) => tx.vaultId === vaultId
    );

    res.json({
      success: true,
      vaultId,
      count: vaultTransactions.length,
      transactions: vaultTransactions,
    });
  } catch (error) {
    console.error("❌ Error reading transaction logs:", error);
    res.status(500).json({
      success: false,
      error: "Failed to read transaction logs",
    });
  }
});

/**
 * DELETE /api/v1/transactions
 * Clear all transaction logs
 */
transactionRouter.delete("/", (_req: Request, res: Response) => {
  try {
    fs.writeFileSync(LOG_FILE, JSON.stringify({ transactions: [] }, null, 2));
    res.json({
      success: true,
      message: "All transaction logs cleared",
    });
  } catch (error) {
    console.error("❌ Error clearing transaction logs:", error);
    res.status(500).json({
      success: false,
      error: "Failed to clear transaction logs",
    });
  }
});
