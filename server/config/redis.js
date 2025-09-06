const redis = require('redis');
require('dotenv').config();

let redisClient = null;

const connectRedis = async () => {
  try {
    const redisConfig = {
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      db: process.env.REDIS_DB || 0,
      retry_strategy: (options) => {
        if (options.error && options.error.code === 'ECONNREFUSED') {
          console.error('Redis server connection refused');
          return new Error('Redis server connection refused');
        }
        if (options.total_retry_time > 1000 * 60 * 60) {
          console.error('Redis retry time exhausted');
          return new Error('Redis retry time exhausted');
        }
        if (options.attempt > 10) {
          console.error('Redis connection attempts exceeded');
          return undefined;
        }
        // Exponential backoff
        return Math.min(options.attempt * 100, 3000);
      }
    };

    redisClient = redis.createClient(redisConfig);

    redisClient.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });

    redisClient.on('connect', () => {
      console.log('Connected to Redis server');
    });

    redisClient.on('ready', () => {
      console.log('Redis client ready');
    });

    redisClient.on('end', () => {
      console.log('Redis client connection closed');
    });

    await redisClient.connect();
    return redisClient;
  } catch (error) {
    console.error('Redis connection error:', error);
    throw error;
  }
};

const getRedisClient = () => {
  if (!redisClient || !redisClient.isOpen) {
    throw new Error('Redis client not initialized or not connected. Call connectRedis() first.');
  }
  return redisClient;
};

// Cache utility functions
const cache = {
  // Set a key with optional expiration (in seconds)
  set: async (key, value, expireInSeconds = null) => {
    try {
      const client = getRedisClient();
      const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
      
      if (expireInSeconds) {
        await client.setEx(key, expireInSeconds, stringValue);
      } else {
        await client.set(key, stringValue);
      }
      return true;
    } catch (error) {
      console.error('Redis SET error:', error);
      return false;
    }
  },

  // Get a key and parse JSON if needed
  get: async (key, parseJson = true) => {
    try {
      const client = getRedisClient();
      const value = await client.get(key);
      
      if (value === null) return null;
      
      if (parseJson) {
        try {
          return JSON.parse(value);
        } catch (parseError) {
          // If parsing fails, return as string
          return value;
        }
      }
      
      return value;
    } catch (error) {
      console.error('Redis GET error:', error);
      return null;
    }
  },

  // Delete a key
  del: async (key) => {
    try {
      const client = getRedisClient();
      const result = await client.del(key);
      return result > 0;
    } catch (error) {
      console.error('Redis DEL error:', error);
      return false;
    }
  },

  // Check if key exists
  exists: async (key) => {
    try {
      const client = getRedisClient();
      const result = await client.exists(key);
      return result === 1;
    } catch (error) {
      console.error('Redis EXISTS error:', error);
      return false;
    }
  },

  // Set expiration for a key
  expire: async (key, seconds) => {
    try {
      const client = getRedisClient();
      const result = await client.expire(key, seconds);
      return result === 1;
    } catch (error) {
      console.error('Redis EXPIRE error:', error);
      return false;
    }
  },

  // Increment a numeric value
  incr: async (key) => {
    try {
      const client = getRedisClient();
      return await client.incr(key);
    } catch (error) {
      console.error('Redis INCR error:', error);
      return null;
    }
  },

  // Add to set
  sadd: async (key, ...values) => {
    try {
      const client = getRedisClient();
      return await client.sAdd(key, values);
    } catch (error) {
      console.error('Redis SADD error:', error);
      return null;
    }
  },

  // Get all set members
  smembers: async (key) => {
    try {
      const client = getRedisClient();
      return await client.sMembers(key);
    } catch (error) {
      console.error('Redis SMEMBERS error:', error);
      return [];
    }
  },

  // Remove from set
  srem: async (key, ...values) => {
    try {
      const client = getRedisClient();
      return await client.sRem(key, values);
    } catch (error) {
      console.error('Redis SREM error:', error);
      return null;
    }
  }
};

// Specialized cache functions for the application
const appCache = {
  // User session management
  setUserSession: async (userId, sessionData, expireInHours = 24) => {
    const key = `session:${userId}`;
    const expireInSeconds = expireInHours * 60 * 60;
    return await cache.set(key, sessionData, expireInSeconds);
  },

  getUserSession: async (userId) => {
    const key = `session:${userId}`;
    return await cache.get(key);
  },

  deleteUserSession: async (userId) => {
    const key = `session:${userId}`;
    return await cache.del(key);
  },

  // Project data caching
  setProjectData: async (projectId, projectData, expireInMinutes = 30) => {
    const key = `project:${projectId}`;
    const expireInSeconds = expireInMinutes * 60;
    return await cache.set(key, projectData, expireInSeconds);
  },

  getProjectData: async (projectId) => {
    const key = `project:${projectId}`;
    return await cache.get(key);
  },

  invalidateProjectCache: async (projectId) => {
    const key = `project:${projectId}`;
    return await cache.del(key);
  },

  // Task status counters
  setTaskCounters: async (projectId, counters, expireInMinutes = 15) => {
    const key = `counters:${projectId}`;
    const expireInSeconds = expireInMinutes * 60;
    return await cache.set(key, counters, expireInSeconds);
  },

  getTaskCounters: async (projectId) => {
    const key = `counters:${projectId}`;
    return await cache.get(key);
  },

  // Recent activity cache
  addRecentActivity: async (projectId, activity, maxActivities = 50) => {
    try {
      const client = getRedisClient();
      const key = `activity:${projectId}`;
      const activityString = JSON.stringify(activity);
      
      // Add to list and trim to max size
      await client.lPush(key, activityString);
      await client.lTrim(key, 0, maxActivities - 1);
      
      // Set expiration for the list
      await client.expire(key, 24 * 60 * 60); // 24 hours
      
      return true;
    } catch (error) {
      console.error('Redis recent activity error:', error);
      return false;
    }
  },

  getRecentActivities: async (projectId, count = 20) => {
    try {
      const client = getRedisClient();
      const key = `activity:${projectId}`;
      const activities = await client.lRange(key, 0, count - 1);
      
      return activities.map(activity => {
        try {
          return JSON.parse(activity);
        } catch (error) {
          return activity;
        }
      });
    } catch (error) {
      console.error('Redis get recent activities error:', error);
      return [];
    }
  },

  // Online users tracking
  setUserOnline: async (userId, socketId) => {
    const key = `online:${userId}`;
    return await cache.set(key, socketId, 300); // 5 minutes
  },

  setUserOffline: async (userId) => {
    const key = `online:${userId}`;
    return await cache.del(key);
  },

  isUserOnline: async (userId) => {
    const key = `online:${userId}`;
    return await cache.exists(key);
  },

  // Rate limiting
  incrementRateLimit: async (identifier, windowSeconds = 900) => { // 15 minutes default
    const key = `ratelimit:${identifier}`;
    const current = await cache.incr(key);
    
    if (current === 1) {
      await cache.expire(key, windowSeconds);
    }
    
    return current;
  },

  getRateLimitCount: async (identifier) => {
    const key = `ratelimit:${identifier}`;
    const count = await cache.get(key, false);
    return count ? parseInt(count) : 0;
  }
};

// Graceful shutdown
const closeRedis = async () => {
  if (redisClient && redisClient.isOpen) {
    await redisClient.quit();
    console.log('Redis connection closed');
  }
};

module.exports = {
  connectRedis,
  getRedisClient,
  cache,
  appCache,
  closeRedis
};
