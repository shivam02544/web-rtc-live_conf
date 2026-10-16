/**
 * Secure configuration management
 * Never use fallback secrets in production
 */

export function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET;
  
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('AUTH_SECRET is required in production environment');
    }
    
    console.warn(
      '⚠️  WARNING: Using fallback secret for development. ' +
      'Set AUTH_SECRET environment variable for production.'
    );
    
    return 'fallback-secret-for-development-only-do-not-use-in-production';
  }
  
  // Validate secret strength
  if (secret.length < 32) {
    console.warn('⚠️  WARNING: AUTH_SECRET should be at least 32 characters long');
  }
  
  return secret;
}

export function getRedisUrl(): string {
  return process.env.REDIS_URL || 'redis://localhost:56379';
}

export function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  
  if (!url) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('DATABASE_URL is required in production environment');
    }
    return 'postgresql://postgres:postgres@localhost:55432/videocall';
  }
  
  return url;
}
