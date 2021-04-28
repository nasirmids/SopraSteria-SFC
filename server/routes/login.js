var express = require('express');
const models = require('../models/index');
const passport = require('passport');
var router = express.Router();
require('../utils/security/passport')(passport);
const crypto = require('crypto');
const bcrypt = require('bcrypt-nodejs');

const generateJWT = require('../utils/security/generateJWT');
const isAuthorised = require('../utils/security/isAuthenticated').isAuthorised;
const uuid = require('uuid');

const config = require('..//config/config');
const formatSuccessulLoginResponse = require('../utils/login/response');

const sendMail = require('../utils/email/notify-email').sendPasswordReset;

const get = require('lodash/get');
const { authLimiter } = require('../utils/middleware/rateLimiting');

const tribalHashCompare = (password, salt, expectedHash) => {
  const hash = crypto.createHash('sha256');
  hash.update(`${password}${salt}`, 'ucs2'); // .NET C# Unicode encoding defaults to UTF-16 // lgtm [js/insufficient-password-hash]

  const calculatedHash = hash.digest('base64');

  if (calculatedHash === expectedHash) {
    return true;
  } else {
    return false;
  }
};

router.use('/', authLimiter);
router.post('/', async (req, res) => {
  const givenUsername = req.body.username.toLowerCase();
  const givenPassword = req.body.password;
  const givenEstablishmentUid =
    req.body.establishment && req.body.establishment.uid ? req.body.establishment.uid : null;

  try {
    if (req.sqreen.userIsBanned()) {
      return res.status(403).send({
        message: 'Banned user.',
      });
    }

    let establishmentUser =
      givenEstablishmentUid === null
        ? await models.login.findOne({
            where: {
              username: givenUsername,
            },
            attributes: [
              'id',
              'username',
              'isActive',
              'invalidAttempt',
              'registrationId',
              'firstLogin',
              'Hash',
              'lastLogin',
              'tribalHash',
              'tribalSalt',
              'agreedUpdatedTerms',
              'status',
            ],
            include: [
              {
                model: models.user,
                attributes: [
                  'id',
                  'uid',
                  'FullNameValue',
                  'EmailValue',
                  'isPrimary',
                  'establishmentId',
                  'UserRoleValue',
                  'registrationSurveyCompleted',
                  'tribalId',
                ],
                include: [
                  {
                    model: models.establishment,
                    attributes: [
                      'id',
                      'uid',
                      'NameValue',
                      'isRegulated',
                      'nmdsId',
                      'isParent',
                      'parentUid',
                      'parentId',
                      'lastBulkUploaded',
                    ],
                    include: [
                      {
                        model: models.services,
                        as: 'mainService',
                        attributes: ['id', 'name'],
                      },
                    ],
                  },
                ],
              },
            ],
          })
        : null;

    let establishmentInfo = {
      userId: get(establishmentUser, 'user.uid'),
      establishmentId: get(establishmentUser, 'establishment.uid'),
    };

    if (!establishmentUser || !establishmentUser.user) {
      // before returning error, check to see if this is a superadmin user with a given establishment UID, to be assumed as their "logged in session" primary establishment
      establishmentUser = await models.login.findOne({
        where: {
          username: givenUsername,
        },
        attributes: [
          'id',
          'username',
          'isActive',
          'invalidAttempt',
          'registrationId',
          'firstLogin',
          'Hash',
          'lastLogin',
          'tribalHash',
          'tribalSalt',
          'agreedUpdatedTerms',
          'status',
        ],
        include: [
          {
            model: models.user,
            attributes: [
              'id',
              'uid',
              'FullNameValue',
              'EmailValue',
              'isPrimary',
              'establishmentId',
              'UserRoleValue',
              'tribalId',
            ],
            where: {
              UserRoleValue: 'Admin',
            },
          },
        ],
      });

      if (establishmentUser && establishmentUser.user && establishmentUser.user.id) {
        if (givenEstablishmentUid) {
          // this is an admin user, find the given establishment
          establishmentUser.user.establishment = await models.establishment.findOne({
            attributes: [
              'id',
              'uid',
              'NameValue',
              'isRegulated',
              'nmdsId',
              'isParent',
              'parentUid',
              'parentId',
              'lastBulkUploaded',
            ],
            include: [
              {
                model: models.services,
                as: 'mainService',
                attributes: ['id', 'name'],
              },
            ],
            where: {
              uid: givenEstablishmentUid,
            },
          });

          establishmentInfo = {
            userId: get(establishmentUser, 'user.uid'),
            establishmentId: get(establishmentUser, 'establishment.uid'),
          };

          if (establishmentUser.user.establishment && establishmentUser.user.establishment.id) {
            console.log('Found admin user and establishment');
          } else {
            req.sqreen.auth_track(false, establishmentInfo);

            console.error('POST .../login failed: on finding the given establishment');
            return res.status(401).send({
              message: 'Authentication failed.',
            });
          }
        } else {
          establishmentUser.user.establishment = null; // this admin user has no primary (home) establishment
        }
      } else {
        req.sqreen.auth_track(false, establishmentInfo);

        console.error('Failed to find user account');
        return res.status(401).send({
          message: 'Authentication failed.',
        });
      }
    }

    if (establishmentUser) {
      //check weather posted user is locked or pending
      if (!establishmentUser.isActive && establishmentUser.status === 'Locked') {
        //check for locked status, if locked then return with 409 error
        console.error('POST .../login failed: User status is locked');
        return res.status(409).send({
          message: 'Authentication failed.',
        });
      } else if (!establishmentUser.isActive && establishmentUser.status === 'PENDING') {
        //check for Pending status, if Pending then return with 403 error
        console.error('POST .../login failed: User status is pending');
        return res.status(405).send({
          message: 'Authentication failed.',
        });
      }
    }

    // if this found login account is a migrated tribal account, and there is no current hash, then
    //  we need to first validate password using tribal hashing
    let tribalErr = null;
    let tribalHashValidated = false;
    if (establishmentUser.user.tribalId !== null && establishmentUser.Hash === null) {
      tribalHashValidated = true;
      const tribalHashCompareReset = tribalHashCompare(
        givenPassword,
        establishmentUser.tribalSalt,
        establishmentUser.tribalHash,
      );

      if (tribalHashCompareReset === false) {
        tribalErr = 'Failed to authenticate using tribal hash';
      }
    }

    establishmentUser.comparePassword(
      escape(givenPassword),
      tribalErr,
      tribalHashValidated,
      async (err, isMatch, rehashTribal) => {
        if (isMatch && !err) {
          const loginTokenTTL = config.get('jwt.ttl.login');

          const token = generateJWT.loginJWT(
            loginTokenTTL,
            establishmentUser.user.establishment ? establishmentUser.user.establishment.id : null,
            establishmentUser.user.establishment ? establishmentUser.user.establishment.uid : null,
            establishmentUser.user.establishment ? establishmentUser.user.establishment.isParent : null,
            givenUsername,
            establishmentUser.user.UserRoleValue,
            establishmentUser.user.uid,
          );
          var date = new Date().getTime();
          date += loginTokenTTL * 60 * 1000;

          // dereference the parent establishment's name
          if (establishmentUser.user.establishment && Number.isInteger(establishmentUser.user.establishment.parentId)) {
            const parentEstablishment = await models.establishment.findOne({
              attributes: ['NameValue'],
              where: {
                id: establishmentUser.user.establishment.parentId,
              },
            });

            if (parentEstablishment.NameValue) {
              establishmentUser.user.establishment.parentName = parentEstablishment.NameValue;
            }
          }

          // migrated user info
          const migratedUserFirstLogon =
            establishmentUser.user.tribalId !== null && establishmentUser.lastLogin === null ? true : false;
          const migratedUser = establishmentUser.user._tribalId !== null ? true : false;

          const response = formatSuccessulLoginResponse(
            establishmentUser.user.uid,
            establishmentUser.user.FullNameValue,
            establishmentUser.user.isPrimary,
            establishmentUser.lastLogin,
            establishmentUser.user.UserRoleValue,
            establishmentUser.user.establishment,
            givenUsername,
            new Date(date).toISOString(),
            establishmentUser.agreedUpdatedTerms,
            {
              migratedUserFirstLogon,
              migratedUser,
            },
            establishmentUser.user.registrationSurveyCompleted,
          );

          await models.sequelize.transaction(async (t) => {
            // check if this is the first time logged in and if so, update the "FirstLogin" timestamp
            // reset the number of failed attempts on any successful login
            const loginUpdate = {
              invalidAttempt: 0,
              lastLogin: new Date(),
            };

            // if this is a migrated tribal user's first login, and consequently, the compare is successful
            //   but they still have no "Hash", we need to create a hash and store it.
            if (rehashTribal) {
              loginUpdate.Hash = await bcrypt.hashSync(givenPassword, bcrypt.genSaltSync(10), null);
            }

            if (!establishmentUser.firstLogin) {
              loginUpdate.firstLogin = new Date();
            }
            establishmentUser.update(loginUpdate, { transaction: t });

            // add an audit record
            const auditEvent = {
              userFk: establishmentUser.user.id,
              username: establishmentUser.username,
              type: 'loginSuccess',
              property: 'password',
              event: {},
            };
            await models.userAudit.create(auditEvent, { transaction: t });
          });

          req.sqreen.auth_track(true, {
            ...establishmentInfo,
            role: get(establishmentUser, 'user.UserRoleValue'),
          });

          // TODO: ultimately remove "Bearer" from the response; this should be added by client
          return res
            .set({ Authorization: 'Bearer ' + token })
            .status(200)
            .json(response);
        } else {
          await models.sequelize.transaction(async (t) => {
            const maxNumberOfFailedAttempts = 10;

            // increment the number of failed attempts by one
            const loginUpdate = {
              invalidAttempt: establishmentUser.invalidAttempt + 1,
            };
            await establishmentUser.update(loginUpdate, { transaction: t });

            if (establishmentUser.invalidAttempt === maxNumberOfFailedAttempts + 1) {
              // lock the account
              const loginUpdate = {
                isActive: false,
                status: 'Locked',
              };
              await establishmentUser.update(loginUpdate, { transaction: t });

              // send reset password email
              const expiresTTLms = 60 * 24 * 1000; // 24 hours

              const requestUuid = uuid.v4();
              const now = new Date();
              const expiresIn = new Date(now.getTime() + expiresTTLms);

              await models.passwordTracking.create(
                {
                  userFk: establishmentUser.user.id,
                  created: now.toISOString(),
                  expires: expiresIn.toISOString(),
                  uuid: requestUuid,
                },
                { transaction: t },
              );

              // send email to recipient with the reset UUID if user is not locked
              try {
                if (establishmentUser.isActive && establishmentUser.status !== 'Locked') {
                  await sendMail(establishmentUser.user.EmailValue, establishmentUser.user.FullNameValue, requestUuid);
                }
              } catch (err) {
                console.error(err);
              }
            }

            // TODO - could implement both https://www.npmjs.com/package/request-ip & https://www.npmjs.com/package/iplocation
            //        to resolve the client's IP address on login failure, thus being able to audit the source of where the failed
            //        login came from

            // add an audit record
            const auditEvent = {
              userFk: establishmentUser.user.id,
              username: establishmentUser.username,
              type:
                establishmentUser.invalidAttempt >= maxNumberOfFailedAttempts + 1 ? 'loginWhileLocked' : 'loginFailed',
              property: 'password',
              event: {},
            };
            await models.userAudit.create(auditEvent, { transaction: t });
          });

          req.sqreen.auth_track(false, establishmentInfo);

          return res.status(401).send({
            message: 'Authentication failed.',
          });
        }
      },
    );
  } catch (err) {
    console.error('POST .../login failed: ', err);
    return res.status(503).send({});
  }
});

// renews a given bearer token; this token must exist and must be valid
//  it must be a Logged In "Bearer" token
router.use('/refresh', isAuthorised, authLimiter);
router.get('/refresh', async function (req, res) {
  // this assumes no re-authentication; this assumes no checking of origin; this assumes no validation against last logged in or timeout against last login

  // gets here the given token is still valid
  const loginTokenTTL = config.get('jwt.ttl.login');
  const token = generateJWT.regenerateLoginToken(loginTokenTTL, req);
  var expiryDate = new Date().getTime();
  expiryDate += loginTokenTTL * 60 * 1000; // TTL is in minutes

  // TODO: ultimately remove "Bearer" from the response; this should be added by client
  return res
    .set({ Authorization: 'Bearer ' + token })
    .status(200)
    .json({
      expiryDate: new Date(expiryDate).toISOString(),
    });
});

module.exports = router;
