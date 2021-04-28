const Sqreen = process.env.SQREEN_APP_NAME ? require('sqreen') : require('./server/utils/middleware/sqreen.mock');
var config = require('./server/config/config');
const Sentry = require('@sentry/node');
const { Integrations } = require('@sentry/tracing');
const beeline = require('honeycomb-beeline')({
  dataset: config.get('env'),
  serviceName: 'sfc',
  sampleRate: 7,
  express: {
    userContext: ['id'],
    parentIdSource: 'X-Honeycomb-Trace',
    traceIdSource: 'X-Honeycomb-Trace',
  },
  presendHook: (ev) => {
    delete ev.data['db.query'];
    delete ev.data['db.query_args'];
  },
});

var express = require('express');

var path = require('path');
var favicon = require('serve-favicon');
var morgan = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var proxy = require('express-http-proxy'); // for service public/download content
var compression = require('compression');

// app config
var AppConfig = require('./server/config/appConfig');

// caching middleware - ref and transactional
var cacheMiddleware = require('./server/utils/middleware/noCache');
var refCacheMiddleware = require('./server/utils/middleware/refCache');
const { authLimiter, dbLimiter } = require('./server/utils/middleware/rateLimiting');

// security libraries
var helmet = require('helmet');
var xssClean = require('xss-clean');
var sanitizer = require('express-sanitizer');
var locations = require('./server/routes/locations');
var postcodes = require('./server/routes/postcodes');
var services = require('./server/routes/services');
var registration = require('./server/routes/registration');
var establishments = require('./server/routes/establishments');
var ownershipRequest = require('./server/routes/ownershipRequest');
var linkParent = require('./server/routes/parentSubLinking');
var jobs = require('./server/routes/jobs');
var la = require('./server/routes/la');
var feedback = require('./server/routes/feedback');
var login = require('./server/routes/login');
var logout = require('./server/routes/logout');
var ethnicity = require('./server/routes/ethnicity');
var country = require('./server/routes/country');
var nationality = require('./server/routes/nationalities');
var qualification = require('./server/routes/qualifications');
var recruitedFrom = require('./server/routes/recruitedFrom');
var user = require('./server/routes/accounts/user');
var workerLeaveReasons = require('./server/routes/workerReason');
var serviceUsers = require('./server/routes/serviceUsers');
var workingTrainingCategories = require('./server/routes/workerTrainingCategories');
var nurseSpecialism = require('./server/routes/nurseSpecialism');
var availableQualifications = require('./server/routes/availableQualifications');
var approvals = require('./server/routes/approvals');
var satisfactionSurvey = require('./server/routes/satisfactionSurvey');
var registrationSurvey = require('./server/routes/registrationSurvey');

// admin route
var admin = require('./server/routes/admin');

// reports
var ReportsRoute = require('./server/routes/reports/index');

var errors = require('./server/routes/errors');

// SNS
const AWSsns = require('./server/aws/sns');
AWSsns.initialise(config.get('aws.region'));

// test only routes - helpers to setup and execute automated tests
var testOnly = require('./server/routes/testOnly');

var app = express();

app.use(Sqreen.middleware);

if (config.get('sentry.dsn')) {
  Sentry.init({
    dsn: config.get('sentry.dsn'),
    integrations: [
      // enable Express.js middleware tracing
      new Integrations.Express({ app }),
    ],
    environment: config.get('env'),
  });
}
app.use(
  Sentry.Handlers.requestHandler({
    user: ['id'],
  }),
);
app.use(compression());

/* public/download - proxy interception */
const publicDownloadBaseUrl = config.get('public.download.baseurl');
app.use(
  '/public/download',
  proxy(publicDownloadBaseUrl, {
    proxyReqPathResolver: function (req) {
      const updatedPath = publicDownloadBaseUrl + req.url;
      //console.log("public/download proxy API request to: ", `${updatedPath}`)
      return updatedPath;
    },
  }),
);

// redirect the admin application
app.use('/admin', (req, res) => {
  res.redirect(301, config.get('admin.url'));
});

/*
 * security - incorproate helmet & xss-clean (de facto/good practice headers) across all endpoints
 */

// exclude middleware for given API path - used to exclude xss-clean to be able to demonstrate express-sanitizer on /api/test
var unless = function (root, path, middleware) {
  return function (req, res, next) {
    const rootRegex = new RegExp('^' + root);
    const excludePathRegex = new RegExp('^' + root + '/' + path);

    // first, if the exclude root, simply move on
    if (excludePathRegex.test(req.path)) {
      return next();
    } else if (rootRegex.test(req.path)) {
      // matches on the root path, and is not excluded
      return middleware(req, res, next);
    } else {
      // doesn't match the root path, so move on
      return next();
    }
  };
};

app.disable('x-powered-by');

app.use(
  helmet({
    referrerPolicy: {
      policy: 'strict-origin-when-cross-origin',
    },
    frameguard: {
      action: 'deny',
    },
    permittedCrossDomainPolicies: {
      permittedPolicies: 'none',
    },
    expectCt: {
      maxAge: 86400,
    },
    dnsPrefetchControl: {
      allow: true,
    },
    hsts: false,
    contentSecurityPolicy: false,
  }),
);

// disable Helmet's caching - because we control that directly - cahcing is not enabled by default; but explicitly disabling it here
// set frame policy to deny
// only use on '/api' endpoint, because these changes may otherwise impact on the UI.
app.use(
  '/api',
  helmet({
    noCache: false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
      },
    },
  }),
  dbLimiter,
);

// encodes all URL parameters
app.use(unless('/api', 'test', xssClean()));

/*
 * end security
 */

// view engine setup
app.set('views', path.join(__dirname, '/server/views'));
app.set('view engine', 'pug');

app.use(favicon(path.join(__dirname, 'dist/favicon.ico')));
app.use(
  morgan('short', {
    stream: {
      write: (text) => {
        console.log(text);
      },
    },
  }),
);
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

/*
 * security - removes unwanted HTML from data
 */

app.use('/api/test', sanitizer()); // used as demonstration on test routes only

/*
 * end security
 */

app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'dist')));

// open/reference endpoints
app.use('/api/services', [refCacheMiddleware.refcache, services]);
app.use('/api/ethnicity', [refCacheMiddleware.refcache, ethnicity]);
app.use('/api/country', [refCacheMiddleware.refcache, country]);
app.use('/api/nationality', [refCacheMiddleware.refcache, nationality]);
app.use('/api/qualification', [refCacheMiddleware.refcache, qualification]);
app.use('/api/recruitedFrom', [refCacheMiddleware.refcache, recruitedFrom]);
app.use('/api/jobs', [refCacheMiddleware.refcache, jobs]);
app.use('/api/localAuthority', [refCacheMiddleware.refcache, la]);
app.use('/api/worker/leaveReasons', [refCacheMiddleware.refcache, workerLeaveReasons]);
app.use('/api/serviceUsers', [refCacheMiddleware.refcache, serviceUsers]);
app.use('/api/trainingCategories', workingTrainingCategories);
app.use('/api/nurseSpecialism', [refCacheMiddleware.refcache, nurseSpecialism]);
app.use('/api/availableQualifications', [refCacheMiddleware.refcache, availableQualifications]);

// transaction endpoints
app.use('/api/errors', errors);
app.use('/api/locations', [cacheMiddleware.nocache, locations]);
app.use('/api/postcodes', [cacheMiddleware.nocache, postcodes]);
app.use('/api/registration', [cacheMiddleware.nocache, registration]);
app.use('/api/login', [cacheMiddleware.nocache, login]);
app.use('/api/logout', [cacheMiddleware.nocache, logout]);
app.use('/api/establishment', [cacheMiddleware.nocache, establishments]);
app.use('/api/ownershipRequest', [cacheMiddleware.nocache, ownershipRequest]);
app.use('/api/parentLinkingDetails', [cacheMiddleware.nocache, linkParent]);
app.use('/api/feedback', [cacheMiddleware.nocache, feedback]);
app.use('/api/test', [cacheMiddleware.nocache, testOnly]);
app.use('/api/user', [cacheMiddleware.nocache, user]);
app.use('/api/reports', [cacheMiddleware.nocache, ReportsRoute]);
app.use('/api/satisfactionSurvey', [cacheMiddleware.nocache, satisfactionSurvey]);
app.use('/api/registrationSurvey', [cacheMiddleware.nocache, registrationSurvey]);

app.use('/api/admin', [cacheMiddleware.nocache, admin]);
app.use('/api/approvals', [cacheMiddleware.nocache, approvals]);

app.use('/loaderio-63e80cd3c669177f22e9ec997ea2594d.txt', authLimiter);
app.get('/loaderio-63e80cd3c669177f22e9ec997ea2594d.txt', function (req, res) {
  res.sendFile(path.join(__dirname, 'loaderio-63e80cd3c669177f22e9ec997ea2594d.txt'));
});

app.use('*', authLimiter);
app.get('*', function (req, res) {
  res.sendFile(path.join(__dirname, 'dist/index.html'));
});

app.use(Sentry.Handlers.errorHandler());
// Optional fallthrough error handler
app.use(function onError(err, req, res) {
  // The error id is attached to `res.sentry` to be returned
  // and optionally displayed to the user for support.
  res.statusCode = 500;
  res.end(res.sentry + '\n');
});
// catch 404 and forward to error handler
app.use(function (req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function (err, req, res) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err,
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function (err, req, res) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {},
  });
});

const startApp = () => {
  if (config.get('honeycomb.write_key')) {
    beeline._apiForTesting().honey.writeKey = config.get('honeycomb.write_key');
  }

  const listenPort = parseInt(config.get('listen.port'), 10);
  app.set('port', listenPort);
  app.listen(app.get('port'));
  console.log('Listening on port: ' + app.get('port'));
};

if (AppConfig.ready) {
  startApp();
} else {
  AppConfig.on(AppConfig.READY_EVENT, () => {
    startApp();
  });
}

module.exports = app;
