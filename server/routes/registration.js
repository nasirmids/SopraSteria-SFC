const express = require('express');
const router = express.Router();
const concatenateAddress = require('../utils/concatenateAddress').concatenateAddress;
const uuid = require('uuid');
const isLocal = require('../utils/security/isLocalTest').isLocal;
const slack = require('../utils/slack/slack-logger');
const sns = require('../aws/sns');

const models = require('../models');

const OTHER_MAX_LENGTH = 120;

// extended change properties
const EstablishmentModel = require('../models/classes/establishment').Establishment;
const EstablishmentSaveException = require('../models/classes/establishment/establishmentExceptions')
  .EstablishmentSaveException;
const UserModel = require('../models/classes/user').User;
const UserSaveException = require('../models/classes/user/userExceptions').UserSaveException;

const generateJWT = require('../utils/security/generateJWT');
const passwordCheck = require('../utils/security/passwordValidation').isPasswordValid;
const usernameCheck = require('../utils/security/usernameValidation').isUsernameValid;
const sendMail = require('../utils/email/notify-email').sendPasswordReset;
const { authLimiter } = require('../utils/middleware/rateLimiting');
// const pCodeCheck = require('../utils/postcodeSanitizer');

class RegistrationException {
  constructor(originalError, errCode, errMessage) {
    this.err = originalError;
    this.errCode = errCode;
    this.errMessage = errMessage;
  }

  toString() {
    return `${this.errCode}: ${this.errMessage}`;
  }
}

// Check if service exists
router.get('/service/:name', async (req, res) => {
  const requestedServiceName = req.params.name;
  try {
    const results = await models.services.findOne({
      where: {
        name: requestedServiceName,
      },
    });

    if (results && results.id && requestedServiceName === results.name) {
      return res.status(200).json({
        status: '1',
        message: `Service name '${requestedServiceName}' found`,
      });
    } else {
      return res.status(200).json({
        status: '0',
        message: `Service name '${requestedServiceName}' not found`,
      });
    }
  } catch (err) {
    // TODO - improve logging/error reporting
    console.error('registration GET service/:name - failed', err);
    return res.status(503).send(`Unable to retrive service by name: ${escape(requestedServiceName)}`);
  }
});

router.get('/username', (req, res) => {
  // this is a false trap for empty username lookup requests from the UI
  return res.status(200).json({
    status: '0',
    message: 'Username not found',
  });
});

router.use('/username/:username', authLimiter);
router.get('/username/:username', async (req, res) => {
  const requestedUsername = req.params.username.toLowerCase();
  try {
    const results = await models.login.findOne({
      where: {
        username: {
          [models.Sequelize.Op.iLike]: requestedUsername,
        },
      },
    });

    req.sqreen.track('app.username_lookup');

    if (results && results.id && requestedUsername === results.username) {
      return res.status(200).json({
        status: '1',
        message: `Username '${requestedUsername}' found`,
      });
    } else {
      return res.status(200).json({
        status: '0',
        message: `Username '${requestedUsername}' not found`,
      });
    }
  } catch (err) {
    // TODO - improve logging/error reporting
    console.error('registration GET username/:username - failed', err);
    return res.json({
      status: '0',
      message: `Username '${requestedUsername}' not found`,
    });
  }
});

router.get('/usernameOrEmail/:usernameOrEmail', async (req, res) => {
  const requestedUsernameOrEmail = req.params.usernameOrEmail.toLowerCase();

  try {
    // username is on Login table, but email is on User table. Could join, but it's just as east to fetch each individual
    const loginResults = await models.login.findOne({
      where: {
        username: {
          [models.Sequelize.Op.iLike]: requestedUsernameOrEmail,
        },
      },
    });
    const userResults = await models.user.findOne({
      where: {
        EmailValue: {
          [models.Sequelize.Op.iLike]: requestedUsernameOrEmail,
        },
      },
    });

    if (
      (loginResults && loginResults.id && requestedUsernameOrEmail === loginResults.username) ||
      (userResults && userResults.id && requestedUsernameOrEmail === userResults.EmailValue)
    ) {
      return res.status(200).send();
    } else {
      return res.status(404).send();
    }
  } catch (err) {
    // TODO - improve logging/error reporting
    console.error('registration GET /usernameOrEmail/:usernameOrEmail - failed', err);
    return res.status(503).send();
  }
});

router.get('/estbname/:name', async (req, res) => {
  const requestedEstablishmentName = req.params.name;

  try {
    const results = await models.establishment.findOne({
      where: {
        NameValue: requestedEstablishmentName,
      },
    });

    if (results && results.id && requestedEstablishmentName === results.NameValue) {
      return res.status(200).json({
        status: '1',
        message: `Establishment by name '${requestedEstablishmentName}' found`,
      });
    } else {
      return res.status(200).json({
        status: '0',
        message: `Establishment by name '${requestedEstablishmentName}' not found`,
      });
    }
  } catch (err) {
    // TODO - improve logging/error reporting
    console.error('registration GET estbname/:name - failed', err);
    return res.json({
      status: '0',
      message: `Establishment by name '${requestedEstablishmentName}' not found`,
    });
  }
});

router.get('/estb/:name/:locationid', async (req, res) => {
  const requestedEstablishmentName = req.params.name;
  const requestedEstablishmentLocationId = req.params.locationid;
  try {
    const results = await models.establishment.findOne({
      where: {
        NameValue: requestedEstablishmentName,
        locationId: requestedEstablishmentLocationId,
      },
    });

    if (results && results.id && requestedEstablishmentName === results.NameValue) {
      return res.status(200).json({
        status: '1',
        message: `Establishment by name '${requestedEstablishmentName}' and by location id '${requestedEstablishmentLocationId}' found`,
      });
    } else {
      return res.status(200).json({
        status: '0',
        message: `Establishment by name '${requestedEstablishmentName}' and by location id '${requestedEstablishmentLocationId}' not found`,
      });
    }
  } catch (err) {
    // TODO - improve logging/error reporting
    console.error('registration GET /estb/:name&:locationid - failed', err);
    return res.json({
      status: '0',
      message: `Establishment by name '${requestedEstablishmentName}' and by location id '${requestedEstablishmentLocationId}' not found`,
    });
  }
});

const responseErrors = {
  default: {
    errCode: -1,
    errMessage: 'Registration Error',
  },
  eastablishment: {
    errCode: -2,
    errMessage: 'Registration: Failed to create Establishment',
  },
  user: {
    errCode: -3,
    errMessage: 'Registration: Failed to create User',
  },
  login: {
    errCode: -4,
    errMessage: 'Registration: Failed to create Login',
  },
  duplicateNonCQC: {
    errCode: -100,
    errMessage: 'Duplicate non-CQC Establishment',
    db_constraint: 'Establishment_unique_registration',
  },
  duplicateCQC: {
    errCode: -150,
    errMessage: 'Duplicate CQC Establishment',
    db_constraint: 'Establishment_unique_registration_with_locationid',
  },
  duplicateEstablishment: {
    errCode: -190,
    errMessage: 'Duplicate Establishment',
  },
  duplicateUsername: {
    errCode: -200,
    errMessage: 'Duplicate Username',
    db_constraint: 'uc_Login_Username',
  },
  unexpectedMainService: {
    errCode: -300,
    errMessage: 'Unexpected main service',
  },
  unknownLocation: {
    errCode: -400,
    errMessage: 'Unknown location',
    db_constraint: 'uc_Login_Username',
  },
  unknownNMDSsequence: {
    errCode: -500,
    errMessage: 'Unknown NMDS Sequence',
  },
  unknownNMDSLetter: {
    errCode: -600,
    errMessage: 'Unknown NMDS Letter/CSSR Region',
  },
  invalidEstablishment: {
    errCode: -700,
    errMessage: 'Establishment data is invalid',
  },
  invalidUser: {
    errCode: -800,
    errMessage: 'User data is invalid',
  },
  invalidUsername: {
    errCode: -210,
    errMessage: 'Invalid Username',
  },
};

router
  .route('/')
  .get((req, res) => {
    res.json({
      status: 'API id Working',
      message: 'Registration API',
    });
  })

  .post(async (req, res) => {
    //basic validation
    if (JSON.stringify(req.body) == '{}') {
      return res.status(400).json({
        success: 0,
        message: 'Parameters missing',
      });
    }

    // TODO: JSON Schema validation

    // Password validation check
    if (req.body[0] && req.body[0].user && req.body[0].user.password) {
      if (!passwordCheck(req.body[0].user.password)) {
        return res.status(400).json({
          success: 0,
          message:
            'Password must be at least 8 characters long and have uppercase letters, lowercase letters and numbers',
        });
      }
    }

    // Username validation check
    if (req.body[0] && req.body[0].user && req.body[0].user.username) {
      if (!usernameCheck(req.body[0].user.username)) {
        console.error(`Registration:  ${responseErrors.invalidUsername.message} - ${req.body[0].user.username}`);
        return res.status(400).json(responseErrors.invalidUsername);
      }
    }

    let defaultError = responseErrors.default;
    try {
      // location ID is only relevant for CQC sites - namely isRegulated is true
      if (!req.body[0].isRegulated) {
        delete req.body[0].locationId;
      }

      // extract establishment, user and login data from given input
      const Estblistmentdata = {
        Name: req.body[0].locationName,
        Address: concatenateAddress(
          req.body[0].addressLine1,
          req.body[0].addressLine2,
          req.body[0].townCity,
          req.body[0].county,
        ),
        Address1: req.body[0].addressLine1,
        Address2: req.body[0].addressLine2,
        Town: req.body[0].townCity,
        County: req.body[0].county,
        LocationID: req.body[0].locationId,
        PostCode: req.body[0].postalCode,
        MainService: req.body[0].mainService,
        MainServiceId: null,
        MainServiceOther: req.body[0].mainServiceOther,
        IsRegulated: req.body[0].isRegulated,
        Status: 'PENDING',
      };
      const Userdata = {
        FullName: req.body[0].user.fullname,
        JobTitle: req.body[0].user.jobTitle,
        Email: req.body[0].user.email,
        Phone: req.body[0].user.phone,
        SecurityQuestion: req.body[0].user.securityQuestion,
        SecurityQuestionAnswer: req.body[0].user.securityQuestionAnswer,
        DateCreated: new Date(),
        EstablishmentID: 0,
        AdminUser: true,
      };
      // Check if the user is allowed to be active based on wether they are CQC registered   - this does work but temporarily we don't want to auto approve anyone
      // let CQCpostcode = false;
      // let CQClocationID = false;
      // Check if the Postcode is in the CQC database
      // try {
      //   console.log('AR - Checking if Postcode is CQC registered.');
      //   let cleanPostcode= pCodeCheck.sanitisePostcode(Estblistmentdata.PostCode);

      //   if (cleanPostcode != null) {
      //     //Find matching postcode data
      //     let results = await models.location.findAll({
      //       where: {
      //         postalcode: cleanPostcode
      //       }
      //     });
      //     if (results.length) {
      //       CQCpostcode = true;
      //       console.log('AR - Found matching CQC Postcode');
      //     }
      //   }
      // } catch(error) {
      //   console.error(error)
      // }
      // // Check if the location ID is in the CQC database
      // try {
      //   console.log('AR - Checking if Location ID is CQC registered.');

      //   if (Estblistmentdata.LocationID != null) {
      //     //Find matching postcode data
      //     let results = await models.location.findAll({
      //       where: {
      //         locationid: Estblistmentdata.LocationID
      //       }
      //     });
      //     if (results.length) {
      //       CQClocationID = true;
      //       console.log('AR - Found matching CQC Location ID');
      //     }
      //   }
      // } catch(error) {
      //   console.error(error)
      // }

      var Logindata = {
        RegistrationId: 0,
        UserName: req.body[0].user.username,
        Password: req.body[0].user.password,
        // Active: CQCpostcode && CQClocationID,
        Active: false,
        InvalidAttempt: 0,
        Status: 'PENDING',
      };

      // there are multiple steps to regiastering a new user/establishment. They must be done in entirety (all or nothing).
      // 1. looking the main service; to get ID
      // 2. Create Establishment record, to get Establishment ID
      // 3. Create User record (using Establishment ID) to get Registration ID
      // 4. Create Login record (using Registration ID)
      try {
        // if any part fails, it all fails. So wrap into a single transaction; commit on success and rollback on failure.
        await models.sequelize.transaction(async (t) => {
          // first - validate given main service id, for which the main service id is dependent on whether the site is CQC regulated or not
          let serviceResults = null;
          if (Estblistmentdata.IsRegulated) {
            // if a regulated (CQC) site, then can use any of the services as long as they are a main service
            serviceResults = await models.services.findOne({
              where: {
                name: Estblistmentdata.MainService,
                isMain: true,
              },
            });
          } else {
            // a non-CQC site can only use non-CQC services
            serviceResults = await models.services.findOne({
              where: {
                name: Estblistmentdata.MainService,
                iscqcregistered: {
                  [models.Sequelize.Op.or]: [false, null],
                },
                isMain: true,
              },
            });
          }

          if (serviceResults && serviceResults.id && Estblistmentdata.MainService === serviceResults.name) {
            Estblistmentdata.MainServiceId = serviceResults.id;
          } else {
            throw new RegistrationException(
              `Lookup on services for '${Estblistmentdata.MainService}' being cqc registered (${Estblistmentdata.IsRegulated}) resulted with zero records`,
              responseErrors.unexpectedMainService.errCode,
              responseErrors.unexpectedMainService.errMessage,
            );
          }

          if (
            serviceResults.other &&
            Estblistmentdata.MainServiceOther &&
            Estblistmentdata.MainServiceOther.length > OTHER_MAX_LENGTH
          ) {
            throw new RegistrationException(
              `Other field value of '${Estblistmentdata.MainServiceOther}' greater than length ${OTHER_MAX_LENGTH}`,
              responseErrors.unexpectedMainService.errCode,
              responseErrors.unexpectedMainService.errMessage,
            );
          }

          // now create establishment - using the extended property encapsulation
          defaultError = responseErrors.establishment;
          const newEstablishment = new EstablishmentModel(Logindata.UserName);
          newEstablishment.initialise(
            Estblistmentdata.Address1,
            Estblistmentdata.Address2,
            null,
            Estblistmentdata.Town,
            Estblistmentdata.County,
            Estblistmentdata.LocationID,
            null, // PROV ID is not captured yet on registration
            Estblistmentdata.PostCode,
            Estblistmentdata.IsRegulated,
          );
          await newEstablishment.load({
            name: Estblistmentdata.Name,
            mainService: {
              id: Estblistmentdata.MainServiceId,
              other: Estblistmentdata.MainServiceOther,
            },
            ustatus: Estblistmentdata.Status,
          }); // no Establishment properties on registration
          if (newEstablishment.hasMandatoryProperties && newEstablishment.isValid) {
            await newEstablishment.save(Logindata.UserName, false, t);
            Estblistmentdata.id = newEstablishment.id;
            Estblistmentdata.eUID = newEstablishment.uid;
            Estblistmentdata.NmdsId = newEstablishment.nmdsId;
          } else {
            // Establishment properties not valid
            throw new RegistrationException(
              'Inavlid establishment properties',
              responseErrors.invalidEstablishment.errCode,
              responseErrors.invalidEstablishment.errMessage,
            );
          }

          // now create user
          defaultError = responseErrors.user;
          const newUser = new UserModel(Estblistmentdata.id);
          await newUser.load({
            role: 'Edit',
            fullname: Userdata.FullName,
            jobTitle: Userdata.JobTitle,
            email: Userdata.Email.toLowerCase(),
            phone: Userdata.Phone,
            securityQuestion: Userdata.SecurityQuestion,
            securityQuestionAnswer: Userdata.SecurityQuestionAnswer,
            username: Logindata.UserName.toLowerCase(),
            password: Logindata.Password,
            isPrimary: true,
            isActive: Logindata.Active,
            status: Logindata.Status,
            registrationSurveyCompleted: false,
          });
          if (newUser.isValid) {
            await newUser.save(Logindata.UserName, 0, t);
            Userdata.registrationID = newUser.id;
          } else {
            // Establishment properties not valid
            throw new RegistrationException(
              'Inavlid user/login properties',
              responseErrors.invalidUser.errCode,
              responseErrors.invalidUser.errMessage,
            );
          }

          // post via Slack, but remove sensitive data
          const slackMsg = req.body[0];
          delete slackMsg.user.password;
          delete slackMsg.user.securityQuestion;
          delete slackMsg.user.securityQuestionAnswer;
          slackMsg.nmdsId = Estblistmentdata.NmdsId;
          slackMsg.establishmentUid = Estblistmentdata.eUID;
          slack.info('Registration', JSON.stringify(slackMsg, null, 2));
          // post through feedback topic - async method but don't wait for a responseThe
          sns.postToRegistrations(slackMsg);
          // gets here on success
          req.sqreen.signup_track({
            userId: newUser.uid,
            establishmentId: Estblistmentdata.eUID,
          });

          res.status(200);
          res.json({
            status: 1,
            message: 'Establishment and primary user successfully created',
            establishmentId: Estblistmentdata.id,
            establishmentUid: Estblistmentdata.eUID,
            primaryUser: Logindata.UserName,
            nmdsId: Estblistmentdata.NmdsId ? Estblistmentdata.NmdsId : 'undefined',
            active: Logindata.Active,
            userstatus: Logindata.Status,
          });
        });
      } catch (err) {
        //console.error('Caught exception in registration: ', err);

        // if we've already found a specific registration error, re-throw the error
        if (err instanceof RegistrationException) throw err;

        if (!defaultError) defaultError = responseErrors.default;

        if (err instanceof EstablishmentSaveException) {
          if (err.message === 'Duplicate Establishment') {
            defaultError = responseErrors.duplicateEstablishment;
          } else if (err.message === 'Unknown Location') {
            defaultError = responseErrors.unknownLocation;
          } else if (err.message === 'Unknown NMDSID') {
            defaultError = responseErrors.unknownNMDSLetter;
          }
        }

        if (err instanceof UserSaveException) {
          if (err.message === 'Duplicate Username') {
            defaultError = responseErrors.duplicateUsername;
          }
        }

        throw new RegistrationException(err, defaultError.errCode, defaultError.errMessage);
      }
    } catch (err) {
      // failed to fully register a new user/establishment - full rollback
      console.error('Registration: rolling back all changes because: ', err.errCode, err.errMessage);
      if (err.errCode > -99) {
        console.error('Registration: original error: ', err.err);
      }

      if (err.errCode > -99) {
        // we have an unexpected error
        res.status(500);
      } else {
        // we have an expected error owing to given client data
        res.status(400);
      }
      res.json({
        status: err.errCode,
        message: err.errMessage,
      });
    }
  }); // ends router.route('/').post

router.post('/requestPasswordReset', async (req, res) => {
  // parse input - escaped to prevent SQL injection
  if (!req.body.usernameOrEmail) {
    return res.status(400).send();
  }
  const givenEmailOrUsername = escape(req.body.usernameOrEmail.toLowerCase());

  // for automated testing, allow the expiry to be overridden by a given TTL parameter (in seconds)
  //  only for localhost/dev
  const expiresTTLms = isLocal(req) && req.body.ttl ? parseInt(req.body.ttl) * 1000 : 60 * 60 * 24 * 1000; // 24 hours

  try {
    // username is on Login table, but email is on User table. Could join, but it's just as east to fetch each individual
    const loginResults = await models.login.findOne({
      attributes: ['id', 'username'],
      where: {
        username: {
          [models.Sequelize.Op.iLike]: givenEmailOrUsername,
        },
        isActive: true,
        status: null,
      },
      include: [
        {
          model: models.user,
          attributes: ['EmailValue', 'FullNameValue', 'id'],
        },
      ],
    });
    const userResults = await models.user.findAll({
      attributes: ['EmailValue', 'FullNameValue', 'id'],
      where: {
        EmailValue: {
          [models.Sequelize.Op.iLike]: givenEmailOrUsername,
        },
      },
      include: [
        {
          model: models.login,
          attributes: ['id', 'username'],
          where: {
            isActive: true,
            status: null,
          },
        },
      ],
    });

    if (
      (loginResults && loginResults.id && givenEmailOrUsername === loginResults.username) ||
      (userResults && userResults.length === 1 && givenEmailOrUsername === userResults[0].EmailValue)
    ) {
      let sendToAddress = null,
        sendToName = null,
        userRegistrationId = null;
      if (userResults && userResults.length === 1 && userResults[0].EmailValue) {
        sendToAddress = userResults[0].EmailValue;
        sendToName = userResults[0].FullNameValue;
        userRegistrationId = userResults[0].id;
      } else if (loginResults && loginResults.user && loginResults.user.EmailValue) {
        sendToAddress = loginResults.user.EmailValue;
        sendToName = loginResults.user.FullNameValue;
        userRegistrationId = loginResults.user.id;
      }

      if (sendToAddress === null || sendToName === null || userRegistrationId === null) {
        throw new Error(
          `Unexpected error: failed to retrieve registration ID/name/email address (${givenEmailOrUsername}) on either user or login`,
        );
      }

      const requestUuid = uuid.v4();
      const now = new Date();
      const expiresIn = new Date(now.getTime() + expiresTTLms);

      await models.passwordTracking.create({
        userFk: userRegistrationId,
        created: now.toISOString(),
        expires: expiresIn.toISOString(),
        uuid: requestUuid,
      });

      const resetLink = `${req.protocol}://${req.get(
        'host',
      )}/api/registration/validateResetPassword?reset=${requestUuid}`;

      // send email to recipient with the reset UUID
      await sendMail(sendToAddress, sendToName, requestUuid);

      req.sqreen.track('app.reset_password_request', {
        userId: userResults.uid,
      });

      if (isLocal(req)) {
        return res.status(200).json({ resetLink, uuid: requestUuid });
      } else {
        return res.status(200).send();
      }
    } else {
      // non-disclosure - if account is not found, return 200 anyway - suggesting that an email has been found
      return res.status(200).send();
    }
  } catch (err) {
    // TODO - improve logging/error reporting
    console.error('registration POST /requestPasswordReset - failed', err);
    return res.status(503).send();
  }
});

router.post('/validateResetPassword', async (req, res) => {
  if (!req.body.uuid) {
    console.error('No UUID');
    return res.status(400).send();
  }
  // parse input - escaped to prevent SQL injection
  const givenUuid = escape(req.body.uuid);
  const uuidV4Regex = /^[A-F\d]{8}-[A-F\d]{4}-4[A-F\d]{3}-[89AB][A-F\d]{3}-[A-F\d]{12}$/i;

  if (!uuidV4Regex.test(givenUuid)) {
    console.error('Invalid UUID');
    return res.status(400).send();
  }

  try {
    // username is on Login table, but email is on User table. Could join, but it's just as east to fetch each individual
    const passTokenResults = await models.passwordTracking.findOne({
      where: {
        uuid: givenUuid,
      },
    });

    if (passTokenResults && passTokenResults.id) {
      // now check if the token has expired or already been consumed
      const now = new Date().getTime();
      if (passTokenResults.expires.getTime() < now) {
        console.error(`registration POST /validateResetPassword - reset token (${givenUuid}) expired`);
        return res.status(403).send();
      }

      if (passTokenResults.completed) {
        console.error(`registration POST /validateResetPassword - reset token (${givenUuid}) has already been used`);
        return res.status(403).send();
      }

      // gets this far if the token is valid. Generate a JWT, which requires knowing the associated User/Login details.
      const userResults = await models.user.findOne({
        where: {
          id: passTokenResults.userFk,
        },
        include: [
          {
            model: models.login,
            attributes: ['username'],
          },
        ],
      });

      if (userResults && userResults.id && userResults.id === passTokenResults.userFk) {
        // generate JWT and attach it to the header (Authorization)
        const JWTexpiryInMinutes = 15;
        const token = generateJWT.passwordResetJWT(
          JWTexpiryInMinutes,
          userResults.login.username,
          userResults.FullNameValue,
          givenUuid,
        );

        res.set({
          Authorization: 'Bearer ' + token,
        });

        return res.status(200).json({
          username: userResults.login.username,
          fullname: userResults.FullNameValue,
        });
      } else {
        throw new Error(`Failed to find user matching reset token (${givenUuid})`);
      }
    } else {
      // token not found
      console.error(`registration POST /validateResetPassword - reset token (${givenUuid}) not found`);
      return res.status(404).send();
    }
  } catch (err) {
    // TODO - improve logging/error reporting
    console.error('registration POST /validateResetPassword - failed', err);
    return res.status(503).send();
  }
});

module.exports = router;
