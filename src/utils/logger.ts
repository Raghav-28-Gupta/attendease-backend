import winston from "winston";

const logger = winston.createLogger({
	level: process.env.NODE_ENV === "production" ? "info" : "debug",
	format: winston.format.combine(
		winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
		winston.format.errors({ stack: true }),
		winston.format.splat(),
		winston.format.json()
	),
	defaultMeta: { service: "attendease-api" },
	transports: [
		// Write all logs to console
		new winston.transports.Console({
			format: winston.format.combine(
				winston.format.colorize(),
				winston.format.printf(
					({ level, message, timestamp, ...metadata }) => {
						let msg = `${timestamp} [${level}]: ${message}`;
						if (Object.keys(metadata).length > 0) {
							msg += ` ${JSON.stringify(metadata)}`;
						}
						return msg;
					}
				)
			),
		}),

		// Write errors to file
		new winston.transports.File({
			filename: "logs/error.log",
			level: "error",
		}),

		// Write all logs to file
		new winston.transports.File({
			filename: "logs/combined.log",
		}),
	],
});

export default logger;
