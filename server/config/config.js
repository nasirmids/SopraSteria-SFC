const convict = require('convict');
const fs = require('fs');
const yaml = require('js-yaml');

// AWS Secrets Manager override
const AWSSecrets = require('../aws/secrets');

const AppConfig = require('./appConfig');

convict.addFormat(require('convict-format-with-validator').ipaddress);
convict.addFormat(require('convict-format-with-validator').url);

// Define schema
const config = convict({
  env: {
    doc: 'The application environment',
    format: ['production', 'preproduction', 'benchmarks', 'development', 'test', 'accessibility', 'localhost'],
    default: 'localhost',
    env: 'NODE_ENV',
  },
  version: {
    doc: 'The API version',
    format: String,
    default: '0.0.0',
  },
  log: {
    level: {
      doc: 'Not yet used, but will be the default log level',
      format: String,
      default: 'NONE',
    },
    sequelize: {
      doc: 'Whether to log sequelize SQL statements',
      format: 'Boolean',
      default: false,
    },
  },
  listen: {
    port: {
      doc: 'Server binding port',
      format: 'port',
      default: 3000,
      env: 'PORT',
    },
    ip: {
      doc: 'Server binding IP',
      format: 'ipaddress',
      default: '127.0.0.1',
      env: 'HOST',
    },
  },
  db: {
    host: {
      doc: 'Database host name/IP',
      format: String,
      default: 'localhost',
      env: 'DB_HOST',
    },
    database: {
      doc: 'Database name',
      format: String,
      default: 'sfcdevdb',
      env: 'DB_NAME',
    },
    username: {
      doc: 'Database username',
      format: String,
      default: 'sfcadmin',
      env: 'DB_USER',
    },
    password: {
      doc: 'Database username',
      format: '*',
      default: 'unknown', // note - bug in notify - must provide a default value for it to use env var
      env: 'DB_PASS',
    },
    port: {
      doc: 'Database port',
      format: 'port',
      default: 5432,
      env: 'DB_PORT',
    },
    dialect: {
      doc: 'Database dialect (sequelize)',
      format: String,
      default: 'postgres',
    },
    ssl: {
      doc: 'Use SSL?',
      format: 'Boolean',
      default: false,
      env: 'DB_SSL',
    },
    pool: {
      min: {
        doc: 'Minimum number of connections in the pool',
        format: 'int',
        default: 5,
      },
      max: {
        doc: 'Maximum number of connections in the pool',
        format: 'int',
        default: 5,
      },
      acquire: {
        doc: 'How long to wait for a connection to become available in the pool',
        format: 'int',
        default: 60000,
      },
      idle: {
        doc: 'The maximum time, in milliseconds, that a connection can be idle before being released.',
        format: 'int',
        default: 1000,
      },
    },
  },
  notify: {
    key: {
      doc: 'The gov.uk notify key',
      format: '*',
      default: 'unknown', // note - bug in notify - must provide a default value for it to use env var
      env: 'NOTIFY_KEY',
    },
    replyTo: {
      doc: 'The id to use for reply-to',
      format: function check(val) {
        const uuidRegex = /^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/;
        if (!uuidRegex.test(val.toUpperCase())) throw new TypeError('gov.uk notify reply-to id should be a V4 UUID');
      },
      default: '80d54020-c420-46f1-866d-b8cc3196809d',
    },
    templates: {
      resetPassword: {
        doc: 'The template id for sending reset password emails',
        format: function check(val) {
          const uuidRegex = /^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/;
          if (!uuidRegex.test(val.toUpperCase()))
            throw new TypeError('gov.uk notify reset password template id should be a V4 UUID');
        },
        default: '80d54020-c420-46f1-866d-b8cc3196809d',
      },
      addUser: {
        doc: 'The template id for sending user registration emails',
        format: function check(val) {
          const uuidRegex = /^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/;
          if (!uuidRegex.test(val.toUpperCase()))
            throw new TypeError('gov.uk notify add user template id should be a V4 UUID');
        },
        default: '80d54020-c420-46f1-866d-b8cc3196809d',
      },
    },
  },
  jwt: {
    iss: {
      doc: 'The JWT issuer',
      format: 'url',
      env: 'TOKEN_ISS',
      default: 'http://localhost:3000',
    },
    secret: {
      doc: 'The JWT signing secret',
      format: '*',
      default: 'nodeauthsecret',
      env: 'TOKEN_SECRET',
    },
    ttl: {
      default: {
        doc: 'The (default) Time To Live (in minutes) for token (timeout)',
        format: 'int',
        default: 5,
      },
      login: {
        doc: 'The Time To Live (in minutes) for login token',
        format: 'int',
        default: 5,
        env: 'LOGIN_JWT_TTL',
      },
    },
    aud: {
      login: {
        doc: 'The logged in JWT audience',
        format: String,
        default: 'ADS-WDS',
      },
      passwordReset: {
        doc: 'The password reset JWT audience',
        format: String,
        default: 'ADS-WDS-password-reset',
      },
      addUser: {
        doc: 'The add user JWT audience',
        format: String,
        default: 'ADS-WDS-add-user',
      },
      internalAdminApp: {
        doc: 'The JWT audience for the Internal Admin application',
        format: String,
        default: 'ADS-WDS-Internal-Admin-App',
      },
    },
  },
  slack: {
    url: {
      doc: 'The slack notification endpoint',
      format: 'url',
      default: 'unknown', // note - bug in notify - must provide a default value for it to use env var
      env: 'SLACK_URL',
    },
    level: {
      doc: 'The level of notifications to be sent to Slack: 0 - disabled, 1-error, 2-warning, 3-info, 5 - trace',
      format: function check(val) {
        if (![0, 1, 2, 3, 5].includes(val)) throw new TypeError('Slack level must be one of 0, 1, 2, 3 or 5');
      },
      env: 'SLACK_LEVEL',
      default: 0,
    },
  },
  getAddress: {
    apikey: {
      doc: 'API key for getAddress.io',
      format: 'String',
      default: '',
    },
  },
  aws: {
    region: {
      doc: 'AWS region',
      format: '*',
      default: 'eu-west-2',
    },
    secrets: {
      use: {
        doc:
          'Whether to use AWS Secret Manager to retrieve sensitive information, e.g. DB_PASS. If false, expect to read from environment variables.',
        format: 'Boolean',
        default: false,
      },
      wallet: {
        doc: 'The name of the AWS Secrets Manager wallet to recall from',
        format: String,
        default: 'bob',
      },
    },
    sns: {
      enabled: {
        doc: 'Enables/disables SNS posts',
        format: 'Boolean',
        default: false,
      },
      registrations: {
        doc: 'The ARN of the SNS topic for registrations',
        format: String,
        default: 'sns-registrations-arn',
      },
      feedback: {
        doc: 'The ARN of the SNS topic for feedback',
        format: String,
        default: 'sns-feedback-arn',
      },
    },
  },
  bulkupload: {
    region: {
      doc: 'AWS region override for bulk upload S3 only',
      format: '*',
      default: 'eu-west-2',
    },
    bucketname: {
      doc: 'Bucket used to upload all client related csv files',
      format: '*',
      default: 'sfcbulkuploadfiles',
    },
    uploadSignedUrlExpire: {
      doc: 'The duration in seconds for the upload signed URL to expire',
      format: 'int',
      default: 300,
    },
    validation: {
      timeout: {
        doc: 'The timeout in seconds for bulk upload validations',
        format: 'int',
        default: 300,
      },
      storeIntermediaries: {
        doc: 'If true, intermediary trace data will be stored',
        format: 'Boolean',
        default: false,
      },
    },
    completion: {
      timeout: {
        doc: 'The timeout in seconds for bulk upload completion',
        format: 'int',
        default: 300,
      },
    },
    download: {
      timeout: {
        doc: 'The timeout in seconds for bulk upload download',
        format: 'int',
        default: 300,
      },
    },
  },
  locks: {
    region: {
      doc: 'AWS region override for locks S3 only',
      format: '*',
      default: 'eu-west-1',
    },
    bucketname: {
      doc: 'Bucket used to create locks',
      format: '*',
      default: 'sfc-locks',
    },
  },
  public: {
    download: {
      baseurl: {
        doc: 'The baseurl to S3 bucket where public download content will be stored',
        format: '*',
        default: 'https://sfc-public-dev.s3.eu-west-2.amazonaws.com/public/download',
      },
    },
  },
  admin: {
    url: {
      doc: 'The URL to redirect users to the admin application',
      format: 'url',
      default: 'https://unknown.com',
      env: 'ADMIN_URL',
    },
    overrideWdfEffectiveDate: {
      doc: 'Allows for overridding the effective date - false is default (calculated) effective date',
      format: '*',
      default: false,
    },
  },
  app: {
    reports: {
      localAuthority: {
        fromDate: {
          doc: 'A fixed from reporting date; in the format YYYY-MM-DD',
          format: String,
          default: '2020-09-14',
        },
        toDate: {
          doc: 'A fixed to reporting date; in the format YYYY-MM-DD',
          format: String,
          default: '2020-10-31',
        },
        timeout: {
          doc: 'The timeout, in seconds, on the Local Authority user and admin API endpoints',
          format: 'int',
          default: 180,
        },
      },
    },
  },
  test: {
    baseurl: {
      doc: 'The API URL to run integration tests against',
      format: String,
      default: 'http://localhost',
      env: 'TEST_BASEURL',
    },
    admin: {
      username: {
        doc: 'A username of an admin user who can approve the registration request for new logins',
        format: String,
        default: 'unknown',
        env: 'TEST_ADMINUSERNAME',
      },
      password: {
        doc: 'A password of an admin user who can approve the registration request for new logins',
        format: String,
        default: 'unknown',
        env: 'TEST_ADMINPASSWORD',
      },
    },
  },
  rateLimiting: {
    points: {
      doc: 'How many times you want allow a user to visit sensitive endpoints',
      format: 'int',
      default: 60,
    },
    duration: {
      doc: 'How long a peroid you want to monitor a user visiting endpoints',
      format: 'int',
      default: 1 * 60 * 60, // 1 hour
    },
    table: {
      doc: 'The table name you want to create/update to log user requests',
      format: String,
      default: 'SensitiveSessions',
    },
  },
  timezone: {
    doc: 'What timezone is the service running in?',
    format: String,
    default: 'Europe/London',
  },
  datadog: {
    site: {
      doc: 'Datadog URL',
      format: String,
      default: 'datadoghq.eu',
    },
    api_key: {
      doc: 'Datadog API Key',
      format: String,
      default: '',
      sensitive: true,
      env: 'DD_API_KEY',
    },
  },
  sentry: {
    dsn: {
      doc: 'Sentry Endpoint',
      format: String,
      default: 'https://59c078b68dc0429aa404e59920f288fd@o409195.ingest.sentry.io/5281212',
      sensitive: true,
      env: 'SENTRY_DSN',
    },
    sample_rate: {
      doc: 'Sample Rate as a percentage of events to be sent',
      format: function (val) {
        if (val !== 0 && (!val || val > 1 || val < 0)) {
          throw new Error('must be a float between 0 and 1, inclusive');
        }
      },
      default: 0.3,
    },
  },
  honeycomb: {
    write_key: {
      doc: 'Honeycomb Write Key',
      format: String,
      default: 'blank',
      sensitive: true,
      env: 'HONEYCOMB_WRITE_KEY',
    },
  },
  satisfactionSurvey: {
    timeSpan: {
      doc: 'The amount of time to look back and see whether the survey should be shown',
      format: Number,
      default: 90,
    },
    unit: {
      doc: 'The unit of time to use (e.g days in moment format)',
      format: String,
      default: 'd',
    },
  },
  encryption: {
    publicKey: {
      doc: 'The public key for encryption',
      format: String,
      default: '',
      env: 'ENCRYPTION_PUBLIC_KEY',
    },
    privateKey: {
      doc: 'The private key for encryption',
      format: String,
      default: '',
      env: 'ENCRYPTION_PRIVATE_KEY',
    },
    passphrase: {
      doc: 'The passphrase used for encryption',
      format: String,
      default: '',
      env: 'ENCRYPTION_PASSPHRASE',
    },
  },
  sendInBlue: {
    apiKey: {
      doc: 'Send in Blue API Key',
      format: String,
      default: '',
      sensitive: true,
      env: 'SEND_IN_BLUE_KEY',
    },
    whitelist: {
      doc: 'Send in Blue API Whitelist',
      format: String,
      default: '',
      sensitive: true,
      env: 'SEND_IN_BLUE_WHITELIST',
    },
    templates: {
      sixMonthsInactive: {
        id: {
          doc: 'Template ID for the 6 month inactive email',
          format: Number,
          default: 13,
        },
        name: {
          doc: 'Template Name for the 6 month inactive email',
          format: String,
          default: '6 months',
        },
      },
      twelveMonthsInactive: {
        id: {
          doc: 'Template ID for the 12 month inactive email',
          format: Number,
          default: 14,
        },
        name: {
          doc: 'Template Name for the 12 month inactive email',
          format: String,
          default: '12 months',
        },
      },
      eighteenMonthsInactive: {
        id: {
          doc: 'Template ID for the 18 month inactive email',
          format: Number,
          default: 10,
        },
        name: {
          doc: 'Template Name for the 18 month inactive email',
          format: String,
          default: '18 months',
        },
      },
      twentyFourMonthsInactive: {
        id: {
          doc: 'Template ID for the 24 month inactive email',
          format: Number,
          default: 12,
        },
        name: {
          doc: 'Template Name for the 24 month inactive email',
          format: String,
          default: '24 months',
        },
      },
      parent: {
        id: {
          doc: 'Template ID for the parent workplace email',
          format: Number,
          default: 15,
        },
        name: {
          doc: 'Template Name for the parent workplace email',
          format: String,
          default: 'Parent',
        },
      },
    },
  },
  vcapServices: {
    doc: 'All the info from VCAP Services env vars from CF',
    env: 'VCAP_SERVICES',
    default: '{}',
  },
});

// Load environment dependent configuration
var env = config.get('env');

const envConfigfile = yaml.safeLoad(fs.readFileSync(__dirname + '/' + env + '.yaml'));
const commonConfigfile = yaml.safeLoad(fs.readFileSync(__dirname + '/common.yaml'));

// load common file first, then env (so env overrides common)
config.load(commonConfigfile);
config.load(envConfigfile);

// Perform validation
config.validate({ allowed: 'strict' });

// now, if defined, load secrets from AWS Secret Manager
if (config.get('aws.secrets.use')) {
  AWSSecrets.initialiseSecrets(config.get('aws.region'), config.get('aws.secrets.wallet')).then(() => {
    // DB rebind
    config.set('db.host', AWSSecrets.dbHost());
    config.set('db.password', AWSSecrets.dbPass());

    // external APIs
    config.set('slack.url', AWSSecrets.slackUrl());
    config.set('notify.key', AWSSecrets.govNotify());
    config.set('admin.url', AWSSecrets.adminUrl());
    config.set('getAddress.apikey', AWSSecrets.getAddressKey());
    //  config.set('datadog.api_key', AWSSecrets.datadogApiKey()); // Data dog is still work in progress, checking if we really need this
    config.set('sentry.dsn', AWSSecrets.sentryDsn());
    config.set('honeycomb.write_key', AWSSecrets.honeycombWriteKey());

    // Send in Blue
    config.set('sendInBlue.apiKey', AWSSecrets.sendInBlueKey());
    config.set('sendInBlue.whitelist', AWSSecrets.sendInBlueWhitelist());
    // openPgp
    config.set('encryption.privateKey', AWSSecrets.encryptionPrivateKey());
    config.set('encryption.publicKey', AWSSecrets.encryptionPublicKey());
    config.set('encryption.passphrase', AWSSecrets.encryptionPassphrase());

    // token secret
    config.set('jwt.secret', AWSSecrets.jwtSecret());

    AppConfig.ready = true;
    AppConfig.emit(AppConfig.READY_EVENT);
  });
} else {
  // emit something here
  AppConfig.ready = true;
}

module.exports = config;
