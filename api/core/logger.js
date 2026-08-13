import fs from 'fs';
import path from 'path';

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

const LOG_COLORS = {
  DEBUG: '[36m',
  INFO: '[32m',
  WARN: '[33m',
  ERROR: '[31m',
  RESET: '[0m',
};

const LOG_DIR = path.join(process.cwd(), 'logs');
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_FILES = 7;

class Logger {
  constructor() {
    this.level = LOG_LEVELS[process.env.LOG_LEVEL?.toUpperCase() || 'INFO'];
    this.logFile = path.join(LOG_DIR, `app_${new Date().toISOString().split('T')[0]}.log`);
    this.ensureLogDir();
  }

  ensureLogDir() {
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }
  }

  rotateLogFile() {
    try {
      const stats = fs.statSync(this.logFile);
      if (stats.size >= MAX_FILE_SIZE) {
        const files = fs.readdirSync(LOG_DIR).filter(f => f.startsWith('app_'));
        files.sort((a, b) => b.localeCompare(a));

        for (let i = files.length - 1; i >= 0; i--) {
          const oldPath = path.join(LOG_DIR, files[i]);
          if (i >= MAX_FILES - 1) {
            fs.unlinkSync(oldPath);
          } else {
            const newName = files[i].replace(/app_(\d{4}-\d{2}-\d{2})\.log/, `app_$1_${i + 1}.log`);
            fs.renameSync(oldPath, path.join(LOG_DIR, newName));
          }
        }

        this.logFile = path.join(LOG_DIR, `app_${new Date().toISOString().split('T')[0]}.log`);
      }
    } catch (err) {
      console.error(`[Logger] Rotate failed: ${err.message}`);
    }
  }

  formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const pid = process.pid;
    const stack = meta.stack ? `\n${meta.stack}` : '';

    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      pid,
      message,
      ...(meta.error && { error: meta.error.message }),
      ...(meta.user && { user: meta.user }),
      ...(meta.requestId && { requestId: meta.requestId }),
      ...(meta.duration && { duration: meta.duration }),
      ...(meta.module && { module: meta.module }),
    };

    return {
      json: JSON.stringify(logEntry) + '\n',
      console: `${LOG_COLORS[level]}[${timestamp}] [${level}] ${message}${stack}${LOG_COLORS.RESET}`,
    };
  }

  log(level, message, meta = {}) {
    if (LOG_LEVELS[level] < this.level) return;

    const { json, console: consoleMsg } = this.formatMessage(level, message, meta);

    console.log(consoleMsg);

    try {
      this.rotateLogFile();
      fs.appendFileSync(this.logFile, json, 'utf8');
    } catch (err) {
      console.error(`[Logger] Write failed: ${err.message}`);
    }
  }

  debug(message, meta = {}) {
    this.log('DEBUG', message, meta);
  }

  info(message, meta = {}) {
    this.log('INFO', message, meta);
  }

  warn(message, meta = {}) {
    this.log('WARN', message, meta);
  }

  error(message, meta = {}) {
    this.log('ERROR', message, { ...meta, stack: meta.error?.stack });
  }

  request(req, res, durationMs, extra = {}) {
    const { method, originalUrl, ip } = req;
    const { statusCode } = res;
    const user = req.user?.email || 'anonymous';
    const route = req.route?.path || '';
    const userAgent = req.headers?.['user-agent'];
    const referer = req.headers?.referer;

    this.info(`${method} ${originalUrl} ${statusCode}`, {
      method,
      url: originalUrl,
      statusCode,
      duration: `${durationMs}ms`,
      bytes: extra.bytes,
      user,
      ip,
      route,
      userAgent,
      referer,
      requestId: req.requestId,
    });
  }

  audit(action, user, details = {}) {
    this.info(`[AUDIT] ${action}`, {
      action,
      user,
      ...details,
    });
  }

  llmCall(model, tokens, durationMs, success = true) {
    this.info(`[LLM] ${model} ${success ? 'OK' : 'FAIL'}`, {
      model,
      tokens,
      duration: `${durationMs}ms`,
      success,
    });
  }
}

export const logger = new Logger();

export function loggerMiddleware(req, res, next) {
  const startTime = Date.now();
  // request id is 12-char base36 — easy to grep, low collision risk per request.
  const requestId = Math.random().toString(36).slice(2, 14);
  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  // Track response size by wrapping both write() and end().  end() can be
  // called with a final chunk that we still need to count.
  let bytesOut = 0;
  const originalWrite = res.write.bind(res);
  res.write = function (chunk, ...rest) {
    if (chunk) bytesOut += Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk);
    return originalWrite(chunk, ...rest);
  };
  const originalEnd = res.end;
  res.end = function (chunk, ...rest) {
    if (chunk) bytesOut += Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk);
    const durationMs = Date.now() - startTime;
    logger.request(req, res, durationMs, { bytes: bytesOut });
    return originalEnd.call(this, chunk, ...rest);
  };

  next();
}
