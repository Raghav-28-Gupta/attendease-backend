import { emailTransporter, EMAIL_FROM } from "@config/email";
import logger from "@utils/logger";

export class EmailService {

	static async sendEmail(mailOptions: {
		from?: string;
		to: string;
		subject: string;
		html: string;
	}): Promise<void> {
		const options = {
			from: mailOptions.from || EMAIL_FROM,
			to: mailOptions.to,
			subject: mailOptions.subject,
			html: mailOptions.html,
		};

		try {
			await emailTransporter.sendMail(options);
			logger.info(`Email sent to ${mailOptions.to}`);
		} catch (error) {
			logger.error("Failed to send email:", error);
			throw error;
		}
	}
	
	static async sendVerificationEmail(
		email: string,
		firstName: string,
		token: string
	): Promise<void> {
		const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;

		const mailOptions = {
			from: EMAIL_FROM,
			to: email,
			subject: "Verify Your Email - AttendEase",
			html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Welcome to AttendEase, ${firstName}!</h2>
          <p>Thank you for signing up. Please verify your email address to activate your account.</p>
          <p>
            <a href="${verificationUrl}" 
               style="background-color: #4CAF50; color: white; padding: 12px 24px; 
                      text-decoration: none; border-radius: 4px; display: inline-block;">
              Verify Email Address
            </a>
          </p>
          <p>Or copy this link into your browser:</p>
          <p style="color: #666; font-size: 14px; word-break: break-all;">${verificationUrl}</p>
          <p style="color: #999; font-size: 12px;">This link will expire in 24 hours.</p>
          <p style="color: #999; font-size: 12px;">If you didn't create this account, please ignore this email.</p>
        </div>
      `,
		};

		try {
			await emailTransporter.sendMail(mailOptions);
			logger.info(`Verification email sent to ${email}`);
		} catch (error) {
			logger.error("Failed to send verification email:", error);
			throw error;
		}
	}

	static async sendPasswordResetEmail(
		email: string,
		firstName: string,
		token: string
	): Promise<void> {
		const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

		const mailOptions = {
			from: EMAIL_FROM,
			to: email,
			subject: "Reset Your Password - AttendEase",
			html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Password Reset Request</h2>
          <p>Hi ${firstName},</p>
          <p>We received a request to reset your password. Click the button below to reset it:</p>
          <p>
            <a href="${resetUrl}" 
               style="background-color: #2196F3; color: white; padding: 12px 24px; 
                      text-decoration: none; border-radius: 4px; display: inline-block;">
              Reset Password
            </a>
          </p>
          <p>Or copy this link into your browser:</p>
          <p style="color: #666; font-size: 14px; word-break: break-all;">${resetUrl}</p>
          <p style="color: #999; font-size: 12px;">This link will expire in 1 hour.</p>
          <p style="color: #999; font-size: 12px;">If you didn't request this, please ignore this email.</p>
        </div>
      `,
		};

		try {
			await emailTransporter.sendMail(mailOptions);
			logger.info(`Password reset email sent to ${email}`);
		} catch (error) {
			logger.error("Failed to send password reset email:", error);
			throw error;
		}
	}
}
