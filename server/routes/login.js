 var express = require('express');
 const models = require('../models/index');
 const passport = require('passport');
 var router = express.Router();
 require('../utils/security/passport')(passport);
const Login = require('../models').login;

const generateJWT = require('../utils/security/generateJWT');
const isAuthorised = require('../utils/security/isAuthenticated').isAuthorised;
const uuid = require('uuid');

const config = require('..//config/config');

const sendMail = require('../utils/email/notify-email').sendPasswordReset;

router.post('/',async function(req, res) {
   Login
      .findOne({
        where: {
          username: {
            [models.Sequelize.Op.iLike] : req.body.username.toLowerCase()
          },
          isActive:true
        },
        attributes: ['id', 'username', 'isActive', 'invalidAttempt', 'registrationId', 'firstLogin', 'Hash', 'lastLogin'],
        include: [ {
          model: models.user,
          attributes: ['id', 'FullNameValue', 'EmailValue', 'isAdmin', 'isPrimary', 'establishmentId', "UserRoleValue"],
          include: [{
            model: models.establishment,
            attributes: ['id', 'uid', 'NameValue', 'isRegulated', 'nmdsId'],
            include: [{
              model: models.services,
              as: 'mainService',
              attributes: ['id', 'name']
            }]
          }]
        }]
      
      })
      .then((login) => {
        if (!login) {
          console.error(`Failed to find user account associated with: ${req.body.username} - `, login);
          return res.status(401).send({
            message: 'Authentication failed.',
          });
        }

        login.comparePassword(escape(req.body.password), async (err, isMatch) => {
          if (isMatch && !err) {
            const loginTokenTTL = config.get('jwt.ttl.login');

            const token = generateJWT.loginJWT(loginTokenTTL, login.user.establishment.id, login.user.establishment.uid, req.body.username.toLowerCase(), login.user.UserRoleValue);
            var date = new Date().getTime();
            date += (loginTokenTTL * 60  * 1000);
   
            const response = formatSuccessulLoginResponse(
              login.user.FullNameValue,
              login.firstLogin,
              login.user.isPrimary,
              login.lastLogin,
              login.user.UserRoleValue,
              login.user.establishment,
              login.user.establishment.mainService,
              new Date(date).toISOString()
            );

            await models.sequelize.transaction(async t => {
              // check if this is the first time logged in and if so, update the "FirstLogin" timestamp
              // reset the number of failed attempts on any successful login
              const loginUpdate = {
                invalidAttempt: 0,
                lastLogin: new Date(),
              };
              if (!login.firstLogin) {
                loginUpdate.firstLogin = new Date();
              }
              login.update(loginUpdate, {transaction: t});

              // add an audit record
              const auditEvent = {
                userFk: login.user.id,
                username: login.username,
                type: 'loginSuccess',
                property: 'password',
                event: {}
              };
              await models.userAudit.create(auditEvent, {transaction: t});
            });

            // TODO: ultimately remove "Bearer" from the response; this should be added by client
            return res.set({'Authorization': 'Bearer ' + token}).status(200).json(response);

          } else {
            await models.sequelize.transaction(async t => {
              const maxNumberOfFailedAttempts = 10;

              // increment the number of failed attempts by one
              const loginUpdate = {
                invalidAttempt: login.invalidAttempt + 1
              };
              login.update(loginUpdate, {transaction: t});

              if (login.invalidAttempt === (maxNumberOfFailedAttempts+1)) {
                // send reset password email
                const expiresTTLms = 60*24*1000; // 24 hours

                const requestUuid = uuid.v4();
                const now = new Date();
                const expiresIn = new Date(now.getTime() + expiresTTLms);
          
                await models.passwordTracking.create({
                  userFk: login.user.id,
                  created: now.toISOString(),
                  expires: expiresIn.toISOString(),
                  uuid: requestUuid
                }, {transaction: t});
          
                const resetLink = `${req.protocol}://${req.get('host')}/api/registration/validateResetPassword?reset=${requestUuid}`;

                // send email to recipient with the reset UUID
                try {
                  await sendMail(login.user.EmailValue, login.user.FullNameValue, requestUuid);
                } catch (err) {
                  console.error(err);
                }
              }

              // TODO - could implement both https://www.npmjs.com/package/request-ip & https://www.npmjs.com/package/iplocation 
              //        to resolve the client's IP address on login failure, thus being able to audit the source of where the failed
              //        login came from

              // add an audit record
              const auditEvent = {
                userFk: login.user.id,
                username: login.username,
                type: login.invalidAttempt >= (maxNumberOfFailedAttempts+1) ? 'loginWhileLocked' : 'loginFailed',
                property: 'password',
                event: {}
              };
              await models.userAudit.create(auditEvent, {transaction: t});
            });

            return res.status(401).send({
              message: 'Authentication failed.',
            });
          }
        })
      })
      .catch((error) => {
        console.error(error);
        return res.status(503).send();
      });
});

// TODO: enforce JSON schema
const formatSuccessulLoginResponse = (fullname, firstLoginDate, isPrimary, lastLoggedDate, role, establishment, mainService, expiryDate) => {
  // note - the mainService can be null
  return {
    fullname,
    isFirstLogin: firstLoginDate ? false : true,
    isPrimary,
    lastLoggedIn: lastLoggedDate ? lastLoggedDate.toISOString() : null,
    role,
    establishment: {
      id: establishment.id,
      uid: establishment.uid,
      name: establishment.NameValue,
      isRegulated: establishment.isRegulated,
      nmdsId: establishment.nmdsId
    },
    mainService: {
      id: mainService ? mainService.id : null,
      name: mainService ? mainService.name : null
    },
    expiryDate: expiryDate
  };
};

// renews a given bearer token; this token must exist and must be valid
//  it must be a Logged In "Bearer" token
router.use('/refresh', isAuthorised);
router.get('/refresh', async function(req, res) {
  // this assumes no re-authentication; this assumes no checking of origin; this assumes no validation against last logged in or timeout against last login

  // gets here the given token is still valid
  const loginTokenTTL = config.get('jwt.ttl.login');
  const token = generateJWT.regenerateLoginToken(loginTokenTTL, req);
  var expiryDate = new Date().getTime();
  expiryDate += (loginTokenTTL * 60  * 1000);    // TTL is in minutes

  // TODO: ultimately remove "Bearer" from the response; this should be added by client
  return res.set({'Authorization': 'Bearer ' + token}).status(200).json({
    expiryDate: new Date(expiryDate).toISOString()
  });
  
});

module.exports = router;
