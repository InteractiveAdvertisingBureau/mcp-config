// middleware/validationMiddleware.js
/**
 * Input validation middleware for API endpoints
 * Protects against injection attacks and malformed data
 */

/**
 * Validate domain parameter
 * Accepts both plain domains (example.com) and full URLs (https://example.com)
 */
export function validateDomain(req, res, next) {
  const { domain } = req.body;

  // Check if domain exists
  if (!domain) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Domain parameter is required'
    });
  }

  // Check type
  if (typeof domain !== 'string') {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Domain must be a string'
    });
  }

  // Check length (prevent extremely long inputs)
  if (domain.length > 255) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Domain exceeds maximum length of 255 characters'
    });
  }

  // Trim and validate format
  const cleanDomain = domain.trim();

  if (cleanDomain.length === 0) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Domain cannot be empty'
    });
  }

  // Regex patterns for validation
  const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-._]*[a-zA-Z0-9]$/;
  const urlRegex = /^https?:\/\//;

  // If it's a URL, validate with URL constructor
  if (urlRegex.test(cleanDomain)) {
    try {
      const urlObj = new URL(cleanDomain);

      // Only allow http and https protocols
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Only HTTP and HTTPS protocols are allowed'
        });
      }

      // Store validated domain in req for downstream use
      req.validatedDomain = cleanDomain;
      return next();
    } catch (err) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid URL format'
      });
    }
  }

  // If it's a plain domain, validate format
  if (!domainRegex.test(cleanDomain)) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Invalid domain format. Use format: example.com or https://example.com'
    });
  }

  // Check for suspicious characters that might indicate injection attempts
  const suspiciousChars = /[;&|`$(){}[\]<>'"\\]/;
  if (suspiciousChars.test(cleanDomain)) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Domain contains invalid characters'
    });
  }

  // Store validated domain in req for downstream use
  req.validatedDomain = cleanDomain;
  next();
}

/**
 * Validate user agent parameter (optional)
 */
export function validateUserAgent(req, res, next) {
  const { userAgent } = req.body;

  // User agent is optional, but if provided, validate it
  if (userAgent !== undefined) {
    if (typeof userAgent !== 'string') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'User-Agent must be a string'
      });
    }

    if (userAgent.length > 500) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'User-Agent exceeds maximum length'
      });
    }

    // Check for control characters that might be used for header injection
    const hasControlChars = /[\r\n\0]/.test(userAgent);
    if (hasControlChars) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'User-Agent contains invalid control characters'
      });
    }

    req.validatedUserAgent = userAgent.trim();
  }

  next();
}

/**
 * Validate error message parameter
 */
export function validateErrorMessage(req, res, next) {
  const { error_message } = req.body;

  if (error_message !== undefined) {
    if (typeof error_message !== 'string') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'error_message must be a string'
      });
    }

    if (error_message.length > 5000) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'error_message exceeds maximum length'
      });
    }

    req.validatedErrorMessage = error_message.trim();
  }

  next();
}

/**
 * Rate limiting helper - simple in-memory rate limiter
 * For production, use redis-based rate limiting
 */
const requestCounts = new Map();

export function rateLimit(maxRequests = 100, windowMs = 60000) {
  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const windowStart = now - windowMs;

    // Get request history for this IP
    if (!requestCounts.has(ip)) {
      requestCounts.set(ip, []);
    }

    const requests = requestCounts.get(ip);

    // Remove old requests outside the time window
    const recentRequests = requests.filter(timestamp => timestamp > windowStart);

    // Check if rate limit exceeded
    if (recentRequests.length >= maxRequests) {
      return res.status(429).json({
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Maximum ${maxRequests} requests per ${windowMs / 1000} seconds.`,
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }

    // Add current request
    recentRequests.push(now);
    requestCounts.set(ip, recentRequests);

    // Cleanup old entries periodically
    if (Math.random() < 0.01) { // 1% chance
      for (const [key, timestamps] of requestCounts.entries()) {
        const recent = timestamps.filter(t => t > windowStart);
        if (recent.length === 0) {
          requestCounts.delete(key);
        } else {
          requestCounts.set(key, recent);
        }
      }
    }

    next();
  };
}
