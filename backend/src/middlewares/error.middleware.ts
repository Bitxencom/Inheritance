import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";

/**
 * Global error handler middleware.
 * Must be registered LAST with 4 parameters so Express recognises it as an error handler.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const globalErrorHandler = (
    err: unknown,
    _req: Request,
    res: Response,
    _next: NextFunction,
): void => {
    console.error("❌ Backend error", err);

    // Zod validation errors
    if (err instanceof ZodError) {
        const errorMessages = err.issues.map((issue) => {
            const path = issue.path.join(".");
            return `${path}: ${issue.message}`;
        });
        res.status(400).json({
            success: false,
            error: errorMessages.join(", "),
            details: err.issues,
        });
        return;
    }

    res.status(500).json({
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
    });
};
