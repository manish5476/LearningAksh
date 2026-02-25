const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const fileUpload = require('express-fileupload');
const useragent = require('express-useragent');
const responseTime = require('response-time');
const promClient = require('prom-client');
const { v4: uuidv4 } = require('uuid');

const AppError = require('./utils/appError');
const globalErrorHandler = require('./controllers/errorController');
const routes = require('./routes');
const logger = require('./utils/logger');
const queueMonitor = require('./jobs/queueMonitor');
const { protect, restrictTo } = require('./middlewares/authMiddleware');
const { auditLog } = require('./middlewares/auditMiddleware');

const app = express();

// ============================================
// PROMETHEUS METRICS COLLECTION
// ============================================
const collectDefaultMetrics = promClient.collectDefaultMetrics;
collectDefaultMetrics({ timeout: 5000 });

const httpRequestDurationMicroseconds = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'code'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
});

const activeConnections = new promClient.Gauge({
  name: 'http_active_connections',
  help: 'Number of active connections'
});

// ============================================
// TRUST PROXY (for rate limiting behind reverse proxies)
// ============================================
app.enable('trust proxy');

// ============================================
// REQUEST ID GENERATION
// ============================================
app.use((req, res, next) => {
  req.id = uuidv4();
  res.setHeader('X-Request-ID', req.id);
  next();
});

// ============================================
// RESPONSE TIME MONITORING
// ============================================
app.use(responseTime((req, res, time) => {
  if (req.route) {
    httpRequestDurationMicroseconds
      .labels(req.method, req.route.path, res.statusCode)
      .observe(time / 1000);
  }
}));

// ============================================
// ACTIVE CONNECTIONS MONITORING
// ============================================
app.use((req, res, next) => {
  activeConnections.inc();
  res.on('finish', () => activeConnections.dec());
  next();
});

// ============================================
// SECURITY HEADERS (Helmet)
// ============================================
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
      connectSrc: ["'self'", 'https://api.stripe.com', 'https://api.razorpay.com']
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// ============================================
// CORS CONFIGURATION
// ============================================
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = process.env.ALLOWED_ORIGINS 
      ? process.env.ALLOWED_ORIGINS.split(',') 
      : ['http://localhost:3000', 'http://localhost:3001'];
    
    if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['X-Request-ID', 'X-RateLimit-Limit', 'X-RateLimit-Remaining']
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// ============================================
// USER AGENT PARSING
// ============================================
app.use(useragent.express());

// ============================================
// COOKIE PARSER
// ============================================
app.use(cookieParser(process.env.COOKIE_SECRET));

// ============================================
// SESSION MANAGEMENT
// ============================================
const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'your-session-secret',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    ttl: 24 * 60 * 60, // 1 day
    autoRemove: 'native',
    touchAfter: 24 * 3600
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax'
  }
};

if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

app.use(session(sessionConfig));

// ============================================
// FILE UPLOAD CONFIGURATION
// ============================================
app.use(fileUpload({
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max file size
  useTempFiles: true,
  tempFileDir: '/tmp/',
  debug: process.env.NODE_ENV === 'development',
  abortOnLimit: true,
  responseOnLimit: 'File size limit has been reached',
  createParentPath: true,
  parseNested: true
}));

// ============================================
// DEVELOPMENT LOGGING
// ============================================
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev', {
    skip: (req, res) => res.statusCode < 400,
    stream: { write: message => logger.http(message.trim()) }
  }));
} else {
  app.use(morgan('combined', {
    skip: (req, res) => res.statusCode < 400,
    stream: { write: message => logger.info(message.trim()) }
  }));
}

// ============================================
// RATE LIMITING (Multi-tier)
// ============================================

// Global API limiter
const globalLimiter = rateLimit({
  max: 1000, // limit each IP to 1000 requests per windowMs
  windowMs: 60 * 60 * 1000, // 1 hour
  message: 'Too many requests from this IP, please try again in an hour!',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.ip === '127.0.0.1' || req.path === '/health' || req.path === '/metrics'
});
app.use('/api', globalLimiter);

// Auth endpoints stricter limiter
const authLimiter = rateLimit({
  max: 10, // limit each IP to 10 auth requests per windowMs
  windowMs: 15 * 60 * 1000, // 15 minutes
  message: 'Too many authentication attempts, please try again after 15 minutes',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true
});
app.use('/api/v1/auth', authLimiter);

// Upload endpoints limiter
const uploadLimiter = rateLimit({
  max: 20, // limit each IP to 20 uploads per windowMs
  windowMs: 60 * 60 * 1000, // 1 hour
  message: 'Upload limit reached, please try again later',
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/v1/upload', uploadLimiter);

// ============================================
// BODY PARSER WITH SIZE LIMITS
// ============================================
app.use(express.json({ 
  limit: '50mb',
  verify: (req, res, buf) => {
    req.rawBody = buf.toString();
  }
}));

app.use(express.urlencoded({ 
  extended: true, 
  limit: '50mb',
  parameterLimit: 10000
}));

// ============================================
// DATA SANITIZATION
// ============================================

// NoSQL query injection prevention
app.use(mongoSanitize({
  replaceWith: '_',
  onSanitize: ({ req, key }) => {
    logger.warn(`NoSQL injection attempt detected: ${key}`, { 
      ip: req.ip, 
      path: req.path,
      requestId: req.id 
    });
  }
}));

// XSS prevention
app.use(xss());

// HTTP Parameter Pollution prevention
app.use(hpp({
  whitelist: [
    'duration', 'rating', 'price', 'level', 'category',
    'totalEnrollments', 'createdAt', 'sort', 'page', 'limit',
    'fields', 'search', 'populate', 'language', 'status'
  ]
}));

// ============================================
// COMPRESSION
// ============================================
app.use(compression({
  level: 6,
  threshold: 100 * 1024, // 100kb
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  }
}));

// ============================================
// STATIC FILES
// ============================================
app.use('/uploads', express.static('public/uploads', {
  maxAge: '30d',
  immutable: true,
  setHeaders: (res, path) => {
    if (path.endsWith('.pdf')) {
      res.setHeader('Content-Type', 'application/pdf');
    }
  }
}));

app.use('/public', express.static('public', {
  maxAge: '1d',
  immutable: false
}));

// ============================================
// REQUEST LOGGING (Audit)
// ============================================
app.use((req, res, next) => {
  // Log request details
  logger.http(`${req.method} ${req.originalUrl}`, {
    requestId: req.id,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    userId: req.user?._id,
    method: req.method,
    path: req.path,
    query: req.query,
    params: req.params
  });

  // Track response time
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.http(`${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`, {
      requestId: req.id,
      duration,
      statusCode: res.statusCode
    });
  });

  next();
});

// ============================================
// HEALTH CHECK ENDPOINT
// ============================================
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Server is healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    requestId: req.id,
    memory: process.memoryUsage(),
    cpu: process.cpuUsage()
  });
});

// ============================================
// METRICS ENDPOINT (for Prometheus)
// ============================================
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', promClient.register.contentType);
    res.end(await promClient.register.metrics());
  } catch (error) {
    res.status(500).end(error.message);
  }
});

// ============================================
// QUEUE MONITORING DASHBOARD (Admin only)
// ============================================
app.use(
  '/admin/queues',
  protect,
  restrictTo('admin'),
  queueMonitor.getRouter()
);

// ============================================
// QUEUE STATS ENDPOINT
// ============================================
app.get('/api/v1/admin/queue-stats', protect, restrictTo('admin'), async (req, res) => {
  try {
    const stats = await queueMonitor.getQueueStats();
    res.status(200).json({
      status: 'success',
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// ============================================
// API ROUTES
// ============================================
app.use('/api/v1', routes);

// ============================================
// 404 HANDLER
// ============================================
app.all('*', (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// ============================================
// GLOBAL ERROR HANDLER
// ============================================
app.use(globalErrorHandler);

// ============================================
// GRACEFUL SHUTDOWN HANDLER
// ============================================
process.on('SIGTERM', () => {
  logger.info('👋 SIGTERM received. Shutting down gracefully');
  server.close(() => {
    logger.info('💥 Process terminated');
  });
});

process.on('SIGINT', () => {
  logger.info('👋 SIGINT received. Shutting down gracefully');
  server.close(() => {
    logger.info('💥 Process terminated');
    process.exit(0);
  });
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

module.exports = app;
// const express = require('express');
// const morgan = require('morgan');
// const cors = require('cors');
// const helmet = require('helmet');
// const rateLimit = require('express-rate-limit');
// const mongoSanitize = require('express-mongo-sanitize');
// const xss = require('xss-clean');
// const hpp = require('hpp');
// const compression = require('compression');

// const AppError = require('./utils/appError');
// const globalErrorHandler = require('./controllers/errorController');
// const routes = require('./routes');

// const app = express();

// // Trust proxy (for rate limiting behind reverse proxies like Heroku, Nginx)
// app.enable('trust proxy');

// // Global Middleware
// // Set security HTTP headers
// app.use(helmet());

// // Development logging
// if (process.env.NODE_ENV === 'development') {
//   app.use(morgan('dev'));
// }

// // Rate limiting
// const limiter = rateLimit({
//   max: 100, // limit each IP to 100 requests per windowMs
//   windowMs: 60 * 60 * 1000, // 1 hour
//   message: 'Too many requests from this IP, please try again in an hour!'
// });
// app.use('/api', limiter);

// // Body parser, reading data from body into req.body
// app.use(express.json({ limit: '10mb' }));
// app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// // Data sanitization against NoSQL query injection
// app.use(mongoSanitize());

// // Data sanitization against XSS
// app.use(xss());

// // Prevent parameter pollution
// app.use(hpp({
//   whitelist: [
//     'duration', 'rating', 'price', 'level', 'category',
//     'totalEnrollments', 'createdAt'
//   ]
// }));

// // Compression for text responses
// app.use(compression());

// // CORS
// app.use(cors());
// app.options('*', cors());

// // Test middleware
// app.use((req, res, next) => {
//   req.requestTime = new Date().toISOString();
//   next();
// });

// // API Routes
// app.use('/api/v1', routes);

// // Handle undefined routes
// app.all('*', (req, res, next) => {
//   next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
// });

// // Global error handler
// app.use(globalErrorHandler);

// module.exports = app;
// // const express = require('express');
// // const cors = require('cors');
// // const helmet = require('helmet');
// // const morgan = require('morgan');
// // const apiRoutes = require('./routes');

// // const app = express();

// // // 1. Global Middlewares
// // app.use(helmet()); // Security headers
// // app.use(cors()); // Cross-Origin Resource Sharing
// // app.use(express.json()); // Parse incoming JSON payloads
// // app.use(express.urlencoded({ extended: true }));

// // // 2. Logging
// // if (process.env.NODE_ENV === 'development') {
// //   app.use(morgan('dev'));
// // }

// // // 3. Mount Routes
// // app.use('/api/v1', apiRoutes);

// // // 4. Global 404 Handler
// // app.use('*', (req, res) => {
// //   res.status(404).json({
// //     status: 'error',
// //     message: `Can't find ${req.originalUrl} on this server!`
// //   });
// // });

// // // 5. Global Error Handler (Add your custom error middleware here later)
// // app.use((err, req, res, next) => {
// //   console.error(err.stack);
// //   res.status(err.status || 500).json({
// //     status: 'error',
// //     message: err.message || 'Internal Server Error',
// //     ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
// //   });
// // });

// // module.exports = app;