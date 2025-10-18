import nodemailer from "nodemailer";

export const emailTransporter = nodemailer.createTransport({
	host: process.env.EMAIL_HOST,
	port: parseInt(process.env.EMAIL_PORT || "587"),
	secure: false, // true for 465, false for other ports
	auth: {
		user: process.env.EMAIL_USER,
		pass: process.env.EMAIL_PASSWORD,
	},
});

// Verify email connection on startup
emailTransporter.verify((error, success) => {
	if (error) {
		console.error("Email configuration error:", error);
	} else {
		console.log("✅ Email server ready");
	}
});

export const EMAIL_FROM =
	process.env.EMAIL_FROM || "AttendEase <noreply@attendease.com>";
