import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import type { ZodType } from "zod";
import { ApiError } from "@utils/ApiError";

export const validate = (schema: ZodType) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        const result = await schema.safeParseAsync({
            body: req.body,
            query: req.query,
            params: req.params,
        });

        if (!result.success) {
            const errors = result.error.issues.map((e) => ({
                field: e.path.join("."),
                message: e.message,
            }));

            return res.status(400).json({
                success: false,
                message: "Validation failed",
                errors,
            });
        }

        next();
    };
};