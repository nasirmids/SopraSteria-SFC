/*
 * establishment.js
 *
 * The encapsulation of a Establishment, including all properties, all specific validation (not API, but object validation),
 * saving & restoring of data to database (via sequelize model), construction and deletion.
 *
 * Also includes representation as JSON, in one or more presentations.
 */
const moment = require('moment');

const uuid = require('uuid');

// Shorthand for hasOwnProperty that also works with bare objects
const hasProp = (obj, prop) => Object.prototype.hasOwnProperty.bind(obj)(prop);

// database models
const models = require('../index');

const EntityValidator = require('./validations/entityValidator').EntityValidator;
const ValidationMessage = require('./validations/validationMessage').ValidationMessage;

// associations
const Worker = require('./worker').Worker;

// exceptions
const EstablishmentExceptions = require('./establishment/establishmentExceptions');

// Establishment properties
const EstablishmentProperties = require('./establishment/establishmentProperties').EstablishmentPropertyManager;
const JSON_DOCUMENT_TYPE = require('./user/userProperties').JSON_DOCUMENT;
const SEQUELIZE_DOCUMENT_TYPE = require('./user/userProperties').SEQUELIZE_DOCUMENT;

// WDF Calculator
const WdfCalculator = require('./wdfCalculator').WdfCalculator;

// service cache
const ServiceCache = require('../cache/singletons/services').ServiceCache;
const CapacitiesCache = require('../cache/singletons/capacities').CapacitiesCache;

// Bulk upload helpers
const db = require('../../utils/datastore');

const STOP_VALIDATING_ON = ['UNCHECKED', 'DELETE', 'DELETED', 'NOCHANGE'];
// const nonCareServices = [16, 20, 35, 11, 21, 23, 18, 22, 1, 7, 2, 8, 3, 5, 4, 6, 27, 28, 26, 29, 30, 32, 31, 33, 34, 17, 15, 36, 14];
// const careBeds = [24, 25, 12];
// const carePlaces = [9, 10, 19];

class Establishment extends EntityValidator {
  constructor(username, bulkUploadStatus = null) {
    super();

    this._username = username;
    this._id = null;
    this._uid = null;
    this._ustatus = null;
    this._created = null;
    this._updated = null;
    this._updatedBy = null;
    this._auditEvents = null;

    // localised attributes
    this._name = null;
    this._address1 = null;
    this._address2 = null;
    this._address3 = null;
    this._town = null;
    this._county = null;
    this._locationId = null;
    this._provId = null;
    this._postcode = null;
    this._isRegulated = null;
    this._mainService = null;
    this._nmdsId = null;
    this._lastWdfEligibility = null;
    this._overallWdfEligibility = null;
    this._establishmentWdfEligibility = null;
    this._staffWdfEligibility = null;
    this._isParent = false;
    this._parentUid = null;
    this._parentId = null;
    this._parentName = null;
    this._dataOwner = null;
    this._dataPermissions = null;
    this._archived = null;
    this._dataOwnershipRequested = null;
    this._linkToParentRequested = null;
    this._lastBulkUploaded = null;

    // interim reasons for leaving - https://trello.com/c/vNHbfdms
    this._reasonsForLeaving = null;

    // abstracted properties
    const thisEstablishmentManager = new EstablishmentProperties();
    this._properties = thisEstablishmentManager.manager;

    // change properties
    this._isNew = false;

    // all known workers for this establishment - an associative object (property key is the worker's key)
    this._workerEntities = {};
    this._readyForDeletionWorkers = null;

    // bulk upload status - this is never stored in database
    this._status = bulkUploadStatus;

    // default logging level - errors only
    // TODO: INFO logging on User; change to LOG_ERROR only
    this._logLevel = Establishment.LOG_INFO;
  }

  // private logging
  static get LOG_ERROR() {
    return 100;
  }
  static get LOG_WARN() {
    return 200;
  }
  static get LOG_INFO() {
    return 300;
  }
  static get LOG_TRACE() {
    return 400;
  }
  static get LOG_DEBUG() {
    return 500;
  }

  set logLevel(logLevel) {
    this._logLevel = logLevel;
  }

  _log(level, msg) {
    if (this._logLevel >= level) {
      console.log(`TODO: (${level}) - Establishment class: `, msg);
    }
  }

  //
  // attributes
  //
  get id() {
    return this._id;
  }

  get uid() {
    return this._uid;
  }

  get ustatus() {
    return this._ustatus;
  }

  get username() {
    return this._username;
  }

  get name() {
    return this._properties.get('Name') ? this._properties.get('Name').property : null;
  }

  get address() {
    // returns concatenated address
    const self = this;
    return ['_address1', '_address2', '_address3', '_town', '_county']
      .reduce((arr, part) => {
        if (self[part]) {
          arr.push(self[part]);
        }
        return arr;
      }, [])
      .join(', ');
  }
  get lastBulkUploaded() {
    return this._lastBulkUploaded;
  }
  get address1() {
    return this._address1;
  }

  get address2() {
    return this._address2;
  }

  get address3() {
    return this._address3;
  }

  get town() {
    return this._town;
  }

  get county() {
    return this._county;
  }

  get locationId() {
    return this._locationId;
  }

  get provId() {
    return this._provId;
  }

  get postcode() {
    return this._postcode;
  }

  get latitude() {
    return this._properties.get('Latitude') ? this._properties.get('Latitude').property : null;
  }

  get longitude() {
    return this._properties.get('Longitude') ? this._properties.get('Longitude').property : null;
  }

  get isRegulated() {
    return this._isRegulated;
  }

  get mainService() {
    return this._properties.get('MainServiceFK') ? this._properties.get('MainServiceFK').property : null;
  }

  get employerType() {
    return this._properties.get('EmployerType') ? this._properties.get('EmployerType').property : null;
  }

  get localIdentifier() {
    return this._properties.get('LocalIdentifier') ? this._properties.get('LocalIdentifier').property : null;
  }

  get shareWith() {
    return this._properties.get('ShareData') ? this._properties.get('ShareData').property : null;
  }

  get shareWithLA() {
    return this._properties.get('ShareWithLA') ? this._properties.get('ShareWithLA').property : null;
  }

  get otherServices() {
    return this._properties.get('OtherServices') ? this._properties.get('OtherServices').property : null;
  }

  get capacities() {
    return this._properties.get('CapacityServices') ? this._properties.get('CapacityServices').property : null;
  }

  get serviceUsers() {
    return this._properties.get('ServiceUsers') ? this._properties.get('ServiceUsers').property : null;
  }

  get starters() {
    return this._properties.get('Starters') ? this._properties.get('Starters').property : null;
  }

  get leavers() {
    return this._properties.get('Leavers') ? this._properties.get('Leavers').property : null;
  }

  get vacancies() {
    return this._properties.get('Vacancies') ? this._properties.get('Vacancies').property : null;
  }

  get reasonsForLeaving() {
    return this._reasonsForLeaving;
  }

  get nmdsId() {
    return this._nmdsId;
  }

  get created() {
    return this._created;
  }

  get updated() {
    return this._updated;
  }

  get updatedBy() {
    return this._updatedBy;
  }

  get isParent() {
    return this._isParent;
  }

  get parentId() {
    return this._parentId;
  }

  get parentUid() {
    return this._parentUid;
  }

  get parentName() {
    return this._parentName;
  }

  get dataOwner() {
    return this._dataOwner;
  }

  get dataPermissions() {
    return this._dataPermissions;
  }

  get numberOfStaff() {
    return this._properties.get('NumberOfStaff') ? this._properties.get('NumberOfStaff').property : 0;
  }

  get status() {
    return this._status;
  }

  get key() {
    return (this._properties.get('LocalIdentifier') && this._properties.get('LocalIdentifier').property
      ? this.localIdentifier.replace(/\s/g, '')
      : this.name
    ).replace(/\s/g, '');
  }

  get archived() {
    return this._archived;
  }

  get dataOwnershipRequested() {
    return this._dataOwnershipRequested;
  }

  get linkToParentRequested() {
    return this._linkToParentRequested;
  }

  // used by save to initialise a new Establishment; returns true if having initialised this Establishment
  _initialise() {
    if (this._uid === null) {
      this._isNew = true;
      this._uid = uuid.v4();

      // note, do not initialise the id as this will be returned by database
      return true;
    } else {
      return false;
    }
  }

  // external method to initialise the mandatory non-extendable properties
  initialise(address1, address2, address3, town, county, locationId, provId, postcode, isRegulated) {
    // NMDS ID will be calculated when saving this establishment for the very first time - on creation only
    this._nmdsId = null;

    this._address1 = address1;
    this._address2 = address2;
    this._address3 = address3;
    this._town = town;
    this._county = county;
    this._postcode = postcode;
    this._isRegulated = isRegulated;
    this._locationId = locationId;
    this._provId = provId;
  }

  initialiseSub(parentID, parentUid) {
    this._parentUid = parentUid;
    this._parentId = parentID;
    this._dataOwner = 'Parent';
    this._dataPermissions = 'None';
  }

  // this method add this given worker (entity) as an association to this establishment entity - (bulk import)
  associateWorker(key, worker) {
    if (key && worker) {
      // worker not yet associated; take as is
      this._workerEntities[key] = worker;
    }
  }

  // returns just the set of keys of the associated workers
  get associatedWorkers() {
    if (this._workerEntities) {
      return Object.keys(this._workerEntities);
    } else {
      return [];
    }
  }

  get workers() {
    if (this._workerEntities) {
      return Object.values(this._workerEntities);
    } else {
      return [];
    }
  }

  theWorker(key) {
    return this._workerEntities && key ? this._workerEntities[key] : null;
  }

  // takes the given JSON document and creates an Establishment's set of extendable properties
  // Returns true if the resulting Establishment is valid; otherwise false
  async load(document, associatedEntities = false, bulkUploadCompletion = false) {
    try {
      // bulk upload status
      if (document.status) {
        this._status = document.status;
      }
      // Consequential updates when one value means another should be empty or null

      if (document.share) {
        if (!document.share.enabled || (document.share.enabled && !document.share.with.includes('Local Authority'))) {
          document.localAuthorities = [];
        }
      }

      if (!(bulkUploadCompletion && document.status === 'NOCHANGE')) {
        this.resetValidations();

        // inject all services against this establishment
        const isRegulated = document.IsCQCRegulated || document.isRegulated;
        document.allMyServices = ServiceCache.allMyServices(isRegulated);

        // inject all capacities against this establishment - note, "other services" can be represented by the JSON document attribute "services" or "otherServices"
        const allAssociatedServiceIndices = [];
        let mainServiceAdded = false;
        let servicesAdded = false;
        if (document.mainService) {
          allAssociatedServiceIndices.push(document.mainService.id);
          mainServiceAdded = true;
        }
        if (
          document &&
          document.otherServices &&
          document.otherServices.services &&
          Array.isArray(document.otherServices)
        ) {
          document.otherServices.services.forEach((thisService) => {
            if (thisService.id) {
              allAssociatedServiceIndices.push(thisService.id);
            } else if (thisService.services && Array.isArray(thisService.services)) {
              thisService.services.forEach((innerService) => {
                allAssociatedServiceIndices.push(innerService.id);
              });
            }
          });
          servicesAdded = true;
        }
        if (document && document.services && document.services.services && Array.isArray(document.services)) {
          document.services.services.forEach((thisService) => allAssociatedServiceIndices.push(thisService.id));

          // if no main service given in document, then use the current known main service property
          if (!mainServiceAdded && this.mainService) {
            allAssociatedServiceIndices.push(this.mainService.id);
          }

          servicesAdded = true;
        }
        if (mainServiceAdded && !servicesAdded && this.otherServices && this.otherServices.services) {
          this.otherServices.services.forEach((thisService) => allAssociatedServiceIndices.push(thisService.id));
        }

        document.allServiceCapacityQuestions = CapacitiesCache.allMyCapacities(allAssociatedServiceIndices);

        await this._properties.restore(document, JSON_DOCUMENT_TYPE);
        if (document.ustatus) {
          this._ustatus = document.ustatus;
        }

        // CQC regulated/location ID
        if (hasProp(document, 'isRegulated')) {
          this._isRegulated = document.isRegulated;

          if (!this.isRegulated) {
            this._locationId = null;

            if (this.shareWith && this.shareWith.with) {
              this.shareWith.with = this.shareWith.with.filter((x) => x !== 'CQC');
            }
          }
        }
        if (document.locationId) {
          // Note - there is more validation to do on location ID - so this really should be a managed property
          this._locationId = document.locationId;
        }
        if (document.provId) {
          // Note - there is more validation to do on location ID - so this really should be a managed property
          this._provId = document.provId;
        }
        if (document.address1) {
          // if address is given, allow reset on all address components
          this._address1 = document.address1;
          this._address2 = document.address2 ? document.address2 : '';
          this._address3 = document.address3 ? document.address3 : '';
          this._town = document.town ? document.town : '';
          this._county = document.county ? document.county : '';
        }
        if (document.postcode) {
          this._postcode = document.postcode;
        }
        if (document.name) {
          this._name = document.name;
        }

        if (document.reasonsForLeaving || document.reasonsForLeaving === '') {
          this._reasonsForLeaving = document.reasonsForLeaving;
        }
      }

      // allow for deep restoration of entities (associations - namely Worker here)
      if (associatedEntities) {
        const promises = [];
        if (document.workers && Array.isArray(document.workers)) {
          this._readyForDeletionWorkers = [];

          document.workers.forEach((thisWorker) => {
            // we're loading from JSON, not entity, so there is no key property; so add it
            thisWorker.key = thisWorker.localIdentifier
              ? thisWorker.localIdentifier.replace(/\s/g, '')
              : thisWorker.nameOrId.replace(/\s/g, '');

            // check if we already have the Worker associated, before associating a new worker
            if (this._workerEntities[thisWorker.key]) {
              // this worker exists; if could be marked for deletion
              if (thisWorker.status === 'DELETE') {
                this._readyForDeletionWorkers.push(this._workerEntities[thisWorker.key]);
              } else {
                // the local identifier is required during bulk upload for reasoning; but against the worker itself, it's immutable.
                delete thisWorker.localIdentifier;

                // else we already have this worker, load changes against it
                promises.push(this._workerEntities[thisWorker.key].load(thisWorker, true, bulkUploadCompletion));
              }
            } else {
              const newWorker = new Worker(null);

              // TODO - until we have Worker.localIdentifier we only have Worker.nameOrId to use as key
              this.associateWorker(thisWorker.key, newWorker);
              promises.push(newWorker.load(thisWorker, true));
            }
          });

          // this has updated existing Worker associations and/or added new Worker associations
          // however, how do we mark for deletion those no longer required
          Object.values(this._workerEntities).forEach((thisWorker) => {
            const foundWorker = document.workers.find((givenWorker) => {
              return givenWorker.key === thisWorker.key;
            });
            if (!foundWorker) {
              this._readyForDeletionWorkers.push(thisWorker);
            }
          });
        }
        await Promise.all(promises);
      }
    } catch (err) {
      this._log(Establishment.LOG_ERROR, `Establishment::load - failed: ${err}`);
      throw new EstablishmentExceptions.EstablishmentJsonException(err, null, 'Failed to load Establishment from JSON');
    }

    return this.isValid();
  }

  // returns true if Establishment is valid, otherwise false
  isValid() {
    // in bulk upload, an establishment entity, if UNCHECKED, will be nothing more than a status and a local identifier
    if (this._status === null || !STOP_VALIDATING_ON.includes(this._status)) {
      const thisEstablishmentIsValid = this._properties.isValid;
      if (this._properties.isValid === true) {
        return true;
      } else {
        // only add validations if not already existing
        if (thisEstablishmentIsValid && Array.isArray(thisEstablishmentIsValid) && this._validations.length === 0) {
          const propertySuffixLength = 'Property'.length * -1;
          thisEstablishmentIsValid.forEach((thisInvalidProp) => {
            this._validations.push(
              new ValidationMessage(ValidationMessage.WARNING, 111111111, 'Invalid', [
                thisInvalidProp.slice(0, propertySuffixLength),
              ]),
            );
          });
        }

        this._log(Establishment.LOG_ERROR, `Establishment invalid properties: ${thisEstablishmentIsValid.toString()}`);
        return false;
      }
    } else {
      return true;
    }
  }

  async saveAssociatedEntities(savedBy, bulkUploaded = false, externalTransaction) {
    if (this._workerEntities) {
      const log = (result) => result == null;

      try {
        const workersAsArray = Object.values(this._workerEntities).map((thisWorker) => {
          thisWorker.establishmentId = this._id;
          return thisWorker;
        });

        // new and updated Workers
        const starterSavePromise = Promise.resolve(null);
        await workersAsArray.reduce(
          (p, thisWorkerToSave) =>
            p.then(() => thisWorkerToSave.save(savedBy, bulkUploaded, 0, externalTransaction, true)).then(log),
          starterSavePromise,
        );

        // now deleted workers
        const starterDeletedPromise = Promise.resolve(null);
        await this._readyForDeletionWorkers.reduce(
          (p, thisWorkerToDelete) =>
            p.then(() => thisWorkerToDelete.archive(savedBy, externalTransaction, true).then(log)),
          starterDeletedPromise,
        );
      } catch (err) {
        console.error('Establishment::saveAssociatedEntities error: ', err);
        // rethrow error to ensure the transaction is rolled back
        throw err;
      }
    }
  }

  // saves the Establishment to DB. Returns true if saved; false is not.
  // Throws "EstablishmentSaveException" on error
  async save(savedBy, bulkUploaded = false, externalTransaction = null, associatedEntities = false) {
    const mustSave = this._initialise();

    if (!this.uid) {
      this._log(Establishment.LOG_ERROR, 'Not able to save an unknown uid');
      throw new EstablishmentExceptions.EstablishmentSaveException(
        null,
        this.uid,
        this.name,
        'Not able to save an unknown uid',
        'Establishment does not exist',
      );
    }

    // with bulk upload, if this entity's status is "UNCHECKED", do not save it
    if (this._status === 'UNCHECKED') {
      // if requested, propagate the saving of this establishment down to each of the associated entities
      if (associatedEntities) {
        await this.saveAssociatedEntities(
          savedBy,
          bulkUploaded,
          externalTransaction || (await models.sequelize.transaction()),
        );
      }

      return;
    }

    if (mustSave && this._isNew) {
      // create new Establishment
      try {
        // when creating an establishment, need to calculate it's NMDS ID, which is combination of postcode area and sequence.
        const cssrResults = await models.pcodedata.findOne({
          where: {
            postcode: this._postcode,
          },
          include: [
            {
              model: models.cssr,
              as: 'theAuthority',
              attributes: ['id', 'name', 'nmdsIdLetter'],
            },
          ],
        });

        let nmdsLetter = null;
        if (
          cssrResults &&
          cssrResults.postcode === this._postcode &&
          cssrResults.theAuthority &&
          cssrResults.theAuthority.id &&
          Number.isInteger(cssrResults.theAuthority.id)
        ) {
          nmdsLetter = cssrResults.theAuthority.nmdsIdLetter;
        } else {
          // No direct match so do the fuzzy match
          const [firstHalfOfPostcode] = 'postcode'.split(' ');
          const fuzzyCssrNmdsIdMatch = await models.sequelize.query(
            `select "Cssr"."NmdsIDLetter"
              from cqcref.pcodedata, cqc."Cssr"
              where postcode like '${escape(firstHalfOfPostcode)}%'
              and pcodedata.local_custodian_code = "Cssr"."LocalCustodianCode"
              group by "Cssr"."NmdsIDLetter"
              limit 1`,
            {
              type: models.sequelize.QueryTypes.SELECT,
            },
          );

          if (fuzzyCssrNmdsIdMatch && fuzzyCssrNmdsIdMatch[0] && fuzzyCssrNmdsIdMatch[0].NmdsIDLetter) {
            nmdsLetter = fuzzyCssrNmdsIdMatch[0].NmdsIDLetter;
          }
        }

        // catch all - because we don't want new establishments failing just because of old postcode data
        if (nmdsLetter === null) {
          nmdsLetter = 'W';
        }

        let nextNmdsIdSeqNumber = 0;
        const nextNmdsIdSeqNumberResults = await models.sequelize.query('SELECT nextval(\'cqc."NmdsID_seq"\')', {
          type: models.sequelize.QueryTypes.SELECT,
        });

        if (
          nextNmdsIdSeqNumberResults &&
          nextNmdsIdSeqNumberResults[0] &&
          nextNmdsIdSeqNumberResults[0] &&
          nextNmdsIdSeqNumberResults[0].nextval
        ) {
          nextNmdsIdSeqNumber = parseInt(nextNmdsIdSeqNumberResults[0].nextval);
        } else {
          // no sequence number
          console.error('Failed to get next sequence number for Establishment: ', nextNmdsIdSeqNumberResults);
          throw new EstablishmentExceptions.EstablishmentSaveException(
            null,
            this.uid,
            this.name,
            'Failed to generate NMDS ID',
            'Failed to generate NMDS ID',
          );
        }

        this._nmdsId = `${nmdsLetter}${nextNmdsIdSeqNumber}`;

        const creationDocument = {
          uid: this.uid,
          NameValue: this.name,
          address1: this._address1,
          address2: this._address2,
          address3: this._address3,
          town: this._town,
          county: this._county,
          postcode: this._postcode,
          isParent: this._isParent,
          parentUid: this._parentUid,
          parentId: this._parentId,
          dataOwner: this._dataOwner ? this._dataOwner : 'Workplace',
          dataPermissions: this._dataPermissions,
          isRegulated: this._isRegulated,
          locationId: this._locationId,
          provId: this._provId,
          MainServiceFKValue: this.mainService.id,
          nmdsId: this._nmdsId,
          updatedBy: savedBy.toLowerCase(),
          ShareDataValue: false,
          shareWithCQC: false,
          shareWithLA: false,
          source: bulkUploaded ? 'Bulk' : 'Online',
          attributes: ['id', 'created', 'updated'],
          ustatus: this._ustatus,
        };

        // need to create the Establishment record and the Establishment Audit event
        //  in one transaction
        await models.sequelize.transaction(async (t) => {
          // the saving of an Establishment can be initiated within
          //  an external transaction
          const thisTransaction = externalTransaction || t;

          // now append the extendable properties.
          // Note - although the POST (create) has a default
          //   set of mandatory properties, there is no reason
          //   why we cannot create an Establishment record with more properties
          const modifedCreationDocument = this._properties.save(savedBy.toLowerCase(), creationDocument);

          // check all mandatory parameters have been provided
          if (!this.hasMandatoryProperties) {
            throw new Error('Missing Mandatory properties');
          }

          // now save the document
          const creation = await models.establishment.create(modifedCreationDocument, { transaction: thisTransaction });

          const sanitisedResults = creation.get({ plain: true });

          this._id = sanitisedResults.EstablishmentID;
          this._created = sanitisedResults.created;
          this._updated = sanitisedResults.updated;
          this._updatedBy = savedBy;
          this._isNew = false;

          // having the user we can now create the audit record; injecting the userFk
          const allAuditEvents = [
            {
              establishmentFk: this._id,
              username: savedBy.toLowerCase(),
              type: 'created',
            },
          ].concat(
            this._properties.auditEvents.map((thisEvent) => {
              return {
                ...thisEvent,
                establishmentFk: this._id,
              };
            }),
          );
          await models.establishmentAudit.bulkCreate(allAuditEvents, { transaction: thisTransaction });

          // now - work through any additional models having processed all properties (first delete and then re-create)
          const additionalModels = this._properties.additionalModels;
          const additionalModelsByname = Object.keys(additionalModels);
          const deleteModelPromises = [];
          additionalModelsByname.forEach(async (thisModelByName) => {
            deleteModelPromises.push(
              models[thisModelByName].destroy({
                where: {
                  establishmentId: this._id,
                },
                transaction: thisTransaction,
              }),
            );
          });
          await Promise.all(deleteModelPromises);
          const createModelPromises = [];
          additionalModelsByname.forEach(async (thisModelByName) => {
            const thisModelData = additionalModels[thisModelByName];
            createModelPromises.push(
              models[thisModelByName].bulkCreate(
                thisModelData.map((thisRecord) => {
                  return {
                    ...thisRecord,
                    establishmentId: this._id,
                  };
                }),
                { transaction: thisTransaction },
              ),
            );
          });
          await Promise.all(createModelPromises);

          // always recalculate WDF - if not bulk upload (this._status)
          if (this._status === null) {
            await WdfCalculator.calculate(
              savedBy,
              this._id,
              null,
              thisTransaction,
              WdfCalculator.ESTABLISHMENT_ADD,
              false,
            );
          }

          // if requested, propagate the saving of this establishment down to each of the associated entities
          if (associatedEntities) {
            await this.saveAssociatedEntities(savedBy, bulkUploaded, thisTransaction);
          }

          this._log(
            Establishment.LOG_INFO,
            `Created Establishment with uid (${this.uid}), id (${this._id}) and name (${this.name})`,
          );
        });
      } catch (err) {
        // need to handle duplicate Establishment
        if (err.name && err.name === 'SequelizeUniqueConstraintError') {
          if (
            err.parent.constraint &&
            (err.parent.constraint === 'Establishment_unique_registration_with_locationid' ||
              err.parent.constraint === 'Establishment_unique_registration')
          ) {
            throw new EstablishmentExceptions.EstablishmentSaveException(
              null,
              this.uid,
              this.name,
              'Duplicate Establishment',
              'Duplicate Establishment',
            );
          }
        }

        if (err.name && err.name === 'SequelizeUniqueConstraintError') {
          if (err.parent.constraint && err.parent.constraint === 'establishment_LocalIdentifier_unq') {
            throw new EstablishmentExceptions.EstablishmentSaveException(
              null,
              this.uid,
              this.name,
              'Duplicate LocalIdentifier',
              'Duplicate LocalIdentifier',
            );
          }
        }

        // and foreign key constaint to Location
        if (err.name && err.name === 'SequelizeForeignKeyConstraintError') {
          throw new EstablishmentExceptions.EstablishmentSaveException(
            null,
            this.uid,
            this.name,
            'Unknown Location',
            'Unknown Location',
          );
        }

        if (err.name && err.name === 'SequelizeValidationError' && err.errors[0].path === 'nmdsId') {
          throw new EstablishmentExceptions.EstablishmentSaveException(
            null,
            this.uid,
            this.name,
            'Unknown NMDSID',
            'Unknown NMDSID',
          );
        }

        // gets here having not explicitly caught err
        throw new EstablishmentExceptions.EstablishmentSaveException(null, this.uid, this.name, err, null);
      }
    } else {
      // we are updating an existing Establishment
      try {
        const updatedTimestamp = new Date();

        // need to update the existing Establishment record and add an
        //  updated audit event within a single transaction
        await models.sequelize.transaction(async (t) => {
          // the saving of an Establishment can be initiated within
          //  an external transaction
          const thisTransaction = externalTransaction || t;
          const buChanged = this._status === 'NOCHANGE';
          // now append the extendable properties
          const modifedUpdateDocument = this._properties.save(savedBy.toLowerCase(), {}, buChanged);

          // note - if the establishment was created online, but then updated via bulk upload, the source become bulk and vice-versa.
          const updateDocument = {
            ...modifedUpdateDocument,
            source: bulkUploaded ? 'Bulk' : 'Online',
            isRegulated: this._isRegulated, // to remove when a change managed property
            locationId: this._locationId, // to remove when a change managed property
            provId: this._provId, // to remove when a change managed property
            address1: this._address1,
            address2: this._address2,
            address3: this._address3,
            name: this._name,
            town: this._town,
            county: this._county,
            postcode: this._postcode,
            reasonsForLeaving: this._reasonsForLeaving,
            updated: updatedTimestamp,
            updatedBy: savedBy.toLowerCase(),
            ustatus: this._ustatus,
          };

          // Every time the establishment is saved, need to calculate
          // it's current WDF eligibility. If it is eligible then
          // update the last WDF Eligibility status
          const wdfEligibility = await this.isWdfEligible(WdfCalculator.effectiveDate);

          let wdfAudit = null;

          if (wdfEligibility.currentEligibility) {
            updateDocument.lastWdfEligibility = updatedTimestamp;
            updateDocument.establishmentWdfEligibility = updatedTimestamp;
            wdfAudit = {
              username: savedBy.toLowerCase(),
              type: 'wdfEligible',
            };
          } else {
            // blank out establishmentWdfEligibility to indicate the
            // establishment is not currently wdf eligable, but preserve
            // the value in lastWdfEligibility as that field is audited
            updateDocument.establishmentWdfEligibility = null;
          }

          // now save the document
          const [updatedRecordCount, updatedRows] = await models.establishment.update(updateDocument, {
            returning: true,
            where: {
              uid: this.uid,
            },
            attributes: ['id', 'updated'],
            transaction: thisTransaction,
          });

          if (updatedRecordCount === 1) {
            const updatedRecord = updatedRows[0].get({ plain: true });

            this._updated = updatedRecord.updated;
            this._updatedBy = savedBy.toLowerCase();
            this._id = updatedRecord.EstablishmentID;

            // having updated the record, create the audit event
            const allAuditEvents = [
              {
                establishmentFk: this._id,
                username: savedBy.toLowerCase(),
                type: 'updated',
              },
            ].concat(
              this._properties.auditEvents.map((thisEvent) => {
                return {
                  ...thisEvent,
                  establishmentFk: this._id,
                };
              }),
            );

            if (wdfAudit) {
              wdfAudit.establishmentFk = this._id;
              allAuditEvents.push(wdfAudit);
            }

            await models.establishmentAudit.bulkCreate(allAuditEvents, { transaction: thisTransaction });

            // now - work through any additional models having processed all properties (first delete and then re-create)
            const additionalModels = this._properties.additionalModels;
            const additionalModelsByname = Object.keys(additionalModels);
            const deleteModelPromises = [];

            additionalModelsByname.forEach(async (thisModelByName) => {
              deleteModelPromises.push(
                models[thisModelByName].destroy({
                  where: {
                    establishmentId: this._id,
                  },
                  transaction: thisTransaction,
                }),
              );
            });

            await Promise.all(deleteModelPromises);

            const createModelPromises = [];

            additionalModelsByname.forEach(async (thisModelByName) => {
              const thisModelData = additionalModels[thisModelByName];
              createModelPromises.push(
                models[thisModelByName].bulkCreate(
                  thisModelData.map((thisRecord) => {
                    return {
                      ...thisRecord,
                      establishmentId: this._id,
                    };
                  }),
                  { transaction: thisTransaction },
                ),
              );
            });

            await Promise.all(createModelPromises);

            // always recalculate WDF - if not bulk upload (this._status)
            if (this._status === null) {
              await WdfCalculator.calculate(
                savedBy,
                this._id,
                null,
                thisTransaction,
                WdfCalculator.ESTABLISHMENT_UPDATE,
                false,
              );
            }

            // if requested, propagate the saving of this establishment down to each of the associated entities
            if (associatedEntities) {
              await this.saveAssociatedEntities(savedBy, bulkUploaded, thisTransaction);
            }

            this._log(Establishment.LOG_INFO, `Updated Establishment with uid (${this.uid}) and name (${this.name})`);
          } else {
            throw new EstablishmentExceptions.EstablishmentSaveException(
              null,
              this.uid,
              this.name,
              `Failed to update resulting establishment record with id: ${this._id}`,
              `Failed to update resulting establishment record with id: ${this._id}`,
            );
          }
        });
      } catch (err) {
        if (err.name && err.name === 'SequelizeUniqueConstraintError') {
          if (err.parent.constraint && err.parent.constraint === 'establishment_LocalIdentifier_unq') {
            throw new EstablishmentExceptions.EstablishmentSaveException(
              null,
              this.uid,
              this.name,
              'Duplicate LocalIdentifier',
              'Duplicate LocalIdentifier',
            );
          }
        }

        throw new EstablishmentExceptions.EstablishmentSaveException(
          null,
          this.uid,
          this.name,
          err,
          `Failed to update establishment record with id: ${this._id}`,
        );
      }
    }

    return mustSave;
  }

  /**
   * Function to fetch all the parents details.
   * @param id is a string or number
   * @fetchQuery consist of parameters based on which we will filter parent detals.
   */
  async fetchParentDetails(id) {
    if (!id) {
      throw new EstablishmentExceptions.EstablishmentRestoreException(
        null,
        null,
        null,
        'User::restore failed: Missing id or uid',
        null,
        'Unexpected Error',
      );
    }
    try {
      // restore establishment based on id as an integer (primary key or uid)
      let fetchQuery = {
        where: {
          id: id,
        },
      };

      if (!Number.isInteger(id)) {
        fetchQuery = {
          where: {
            uid: id,
            archived: false,
          },
        };
      }
      let parentDetails = {};
      const fetchDetails = await models.establishment.findOne(fetchQuery);
      if (fetchDetails && fetchDetails.id && Number.isInteger(fetchDetails.id)) {
        this._parentName = fetchDetails.NameValue;
        this._id = fetchDetails.id;
        parentDetails.parentName = this._parentName;
        parentDetails.id = this._id;
      }
      return parentDetails;
    } catch (err) {
      // typically errors when making changes to model or database schema!
      this._log(Establishment.LOG_ERROR, err);

      throw new EstablishmentExceptions.EstablishmentRestoreException(null, this.uid, null, err, null);
    }
  }

  /**
   * Function will update linkToParentRequested column.
   * @param establishmentId is a number
   */
  async updateLinkToParentRequested(establishmentId, linkToParentRequest = false) {
    try {
      const updatedEstablishment = await models.establishment.update(
        {
          linkToParentRequested: linkToParentRequest ? null : new Date(),
        },
        {
          where: {
            id: establishmentId,
          },
        },
      );
      if (updatedEstablishment) {
        return true;
      }
    } catch (err) {
      this._log(Establishment.LOG_ERROR, `linkToParentRequested - failed: ${err}`);
    }
  }
  // loads the Establishment (with given id or uid) from DB, but only if it belongs to the known User
  // returns true on success; false if no User
  // Can throw EstablishmentRestoreException exception.
  async restore(id, showHistory = false, associatedEntities = false, associatedLevel = 1) {
    if (!id) {
      throw new EstablishmentExceptions.EstablishmentRestoreException(
        null,
        null,
        null,
        'User::restore failed: Missing id or uid',
        null,
        'Unexpected Error',
      );
    }
    try {
      // restore establishment based on id as an integer (primary key or uid)
      let fetchQuery = {
        where: {
          id: id,
        },
      };

      if (!Number.isInteger(id)) {
        fetchQuery = {
          where: {
            uid: id,
            archived: false,
          },
        };
      }

      const fetchResults = await models.establishment.findOne(fetchQuery);
      if (fetchResults && fetchResults.id && Number.isInteger(fetchResults.id)) {
        // update self - don't use setters because they modify the change state
        this._isNew = false;
        this._id = fetchResults.id;
        this._uid = fetchResults.uid;
        this._ustatus = fetchResults.ustatus;
        this._created = fetchResults.created;
        this._updated = fetchResults.updated;
        this._updatedBy = fetchResults.updatedBy;

        this._name = fetchResults.NameValue;
        this._address1 = fetchResults.address1;
        this._address2 = fetchResults.address2;
        this._address3 = fetchResults.address3;
        this._town = fetchResults.town;
        this._county = fetchResults.county;

        this._locationId = fetchResults.locationId;
        this._provId = fetchResults.provId;
        this._postcode = fetchResults.postcode;
        this._isRegulated = fetchResults.isRegulated;

        this._nmdsId = fetchResults.nmdsId;
        this._lastWdfEligibility = fetchResults.lastWdfEligibility;
        this._overallWdfEligibility = fetchResults.overallWdfEligibility;
        this._establishmentWdfEligibility = fetchResults.establishmentWdfEligibility;
        this._staffWdfEligibility = fetchResults.staffWdfEligibility;
        this._isParent = fetchResults.isParent;
        this._parentId = fetchResults.parentId;
        this._parentUid = fetchResults.parentUid;
        this._dataOwner = fetchResults.dataOwner;
        this._dataPermissions = fetchResults.dataPermissions;

        // interim solution for reason for leaving
        this._reasonsForLeaving = fetchResults.reasonsForLeaving;
        this._archived = fetchResults.archived;
        this._dataOwnershipRequested = fetchResults.dataOwnershipRequested;
        this._linkToParentRequested = fetchResults.linkToParentRequested;
        this._lastBulkUploaded = fetchResults.lastBulkUploaded;
        // if history of the User is also required; attach the association
        //  and order in reverse chronological - note, order on id (not when)
        //  because ID is primay key and hence indexed
        // There can be hundreds/thousands of audit history. The left joins
        //   and multiple joins across tables incurs a hefty SQL
        //   performance penalty if join audit data to.
        // Therefore a separate fetch is used for audit data
        if (showHistory) {
          fetchResults.auditEvents = await models.establishmentAudit.findAll({
            where: {
              establishmentFk: this._id,
            },
            order: [['id', 'DESC']],
          });
        }

        // Individual fetches for extended information in associations
        const establishmentServiceUserResults = await models.establishmentServiceUsers.findAll({
          where: {
            EstablishmentID: this._id,
          },
          raw: true,
        });

        const establishmentServices = await models.establishmentServices.findAll({
          where: {
            EstablishmentID: this._id,
          },
          raw: true,
        });

        const [otherServices, mainService, serviceUsers, capacity, jobs, localAuthorities] = await Promise.all([
          ServiceCache.allMyOtherServices(establishmentServices.map((x) => x)),
          models.services.findOne({
            where: {
              id: fetchResults.MainServiceFKValue,
            },
            attributes: ['id', 'name'],
            raw: true,
          }),
          models.serviceUsers.findAll({
            where: {
              id: establishmentServiceUserResults.map((su) => su.serviceUserId),
            },
            attributes: ['id', 'service', 'group', 'seq'],
            order: [['seq', 'ASC']],
            raw: true,
          }),
          models.establishmentCapacity.findAll({
            where: {
              EstablishmentID: this._id,
            },
            include: [
              {
                model: models.serviceCapacity,
                as: 'reference',
                attributes: ['id', 'question'],
              },
            ],
            attributes: ['id', 'answer'],
          }),
          models.establishmentJobs.findAll({
            where: {
              EstablishmentID: this._id,
            },
            include: [
              {
                model: models.job,
                as: 'reference',
                attributes: ['id', 'title'],
                order: [['title', 'ASC']],
              },
            ],
            attributes: ['id', 'type', 'total'],
            order: [['type', 'ASC']],
          }),
          models.establishmentLocalAuthority.findAll({
            where: {
              EstablishmentID: this._id,
            },
            attributes: ['id', 'cssrId', 'cssr'],
          }),
        ]);

        // For services merge any other data into resultset
        fetchResults.serviceUsers = establishmentServiceUserResults.map((suResult) => {
          const serviceUser = serviceUsers.find((element) => {
            return suResult.serviceUserId === element.id;
          });
          if (suResult.other) {
            return {
              ...serviceUser,
              other: suResult.other,
            };
          } else {
            return serviceUser;
          }
        });

        fetchResults.otherServices = establishmentServices.map((suResult) => {
          const otherService = otherServices.find((element) => {
            return suResult.serviceId === element.id;
          });
          if (suResult.other) {
            return {
              ...otherService,
              other: suResult.other,
            };
          } else {
            return otherService;
          }
        });

        fetchResults.capacity = capacity;
        fetchResults.jobs = jobs;
        fetchResults.localAuthorities = localAuthorities;

        fetchResults.mainService = { ...mainService, other: fetchResults.MainServiceFkOther };

        // Moved this code from the section after the findOne, to here, now that mainService is pulled in seperately
        this._mainService = {
          id: fetchResults.mainService.id,
          name: fetchResults.mainService.name,
        };

        // other services output requires a list of ALL services available to
        // the Establishment
        fetchResults.allMyServices = ServiceCache.allMyServices(fetchResults.isRegulated);

        // service capacities output requires a list of ALL service capacities available to
        //  the Establishment
        // fetch the main service id and all the associated 'other services' by id only
        const allCapacitiesResults = await models.establishment.findOne({
          where: {
            id: this._id,
          },
          attributes: ['id'],
          include: [
            {
              model: models.services,
              as: 'otherServices',
              attributes: ['id'],
            },
            {
              model: models.services,
              as: 'mainService',
              attributes: ['id'],
            },
          ],
        });

        const allAssociatedServiceIndices = [];

        if (allCapacitiesResults && allCapacitiesResults.id) {
          // merge tha main and other service ids
          if (allCapacitiesResults.mainService.id) {
            allAssociatedServiceIndices.push(allCapacitiesResults.mainService.id);
          }

          if (allCapacitiesResults.otherServices) {
            allCapacitiesResults.otherServices.forEach((thisService) =>
              allAssociatedServiceIndices.push(thisService.id),
            );
          }
        }

        // now fetch all the questions for the given set of combined services
        if (allAssociatedServiceIndices.length > 0) {
          fetchResults.allServiceCapacityQuestions = CapacitiesCache.allMyCapacities(allAssociatedServiceIndices);
        } else {
          fetchResults.allServiceCapacityQuestions = null;
        }

        // need to identify which, if any, of the shared authorities is attributed to the
        //  primary Authority; that is the Local Authority associated with the physical area
        //  of the given Establishment (using the postcode as the key)
        // lookup primary authority by trying to resolve on specific postcode code
        const cssrResults = await models.pcodedata.findOne({
          where: {
            postcode: fetchResults.postcode,
          },
          include: [
            {
              model: models.cssr,
              as: 'theAuthority',
              attributes: ['id', 'name', 'nmdsIdLetter'],
            },
          ],
        });

        if (
          cssrResults &&
          cssrResults.postcode === fetchResults.postcode &&
          cssrResults.theAuthority &&
          cssrResults.theAuthority.id &&
          Number.isInteger(cssrResults.theAuthority.id)
        ) {
          fetchResults.primaryAuthorityCssr = {
            id: cssrResults.theAuthority.id,
            name: cssrResults.theAuthority.name,
          };
        } else {
          //  using just the first half of the postcode
          const [firstHalfOfPostcode] = fetchResults.postcode.split(' ');

          // must escape the string to prevent SQL injection
          const fuzzyCssrIdMatch = await models.sequelize.query(
            `select "Cssr"."CssrID", "Cssr"."CssR"
              from cqcref.pcodedata, cqc."Cssr"
              where postcode like '${escape(firstHalfOfPostcode)}%'
              and pcodedata.local_custodian_code = "Cssr"."LocalCustodianCode"
              group by "Cssr"."CssrID", "Cssr"."CssR"
              limit 1`,
            {
              type: models.sequelize.QueryTypes.SELECT,
            },
          );

          if (fuzzyCssrIdMatch && fuzzyCssrIdMatch[0] && fuzzyCssrIdMatch[0] && fuzzyCssrIdMatch[0].CssrID) {
            fetchResults.primaryAuthorityCssr = {
              id: fuzzyCssrIdMatch[0].CssrID,
              name: fuzzyCssrIdMatch[0].CssR,
            };
          }
        }

        if (fetchResults.auditEvents) {
          this._auditEvents = fetchResults.auditEvents;
        }

        // load extendable properties
        await this._properties.restore(fetchResults, SEQUELIZE_DOCUMENT_TYPE);

        // certainly for bulk upload, but also expected for cross-entity validations, restore all associated entities (workers)
        if (associatedEntities) {
          // restoring associated entities can be resource expensive, especially if doing deep restore of associated entities
          //  - that is especially true if restoring the training and qualification records for each of the Workers.
          //  Only pass down the restoration of Worker's associated entities if the association level is more than one level
          const myWorkerSet = await models.worker.findAll({
            attributes: ['uid'],
            where: {
              establishmentFk: this._id,
              archived: false,
            },
          });

          if (myWorkerSet && Array.isArray(myWorkerSet)) {
            await Promise.all(
              myWorkerSet.map(async (thisWorker) => {
                const newWorker = new Worker(this._id, this._status);
                await newWorker.restore(
                  thisWorker.uid,
                  false,
                  associatedLevel > 1 ? associatedEntities : false,
                  associatedLevel,
                );

                // TODO: once we have the unique worder id property, use that instead; for now, we only have the name or id.
                // without whitespace
                this.associateWorker(newWorker.key, newWorker);

                return {};
              }),
            );
          }
        }

        return true;
      }

      return false;
    } catch (err) {
      // typically errors when making changes to model or database schema!
      this._log(Establishment.LOG_ERROR, err);

      throw new EstablishmentExceptions.EstablishmentRestoreException(null, this.uid, null, err, null);
    }
  }

  async delete(deletedBy, externalTransaction = null, associatedEntities = false) {
    let t;
    try {
      const updatedTimestamp = new Date();

      // the saving of an Establishment can be initiated within
      //  an external transaction
      t = externalTransaction === null ? await models.sequelize.transaction() : null;
      const thisTransaction = externalTransaction || t;

      const updateDocument = {
        archived: true,
        updated: updatedTimestamp,
        updatedBy: deletedBy,
        LocalIdentifierValue: null,
      };

      const [updatedRecordCount, updatedRows] = await models.establishment.update(updateDocument, {
        returning: true,
        where: {
          uid: this.uid,
        },
        attributes: ['id', 'updated'],
        transaction: thisTransaction,
      });

      if (updatedRecordCount === 1) {
        const updatedRecord = updatedRows[0].get({ plain: true });

        this._updated = updatedRecord.updated;
        this._updatedBy = deletedBy;

        const allAuditEvents = [
          {
            establishmentFk: this._id,
            username: deletedBy,
            type: 'deleted',
          },
        ];

        await models.establishmentAudit.bulkCreate(allAuditEvents, { transaction: thisTransaction });

        // if deleting this establishment, and if requested, then delete all the associated entities (workers) too
        if (associatedEntities && this._workerEntities) {
          await Promise.all(
            Object.values(this._workerEntities).map((thisWorker) => thisWorker.archive(deletedBy, thisTransaction)),
          );
        }

        // always recalculate WDF - if not bulk upload (this._status)
        if (this._status === null) {
          await WdfCalculator.calculate(
            deletedBy,
            this._id,
            null,
            thisTransaction,
            WdfCalculator.ESTABLISHMENT_DELETE,
            false,
          );
        }

        if (t) {
          t.commit();
        }

        this._log(Establishment.LOG_INFO, `Archived Establishment with uid (${this._uid}) and id (${this._id})`);
      } else {
        const nameId = this._properties.get('NameOrId');

        throw new EstablishmentExceptions.EstablishmentDeleteException(
          null,
          this.uid,
          nameId ? nameId.property : null,
          '',
          `Failed to update (archive) estabalishment record with uid: ${this._uid}`,
        );
      }
    } catch (err) {
      if (t) {
        t.rollback();
      } else {
        externalTransaction.rollback();
      }
      console.log('throwing error');
      console.log(err);
      const nameId = this._properties.get('NameOrId');
      throw new EstablishmentExceptions.EstablishmentDeleteException(
        null,
        this.uid,
        nameId ? nameId.property : null,
        err,
        `Failed to update (archive) estabalishment record with uid: ${this._uid}`,
      );
    }
  }

  // helper returns a set 'json ready' objects for representing an Establishments's overall
  //  change history, from a given set of audit events (those events being created
  //  or updated only)
  formatHistoryEvents(auditEvents) {
    if (auditEvents) {
      return auditEvents
        .filter((thisEvent) => ['created', 'updated', 'wdfEligible', 'overalWdfEligible'].includes(thisEvent.type))
        .map((thisEvent) => {
          return {
            when: thisEvent.when,
            username: thisEvent.username,
            event: thisEvent.type,
          };
        });
    } else {
      return null;
    }
  }

  // helper returns a set 'json ready' objects for representing an Establishment's audit
  //  history, from a the given set of audit events including those of individual
  //  Establishment properties)
  formatHistory(auditEvents) {
    if (auditEvents) {
      return auditEvents.map((thisEvent) => {
        return {
          when: thisEvent.when,
          username: thisEvent.username,
          event: thisEvent.type,
          property: thisEvent.property,
          change: thisEvent.event,
        };
      });
    } else {
      return null;
    }
  }

  async getTotalWorkers() {
    return models.worker.count({ where: { establishmentFk: this._id, archived: false } });
  }

  // returns a Javascript object which can be used to present as JSON
  //  showHistory appends the historical account of changes at User and individual property level
  //  showHistoryTimeline just returns the history set of audit events for the given User
  toJSON(
    showHistory = false,
    showPropertyHistoryOnly = true,
    showHistoryTimeline = false,
    modifiedOnlyProperties = false,
    fullDescription = true,
    filteredPropertiesByName = null,
    includeAssociatedEntities = false,
  ) {
    if (!showHistoryTimeline) {
      if (filteredPropertiesByName !== null && !Array.isArray(filteredPropertiesByName)) {
        throw new Error('Establishment::toJSON filteredPropertiesByName must be a simple Array of names');
      }

      // JSON representation of extendable properties - with optional filter
      const myJSON = this._properties.toJSON(
        showHistory,
        showPropertyHistoryOnly,
        modifiedOnlyProperties,
        filteredPropertiesByName,
        false,
      );

      // add Establishment default properties
      //  using the default formatters
      const myDefaultJSON = {
        id: this.id,
        uid: this.uid,
        name: this.name,
        dataOwnershipRequested: this.dataOwnershipRequested,
        linkToParentRequested: this.linkToParentRequested,
      };

      if (fullDescription) {
        myDefaultJSON.address = this.address;
        myDefaultJSON.address1 = this.address1;
        myDefaultJSON.address2 = this.address2;
        myDefaultJSON.address3 = this.address3;
        myDefaultJSON.town = this.town;
        myDefaultJSON.county = this.county;
        myDefaultJSON.postcode = this.postcode;
        myDefaultJSON.Latitude = this.latitude;
        myDefaultJSON.Longitude = this.longitude;
        myDefaultJSON.locationId = this.locationId;
        myDefaultJSON.provId = this.provId;
        myDefaultJSON.isRegulated = this.isRegulated;
        myDefaultJSON.nmdsId = this.nmdsId;
        myDefaultJSON.isParent = this.isParent;
        myDefaultJSON.parentUid = this.parentUid;
        myDefaultJSON.dataOwner = this.dataOwner;
        myDefaultJSON.dataOwnershipRequested = this.dataOwnershipRequested;
        myDefaultJSON.linkToParentRequested = this.linkToParentRequested;
        myDefaultJSON.dataPermissions = this.isParent ? undefined : this.dataPermissions;
        myDefaultJSON.reasonsForLeaving = this.reasonsForLeaving;
        myDefaultJSON.lastBulkUploaded = this.lastBulkUploaded;
      }

      if (this._ustatus) {
        myDefaultJSON.ustatus = this._ustatus;
      }

      // bulk upload status
      if (this._status) {
        myDefaultJSON.status = this._status;
      }

      myDefaultJSON.created = this.created ? this.created.toJSON() : null;
      myDefaultJSON.updated = this.updated ? this.updated.toJSON() : null;
      myDefaultJSON.updatedBy = this.updatedBy ? this.updatedBy : null;

      // TODO: JSON schema validation
      if (showHistory && !showPropertyHistoryOnly) {
        return {
          ...myDefaultJSON,
          ...myJSON,
          history: this.formatHistoryEvents(this._auditEvents),
        };
      } else {
        return {
          ...myDefaultJSON,
          ...myJSON,
          workers: includeAssociatedEntities
            ? Object.values(this._workerEntities).map((thisWorker) =>
                thisWorker.toJSON(false, false, false, false, true),
              )
            : undefined,
        };
      }
    } else {
      return {
        id: this.id,
        uid: this.uid,
        name: this.name,
        created: this.created.toJSON(),
        updated: this.updated.toJSON(),
        updatedBy: this.updatedBy,
        history: this.formatHistory(this._auditEvents),
      };
    }
  }

  // HELPERS

  // returns true if all mandatory properties for an Establishment exist and are valid
  get hasMandatoryProperties() {
    let allExistAndValid = true; // assume all exist until proven otherwise

    // in bulk upload, an establishment entity, if UNCHECKED, will be nothing more than a status and a local identifier
    if (this._status === null || !STOP_VALIDATING_ON.includes(this._status)) {
      try {
        const nmdsIdRegex = /^[A-Z]1[\d]{6}$/i;
        if (this._uid !== null && !(this._nmdsId && nmdsIdRegex.test(this._nmdsId))) {
          allExistAndValid = false;
          this._validations.push(
            new ValidationMessage(ValidationMessage.ERROR, 101, this._nmdsId ? `Invalid: ${this._nmdsId}` : 'Missing', [
              'NMDSID',
            ]),
          );
          this._log(Establishment.LOG_ERROR, 'Establishment::hasMandatoryProperties - missing or invalid NMDS ID');
        }

        if (!this.name) {
          allExistAndValid = false;
          this._validations.push(
            new ValidationMessage(ValidationMessage.ERROR, 102, this.name ? `Invalid: ${this.name}` : 'Missing', [
              'Name',
            ]),
          );
          this._log(Establishment.LOG_ERROR, 'Establishment::hasMandatoryProperties - missing or invalid name');
        }

        if (!this.mainService) {
          allExistAndValid = false;
          this._log(Establishment.LOG_ERROR, 'Establishment::hasMandatoryProperties - missing or invalid main service');
        }

        // must at least have the first line of address
        if (!this._address1) {
          allExistAndValid = false;
          this._validations.push(
            new ValidationMessage(
              ValidationMessage.ERROR,
              103,
              this._address ? `Invalid: ${this._address}` : 'Missing',
              ['Address'],
            ),
          );
          this._log(
            Establishment.LOG_ERROR,
            'Establishment::hasMandatoryProperties - missing or invalid first line of address',
          );
        }

        if (!this._postcode) {
          allExistAndValid = false;
          this._validations.push(
            new ValidationMessage(
              ValidationMessage.ERROR,
              104,
              this._postcode ? `Invalid: ${this._postcode}` : 'Missing',
              ['Postcode'],
            ),
          );
          this._log(Establishment.LOG_ERROR, 'Establishment::hasMandatoryProperties - missing or invalid postcode');
        }

        if (this._isRegulated === null) {
          allExistAndValid = false;
          this._validations.push(new ValidationMessage(ValidationMessage.ERROR, 105, 'Missing', ['CQCRegistered']));
          this._log(Establishment.LOG_ERROR, 'Establishment::hasMandatoryProperties - missing regulated flag');
        }

        // location id can be null for a Non-CQC site
        // if a CQC site, and main service is head office (ID=16)
        const MAIN_SERVICE_HEAD_OFFICE_ID = 16;
        if (this._isRegulated) {
          if (this.mainService.id !== MAIN_SERVICE_HEAD_OFFICE_ID && this._locationId === null) {
            allExistAndValid = false;
            this._validations.push(
              new ValidationMessage(ValidationMessage.ERROR, 106, 'Missing (mandatory) for a CQC Registered site', [
                'LocationID',
              ]),
            );
            this._log(
              Establishment.LOG_ERROR,
              'Establishment::hasMandatoryProperties - missing or invalid Location ID for a (CQC) Regulated workspace',
            );
          }
        }
      } catch (err) {
        console.error(err);
      }
    }

    return allExistAndValid;
  }

  async canConfirm(effectiveFrom, lastEligibility, wdfPropertyValues) {
    const hasEligibleProperties = wdfPropertyValues.every((thisWdfProperty) => thisWdfProperty.isEligible !== 'No');

    if (!hasEligibleProperties) {
      return false;
    }

    effectiveFrom = moment(effectiveFrom);
    lastEligibility = moment(lastEligibility);

    if (lastEligibility.isAfter(effectiveFrom)) {
      return false;
    }

    return true;
  }

  // returns true if this establishment is WDF eligible as referenced from the
  //  given effective date; otherwise returns false
  async isWdfEligible(effectiveFrom) {
    const wdfByProperty = await this.wdf(effectiveFrom);
    const wdfPropertyValues = Object.values(wdfByProperty);
    const lastEligibility = this._lastWdfEligibility ? this._lastWdfEligibility.toISOString() : null;
    const canConfirm = await this.canConfirm(effectiveFrom, lastEligibility, wdfPropertyValues);

    // This establishment is eligible only if the overall eligible date is later than the effective date
    // The WDF by property will show the current eligibility of each property
    return {
      // whether the establishment has achieved overall wdf eligibility in this financial year
      isEligible: !!(this._overallWdfEligibility && this._overallWdfEligibility > effectiveFrom),

      // whether just the establishment fields are currently considered wdf valid
      currentEligibility: wdfPropertyValues.every(
        (thisWdfProperty) =>
          (thisWdfProperty.isEligible === 'Yes' && thisWdfProperty.updatedSinceEffectiveDate) ||
          thisWdfProperty.isEligible === 'Not relevant',
      ),
      // Can the Establishment confirm their up-to-date information?
      canConfirm: canConfirm,
      // The date just the establishment fields were last wdf valid
      lastEligibility: lastEligibility,
      ...wdfByProperty,
    };
  }

  _isPropertyWdfBasicEligible(refEpoch, property) {
    const PER_PROPERTY_ELIGIBLE = 0;
    const RECORD_LEVEL_ELIGIBLE = 1;
    const COMPLETED_PROPERTY_ELIGIBLE = 2;
    const ELIGIBILITY_REFERENCE = RECORD_LEVEL_ELIGIBLE;

    let referenceTime = null;

    switch (ELIGIBILITY_REFERENCE) {
      case PER_PROPERTY_ELIGIBLE:
        referenceTime = property.savedAt.getTime();
        break;

      case RECORD_LEVEL_ELIGIBLE:
        referenceTime = this._updated.getTime();
        break;

      case COMPLETED_PROPERTY_ELIGIBLE:
        // there is no completed property (yet) - copy the code from '.../server/models/classes/worker.js' once there is
        throw new Error('Establishment WDF by Completion is Not implemented');
    }

    return (
      property &&
      property.property !== null &&
      property.property !== undefined &&
      property.valid &&
      referenceTime !== null
    );
  }

  // returns the WDF eligibility of each WDF relevant property as referenced from
  //  the given effect date
  async wdf(effectiveFrom) {
    const myWdf = {};
    const effectiveFromEpoch = effectiveFrom.getTime();

    // employer type
    myWdf.employerType = {
      isEligible: this._isPropertyWdfBasicEligible(effectiveFromEpoch, this._properties.get('EmployerType'))
        ? 'Yes'
        : 'No',
      updatedSinceEffectiveDate: this._properties.get('EmployerType').toJSON(false, true, WdfCalculator.effectiveDate),
    };

    // main service & Other Service & Service Capacities & Service Users
    myWdf.mainService = {
      isEligible: this._isPropertyWdfBasicEligible(effectiveFromEpoch, this._properties.get('MainServiceFK'))
        ? 'Yes'
        : 'No',
      updatedSinceEffectiveDate: this._properties.get('MainServiceFK').toJSON(false, true, WdfCalculator.effectiveDate),
    };

    // capacities eligibility is only relevant to the main service capacities (other services' capacities are not relevant)
    //   are capacities. Otherwise, it (capacities eligibility) is not relevant.
    // All Known Capacities is available from the CapacityServices property JSON
    const hasCapacities = this._properties.get('CapacityServices')
      ? this._properties.get('CapacityServices').toJSON(false, false).allServiceCapacities.length > 0
      : false;

    let capacitiesEligible;
    if (hasCapacities) {
      // first validate whether any of the capacities are eligible - this is simply a check that capacities are valid.
      const capacitiesProperty = this._properties.get('CapacityServices');

      // we're only interested in the main service capacities
      const mainServiceCapacities = capacitiesProperty
        .toJSON(false, false)
        .allServiceCapacities.filter((thisCapacity) => /^Main Service - /.test(thisCapacity.service));

      if (mainServiceCapacities.length === 0) {
        capacitiesEligible = 'Not relevant';
      } else {
        // ensure all all main service's capacities have been answered - note, the can only be one Main Service capacity set
        capacitiesEligible = mainServiceCapacities[0].questions.every((thisQuestion) => hasProp(thisQuestion, 'answer'))
          ? 'Yes'
          : 'No';
      }
    } else {
      capacitiesEligible = 'Not relevant';
    }

    myWdf.capacities = {
      isEligible: capacitiesEligible,
      updatedSinceEffectiveDate: this._properties
        .get('CapacityServices')
        .toJSON(false, true, WdfCalculator.effectiveDate),
    };

    const serviceUsers = this._properties.get('ServiceUsers');
    myWdf.serviceUsers = {
      // for service users, it is not enough that the property itself is valid, to be WDF eligible it
      //   there must be at least one service user
      isEligible:
        this._isPropertyWdfBasicEligible(effectiveFromEpoch, serviceUsers) && serviceUsers.property.length > 0
          ? 'Yes'
          : 'No',
      updatedSinceEffectiveDate: serviceUsers.toJSON(false, true, WdfCalculator.effectiveDate),
    };

    // vacancies, starters and leavers
    myWdf.vacancies = {
      isEligible: this._isPropertyWdfBasicEligible(effectiveFromEpoch, this._properties.get('Vacancies'))
        ? 'Yes'
        : 'No',
      updatedSinceEffectiveDate: this._properties.get('Vacancies').toJSON(false, true, WdfCalculator.effectiveDate),
    };

    myWdf.starters = {
      isEligible: this._isPropertyWdfBasicEligible(effectiveFromEpoch, this._properties.get('Starters')) ? 'Yes' : 'No',
      updatedSinceEffectiveDate: this._properties.get('Starters').toJSON(false, true, WdfCalculator.effectiveDate),
    };

    myWdf.leavers = {
      isEligible: this._isPropertyWdfBasicEligible(effectiveFromEpoch, this._properties.get('Leavers')) ? 'Yes' : 'No',
      updatedSinceEffectiveDate: this._properties.get('Leavers').toJSON(false, true, WdfCalculator.effectiveDate),
    };

    // removing the cross-check on #workers from establishment's own (self) WDF Eligibility
    // let totalWorkerCount = await this.getTotalWorkers();

    myWdf.numberOfStaff = {
      // isEligible: this._isPropertyWdfBasicEligible(effectiveFromEpoch, this._properties.get('NumberOfStaff')) && this._properties.get('NumberOfStaff').property == totalWorkerCount ? 'Yes' : 'No',
      isEligible: this._isPropertyWdfBasicEligible(effectiveFromEpoch, this._properties.get('NumberOfStaff'))
        ? 'Yes'
        : 'No',
      updatedSinceEffectiveDate: this._properties.get('NumberOfStaff').toJSON(false, true, WdfCalculator.effectiveDate),
    };

    return myWdf;
  }

  // returns the WDF eligibilty as JSON object
  async wdfToJson() {
    const effectiveFrom = WdfCalculator.effectiveDate;

    return {
      effectiveFrom: effectiveFrom.toISOString(),
      ...(await this.isWdfEligible(effectiveFrom)),
    };
  }

  // for the given establishment, updates the last bulk uploaded timestamp
  static async bulkUploadSuccess(establishmentId) {
    try {
      await models.establishment.update(
        {
          lastBulkUploaded: new Date(),
        },
        {
          where: {
            id: establishmentId,
          },
        },
      );
    } catch (err) {
      console.error(Establishment.LOG_ERROR, `bulkUploadSuccess - failed: ${err}`);
    }
  }

  /**
   * Function to fetch all the parents name and their post code.
   * @fetchQuery consist of parameters based on which we will filter parent name and postcode.
   */

  static async fetchAllParentsAndPostcode() {
    try {
      let fetchQuery = {
        attributes: ['uid', 'NameValue', 'postcode'],
        where: {
          isParent: true,
          archived: false,
        },
      };
      let parentsAndPostcodeDetails = await models.establishment.findAll(fetchQuery);
      if (parentsAndPostcodeDetails) {
        let parentPostcodeDetailsArr = [];
        for (let i = 0; i < parentsAndPostcodeDetails.length; i++) {
          parentPostcodeDetailsArr.push({
            parentName: parentsAndPostcodeDetails[i].NameValue,
            postcode: parentsAndPostcodeDetails[i].postcode,
            uid: parentsAndPostcodeDetails[i].uid,
            parentNameAndPostalcode: `${parentsAndPostcodeDetails[i].NameValue}, ${parentsAndPostcodeDetails[i].postcode}`,
          });
        }
        return parentPostcodeDetailsArr;
      }
    } catch (err) {
      console.error('Establishment::fetch error: ', err);
      return false;
    }
  }

  // encapsulated method to fetch a list of all establishments (primary and any subs if a parent) for the given primary establishment
  static async fetchMyEstablishments(isParent, primaryEstablishmentId, isWDF) {
    // for each establishment, need:
    //  1. Name
    //  2. Main Service (by title)
    //  3. Data Owner
    //  4. Data Owner Permissions
    //  5. Updated
    //  6. UID (significantly to be able to navigate to the specific establishment)
    //  7. ParentUID

    // only get the sub if the isParent parameter is truthy
    const where = isParent
      ? {
          [models.Sequelize.Op.or]: [
            {
              id: {
                [models.Sequelize.Op.eq]: primaryEstablishmentId,
              },
            },
            {
              ParentID: {
                [models.Sequelize.Op.eq]: primaryEstablishmentId,
              },
            },
          ],
        }
      : { id: primaryEstablishmentId };

    let params;

    if (isWDF) {
      params = {
        attributes: [
          'id',
          'uid',
          'updated',
          'parentUid',
          'NameValue',
          'LocalIdentifierValue',
          'dataOwner',
          'dataPermissions',
          'dataOwnershipRequested',
          'overallWdfEligibility',
          'lastWdfEligibility',
          'establishmentWdfEligibility',
          'NumberOfStaffValue',
          'ustatus',
          'postcode',
          [models.sequelize.fn('COUNT', models.sequelize.col('"workers"."ID"')), 'workerCount'],
          [
            models.sequelize.fn(
              'SUM',
              models.sequelize.literal(
                `CASE WHEN "workers"."LastWdfEligibility" > '${WdfCalculator.effectiveDate.toISOString()}' THEN 1 ELSE 0 END`,
              ),
            ),
            'eligibleWorkersCount',
          ],
        ],
        include: [
          {
            model: models.services,
            as: 'mainService',
            attributes: ['name'],
          },
          {
            model: models.worker,
            required: false,
            as: 'workers',
            attributes: [],
            where: {
              archived: false,
            },
          },
        ],
        where,
        order: [
          // list the primary establishment first
          models.sequelize.literal('"ParentID" IS NOT NULL'),
          'NameValue',
        ],
        group: [
          'establishment.EstablishmentID',
          'mainService.id',
          'mainService.name',
          'uid',
          'establishment.updated',
          'parentUid',
          'NameValue',
          'establishment.LocalIdentifierValue',
          'dataOwner',
          'dataPermissions',
          'dataOwnershipRequested',
          'overallWdfEligibility',
          'lastWdfEligibility',
          'establishmentWdfEligibility',
          'NumberOfStaffValue',
          'ustatus',
        ],
      };
    } else {
      params = {
        attributes: [
          'id',
          'uid',
          'updated',
          'parentUid',
          'NameValue',
          'LocalIdentifierValue',
          'dataOwner',
          'dataPermissions',
          'dataOwnershipRequested',
          'ustatus',
          'postcode',
        ],
        include: [
          {
            model: models.services,
            as: 'mainService',
            attributes: ['name'],
          },
        ],
        where,
        order: [models.sequelize.literal('"ParentID" IS NOT NULL'), 'NameValue'],
      };
    }

    // first - get the user's primary establishment (every user will have a primary establishment)
    const fetchResults = await models.establishment.findAll(params);

    // if no results return false?! whatever. It's what it did before
    if (fetchResults.length === 0) {
      return false;
    }

    // map the results to the desired type
    const mappedResults = await Promise.all(
      fetchResults.map(async (thisSub) => {
        const {
          id,
          uid,
          updated,
          parentUid,
          NameValue: name,
          LocalIdentifierValue,
          mainService: { name: mainService },
          dataOwner,
          dataPermissions,
          dataOwnershipRequested,
          ustatus,
          postcode,
        } = thisSub;

        return {
          id,
          uid,
          updated,
          parentUid,
          name,
          localIdentifier: LocalIdentifierValue || null,
          mainService,
          dataOwner,
          dataPermissions,
          dataOwnershipRequested,
          ustatus,
          postCode: postcode,
          wdf: isWDF
            ? await WdfCalculator.calculateData({
                thisEstablishment: thisSub,
                calculateOverall: true,
                calculateStaff: true,
                calculateEstablishment: true,
                readOnly: true,
              })
            : undefined,
        };
      }),
    );

    // The first result is the primary establishment. put it in a special field
    const primary = mappedResults.shift();

    // Add a boolean flag to indicate the establishment is a parent

    primary.isParent = !!mappedResults.length;
    return {
      primary,
      subsidaries: primary.isParent
        ? {
            count: mappedResults.length,
            establishments: mappedResults,
          }
        : undefined,
    };
  }

  //used by bulk upload to fetch a list of the worker
  static async fetchMyEstablishmentsWorkers(establishmentId, establishmentKey) {
    return await db.query(
      `SELECT
        "Establishment"."LocalIdentifierValue" "establishmentKey",
        "Worker"."LocalIdentifierValue" "uniqueWorker",
        "Worker"."ContractValue" "contractTypeId",
        "Worker"."MainJobFKValue" "mainJobRoleId",
        array_to_string(array_agg("WorkerJobs"."JobFK"), :sep) "otherJobIds"
      FROM cqc."Establishment"
      JOIN cqc."Worker" on "Worker"."EstablishmentFK" = "Establishment"."EstablishmentID"
      LEFT JOIN cqc."WorkerJobs" on "WorkerJobs"."WorkerFK" = "Worker"."ID"
      WHERE "Worker"."LocalIdentifierValue" IS NOT NULL AND
       REPLACE("Establishment"."LocalIdentifierValue", :space, :no_space) = REPLACE(:establishmentKey,:space,:no_space)
      AND "Establishment"."EstablishmentID" = :establishmentId
      GROUP BY "establishmentKey", "uniqueWorker", "contractTypeId", "mainJobRoleId"`,
      {
        replacements: {
          establishmentKey,
          establishmentId,
          sep: ';',
          space: ' ',
          no_space: '',
        },
        type: db.QueryTypes.SELECT,
      },
    );
  }

  // a helper function that updates the establishment and adds the necessary audit events
  //  https://trello.com/c/Z93EZqyB - requires that when updating local identifier, the
  //                                  establishment's own `updated` timestamp is not is to
  //                                  be updated
  async _updateLocalIdOnEstablishment(thisGivenEstablishment, transaction, updatedTimestamp, username, allAuditEvents) {
    const updatedEstablishment = await models.establishment.update(
      {
        LocalIdentifierValue: thisGivenEstablishment.value,
        LocalIdentifierSavedBy: username,
        LocalIdentifierChangedBy: username,
        LocalIdentifierSavedAt: updatedTimestamp,
        LocalIdentifierChangedAt: updatedTimestamp,
      },
      {
        returning: true,
        where: {
          uid: thisGivenEstablishment.uid,
        },
        attributes: ['id', 'updated'],
        transaction,
      },
    );

    if (updatedEstablishment[0] === 1) {
      const updatedRecord = updatedEstablishment[1][0].get({ plain: true });

      // two for the LocalIdentifier property (saved and changed)
      allAuditEvents.push({
        establishmentFk: updatedRecord.EstablishmentID,
        username,
        type: 'saved',
        property: 'LocalIdentifier',
      });

      allAuditEvents.push({
        establishmentFk: updatedRecord.EstablishmentID,
        username,
        type: 'changed',
        property: 'LocalIdentifier',
        event: {
          new: thisGivenEstablishment.value,
        },
      });
    }
  }

  // update the local identifiers across multiple establishments; this establishment being the primary with 0 or more subs
  //   - can only update the local identifier on subs "owned" by this given primary establishment
  //  - When updating the local identifier, the local identifier property itself is audited, but the establishment's own
  //    "updated" status is not updated
  async bulkUpdateLocalIdentifiers(username, givenLocalIdentifiers) {
    try {
      const myEstablishments = await Establishment.fetchMyEstablishments(this.isParent, this.id, false);

      // create a list of those establishment UIDs - the user will only be able to update the local identifier for which they own
      const myEstablishmentUIDs = [];

      myEstablishmentUIDs.push({
        uid: myEstablishments.primary.uid,
        localIdentifier: myEstablishments.primary.localIdentifier,
      });

      if (myEstablishments.subsidaries) {
        myEstablishments.subsidaries.establishments.forEach((thisEst) => {
          // only those subs "owned" by this parent
          if (thisEst.dataOwner === 'Parent') {
            myEstablishmentUIDs.push({
              uid: thisEst.uid,
              localIdentifier: thisEst.localIdentifier,
            });
          }
        });
      }

      // within one transaction
      const updatedTimestamp = new Date();
      const updatedUids = [];

      // now note - there is no such thing as a bulk update (except when joing data between two tables on the database)
      //   so when iterating through the local identifiers, check if the local identifier has changed before issuing
      //   any update!

      await models.sequelize.transaction(async (t) => {
        const dbUpdatePromises = [];
        const allAuditEvents = [];
        givenLocalIdentifiers.forEach((thisGivenEstablishment) => {
          if (thisGivenEstablishment && thisGivenEstablishment.uid) {
            const foundEstablishment = myEstablishmentUIDs.find(
              (thisEst) => thisEst.uid === thisGivenEstablishment.uid,
            );

            // only if the found and given local identifiers are not equal, then update the record
            if (foundEstablishment && foundEstablishment.localIdentifier !== thisGivenEstablishment.value) {
              const updateThisEstablishment = this._updateLocalIdOnEstablishment(
                thisGivenEstablishment,
                t,
                updatedTimestamp,
                username,
                allAuditEvents,
              );
              dbUpdatePromises.push(updateThisEstablishment);
              updatedUids.push(thisGivenEstablishment);
            } else if (foundEstablishment) {
              updatedUids.push(thisGivenEstablishment);
            } else {
              // no found - just silently ignore
            }
          }
        });

        // wait for all updates to finish
        await Promise.all(dbUpdatePromises);
        await models.establishmentAudit.bulkCreate(allAuditEvents, { transaction: t });
      });

      return updatedUids;
    } catch (err) {
      console.error('Establishment::bulkUpdateLocalIdentifiers error: ', err);
      throw err;
    }
  }

  // returns all true if establishments (subs only owned by this parent) and workers associated to them
  //  local identifier is not null (has been set), otherwise returns false
  async missingLocalIdentifiers() {
    try {
      // NOTE - req.establishmentId is an assured integer from authorisation middleware
      //        and consequently the value is assured and thus the queries below not at risk
      //        from SQL injection

      const missingEstablishmentsWithWorkerCountQuery = `
            select
            "Establishment"."EstablishmentID",
            "EstablishmentUID",
            "NameValue",
            "Status",
            "Establishment"."LocalIdentifierValue" AS "EstablishmentLocal",
            CASE WHEN "WorkerTotals"."TotalWorkers" IS NULL THEN 0 ELSE "WorkerTotals"."TotalWorkers" END AS "TotalWorkers"
          from cqc."Establishment"
            left join
            (
              select
                "EstablishmentID",
                count(0) AS "TotalWorkers"
              from cqc."Worker"
                inner join cqc."Establishment" on "Establishment"."EstablishmentID" = "Worker"."EstablishmentFK"
              where (("EstablishmentID" = ${this._id}) OR ("ParentID" = ${this._id} AND "DataOwner" = 'Parent'))
              and "Worker"."Archived" = false
              and "Worker"."LocalIdentifierValue" is null
              group by "EstablishmentID"
            ) "WorkerTotals" on "WorkerTotals"."EstablishmentID" = "Establishment"."EstablishmentID"
          where (("Establishment"."EstablishmentID" = ${this._id}) OR ("ParentID" = ${this._id} AND "DataOwner" = 'Parent'))
            and "Establishment"."Archived" = false
            and ("Establishment"."LocalIdentifierValue" is null)`;

      const results = await models.sequelize.query(missingEstablishmentsWithWorkerCountQuery, {
        type: models.sequelize.QueryTypes.SELECT,
      });

      // note - postgres returns the Total as a string not an integer
      // eg.:
      // [ { EstablishmentID: 30,
      //     EstablishmentUID: '2d3fcc78-c9e8-4723-8927-a9c11988ba51',
      //     NameValue: 'WOZiTech Rest Home for IT Professionals',
      //     EstablishmentLocal: null,
      //     TotalWorkers: '0' },
      //   { EstablishmentID: 104,
      //     EstablishmentUID: 'defefda6-9730-4c72-a505-6807ded10c21',
      //     NameValue: 'WOZiTech Cares Sub 2',
      //     EstablishmentLocal: 'BOB2',
      //     TotalWorkers: '1' } ]
      //
      const missingEstablishments = [];
      if (results && Array.isArray(results)) {
        results.forEach((thisEstablishment) => {
          missingEstablishments.push({
            uid: thisEstablishment.EstablishmentUID,
            name: thisEstablishment.NameValue,
            status: thisEstablishment.Status,
            missing: thisEstablishment.EstablishmentLocal === null ? true : undefined,
            workers: parseInt(thisEstablishment.TotalWorkers, 10),
          });
        });
      }

      return missingEstablishments;
    } catch (err) {
      console.error('Establishment::missingLocalIdentifiers error: ', err);
      throw err;
    }
  }

  async bulkUploadWdf(savedby, externalTransaction) {
    // recalculate WDF - if not bulk upload (this._status)
    return WdfCalculator.calculate(savedby, this._id, null, externalTransaction, WdfCalculator.BULK_UPLOAD, false);
  }

  // recalcs the establishment known by given establishment
  static async recalcWdf(username, establishmentId) {
    try {
      const log = (result) => result == null;
      const thisEstablishment = new Establishment(username);

      await models.sequelize.transaction(async (t) => {
        if (await thisEstablishment.restore(establishmentId)) {
          // only try to update if not yet eligible
          if (thisEstablishment._lastWdfEligibility === null) {
            const wdfEligibility = await thisEstablishment.wdfToJson();

            if (wdfEligibility.isEligible) {
              await models.establishment.update(
                {
                  lastWdfEligibility: new Date(),
                },
                {
                  where: {
                    id: establishmentId,
                  },
                  transaction: t,
                },
              );

              await models.establishmentAudit.create(
                {
                  establishmentFk: establishmentId,
                  username,
                  type: 'wdfEligible',
                },
                { transaction: t },
              );
            }
          } // end if _lastWdfEligibility

          // checking checked/updated establishment, now iterate through the workers
          const workers = await Worker.fetch(establishmentId);
          const workerPromise = Promise.resolve(null);
          await workers.reduce(
            (p, thisWorker) => p.then(() => Worker.recalcWdf(username, establishmentId, thisWorker.uid, t).then(log)),
            workerPromise,
          );

          // having updated establishment and all workers, recalculate the overall WDF eligibility
          await WdfCalculator.calculate(username, establishmentId, null, t, WdfCalculator.RECALC, false);
        } else {
          // not found
        }
      }); // end transaction

      return true;
    } catch (err) {
      console.error('Establishment::recalcWdf error: ', err);
      return false;
    }
  }

  //method to fetch all establishment details by establishment id
  static async fetchAndUpdateEstablishmentDetails(id, data, establishmentIsParent = false) {
    if (!id) {
      throw new EstablishmentExceptions.EstablishmentRestoreException(
        null,
        null,
        null,
        'User::restore failed: Missing id or uid',
        null,
        'Unexpected Error',
      );
    }
    try {
      // restore establishment based on id as an integer (primary key or uid)
      let fetchQuery = {
        where: {
          id: id,
        },
      };

      if (!Number.isInteger(id)) {
        fetchQuery = {
          where: {
            uid: id,
            archived: false,
          },
        };
      }
      let establishment = await models.establishment.findOne(fetchQuery);
      if (establishment) {
        if (establishmentIsParent !== false) {
          data.dataOwner = establishment.isParent === false ? 'Parent' : 'Workplace';
        }
        let responseToReturn = await establishment.update(data).then(function (establishmentDetails) {
          return establishmentDetails;
        });
        return responseToReturn;
      }
    } catch (err) {
      console.error('Establishment::fetch error: ', err);
      return false;
    }
  }
}

module.exports.Establishment = Establishment;

// sub types
module.exports.EstablishmentExceptions = EstablishmentExceptions;
