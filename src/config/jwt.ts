import jwt from "jsonwebtoken";

export const JWT_CONFIG = {
	secret: process.env.JWT_SECRET!,
	refreshSecret: process.env.JWT_REFRESH_SECRET!,
	expiresIn: process.env.JWT_EXPIRES_IN || "24h",
	refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
};

export interface JWTPayload {
	userId: string;
	email: string;
	role: "STUDENT" | "TEACHER";
	identifier?: string; // studentId or employeeId
}

export const generateAccessToken = (payload: JWTPayload): string => {
     // @ts-ignore
	return jwt.sign(payload, JWT_CONFIG.secret, {
		expiresIn: JWT_CONFIG.expiresIn,
	});
};

export const generateRefreshToken = (userId: string): string => {
     // @ts-ignore
	return jwt.sign({ userId }, JWT_CONFIG.refreshSecret, {
		expiresIn: JWT_CONFIG.refreshExpiresIn,
	});
};

export const verifyAccessToken = (token: string): JWTPayload => {
	return jwt.verify(token, JWT_CONFIG.secret) as JWTPayload;
};

export const verifyRefreshToken = (token: string): { userId: string } => {
	return jwt.verify(token, JWT_CONFIG.refreshSecret) as { userId: string };
};
