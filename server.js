var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

// caching middleware - ref and transactional
var cacheMiddleware = require('./server/utils/middleware/noCache');
var refCacheMiddleware = require('./server/utils/middleware/refCache');

// security libraries
var helmet = require('helmet');
var xssClean = require('xss-clean');
var sanitizer = require('express-sanitizer');

var routes = require('./server/routes/index');
var locations = require('./server/routes/locations');
var postcodes = require('./server/routes/postcodes');
var services = require('./server/routes/services');
var registration = require('./server/routes/registration');
var establishments = require('./server/routes/establishments');
var jobs = require('./server/routes/jobs');
var la = require('./server/routes/la');
var feedback = require('./server/routes/feedback');
var login = require('./server/routes/login');
var ethnicity = require('./server/routes/ethnicity');
var country = require('./server/routes/country');
var nationality = require('./server/routes/nationalities');
var qualification = require('./server/routes/qualifications');
var recruitedFrom = require('./server/routes/recruitedFrom');

var errors = require('./server/routes/errors');

// test only routes - helpers to setup and execute automated tests
var testOnly = require('./server/routes/testOnly');


var app = express();

/*  
 * security - incorproate helmet & xss-clean (de facto/good practice headers) across all endpoints
 */

// exclude middleware for given API path - used to exclude xss-clean to be able to demonstrate express-sanitizer on /api/test
var unless = function(root, path, middleware) {
    return function(req, res, next) {
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

// disable Helmet's caching - because we control that directly - cahcing is not enabled by default; but explicitly disabling it here
// set frame policy to deny
// only use on '/api' endpoint, because these changes may otherwise impact on the UI.
app.use('/api', helmet({
    noCache: false,
    frameguard: {
        action: 'deny'
    },
    contentSecurityPolicy : {
        directives: {
            defaultSrc: ["'self'"]
        }
    }
}));

// encodes all URL parameters
app.use(unless('/api', 'test', xssClean()));

/*  
 * end security
 */

// view engine setup
app.set('views', path.join(__dirname, '/server/views'));
app.set('view engine', 'jade');

app.use(favicon(path.join(__dirname, 'dist/favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

/*  
 * security - removes unwanted HTML from data
 */

app.use('/api/test', sanitizer());       // used as demonstration on test routes only

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

// transaction endpoints
app.use('/api/errors', errors);
app.use('/api/locations', [cacheMiddleware.nocache, locations]);
app.use('/api/postcodes', [cacheMiddleware.nocache, postcodes]);
app.use('/api/registration', [cacheMiddleware.nocache, registration]);
app.use('/api/login', [cacheMiddleware.nocache, login]);
app.use('/api/establishment', [cacheMiddleware.nocache,establishments]);
app.use('/api/feedback', [cacheMiddleware.nocache, feedback]);
app.use('/api/test', [cacheMiddleware.nocache,testOnly]);


app.get('*', function(req, res) {
  res.sendFile(path.join(__dirname, 'dist/index.html'));
});

// catch 404 and forward to error handler
app.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
    app.use(function(err, req, res, next) {
        res.status(err.status || 500);
        res.render('error', {
            message: err.message,
            error: err
        });
    });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
        message: err.message,
        error: {}
    });
});

var debug = require('debug')('server');

app.set('port', process.env.PORT || 3000);

app.listen(app.get('port'));

console.log('Listening on port: ' + app.get('port'));

module.exports = app;
