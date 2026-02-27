/**
 * Security Headers Middleware
 * 
 * Features:
 * - Content Security Policy (CSP)
 * - XSS Protection
 * - Content Type Options
 * - Frame Options
 * - HSTS (HTTP Strict Transport Security)
 * - Referrer Policy
 * - Permissions Policy
 */

import { Context, Next } from 'hono';

/**
 * Security headers configuration
 */
export interface SecurityOptions {
  /** Enable Content Security Policy */
  csp?: boolean | CspDirectives;
  /** Enable X-XSS-Protection header */
  xssProtection?: boolean;
  /** Enable X-Content-Type-Options header */
  contentTypeOptions?: boolean;
  /** Enable X-Frame-Options header */
  frameOptions?: boolean | 'DENY' | 'SAMEORIGIN';
  /** Enable Strict-Transport-Security header */
  hsts?: boolean | HstsOptions;
  /** Enable Referrer-Policy header */
  referrerPolicy?: boolean | string;
  /** Enable Permissions-Policy header */
  permissionsPolicy?: boolean | string;
  /** Remove X-Powered-By header */
  hidePoweredBy?: boolean;
}

/**
 * Content Security Policy directives
 */
export interface CspDirectives {
  'default-src'?: string[];
  'script-src'?: string[];
  'style-src'?: string[];
  'img-src'?: string[];
  'font-src'?: string[];
  'connect-src'?: string[];
  'frame-ancestors'?: string[];
  'form-action'?: string[];
  'base-uri'?: string[];
  'object-src'?: string[];
  'upgrade-insecure-requests'?: boolean;
}

/**
 * HSTS options
 */
export interface HstsOptions {
  maxAge?: number;
  includeSubDomains?: boolean;
  preload?: boolean;
}

/**
 * Default CSP directives for API
 */
const DEFAULT_CSP: CspDirectives = {
  'default-src': ["'none'"],
  'frame-ancestors': ["'none'"],
  'form-action': ["'none'"],
  'base-uri': ["'none'"],
  'object-src': ["'none'"],
};

/**
 * Build CSP header value from directives
 */
function buildCspValue(directives: CspDirectives): string {
  const parts: string[] = [];
  
  for (const [directive, value] of Object.entries(directives)) {
    if (value === true) {
      parts.push(directive);
    } else if (Array.isArray(value)) {
      parts.push(`${directive} ${value.join(' ')}`);
    }
  }
  
  return parts.join('; ');
}

/**
 * Build HSTS header value from options
 */
function buildHstsValue(options: HstsOptions): string {
  const parts: string[] = [`max-age=${options.maxAge || 31536000}`];
  
  if (options.includeSubDomains !== false) {
    parts.push('includeSubDomains');
  }
  
  if (options.preload) {
    parts.push('preload');
  }
  
  return parts.join('; ');
}

/**
 * Security headers middleware
 */
export function securityHeaders(options: SecurityOptions = {}) {
  const {
    csp = true,
    xssProtection = true,
    contentTypeOptions = true,
    frameOptions = true,
    hsts = false, // Only enable in production with HTTPS
    referrerPolicy = true,
    permissionsPolicy = true,
    hidePoweredBy = true,
  } = options;

  return async (c: Context, next: Next) => {
    // Set security headers before processing request
    
    // Content Security Policy
    if (csp) {
      const directives = typeof csp === 'boolean' ? DEFAULT_CSP : csp;
      c.header('Content-Security-Policy', buildCspValue(directives));
    }
    
    // XSS Protection
    if (xssProtection) {
      c.header('X-XSS-Protection', '1; mode=block');
    }
    
    // Content Type Options (prevents MIME type sniffing)
    if (contentTypeOptions) {
      c.header('X-Content-Type-Options', 'nosniff');
    }
    
    // Frame Options (prevents clickjacking)
    if (frameOptions) {
      const value = typeof frameOptions === 'string' ? frameOptions : 'DENY';
      c.header('X-Frame-Options', value);
    }
    
    // HTTP Strict Transport Security (only in production)
    if (hsts) {
      const hstsValue = typeof hsts === 'object' ? buildHstsValue(hsts) : buildHstsValue({});
      c.header('Strict-Transport-Security', hstsValue);
    }
    
    // Referrer Policy
    if (referrerPolicy) {
      const value = typeof referrerPolicy === 'string' ? referrerPolicy : 'strict-origin-when-cross-origin';
      c.header('Referrer-Policy', value);
    }
    
    // Permissions Policy (formerly Feature Policy)
    if (permissionsPolicy) {
      const value = typeof permissionsPolicy === 'string' 
        ? permissionsPolicy 
        : 'camera=(), microphone=(), geolocation=(), payment=(), usb=()';
      c.header('Permissions-Policy', value);
    }
    
    // Remove X-Powered-By (hide server info)
    if (hidePoweredBy) {
      c.header('X-Powered-By', undefined);
    }
    
    await next();
  };
}

/**
 * CORS Configuration for Agent Talk API
 * 
 * Restricts origins to known domains
 */
export interface CorsConfig {
  /** Allowed origins (use '*' for public APIs, or specific domains) */
  allowedOrigins: string[] | '*';
  /** Allowed HTTP methods */
  allowedMethods?: string[];
  /** Allowed headers */
  allowedHeaders?: string[];
  /** Exposed headers */
  exposedHeaders?: string[];
  /** Allow credentials (cookies, authorization headers) */
  allowCredentials?: boolean;
  /** Max age for preflight cache */
  maxAge?: number;
}

/**
 * Default CORS configuration for Agent Talk
 */
export const DEFAULT_CORS_CONFIG: CorsConfig = {
  allowedOrigins: process.env.NODE_ENV === 'production' 
    ? [
        'https://talk.onhyper.io',
        'https://onhyper.io',
        'https://www.onhyper.io',
      ]
    : '*', // Allow all origins in development
  allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Api-Key',
    'X-Request-Id',
  ],
  exposedHeaders: ['X-Request-Id'],
  allowCredentials: true,
  maxAge: 86400, // 24 hours
};

/**
 * Custom CORS middleware with origin validation
 */
export function corsMiddleware(config: CorsConfig = DEFAULT_CORS_CONFIG) {
  return async (c: Context, next: Next) => {
    const origin = c.req.header('Origin');
    
    // Handle preflight requests
    if (c.req.method === 'OPTIONS') {
      // Check if origin is allowed
      if (origin) {
        const isAllowed = config.allowedOrigins === '*' || 
          config.allowedOrigins.includes(origin);
        
        if (isAllowed) {
          const allowedOrigin = config.allowedOrigins === '*' ? '*' : origin;
          c.header('Access-Control-Allow-Origin', allowedOrigin);
          
          if (config.allowedMethods) {
            c.header('Access-Control-Allow-Methods', config.allowedMethods.join(', '));
          }
          
          if (config.allowedHeaders) {
            c.header('Access-Control-Allow-Headers', config.allowedHeaders.join(', '));
          }
          
          if (config.allowCredentials) {
            c.header('Access-Control-Allow-Credentials', 'true');
          }
          
          if (config.maxAge) {
            c.header('Access-Control-Max-Age', config.maxAge.toString());
          }
        }
      }
      
      return c.body(null, 204);
    }
    
    // Handle actual requests
    if (origin) {
      const isAllowed = config.allowedOrigins === '*' || 
        config.allowedOrigins.includes(origin);
      
      if (isAllowed) {
        const allowedOrigin = config.allowedOrigins === '*' ? '*' : origin;
        c.header('Access-Control-Allow-Origin', allowedOrigin);
        
        if (config.allowCredentials) {
          c.header('Access-Control-Allow-Credentials', 'true');
        }
        
        if (config.exposedHeaders) {
          c.header('Access-Control-Expose-Headers', config.exposedHeaders.join(', '));
        }
      }
    }
    
    await next();
  };
}

/**
 * Combined security middleware with all protections
 */
export function applySecurityMiddlewares(options: {
  cors?: CorsConfig;
  security?: SecurityOptions;
} = {}) {
  return [
    corsMiddleware(options.cors),
    securityHeaders(options.security),
  ];
}
