/*
 * establishment.js
 *
 * The encapsulation of a Establishment, including all properties, all specific validation (not API, but object validation),
 * saving & restoring of data to database (via sequelize model), construction and deletion.
 *
 * Also includes representation as JSON, in one or more presentations.
 */
const uuid = require('uuid');

// database models
const models = require('../index');

const EntityValidator = require('./validations/entityValidator').EntityValidator;
const ValidationMessage = require('./validations/validationMessage').ValidationMessage;

// associations
const Worker = require('./worker').Worker;

// notifications
const AWSKinesis = require('../../aws/kinesis');

// temp formatters
const ServiceFormatters = require('../api/services');

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

// Errors for initialise and registration error - this needs to be refactored out DB
class RegistrationException {
    constructor(originalError, errCode, errMessage) {
      this.err = originalError;
      this.errCode = errCode;
      this.errMessage = errMessage;
    };

    toString() {
      return `${this.errCode}: ${this.errMessage}`;
    };
};

const responseErrors = {
    unknownNMDSsequence: {
      errCode: -500,
      errMessage: 'Unknown NMDS Sequence'
    },
    unknownNMDSLetter: {
      errCode: -600,
      errMessage: 'Unknown NMDS Letter/CSSR Region'
    }
};

const STOP_VALIDATING_ON = ['UNCHECKED', 'DELETE', 'DELETED'];

class Establishment extends EntityValidator {
    constructor(username) {
        super();

        this._username = username;
        this._id = null;
        this._uid = null;
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
        this._isParent = false;
        this._parentUid = null;
        this._parentId = null;
        this._dataOwner = null;
        this._parentPermissions = null;

        // interim reasons for leaving - https://trello.com/c/vNHbfdms
        this._reasonsForLeaving = null;

        // abstracted properties
        const thisEstablishmentManager = new EstablishmentProperties();
        this._properties =thisEstablishmentManager.manager;

        // change properties
        this._isNew = false;

        // all known workers for this establishment - an associative object (property key is the worker's key)
        this._workerEntities = {};
        this._readyForDeletionWorkers = null;

        // bulk upload status - this is never stored in database
        this._status = null;

        // default logging level - errors only
        // TODO: INFO logging on User; change to LOG_ERROR only
        this._logLevel = Establishment.LOG_INFO;
    }

    // private logging
    static get LOG_ERROR() { return 100; }
    static get LOG_WARN() { return 200; }
    static get LOG_INFO() { return 300; }
    static get LOG_TRACE() { return 400; }
    static get LOG_DEBUG() { return 500; }

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
    get username() {
        return this._username;
    }
    get name() {
        return this._properties.get('Name') ? this._properties.get('Name').property : null;
    };
    get address() {
      // returns concatenated address
      const addressParts = [];
      this._address1 ? addressParts.push(this._address1) : true;
      this._address2 ? addressParts.push(this._address2) : true;
      this._address3 ?  addressParts.push(this._address3) : true;
      this._town ? addressParts.push(this._town) : true;
      this._county ? addressParts.push(this._county) : true;
      return addressParts.join(', ');
    }
    get address1() {
        return this._address1;
    };
    get address1() {
        return this._address1;
    };
    get address2() {
      return this._address2;
    };
    get address3() {
      return this._address3;
    };
    get town() {
      return this._town;
    }
    get county() {
      return this._county;
    }
    get locationId() {
      return this._locationId;
    };
    get provId() {
      return this._provId;
    }
    get postcode() {
        return this._postcode;
    };
    get isRegulated() {
        return this._isRegulated;
    };
    get mainService() {
        return this._properties.get('MainServiceFK') ? this._properties.get('MainServiceFK').property : null;
    };
    get employerType() {
        return this._properties.get('EmployerType') ? this._properties.get('EmployerType').property : null;
    };
    get localIdentifier() {
      return this._properties.get('LocalIdentifier') ? this._properties.get('LocalIdentifier').property : null;
    };
    get shareWith() {
      return this._properties.get('ShareData') ? this._properties.get('ShareData').property : null;
    };
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
    get parentUid() {
        return this._parentUid;
    }

    get dataOwner() {
        return this._dataOwner;
    }

    get parentPermissions() {
        return this._parentPermissions;
    }

    get numberOfStaff() {
        return this._properties.get('NumberOfStaff') ? this._properties.get('NumberOfStaff').property : 0;
    }

    get key() {
        return ((this._properties.get('LocalIdentifier') && this._properties.get('LocalIdentifier').property) ? this.localIdentifier.replace(/\s/g, "") : this.name).replace(/\s/g, "");
    }
    get status() {
      return this._status;
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

    initialiseSub(parentID, parentUid){
        this._parentUid = parentUid;
        this._parentId = parentID;
        this._dataOwner = 'Parent';
        this._parentPermissions = null;     // if the owner is parent, then parent permissions are irrelevant
    }

    // this method add this given worker (entity) as an association to this establishment entity - (bulk import)
    associateWorker(key, worker) {
        if (key && worker) {
            // worker not yet associated; take as is
            this._workerEntities[key] = worker;
        }
    };

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
    async load(document, associatedEntities=false, bulkUploadCompletion=false) {
        try {
            // bulk upload status
            if (document.status) {
              this._status = document.status;
            }

            if (bulkUploadCompletion && document.status === 'NOCHANGE') {
              console.log("WA DEBUG - this establishment is NOCHANGE; ignoring update of self: ", this._id, this.localIdentifier);

            } else {
              this.resetValidations();

              // inject all services against this establishment
              const isRegulated = document.IsCQCRegulated || document.isRegulated;
              document.allMyServices = ServiceCache.allMyServices(isRegulated);

              // inject all capacities against this establishment - note, "other services" can be represented by the JSON document attribute "services" or "otherServices"
              const allAssociatedServiceIndices = [];
              if (document.mainService) {
                  allAssociatedServiceIndices.push(document.mainService.id);
              }
              if (document && document.otherServices && Array.isArray(document.otherServices)) {
                  document.otherServices.forEach(thisService => {
                    if (thisService.id) {
                      allAssociatedServiceIndices.push(thisService.id);
                    } else if (thisService.services && Array.isArray(thisService.services)) {
                      thisService.services.forEach(innerService => {
                        allAssociatedServiceIndices.push(innerService.id)
                      });
                    }
                  });
              }
              if (document && document.services && Array.isArray(document.services)) {
                  document.services.forEach(thisService => allAssociatedServiceIndices.push(thisService.id));
              }
              document.allServiceCapacityQuestions = CapacitiesCache.allMyCapacities(allAssociatedServiceIndices);

              await this._properties.restore(document, JSON_DOCUMENT_TYPE);

              // CQC reugulated/location ID
              if (document.hasOwnProperty('isRegulated')) {
                  this._isRegulated = document.isRegulated;
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

                    document.workers.forEach(thisWorker => {
                      // we're loading from JSON, not entity, so there is no key property; so add it
                      thisWorker.key = thisWorker.localIdentifier ? thisWorker.localIdentifier.replace(/\s/g, "") : thisWorker.nameOrId.replace(/\s/g, "");

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
                    Object.values(this._workerEntities).forEach(thisWorker => {
                        const foundWorker = document.workers.find(givenWorker => {
                          return givenWorker.key === thisWorker.key
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
            throw new EstablishmentExceptions.EstablishmentJsonException(
                err,
                null,
                'Failed to load Establishment from JSON');
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
            if (thisEstablishmentIsValid && Array.isArray(thisEstablishmentIsValid) && this._validations.length == 0) {
                const propertySuffixLength = 'Property'.length * -1;
                thisEstablishmentIsValid.forEach(thisInvalidProp => {
                    this._validations.push(new ValidationMessage(
                        ValidationMessage.WARNING,
                        111111111,
                        'Invalid',
                        [thisInvalidProp.slice(0,propertySuffixLength)],
                    ));
                });
            }

            this._log(Establishment.LOG_ERROR, `Establishment invalid properties: ${thisEstablishmentIsValid.toString()}`);
            return false;
        }
      } else {
        return true;
      }
    }

    async saveAssociatedEntities(savedBy, bulkUploaded=false, externalTransaction)  {
        if (this._workerEntities) {
            const log = result => result=null;

            try {
                const workersAsArray = Object.values(this._workerEntities).map(thisWorker => {
                    thisWorker.establishmentId = this._id;
                    return thisWorker;
                });

                // new and updated Workers
                const starterSavePromise = Promise.resolve(null);
                await workersAsArray.reduce((p, thisWorkerToSave) => p.then(() => thisWorkerToSave.save(savedBy, bulkUploaded, 0, externalTransaction, true).then(log)), starterSavePromise);

                // now deleted workers
                const starterDeletedPromise = Promise.resolve(null);
                await this._readyForDeletionWorkers.reduce((p, thisWorkerToDelete) => p.then(() => thisWorkerToDelete.archive(savedBy, externalTransaction, true).then(log)), starterDeletedPromise);

            } catch (err) {
                console.error('Establishment::saveAssociatedEntities error: ', err);
                // rethrow error to ensure the transaction is rolled back
                throw err;
            }
        }
    }

    // saves the Establishment to DB. Returns true if saved; false is not.
    // Throws "EstablishmentSaveException" on error
    async save(savedBy, bulkUploaded=false, ttl=0, externalTransaction=null, associatedEntities=false) {
        let mustSave = this._initialise();

        if (!this.uid) {
            this._log(Establishment.LOG_ERROR, 'Not able to save an unknown uid');
            throw new UserExceptions.UserSaveException(null,
                this.uid,
                this.name,
                'Not able to save an unknown uid',
                'Establishment does not exist');
        }

        // with bulk upload, if this entity's status is "UNCHECKED", do not save it
        if (this._status === 'UNCHECKED') {
          console.log("WA DEBUG - not saving Establishment: ", this._id, this.localIdentifier);

          // if requested, propagate the saving of this establishment down to each of the associated entities
          if (associatedEntities) {
            await models.sequelize.transaction(async t => {
              const thisTransaction = externalTransaction ? externalTransaction : t;
              await this.saveAssociatedEntities(savedBy, bulkUploaded, thisTransaction);
            });
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
                    include: [{
                        model: models.cssr,
                        as: 'theAuthority',
                        attributes: ['id', 'name', 'nmdsIdLetter']
                    }]
                });

                let nmdsLetter = null;
                if (cssrResults && cssrResults.postcode === this._postcode && cssrResults.theAuthority && cssrResults.theAuthority.id && Number.isInteger(cssrResults.theAuthority.id)) {
                    nmdsLetter = cssrResults.theAuthority.nmdsIdLetter;
                } else {
                    // No direct match so do the fuzzy match
                    const [firstHalfOfPostcode] = `postcode`.split(' ');
                    const fuzzyCssrNmdsIdMatch = await models.sequelize.query(`select "Cssr"."NmdsIDLetter" from cqcref.pcodedata, cqc."Cssr" where postcode like \'${escape(firstHalfOfPostcode)}%\' and pcodedata.local_custodian_code = "Cssr"."LocalCustodianCode" group by "Cssr"."NmdsIDLetter" limit 1`, { type: models.sequelize.QueryTypes.SELECT });

                    if (fuzzyCssrNmdsIdMatch && fuzzyCssrNmdsIdMatch[0] && fuzzyCssrNmdsIdMatch[0] && fuzzyCssrNmdsIdMatch[0].NmdsIDLetter) {
                        nmdsLetter = fuzzyCssrNmdsIdMatch[0].NmdsIDLetter;
                    }
                }

                // catch all - because we don't want new establishments failing just because of old postcode data
                if (nmdsLetter === null) {
                    nmdsLetter = 'W';
                }

                let nextNmdsIdSeqNumber = 0;
                const nextNmdsIdSeqNumberResults = await models.sequelize.query('SELECT nextval(\'cqc."NmdsID_seq"\')', { type: models.sequelize.QueryTypes.SELECT });

                if (nextNmdsIdSeqNumberResults && nextNmdsIdSeqNumberResults[0] && nextNmdsIdSeqNumberResults[0] && nextNmdsIdSeqNumberResults[0].nextval) {
                    nextNmdsIdSeqNumber = parseInt(nextNmdsIdSeqNumberResults[0].nextval);
                } else {
                    // no sequence number
                    console.error("Failed to get next sequence number for Establishment: ", nextNmdsIdSeqNumberResults);
                    throw new EstablishmentExceptions.EstablishmentSaveException(null, this.uid, this.name, 'Failed to generate NMDS ID', 'Failed to generate NMDS ID');
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
                    parentPermissions: this._parentPermissions,
                    isRegulated: this._isRegulated,
                    locationId: this._locationId,
                    proviId: this._provId,
                    MainServiceFKValue: this.mainService.id,
                    nmdsId: this._nmdsId,
                    updatedBy: savedBy.toLowerCase(),
                    ShareDataValue: false,
                    shareWithCQC: false,
                    shareWithLA: false,
                    source: bulkUploaded ? 'Bulk' : 'Online',
                    attributes: ['id', 'created', 'updated'],
                };

                // need to create the Establishment record and the Establishment Audit event
                //  in one transaction
                await models.sequelize.transaction(async t => {
                    // the saving of an Establishment can be initiated within
                    //  an external transaction
                    const thisTransaction = externalTransaction ? externalTransaction : t;

                    // now append the extendable properties.
                    // Note - although the POST (create) has a default
                    //   set of mandatory properties, there is no reason
                    //   why we cannot create an Establishment record with more properties
                    const modifedCreationDocument = this._properties.save(savedBy.toLowerCase(), creationDocument);

                    // check all mandatory parameters have been provided
                    if (!this.hasMandatoryProperties) {
                        throw 'Missing Mandatory properties';
                    }

                    // now save the document
                    let creation = await models.establishment.create(modifedCreationDocument, {transaction: thisTransaction});

                    const sanitisedResults = creation.get({plain: true});

                    this._id = sanitisedResults.EstablishmentID;
                    this._created = sanitisedResults.created;
                    this._updated = sanitisedResults.updated;
                    this._updatedBy = savedBy;
                    this._isNew = false;

                    // having the user we can now create the audit record; injecting the userFk
                    const allAuditEvents = [{
                        establishmentFk: this._id,
                        username: savedBy.toLowerCase(),
                        type: 'created'}].concat(this._properties.auditEvents.map(thisEvent => {
                            return {
                                ...thisEvent,
                                establishmentFk: this._id
                            };
                        }));
                    await models.establishmentAudit.bulkCreate(allAuditEvents, {transaction: thisTransaction});

                    // now - work through any additional models having processed all properties (first delete and then re-create)
                    const additionalModels = this._properties.additionalModels;
                    const additionalModelsByname = Object.keys(additionalModels);
                    const deleteModelPromises = [];
                    additionalModelsByname.forEach(async thisModelByName => {
                        deleteModelPromises.push(
                            models[thisModelByName].destroy({
                                where: {
                                    establishmentId: this._id
                                },
                                transaction: thisTransaction,
                                })
                        );
                    });
                    await Promise.all(deleteModelPromises);
                    const createModelPromises = [];
                    additionalModelsByname.forEach(async thisModelByName => {
                        const thisModelData = additionalModels[thisModelByName];
                        createModelPromises.push(
                            models[thisModelByName].bulkCreate(
                                thisModelData.map(thisRecord => {
                                    return {
                                        ...thisRecord,
                                        establishmentId: this._id
                                    };
                                }),
                                { transaction: thisTransaction },
                            )
                        );
                    });
                    await Promise.all(createModelPromises);

                    // this is an async method - don't wait for it to return
                    AWSKinesis.establishmentPump(AWSKinesis.CREATED, this.toJSON());

                    // if requested, propagate the saving of this establishment down to each of the associated entities
                    if (associatedEntities) {
                        await this.saveAssociatedEntities(savedBy, bulkUploaded, thisTransaction);
                    }

                    this._log(Establishment.LOG_INFO, `Created Establishment with uid (${this.uid}), id (${this._id}) and name (${this.name})`);
                });

            } catch (err) {
                // need to handle duplicate Establishment
                if (err.name && err.name === 'SequelizeUniqueConstraintError') {
                    if (err.parent.constraint && ( err.parent.constraint === 'Establishment_unique_registration_with_locationid' || err.parent.constraint === 'Establishment_unique_registration')) {
                        throw new EstablishmentExceptions.EstablishmentSaveException(null, this.uid, this.name, 'Duplicate Establishment', 'Duplicate Establishment');
                    }
                }

                if (err.name && err.name === 'SequelizeUniqueConstraintError') {
                    if(err.parent.constraint && ( err.parent.constraint === 'establishment_LocalIdentifier_unq')){
                        throw new EstablishmentExceptions.EstablishmentSaveException(null, this.uid, this.name, 'Duplicate LocalIdentifier', 'Duplicate LocalIdentifier');
                    }
                }

                // and foreign key constaint to Location
                if (err.name && err.name === 'SequelizeForeignKeyConstraintError') {
                    throw new EstablishmentExceptions.EstablishmentSaveException(null, this.uid, this.name, 'Unknown Location', 'Unknown Location');
                }

                if (err.name && err.name === 'SequelizeValidationError' && err.errors[0].path === 'nmdsId') {
                    throw new EstablishmentExceptions.EstablishmentSaveException(null, this.uid, this.name, 'Unknown NMDSID', 'Unknown NMDSID');
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
                await models.sequelize.transaction(async t => {
                    // the saving of an Establishment can be initiated within
                    //  an external transaction
                    const thisTransaction = externalTransaction ? externalTransaction : t;

                    // now append the extendable properties
                    const modifedUpdateDocument = this._properties.save(savedBy.toLowerCase(), {});

                    // note - if the establishment was created online, but then updated via bulk upload, the source become bulk and vice-versa.
                    const updateDocument = {
                        ...modifedUpdateDocument,
                        source: bulkUploaded ? 'Bulk' : 'Online',
                        isRegulated: this._isRegulated,                         // to remove when a change managed property
                        locationId: this._locationId,                           // to remove when a change managed property
                        provId: this._provId,                                   // to remove when a change managed property
                        address1: this._address1,
                        address2: this._address2,
                        address3: this._address3,
                        name: this._name,
                        town: this._town,
                        county: this._county,
                        postcode: this._postcode,
                        reasonsForLeaving: this._reasonsForLeaving,
                        updated: updatedTimestamp,
                        updatedBy: savedBy.toLowerCase()
                    };

                    // every time the establishment is saved, need to calculate
                    //  it's current WDF Eligibility, and if it is eligible, update
                    //  the last WDF Eligibility status
                    const currentWdfEligibiity = await this.isWdfEligible(WdfCalculator.effectiveDate);
                    let wdfAudit = null;
                    if (currentWdfEligibiity.currentEligibility) {
                        console.log("WA DEBUG - updating this establishment's last WDF Eligible timestamp")
                        updateDocument.lastWdfEligibility = updatedTimestamp;
                        wdfAudit = {
                            username: savedBy.toLowerCase(),
                            type: 'wdfEligible'
                        };
                    }

                    // now save the document
                    let [updatedRecordCount, updatedRows] =
                        await models.establishment.update(
                            updateDocument,
                            {
                                returning: true,
                                where: {
                                    uid: this.uid
                                },
                                attributes: ['id', 'updated'],
                                transaction: thisTransaction,
                            }
                        );

                    if (updatedRecordCount === 1) {
                        const updatedRecord = updatedRows[0].get({plain: true});

                        this._updated = updatedRecord.updated;
                        this._updatedBy = savedBy.toLowerCase();
                        this._id = updatedRecord.EstablishmentID;

                        // having updated the record, create the audit event
                        const allAuditEvents = [{
                            establishmentFk: this._id,
                            username: savedBy.toLowerCase(),
                            type: 'updated'}].concat(this._properties.auditEvents.map(thisEvent => {
                                return {
                                    ...thisEvent,
                                    establishmentFk: this._id
                                };
                            }));
                        if (wdfAudit) {
                            wdfAudit.establishmentFk = this._id;
                            allAuditEvents.push(wdfAudit);
                        }
                        await models.establishmentAudit.bulkCreate(allAuditEvents, {transaction: thisTransaction});

                        // now - work through any additional models having processed all properties (first delete and then re-create)
                        const additionalModels = this._properties.additionalModels;
                        const additionalModelsByname = Object.keys(additionalModels);
                        const deleteModelPromises = [];
                        additionalModelsByname.forEach(async thisModelByName => {
                            deleteModelPromises.push(
                                models[thisModelByName].destroy({
                                    where: {
                                        establishmentId: this._id
                                    },
                                    transaction: thisTransaction,
                                  })
                            );
                        });
                        await Promise.all(deleteModelPromises);
                        const createModelPromises = [];
                        additionalModelsByname.forEach(async thisModelByName => {
                            const thisModelData = additionalModels[thisModelByName];
                            createModelPromises.push(
                                models[thisModelByName].bulkCreate(
                                    thisModelData.map(thisRecord => {
                                        return {
                                            ...thisRecord,
                                            establishmentId: this._id
                                        };
                                    }),
                                    { transaction: thisTransaction },
                                )
                            );
                        });
                        await Promise.all(createModelPromises);

                        /* https://trello.com/c/5V5sAa4w
                        // TODO: ideally I'd like to publish this to pub/sub topic and process async - but do not have pub/sub to hand here
                        // having updated the Establishment, check to see whether it is necessary to recalculate
                        //  the overall WDF eligibility for this establishment and all its workers
                        //  This decision is done based on if the Establishment is being marked as Completed.
                        // There does not yet exist a Completed property for establishment.
                        // For now, we'll recalculate on every update!
                        const completedProperty = this._properties.get('Completed');
                        if (this._properties.get('Completed') && this._properties.get('Completed').modified) {
                            await WdfCalculator.calculate(savedBy.toLowerCase(), this._id, this._uid, thisTransaction);
                        } else {
                            // TODO - include Completed logic.
                            await WdfCalculator.calculate(savedBy.toLowerCase(), this._id, this._uid, thisTransaction);
                        } */

                        // if requested, propagate the saving of this establishment down to each of the associated entities
                        if (associatedEntities) {
                            await this.saveAssociatedEntities(savedBy, bulkUploaded, thisTransaction);
                        }

                        // this is an async method - don't wait for it to return
                        AWSKinesis.establishmentPump(AWSKinesis.UPDATED, this.toJSON());

                        this._log(Establishment.LOG_INFO, `Updated Establishment with uid (${this.uid}) and name (${this.name})`);


                    } else {
                        throw new EstablishmentExceptions.EstablishmentSaveException(null, this.uid, this.name, `Failed to update resulting establishment record with id: ${this._id}`, `Failed to update resulting establishment record with id: ${this._id}`);
                    }
                });

            } catch (err) {
                if (err.name && err.name === 'SequelizeUniqueConstraintError') {
                    if(err.parent.constraint && ( err.parent.constraint === 'establishment_LocalIdentifier_unq')){
                        throw new EstablishmentExceptions.EstablishmentSaveException(null, this.uid, this.name, 'Duplicate LocalIdentifier', 'Duplicate LocalIdentifier');
                    }
                }

                throw new EstablishmentExceptions.EstablishmentSaveException(null, this.uid, this.name, err, `Failed to update establishment record with id: ${this._id}`);
            }

        }

        return mustSave;
    };

    // loads the Establishment (with given id or uid) from DB, but only if it belongs to the known User
    // returns true on success; false if no User
    // Can throw EstablishmentRestoreException exception.
    async restore(id, showHistory=false, associatedEntities=false, associatedLevel=1) {
        if (!id) {
            throw new EstablishmentExceptions.EstablishmentRestoreException(null,
                null,
                null,
                'User::restore failed: Missing id or uid',
                null,
                'Unexpected Error');
        }

        try {
            // restore establishment based on id as an integer (primary key or uid)
            let fetchQuery = {
                // attributes: ['id', 'uid'],
                where: {
                    id: id
                },
            };

            if (!Number.isInteger(id)) {
                fetchQuery = {
                    // attributes: ['id', 'uid'],
                    where: {
                        uid: id,
                        archived: false
                    },
                };
            }

            const fetchResults = await models.establishment.findOne(fetchQuery);

            if (fetchResults && fetchResults.id && Number.isInteger(fetchResults.id)) {
                // update self - don't use setters because they modify the change state
                this._isNew = false;
                this._id = fetchResults.id;
                this._uid = fetchResults.uid;
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
                this._isParent = fetchResults.isParent;
                this._parentId = fetchResults.parentId;
                this._parentUid = fetchResults.parentUid;
                this._dataOwner = fetchResults.dataOwner;
                this._parentPermissions = fetchResults.parentPermissions;

                // interim solution for reason for leaving
                this._reasonsForLeaving = fetchResults.reasonsForLeaving;

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
                            establishmentFk: this._id
                        },
                        order: [
                            ['id','DESC']
                        ]
                    });
                }

                // Individual fetches for extended information in associations
                const establishmentServiceUserResults = await models.establishmentServiceUsers.findAll({
                    where: {
                        EstablishmentID : this._id
                    },
                    raw: true
                });

                const establishmentServices = await models.establishmentServices.findAll({
                    where: {
                        EstablishmentID : this._id
                    },
                    raw: true
                });

                const [otherServices, mainService, serviceUsers, capacity, jobs, localAuthorities] = await Promise.all([
                    ServiceCache.allMyOtherServices(establishmentServices.map(x => x)),
                    models.services.findOne({
                        where: {
                            id : fetchResults.MainServiceFKValue
                        },
                        attributes: ['id', 'name'],
                        raw: true
                    }),
                    models.serviceUsers.findAll({
                        where: {
                            id: establishmentServiceUserResults.map(su => su.serviceUserId)
                        },
                        attributes: ['id', 'service', 'group', 'seq'],
                        order: [
                            ['seq', 'ASC']
                        ],
                        raw: true
                    }),
                    models.establishmentCapacity.findAll({
                        where: {
                            EstablishmentID: this._id
                        },
                        include: [{
                            model: models.serviceCapacity,
                            as: 'reference',
                            attributes: ['id', 'question']
                        }],
                        attributes: ['id', 'answer']
                    }),
                    models.establishmentJobs.findAll({
                        where: {
                            EstablishmentID: this._id
                        },
                        include: [{
                            model: models.job,
                            as: 'reference',
                            attributes: ['id', 'title'],
                            order: [
                              ['title', 'ASC']
                            ]
                        }],
                        attributes: ['id', 'type', 'total'],
                        order: [
                          ['type', 'ASC']
                        ]
                    }),
                    models.establishmentLocalAuthority.findAll({
                        where: {
                            EstablishmentID: this._id
                        },
                        attributes: ['id', 'cssrId', 'cssr']
                    })
                ]);

                // For services merge any other data into resultset
                fetchResults.serviceUsers = establishmentServiceUserResults.map((suResult)=>{
                    const serviceUser = serviceUsers.find(element => { return suResult.serviceUserId === element.id});
                    if(suResult.other) {
                        return {
                            ...serviceUser,
                            other: suResult.other
                        }
                    } else {
                        return serviceUser;
                    }
                });

                fetchResults.otherServices = establishmentServices.map((suResult)=>{
                    const otherService = otherServices.find(element => { return suResult.serviceId === element.id});
                    if(suResult.other) {
                        return {
                            ...otherService,
                            other: suResult.other
                        }
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
                    name: fetchResults.mainService.name
                };

                // other services output requires a list of ALL services available to
                // the Establishment
                fetchResults.allMyServices = ServiceCache.allMyServices(fetchResults.isRegulated);

                // service capacities output requires a list of ALL service capacities available to
                //  the Establishment
                // fetch the main service id and all the associated 'other services' by id only
                const allCapacitiesResults = await models.establishment.findOne({
                    where: {
                        id: this._id
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
                        attributes: ['id']
                        }
                    ]
                });

                const allAssociatedServiceIndices = [];

                // console.log('allCapacitiesResults.mainService', allCapacitiesResults.mainService)
                // console.log('allCapacitiesResults.otherServices', allCapacitiesResults.otherServices)


                if (allCapacitiesResults && allCapacitiesResults.id) {
                    // merge tha main and other service ids
                    if (allCapacitiesResults.mainService.id) {
                        allAssociatedServiceIndices.push(allCapacitiesResults.mainService.id);
                    }
                    // TODO: there is a much better way to derference (transpose) the id on an Array of objects
                    //  viz. Map
                    if (allCapacitiesResults.otherServices) {
                        allCapacitiesResults.otherServices.forEach(thisService => allAssociatedServiceIndices.push(thisService.id));
                    }
                }

                // now fetch all the questions for the given set of combined services
                if (allAssociatedServiceIndices.length > 0) {
                    fetchResults.allServiceCapacityQuestions = CapacitiesCache.allMyCapacities(allAssociatedServiceIndices)
                } else {
                    fetchResults.allServiceCapacityQuestions = null;
                }

                // need to identify which, if any, of the shared authorities is attributed to the
                //  primary Authority; that is the Local Authority associated with the physical area
                //  of the given Establishment (using the postcode as the key)
                let primaryAuthorityCssr = null;

                // lookup primary authority by trying to resolve on specific postcode code
                const cssrResults = await models.pcodedata.findOne({
                    where: {
                        postcode: fetchResults.postcode,
                    },
                    include: [
                        {
                            model: models.cssr,
                            as: 'theAuthority',
                            attributes: ['id', 'name', 'nmdsIdLetter']
                        }
                    ]
                });

                if (cssrResults && cssrResults.postcode === fetchResults.postcode &&
                    cssrResults.theAuthority && cssrResults.theAuthority.id &&
                    Number.isInteger(cssrResults.theAuthority.id)) {

                    fetchResults.primaryAuthorityCssr = {
                        id: cssrResults.theAuthority.id,
                        name: cssrResults.theAuthority.name
                    };

                } else {
                    //  using just the first half of the postcode
                    const [firstHalfOfPostcode] = fetchResults.postcode.split(' ');

                    // must escape the string to prevent SQL injection
                    const fuzzyCssrIdMatch = await models.sequelize.query(
                        `select "Cssr"."CssrID", "Cssr"."CssR" from cqcref.pcodedata, cqc."Cssr" where postcode like \'${escape(firstHalfOfPostcode)}%\' and pcodedata.local_custodian_code = "Cssr"."LocalCustodianCode" group by "Cssr"."CssrID", "Cssr"."CssR" limit 1`,
                        {
                            type: models.sequelize.QueryTypes.SELECT
                        }
                    );
                    if (fuzzyCssrIdMatch && fuzzyCssrIdMatch[0] && fuzzyCssrIdMatch[0] && fuzzyCssrIdMatch[0].CssrID) {
                        fetchResults.primaryAuthorityCssr = {
                            id: fuzzyCssrIdMatch[0].CssrID,
                            name: fuzzyCssrIdMatch[0].CssR
                        }
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
                            archived: false
                        },
                    });

                    if (myWorkerSet && Array.isArray(myWorkerSet)) {
                        await Promise.all(myWorkerSet.map(async thisWorker => {
                            const newWorker = new Worker(this._id);
                            await newWorker.restore(thisWorker.uid, false, associatedLevel > 1 ? associatedEntities : false, associatedLevel);

                            // TODO: once we have the unique worder id property, use that instead; for now, we only have the name or id.
                            // without whitespace
                            this.associateWorker(newWorker.key, newWorker);

                            return {};
                        }));
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
    };

    async delete(deletedBy, externalTransaction=null, associatedEntities=false) {
        try {
            const updatedTimestamp = new Date();

            await models.sequelize.transaction(async t => {
                // the saving of an Establishment can be initiated within
                //  an external transaction
                const thisTransaction = externalTransaction ? externalTransaction : t;

                const updateDocument = {
                    archived: true,
                    updated: updatedTimestamp,
                    updatedBy: deletedBy
                };

                let [updatedRecordCount, updatedRows] = await models.establishment.update(updateDocument,
                                            {
                                                returning: true,
                                                where: {
                                                    uid: this.uid
                                                },
                                                attributes: ['id', 'updated'],
                                                transaction: thisTransaction,
                                            });

                if (updatedRecordCount === 1) {

                    const updatedRecord = updatedRows[0].get({plain: true});

                    this._updated = updatedRecord.updated;
                    this._updatedBy = deletedBy;

                    const allAuditEvents = [{
                        establishmentFk: this._id,
                        username: deletedBy,
                        type: 'deleted'}];

                    await models.establishmentAudit.bulkCreate(allAuditEvents, {transaction: thisTransaction});

                    // if deleting this establishment, and if requested, then delete all the associated entities (workers) too
                    if (associatedEntities) {
                        if (this._workerEntities) {
                            const associatedWorkersArray = Object.values(this._workerEntities);
                            await Promise.all(associatedWorkersArray.map(thisWorker => {
                                return thisWorker.archive(deletedBy, thisTransaction);
                            }));
                        }
                    }

                    // this is an async method - don't wait for it to return
                    AWSKinesis.establishmentPump(AWSKinesis.DELETED, this.toJSON());

                    this._log(Establishment.LOG_INFO, `Archived Establishment with uid (${this._uid}) and id (${this._id})`);

                } else {
                    const nameId = this._properties.get('NameOrId');
                    throw new EstablishmentExceptions.EstablishmentDeleteException(null,
                                                                        this.uid,
                                                                        nameId ? nameId.property : null,
                                                                        err,
                                                                        `Failed to update (archive) estabalishment record with uid: ${this._uid}`);
                }

            });
        } catch (err) {
            console.log('throwing error');
            console.log(err);
            throw new EstablishmentExceptions.EstablishmentDeleteException(null,
                this.uid,
                nameId ? nameId.property : null,
                err,
                `Failed to update (archive) estabalishment record with uid: ${this._uid}`);
        }
    };

    // helper returns a set 'json ready' objects for representing an Establishments's overall
    //  change history, from a given set of audit events (those events being created
    //  or updated only)
    formatHistoryEvents(auditEvents) {
        if (auditEvents) {
            return auditEvents.filter(thisEvent => ['created', 'updated', 'wdfEligible', 'overalWdfEligible'].includes(thisEvent.type))
                               .map(thisEvent => {
                                    return {
                                        when: thisEvent.when,
                                        username: thisEvent.username,
                                        event: thisEvent.type
                                    };
                               });
        } else {
            return null;
        }
    };

    // helper returns a set 'json ready' objects for representing an Establishment's audit
    //  history, from a the given set of audit events including those of individual
    //  Establishment properties)
    formatHistory(auditEvents) {
        if (auditEvents) {
            return auditEvents.map(thisEvent => {
                                    return {
                                        when: thisEvent.when,
                                        username: thisEvent.username,
                                        event: thisEvent.type,
                                        property: thisEvent.property,
                                        change: thisEvent.event
                                    };
                               });
        } else {
            return null;
        }
    };


    // returns a Javascript object which can be used to present as JSON
    //  showHistory appends the historical account of changes at User and individual property level
    //  showHistoryTimeline just returns the history set of audit events for the given User
    toJSON(showHistory=false, showPropertyHistoryOnly=true, showHistoryTimeline=false, modifiedOnlyProperties=false, fullDescription=true, filteredPropertiesByName=null, includeAssociatedEntities=false) {
        if (!showHistoryTimeline) {
            if (filteredPropertiesByName !== null && !Array.isArray(filteredPropertiesByName)) {
                throw new Error('Establishment::toJSON filteredPropertiesByName must be a simple Array of names');
            }

            // JSON representation of extendable properties - with optional filter
            const myJSON = this._properties.toJSON(showHistory, showPropertyHistoryOnly, modifiedOnlyProperties, filteredPropertiesByName);

            // add Establishment default properties
            //  using the default formatters
            const myDefaultJSON = {
                id: this.id,
                uid:  this.uid,
                name: this.name,
            };

            if (fullDescription) {
                myDefaultJSON.address = this.address;
                myDefaultJSON.address1 = this.address1;
                myDefaultJSON.address2 = this.address2;
                myDefaultJSON.address3 = this.address3;
                myDefaultJSON.town = this.town;
                myDefaultJSON.county = this.county;
                myDefaultJSON.postcode = this.postcode;
                myDefaultJSON.locationId = this.locationId;
                myDefaultJSON.provId = this.provId;
                myDefaultJSON.isRegulated = this.isRegulated;
                myDefaultJSON.nmdsId = this.nmdsId;
                myDefaultJSON.isParent = this.isParent;
                myDefaultJSON.parentUid = this.parentUid;
                myDefaultJSON.dataOwner = this.dataOwner;
                myDefaultJSON.parentPermissions = this.isParent ? undefined : this.parentPermissions;
                myDefaultJSON.reasonsForLeaving = this.reasonsForLeaving;
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
                    history: this.formatHistoryEvents(this._auditEvents)
                };
            } else {
                return {
                    ...myDefaultJSON,
                    ...myJSON,
                    workers: includeAssociatedEntities ? Object.values(this._workerEntities).map(thisWorker => thisWorker.toJSON(false, false, false, false, true)): undefined,
               };
            }
        } else {
            return {
                id: this.id,
                uid:  this.uid,
                name: this.name,
                created: this.created.toJSON(),
                updated: this.updated.toJSON(),
                updatedBy: this.updatedBy,
                history: this.formatHistory(this._auditEvents)
            };
        }
    }


    // HELPERS

    // returns true if all mandatory properties for an Establishment exist and are valid
    get hasMandatoryProperties() {
      let allExistAndValid = true;    // assume all exist until proven otherwise

      // in bulk upload, an establishment entity, if UNCHECKED, will be nothing more than a status and a local identifier
      if (this._status === null || !STOP_VALIDATING_ON.includes(this._status)) {
        try {
          const nmdsIdRegex = /^[A-Z]1[\d]{6}$/i;
          if (this._uid !== null && !(this._nmdsId && nmdsIdRegex.test(this._nmdsId))) {
              allExistAndValid = false;
              this._validations.push(new ValidationMessage(
                  ValidationMessage.ERROR,
                  101,
                  this._nmdsId ? `Invalid: ${this._nmdsId}` : 'Missing',
                  ['NMDSID']
              ));
              this._log(Establishment.LOG_ERROR, 'Establishment::hasMandatoryProperties - missing or invalid NMDS ID');
          }

          if (!(this.name)) {
              allExistAndValid = false;
              this._validations.push(new ValidationMessage(
                  ValidationMessage.ERROR,
                  102,
                  this.name ? `Invalid: ${this.name}` : 'Missing',
                  ['Name']
              ));
              this._log(Establishment.LOG_ERROR, 'Establishment::hasMandatoryProperties - missing or invalid name');
          }

          if (!(this.mainService)) {
              allExistAndValid = false;
              this._log(Establishment.LOG_ERROR, 'Establishment::hasMandatoryProperties - missing or invalid main service');
          }

          // must at least have the first line of address
          if (!(this._address1)) {
              allExistAndValid = false;
              this._validations.push(new ValidationMessage(
                  ValidationMessage.ERROR,
                  103,
                  this._address ? `Invalid: ${this._address}` : 'Missing',
                  ['Address']
              ));
              this._log(Establishment.LOG_ERROR, 'Establishment::hasMandatoryProperties - missing or invalid first line of address');
          }

          if (!(this._postcode)) {
              allExistAndValid = false;
              this._validations.push(new ValidationMessage(
                  ValidationMessage.ERROR,
                  104,
                  this._postcode ? `Invalid: ${_postcode}` : 'Missing',
                  ['Postcode']
              ));
              this._log(Establishment.LOG_ERROR, 'Establishment::hasMandatoryProperties - missing or invalid postcode');
          }

          if (this._isRegulated === null) {
              allExistAndValid = false;
              this._validations.push(new ValidationMessage(
                  ValidationMessage.ERROR,
                  105,
                  'Missing',
                  ['CQCRegistered']
              ));
              this._log(Establishment.LOG_ERROR, 'Establishment::hasMandatoryProperties - missing regulated flag');
          }

          // location id can be null for a Non-CQC site
          // if a CQC site, and main service is head office (ID=16)
          const MAIN_SERVICE_HEAD_OFFICE_ID=16;
          if (this._isRegulated) {
              if (this.mainService.id !== MAIN_SERVICE_HEAD_OFFICE_ID && this._locationId === null)  {
                  allExistAndValid = false;
                  this._validations.push(new ValidationMessage(
                      ValidationMessage.ERROR,
                      106,
                      'Missing (mandatory) for a CQC Registered site',
                      ['LocationID']
                  ));
                  this._log(Establishment.LOG_ERROR, 'Establishment::hasMandatoryProperties - missing or invalid Location ID for a (CQC) Regulated workspace');
              }
          }

          // prov id can be null for a Non-CQC site - CANNOT IMPOSE THIS PROPERTY AS IT IS NOT YET COMING FROM REGISTRATION
          // if (this._isRegulated && this._provId === null) {
          //   allExistAndValid = false;
          //   this._validations.push(new ValidationMessage(
          //       ValidationMessage.ERROR,
          //       106,
          //       'Missing (mandatory) for a CQC Registered site',
          //       ['ProvID']
          //   ));
          //   this._log(Establishment.LOG_ERROR, 'Establishment::hasMandatoryProperties - missing or invalid Prov ID for a (CQC) Regulated workspace');
          // }

        } catch (err) {
            console.error(err)
        }
      }

      return allExistAndValid;
    }

    // returns true if this establishment is WDF eligible as referenced from the
    //  given effective date; otherwise returns false
    async isWdfEligible(effectiveFrom) {
        const wdfByProperty = await this.wdf(effectiveFrom);
        const wdfPropertyValues = Object.values(wdfByProperty);

        // this establishment is eligible only if the last eligible date is later than the effective date
        //  the WDF by property will show the current eligibility of each property
        return {
            lastEligibility: this._lastWdfEligibility ? this._lastWdfEligibility.toISOString() : null,
            isEligible: this._lastWdfEligibility && this._lastWdfEligibility.getTime() > effectiveFrom.getTime() ? true : false,
            currentEligibility: wdfPropertyValues.every(thisWdfProperty => thisWdfProperty !== 'No'),
            ... wdfByProperty
        };
    }

    _isPropertyWdfBasicEligible(refEpoch, property) {
        const PER_PROPERTY_ELIGIBLE=0;
        const RECORD_LEVEL_ELIGIBLE=1;
        const COMPLETED_PROPERTY_ELIGIBLE=2;
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
                break;
        }

        return property &&
               (property.property !== null && property.property !== undefined) &&
               property.valid &&
               referenceTime !== null &&
               referenceTime > refEpoch;
    }

    // returns the WDF eligibility of each WDF relevant property as referenced from
    //  the given effect date
    async wdf(effectiveFrom) {
        const myWdf = {};
        const effectiveFromEpoch = effectiveFrom.getTime();

        // employer type
        myWdf['employerType'] = this._isPropertyWdfBasicEligible(effectiveFromEpoch, this._properties.get('EmployerType')) ? 'Yes' : 'No';

        // main service & Other Service & Service Capacities & Service Users
        myWdf['mainService'] = this._isPropertyWdfBasicEligible(effectiveFromEpoch, this._properties.get('MainServiceFK')) ? 'Yes' : 'No';
        myWdf['otherService'] = this._isPropertyWdfBasicEligible(effectiveFromEpoch, this._properties.get('OtherServices')) ? 'Yes' : 'No';

        // capacities eligibility is only relevant to the main service capacities (other services' capacities are not relevant)
        //   are capacities. Otherwise, it (capacities eligibility) is not relevant.
        // All Known Capacities is available from the CapacityServices property JSON
        const hasCapacities = this._properties.get('CapacityServices') ? this._properties.get('CapacityServices').toJSON(false, false).allServiceCapacities.length > 0 : false;

        if (hasCapacities) {
            // first validate whether any of the capacities are eligible - this is simply a check that capacities are valid.
            const capacitiesProperty = this._properties.get('CapacityServices');
            let capacitiesEligibility = this._isPropertyWdfBasicEligible(effectiveFromEpoch, capacitiesProperty);

            // we're only interested in the main service capacities
            const mainServiceCapacities = capacitiesProperty.toJSON(false, false).allServiceCapacities.filter(thisCapacity => {
                const mainServiceCapacityRegex = /^Main Service \- /;
                if (mainServiceCapacityRegex.test(thisCapacity.service)) {
                    return true;
                } else {
                    return false;
                }
            });

            if (mainServiceCapacities.length === 0) {
                myWdf['capacities'] = 'Not relevant';
            } else {
                // ensure all all main service's capacities have been answered - note, the can only be one Main Service capacity set
                myWdf['capacities'] = mainServiceCapacities[0].questions.every(thisQuestion => thisQuestion.hasOwnProperty('answer')) ? 'Yes' : 'No';
            }

        } else {
            myWdf['capacities'] = 'Not relevant';
        }
        myWdf['serviceUsers'] = this._isPropertyWdfBasicEligible(effectiveFromEpoch, this._properties.get('ServiceUsers')) ? 'Yes' : 'No';

        // vacancies, starters and leavers
        myWdf['vacancies'] = this._isPropertyWdfBasicEligible(effectiveFromEpoch, this._properties.get('Vacancies')) ? 'Yes' : 'No';
        myWdf['starters'] = this._isPropertyWdfBasicEligible(effectiveFromEpoch, this._properties.get('Starters')) ? 'Yes' : 'No';
        myWdf['leavers'] = this._isPropertyWdfBasicEligible(effectiveFromEpoch, this._properties.get('Leavers')) ? 'Yes' : 'No';

        return myWdf;
    }

    // returns the WDF eligibilty as JSON object
    async wdfToJson() {
        const effectiveFrom = WdfCalculator.effectiveDate;
        const myWDF = {
            effectiveFrom: effectiveFrom.toISOString(),
            overalWdfEligible: this._overallWdfEligibility ? this._overallWdfEligibility.toISOString() : false,
            ... await this.isWdfEligible(effectiveFrom)
        };
        return myWDF;
    }

    // for the given establishment, updates the last bulk uploaded timestamp
    static async bulkUploadSuccess(establishmentId) {
      try {
        await models.establishment.update(
          {
            lastBulkUploaded: new Date()
          },
          {
            where: {
              id: establishmentId
            }
          }
        );
      } catch (err) {
        this._log(Establishment.LOG_ERROR, `bulkUploadSuccess - failed: ${err}`);
      }
    }
};

module.exports.Establishment = Establishment;

// sub types
module.exports.EstablishmentExceptions = EstablishmentExceptions;
