/**
 * Structured Logger Configuration
 * Logging מתקדם עם Winston לפי תקני הייטק
 */

const winston = require('winston');

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue'
};

winston.addColors(colors);

// Custom format for structured logging
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf((info) => {
    const {
      timestamp, level, message, correlationId, userId, action, ...meta
    } = info;

    // Build structured log entry
    const logEntry = {
      timestamp,
      level,
      message,
      correlationId: correlationId || 'N/A',
      userId: userId || 'system',
      action: action || 'unknown'
    };

    // Add metadata if exists
    if (Object.keys(meta).length > 0) {
      logEntry.metadata = meta;
    }

    return JSON.stringify(logEntry);
  })
);

// Create transports array
const transports = [
  // Console output for all environments
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize({ all: true }),
      winston.format.simple()
    )
  })
];

// Add file transports in production
if (process.env.NODE_ENV === 'production') {
  transports.push(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      format
    })
  );
}

// Create the logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels,
  format,
  transports,
  exitOnError: false
});

/**
 * Helper function to create child logger with context
 * @param {Object} context - Context to include in all logs
 * @returns {Object} Child logger
 */
function createContextLogger(context = {}) {
  return {
    debug: (message, meta = {}) => logger.debug(message, { ...context, ...meta }),
    info: (message, meta = {}) => logger.info(message, { ...context, ...meta }),
    warn: (message, meta = {}) => logger.warn(message, { ...context, ...meta }),
    error: (message, meta = {}) => logger.error(message, { ...context, ...meta })
  };
}

/**
 * Express/Cloud Functions middleware for request logging
 */
function requestLogger(req, res, next) {
  const start = Date.now();
  const correlationId = req.headers['x-correlation-id'] || require('uuid').v4();

  // Attach correlation ID to request
  req.correlationId = correlationId;

  // Log request
  logger.info('Request received', {
    correlationId,
    method: req.method,
    path: req.path,
    userId: req.user?.uid || 'anonymous'
  });

  // Log response
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('Request completed', {
      correlationId,
      statusCode: res.statusCode,
      duration: `${duration}ms`
    });
  });

  next();
}

/**
 * Error logger for Cloud Functions
 */
function logError(error, context = {}) {
  logger.error(error.message, {
    ...context,
    errorName: error.name,
    errorCode: error.code,
    stack: error.stack
  });
}

/**
 * Success logger for Cloud Functions
 */
function logSuccess(action, context = {}) {
  logger.info(`Action succeeded: ${action}`, context);
}

module.exports = {
  logger,
  createContextLogger,
  requestLogger,
  logError,
  logSuccess
};
