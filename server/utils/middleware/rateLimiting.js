const config = require('../../config/config');
const RateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');

const vcapServices = JSON.parse(config.get('vcapServices'));

const store = new RedisStore({
  redisURL: vcapServices.redis.uri,
});

const rateLimiterConfig = {
  store,
  delayMs: 0, // disable delaying - full speed until the max limit is reached
  passIfNotConnected: true,
};

const authLimiter = new RateLimit({
  ...rateLimiterConfig,
  max: 100,
  prefix: 'auth:',
});

const dbLimiter = new RateLimit({
  ...rateLimiterConfig,
  max: 200,
  prefix: 'db:',
});

module.exports.authLimiter = authLimiter;
module.exports.dbLimiter = dbLimiter;
