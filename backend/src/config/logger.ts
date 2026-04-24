import pino from "pino";
import { appEnv } from "./env.js";

const isDev = appEnv.nodeEnv === "development";

export const logger = pino({
    level: isDev ? "debug" : "info",
    transport: {
        targets: [
            ...(isDev
                ? [
                    {
                        target: "pino-pretty",
                        level: "debug",
                        options: {
                            colorize: true,
                            ignore: "pid,hostname",
                            translateTime: "SYS:standard",
                        },
                    },
                ]
                : []),
            {
                target: "pino-roll",
                level: "info",
                options: {
                    file: "./logs/app.log",
                    frequency: "daily",
                    size: "10m",
                    mkdir: true,
                    extension: ".log",
                    limit: { count: 14 },
                },
            },
            {
                target: "pino-roll",
                level: "error",
                options: {
                    file: "./logs/error.log",
                    frequency: "daily",
                    mkdir: true,
                },
            },
        ],
    },
});
