import { z } from "zod";

export const triggerSchema = z
    .object({
        triggerType: z.enum(["date", "death", "manual"]),
        triggerDate: z.string().optional(),
    })
    .refine(
        (data) => {
            if (data.triggerType !== "date") {
                return !data.triggerDate || data.triggerDate.trim() === "";
            }
            return true;
        },
        {
            message: "Trigger date must be empty if trigger type is not date",
            path: ["triggerDate"],
        },
    );

export const vaultSchema = z
    .object({
        willDetails: z.object({
            willType: z.enum(["one-time", "editable"]),
            title: z.string(),
            content: z.string(),
            documents: z
                .array(
                    z.object({
                        name: z.string(),
                        size: z.number(),
                        type: z.string(),
                        content: z.string(), // base64 encoded file content
                    }),
                )
                .default([]),
        }),
        securityQuestions: z
            .array(
                z.object({
                    question: z.string(),
                    answer: z.string(),
                }),
            )
            .default([]),
        beneficiaries: z
            .array(
                z.object({
                    fullName: z.string(),
                    email: z.string().email(),
                    dateOfBirth: z.string(),
                    relationship: z.string(),
                }),
            )
            .optional()
            .default([]),
        triggerRelease: triggerSchema,
        payment: z.object({
            paymentMethod: z.enum(["wander", "metamask"]),
        }),
        enablePqc: z.boolean().optional().default(true),
    })
    .refine(
        (data) => {
            if (data.willDetails.willType === "editable") {
                return data.triggerRelease.triggerType === "manual";
            }
            return true;
        },
        {
            message: "Editable inheritance must use anytime (manual) trigger type",
            path: ["triggerRelease", "triggerType"],
        },
    );

export const clientEncryptedSchema = z
    .object({
        encryptedVault: z.object({
            cipherText: z.string(),
            iv: z.string(),
            checksum: z.string(),
            pqcCipherText: z.string().optional(),
            alg: z.enum(["AES-CBC", "AES-GCM"]).optional(),
            keyMode: z.enum(["pqc", "envelope"]).optional(),
        }),
        metadata: z.object({
            trigger: triggerSchema,
            beneficiaryCount: z.number(),
            securityQuestionHashes: z.array(
                z.object({
                    q: z.string().optional(),
                    a: z.string().optional(),
                    encryptedQuestion: z.string().optional(),
                    question: z.string().optional(),
                    answerHash: z.string().optional(),
                }),
            ),
            willType: z.enum(["one-time", "editable"]),
            isPqcEnabled: z.boolean().optional(),
            pqcPublicKey: z.any().optional(),
            contractEncryptedKey: z.string().optional(),
            encryptionVersion: z.union([z.literal("v2-client"), z.literal("v3-envelope")]),
        }),
    })
    .refine(
        (data) => {
            if (data.metadata.willType === "editable") {
                return data.metadata.trigger.triggerType === "manual";
            }
            return true;
        },
        {
            message: "Editable inheritance must use anytime (manual) trigger type",
            path: ["metadata", "trigger", "triggerType"],
        },
    );

export const unlockSchema = z.object({
    arweaveTxId: z.string().optional(),
    claimNonce: z.string().optional(),
    fractionKeys: z.array(z.string().min(1)).optional().default([]),
    securityQuestionAnswers: z
        .array(
            z.object({
                index: z.number().int().min(0).optional(),
                question: z.string().optional(),
                answer: z.string().min(1).max(256),
            }),
        )
        .min(3)
        .max(20)
        .optional(),
});

export const editSchema = z.object({
    willDetails: z.object({
        title: z.string().min(1),
        content: z.string().min(1),
        documents: z
            .array(
                z.object({
                    name: z.string(),
                    size: z.number(),
                    type: z.string(),
                    content: z.string().optional(),
                }),
            )
            .optional()
            .default([]),
    }),
    fractionKeys: z.array(z.string().min(1)).min(3),
    securityQuestions: z
        .array(
            z.object({
                question: z.string().min(1, "Question is required"),
                answer: z.string().min(1, "Answer is required"),
            }),
        )
        .min(3, "Minimum 3 security questions required")
        .optional(),
    arweaveTxId: z.string().optional(),
});

export const previewSchema = z.object({
    fractionKeys: z.array(z.string().min(1)).min(3),
    arweaveTxId: z.string().optional(),
    securityQuestionAnswers: z
        .array(
            z.object({
                question: z.string().optional(),
                answer: z.string(),
            }),
        )
        .optional(),
});

export const verifySecurityQuestionsSchema = z.object({
    claimNonce: z.string().optional(),
    securityQuestionAnswers: z
        .array(
            z.object({
                index: z.number().int().min(0).optional(),
                question: z.string().optional(),
                answer: z.string().min(1).max(256),
            }),
        )
        .min(3, "At least 3 security question answers are required")
        .max(20),
    arweaveTxId: z.string().optional(),
});

export const claimSchema = z.object({
    vaultId: z.string().min(1),
    arweaveTxId: z.string().optional(),
    fractionKeys: z.array(z.string().min(1)).min(3),
    securityAnswers: z
        .array(
            z.object({
                question: z.string(),
                answer: z.string(),
            }),
        )
        .min(3),
    beneficiaryEmail: z.string().email(),
});
