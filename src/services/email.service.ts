import nodemailer from "nodemailer";
import logger from "@utils/logger";

interface EmailOptions {
	from: string;
	to: string;
	subject: string;
	html: string;
}

export class EmailService {
	private static transporter = nodemailer.createTransport({
		host: process.env.EMAIL_HOST,
		port: parseInt(process.env.EMAIL_PORT || "587"),
		secure: process.env.EMAIL_SECURE === "true",
		auth: {
			user: process.env.EMAIL_USER,
			pass: process.env.EMAIL_PASSWORD,
		},
	});

	/**
	 * Send email
	 */
	static async sendEmail(options: EmailOptions) {
		try {
			const info = await this.transporter.sendMail(options);
			logger.info(`Email sent: ${info.messageId}`);
			return info;
		} catch (error) {
			logger.error("Failed to send email:", error);
			throw error;
		}
	}

	/**
	 * Send verification email (existing)
	 */
	static async sendVerificationEmail(
		email: string,
		firstName: string,
		verificationToken: string
	): Promise<void> {
		const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;

		const mailOptions: EmailOptions = {
			from: process.env.EMAIL_FROM || "noreply@attendease.com",
			to: email,
			subject: "Verify Your Email - AttendEase",
			html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Welcome to AttendEase, ${firstName}!</h2>
          <p>Please verify your email address by clicking the button below:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}" 
               style="background-color: #28a745; color: white; padding: 14px 28px; 
                      text-decoration: none; border-radius: 6px; display: inline-block;">
              ✅ Verify Email
            </a>
          </div>
          <p>Or copy this link: ${verificationUrl}</p>
          <p style="color: #666; font-size: 12px;">
            This link expires in 24 hours.
          </p>
        </div>
      `,
		};

		await this.sendEmail(mailOptions);
	}

	/**
	 * Send low attendance alert email 
	 */
	static async sendLowAttendanceAlertEmail(
		email: string,
		data: {
			studentName: string;
			subjectCode: string;
			subjectName: string;
			percentage: number;
			sessionsNeeded: number;
			status: "WARNING" | "CRITICAL";
		}
	): Promise<void> {
		const statusColor = data.status === "CRITICAL" ? "#dc3545" : "#ffc107";
		const statusIcon = data.status === "CRITICAL" ? "🚨" : "⚠️";
		const urgency = data.status === "CRITICAL" ? "CRITICAL" : "Warning";

		const mailOptions: EmailOptions = {
			from: process.env.EMAIL_FROM || "noreply@attendease.com",
			to: email,
			subject: `${statusIcon} ${urgency}: Low Attendance in ${data.subjectCode}`,
			html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: ${statusColor}; color: white; padding: 20px; border-radius: 8px; text-align: center;">
            <h1 style="margin: 0; font-size: 24px;">${statusIcon} ${urgency}: Low Attendance Alert</h1>
          </div>
          
          <div style="background-color: #f8f9fa; padding: 20px; margin-top: 20px; border-radius: 8px;">
            <h2 style="margin-top: 0;">Hi ${data.studentName},</h2>
            <p>Your attendance in <strong>${data.subjectName} (${
				data.subjectCode
			})</strong> has dropped below the required threshold.</p>
            
            <table style="width: 100%; margin: 20px 0; border-collapse: collapse;">
              <tr>
                <td style="padding: 10px; background-color: white; border: 1px solid #dee2e6;">
                  <strong>Current Attendance:</strong>
                </td>
                <td style="padding: 10px; background-color: white; border: 1px solid #dee2e6;">
                  <span style="color: ${statusColor}; font-size: 20px; font-weight: bold;">${
				data.percentage
			}%</span>
                </td>
              </tr>
              <tr>
                <td style="padding: 10px; background-color: white; border: 1px solid #dee2e6;">
                  <strong>Required Attendance:</strong>
                </td>
                <td style="padding: 10px; background-color: white; border: 1px solid #dee2e6;">
                  <strong>75%</strong>
                </td>
              </tr>
              <tr>
                <td style="padding: 10px; background-color: white; border: 1px solid #dee2e6;">
                  <strong>Classes Needed:</strong>
                </td>
                <td style="padding: 10px; background-color: white; border: 1px solid #dee2e6;">
                  <strong>${data.sessionsNeeded} more classes</strong>
                </td>
              </tr>
            </table>
            
            ${
					data.status === "CRITICAL"
						? `
              <div style="background-color: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin: 20px 0;">
                <strong>⚠️ Urgent Action Required:</strong>
                <p style="margin: 10px 0 0 0;">You are at risk of not meeting the minimum attendance requirement. Please attend the next ${data.sessionsNeeded} classes without fail.</p>
              </div>
            `
						: `
              <div style="background-color: #d1ecf1; padding: 15px; border-left: 4px solid #0c5460; margin: 20px 0;">
                <strong>ℹ️ Action Recommended:</strong>
                <p style="margin: 10px 0 0 0;">Attend the next ${data.sessionsNeeded} classes to reach the 75% threshold.</p>
              </div>
            `
				}
            
            <p style="margin-top: 20px;">
              <a href="${process.env.FRONTEND_URL}/dashboard" 
                 style="background-color: #007bff; color: white; padding: 12px 24px; 
                        text-decoration: none; border-radius: 6px; display: inline-block;">
                View Full Attendance Report
              </a>
            </p>
          </div>
          
          <div style="margin-top: 20px; padding: 20px; background-color: #f8f9fa; border-radius: 8px;">
            <h3>Tips to Improve Attendance:</h3>
            <ul>
              <li>Set reminders for classes</li>
              <li>Check your timetable daily</li>
              <li>Inform teacher in advance if you need to miss class</li>
              <li>Attend makeup sessions if available</li>
            </ul>
          </div>
          
          <p style="color: #666; font-size: 12px; text-align: center; margin-top: 30px;">
            This is an automated alert from AttendEase. Please do not reply to this email.
          </p>
        </div>
      `,
		};

		await this.sendEmail(mailOptions);
		logger.info(
			`Low attendance email sent to ${email} (${data.percentage}% in ${data.subjectCode})`
		);
	}

	/**
	 * Send attendance marked notification email 
	 */
	static async sendAttendanceMarkedEmail(
		email: string,
		data: {
			studentName: string;
			subjectCode: string;
			subjectName: string;
			date: string;
			status: string;
			percentage: number;
		}
	): Promise<void> {
		const statusEmoji =
			{
				PRESENT: "✅",
				ABSENT: "❌",
				LATE: "⏰",
				EXCUSED: "📝",
			}[data.status] || "📊";

		const statusColor =
			{
				PRESENT: "#28a745",
				ABSENT: "#dc3545",
				LATE: "#ffc107",
				EXCUSED: "#17a2b8",
			}[data.status] || "#6c757d";

		const mailOptions: EmailOptions = {
			from: process.env.EMAIL_FROM || "noreply@attendease.com",
			to: email,
			subject: `${statusEmoji} Attendance Marked: ${data.subjectCode} - ${data.date}`,
			html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2>Attendance Update</h2>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
            <p>Hi ${data.studentName},</p>
            <p>Your attendance has been marked for <strong>${
					data.subjectName
				} (${data.subjectCode})</strong>.</p>
            
            <table style="width: 100%; margin: 20px 0; border-collapse: collapse;">
              <tr>
                <td style="padding: 10px; background-color: white; border: 1px solid #dee2e6;">
                  <strong>Date:</strong>
                </td>
                <td style="padding: 10px; background-color: white; border: 1px solid #dee2e6;">
                  ${data.date}
                </td>
              </tr>
              <tr>
                <td style="padding: 10px; background-color: white; border: 1px solid #dee2e6;">
                  <strong>Status:</strong>
                </td>
                <td style="padding: 10px; background-color: white; border: 1px solid #dee2e6;">
                  <span style="color: ${statusColor}; font-weight: bold;">${statusEmoji} ${
				data.status
			}</span>
                </td>
              </tr>
              <tr>
                <td style="padding: 10px; background-color: white; border: 1px solid #dee2e6;">
                  <strong>Current Attendance:</strong>
                </td>
                <td style="padding: 10px; background-color: white; border: 1px solid #dee2e6;">
                  <strong>${data.percentage}%</strong>
                </td>
              </tr>
            </table>
            
            ${
					data.status === "ABSENT"
						? `
              <div style="background-color: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin-top: 20px;">
                <strong>⚠️ Note:</strong> If this marking is incorrect, please contact your teacher immediately.
              </div>
            `
						: ""
				}
          </div>
          
          <p style="text-align: center; margin-top: 20px;">
            <a href="${process.env.FRONTEND_URL}/dashboard" 
               style="background-color: #007bff; color: white; padding: 12px 24px; 
                      text-decoration: none; border-radius: 6px; display: inline-block;">
              View Dashboard
            </a>
          </p>
          
          <p style="color: #666; font-size: 12px; text-align: center; margin-top: 30px;">
            AttendEase - Automated Attendance Management
          </p>
        </div>
      `,
		};

		await this.sendEmail(mailOptions);
	}

	/**
	 * Send weekly attendance summary
	 */
	static async sendWeeklyAttendanceSummary(
		email: string,
		data: {
			studentName: string;
			subjects: {
				code: string;
				name: string;
				percentage: number;
				status: "GOOD" | "WARNING" | "CRITICAL";
				sessionsThisWeek: number;
			}[];
		}
	): Promise<void> {
		const subjectsHTML = data.subjects
			.map(
				(subject) => `
        <tr>
          <td style="padding: 10px; border: 1px solid #dee2e6;">${
					subject.name
				}</td>
          <td style="padding: 10px; border: 1px solid #dee2e6; text-align: center;">${
					subject.sessionsThisWeek
				}</td>
          <td style="padding: 10px; border: 1px solid #dee2e6; text-align: center;">
            <span style="color: ${
					subject.status === "GOOD"
						? "#28a745"
						: subject.status === "WARNING"
						? "#ffc107"
						: "#dc3545"
				}; font-weight: bold;">
              ${subject.percentage}%
            </span>
          </td>
          <td style="padding: 10px; border: 1px solid #dee2e6; text-align: center;">
            ${
					subject.status === "GOOD"
						? "✅"
						: subject.status === "WARNING"
						? "⚠️"
						: "🚨"
				}
          </td>
        </tr>
      `
			)
			.join("");

		const mailOptions: EmailOptions = {
			from: process.env.EMAIL_FROM || "noreply@attendease.com",
			to: email,
			subject: `📊 Weekly Attendance Summary`,
			html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2>📊 Your Weekly Attendance Summary</h2>
          
          <p>Hi ${data.studentName},</p>
          <p>Here's your attendance summary for this week:</p>
          
          <table style="width: 100%; margin: 20px 0; border-collapse: collapse;">
            <thead>
              <tr style="background-color: #007bff; color: white;">
                <th style="padding: 10px; border: 1px solid #dee2e6; text-align: left;">Subject</th>
                <th style="padding: 10px; border: 1px solid #dee2e6; text-align: center;">Sessions</th>
                <th style="padding: 10px; border: 1px solid #dee2e6; text-align: center;">Attendance</th>
                <th style="padding: 10px; border: 1px solid #dee2e6; text-align: center;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${subjectsHTML}
            </tbody>
          </table>
          
          ${
					data.subjects.some(
						(s) => s.status === "WARNING" || s.status === "CRITICAL"
					)
						? `
            <div style="background-color: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin: 20px 0;">
              <strong>⚠️ Action Required:</strong>
              <p style="margin: 10px 0 0 0;">You have subjects with low attendance. Please attend more classes to maintain the 75% requirement.</p>
            </div>
          `
						: ""
				}
          
          <p style="text-align: center; margin-top: 20px;">
            <a href="${process.env.FRONTEND_URL}/dashboard" 
               style="background-color: #007bff; color: white; padding: 12px 24px; 
                      text-decoration: none; border-radius: 6px; display: inline-block;">
              View Full Report
            </a>
          </p>
        </div>
      `,
		};

		await this.sendEmail(mailOptions);
	}
}
