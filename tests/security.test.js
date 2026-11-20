const test = require('node:test');
const assert = require('node:assert/strict');
const { validateSecurityConfig } = require('../src/config/security');

const validConfig = { JWT_SECRET: 'test-secret-that-is-long-enough-for-security', NODE_ENV: 'production', COOKIE_SECURE: 'true' };

test('security config accepts cross-site cookies only with Secure enabled', () => {
  assert.doesNotThrow(() => validateSecurityConfig({ ...validConfig, COOKIE_SAME_SITE: 'none' }));
  assert.throws(() => validateSecurityConfig({ ...validConfig, COOKIE_SECURE: 'false', COOKIE_SAME_SITE: 'none' }), /COOKIE_SECURE=true/);
  assert.throws(() => validateSecurityConfig({ ...validConfig, COOKIE_SAME_SITE: 'invalid' }), /COOKIE_SAME_SITE/);
});
