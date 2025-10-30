import admin from "firebase-admin";
import logger from "@utils/logger";

// Initialize Firebase Admin (using service account)
const initializeFirebase = () => {
	try {
		// Option 1: Using service account JSON file
		if (process.env.FIREBASE_SERVICE_ACCOUNT) {
			const serviceAccount = JSON.parse(
				process.env.FIREBASE_SERVICE_ACCOUNT
			);

			admin.initializeApp({
				credential: admin.credential.cert(serviceAccount),
			});
		}
		// Option 2: Using individual environment variables
		else if (
			process.env.FIREBASE_PROJECT_ID &&
			process.env.FIREBASE_CLIENT_EMAIL &&
			process.env.FIREBASE_PRIVATE_KEY
		) {
			admin.initializeApp({
				credential: admin.credential.cert({
					projectId: process.env.FIREBASE_PROJECT_ID,
					clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
					privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(
						/\\n/g,
						"\n"
					),
				}),
			});
		} else {
			logger.warn("Firebase not configured - push notifications disabled");
			return null;
		}

		logger.info("Firebase Admin initialized");
		return admin;
	} catch (error) {
		logger.error("Firebase initialization failed:", error);
		return null;
	}
};

export const firebaseAdmin = initializeFirebase();

export const getMessaging = () => {
	if (!firebaseAdmin) {
		throw new Error("Firebase not initialized");
	}
	return firebaseAdmin.messaging();
};
