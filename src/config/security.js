function jwtLifetimeSeconds(value = '1d') {
  const match = /^(\d+)(s|m|h|d)$/.exec(value);
  if (!match) throw new Error('JWT_EXPIRES_IN must use seconds, minutes, hours, or days (for example 1d)');
  const multipliers = { s: 1, m: 60, h: 3600, d: 86400 };
  const seconds = Number(match[1]) * multipliers[match[2]];
  if (!Number.isSafeInteger(seconds) || seconds < 60 || seconds > 30 * 86400) {
    throw new Error('JWT_EXPIRES_IN must be between 60 seconds and 30 days');
  }
  return seconds;
}

function validateSecurityConfig(env = process.env) {
  if (!env.JWT_SECRET || env.JWT_SECRET.startsWith('replace-') || Buffer.byteLength(env.JWT_SECRET) < 32) {
    throw new Error('JWT_SECRET must be a unique random secret of at least 32 bytes');
  }
  jwtLifetimeSeconds(env.JWT_EXPIRES_IN || '1d');
  if (env.NODE_ENV === 'production' && env.COOKIE_SECURE !== 'true') {
    throw new Error('COOKIE_SECURE=true is required in production');
  }
  const sameSite = env.COOKIE_SAME_SITE || 'lax';
  if (!['lax', 'strict', 'none'].includes(sameSite)) {
    throw new Error('COOKIE_SAME_SITE must be lax, strict, or none');
  }
  if (sameSite === 'none' && env.COOKIE_SECURE !== 'true') {
    throw new Error('COOKIE_SECURE=true is required when COOKIE_SAME_SITE=none');
  }
}

module.exports = { jwtLifetimeSeconds, validateSecurityConfig };
