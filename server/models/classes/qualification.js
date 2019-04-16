/*
 * qualification.js
 *
 * The encapsulation of a Worker's Qualification record, including all properties, all specific validation (not API, but object validation),
 * saving & restoring of data to database (via sequelize model), construction and deletion.
 * 
 * Also includes representation as JSON, in one or more presentations.
 *
 * TO NOTE - Qualification is a simplified representation of User, Worker and Establishment; it does not have any managed properties or auditing.
 */
const uuid = require('uuid');
const moment = require('moment');

// database models
const models = require('../index');

// known qualification types
const QUALIFICATION_TYPE = [
    'NVQ',
    'Any other qualification',
    'Certificate',
    'Degree',
    'Assessor and mentoring',
    'Award', 
    'Diploma',
    'Apprenticeship'
];

class QualificationDuplicateException {
    // TODO: parse the sequelize error on create failure
    constructor() {  };

    get message()  {
        return 'Duplicate';
    };
};

class Qualification {
    constructor(establishmentId, workerUid) {
        this._establishmentId = establishmentId;
        this._workerUid = workerUid;
        this._id = null;
        this._uid = null;
        this._created = null;
        this._updated = null;
        this._updatedBy = null;

        // localised attributes - optional on load
        this._qualification = null;
        this._year = null;
        this._notes = null;

        // lifecycle properties
        this._isNew = false;

        // UUID validator
        this.uuidV4Regex = /^[A-F\d]{8}-[A-F\d]{4}-4[A-F\d]{3}-[89AB][A-F\d]{3}-[A-F\d]{12}$/i;
        
        // default logging level - errors only
        // TODO: INFO logging on Training; change to LOG_ERROR only
        this._logLevel = Qualification.LOG_INFO;
    }

    // returns true if valid worker uid
    get _isWorkerUidValid() {
        if (this._workerUid &&
            this._establishmentId &&
            this.uuidV4Regex.test(this._workerUid)
           ) {
                return true;
            } else {
                return false;
            }
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
            console.log(`TODO: (${level}) - Qualification class: `, msg);
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
    get workerUid() {
        return this._workerUid;
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

    get qualification() {
        return this._qualification;
    };
    get year() {
        return this._year;
    };
    get notes() {
        if (this._notes === null) return null;
        return unescape(this._notes);
    };
    set qualification(qualification) {
        this._qualification = qualification;
    };
    set year(year) {
        this._year = year;
    };
    set notes(notes) {
        if (notes !== null) {
            // do not escape null
            this._notes = escape(notes);
        } else {
            this._notes = null;
        }
    };

    // used by save to initialise a new Qualification Record; returns true if having initialised this Qualification Record
    _initialise() {
        if (this._uid === null) {
            this._isNew = true;
            this._uid = uuid.v4();
            
            if (!this._isWorkerUidValid)
                throw new Error('Qualification initialisation error');

            // note, do not initialise the id as this will be returned by database
            return true;
        } else {
            return false;
        }
    }

    // validates a given qualification record; returns the qualification record if valid
    async validateQualificationRecord(document) {
        // to validate a qualification record, need the list of available qualifications
        const qualifications = await models.workerAvailableQualifications.findAll({
            attributes: ['id', 'seq', 'group', 'title', 'level', 'from', 'until'],
            order: [
                ["seq", "ASC"]
            ]
        });

        if (!qualifications || !Array.isArray(qualifications)) {
            this._log(Qualification.LOG_ERROR, 'Failed to get all training categories');
            return false;
        }
        
        const validatedQualificationRecord = {};
        // qualification category
        if (document.qualification) {
            // validate category
            if (!(document.qualification.id || (document.qualification.title && document.qualification.level))) {
                this._log(Qualification.LOG_ERROR, 'qualification failed validation: qualification.id or qualification.title and qualification.level must exist');
                return false;
            }

            if (document.qualification.id && !Number.isInteger(document.qualification.id)) {
                this._log(Qualification.LOG_ERROR, 'qualification failed validation: qualification.id must be an integer');
                return false;
            }
            if (document.qualification.level && !Number.isInteger(document.qualification.level)) {
                this._log(Qualification.LOG_ERROR, 'qualification failed validation: qualification.level must be an integer');
                return false;
            }
            let foundQualification = null;
            if (document.qualification.id) {
                foundQualification = qualifications.find(thisQualification => thisQualification.id === document.qualification.id);
            }
            if (!foundQualification) {
                this._log(Qualification.LOG_ERROR, 'qualification failed validation: qualification.id or qualification.title and qualification.level must exist');
                return false;
            } else {
                validatedQualificationRecord.qualification = {
                    id: foundQualification.id,
                    title: foundQualification.title,
                    level: foundQualification.level,
                    group: foundQualification.group
                };
            }

            // TODO - enforce the from/until dates on qualification (year is currently optional, so not validating)!
            // NOTE - no complex validation on pathway, such as, having completed other qualifications first
        }

        // year
        if (document.year) {
            // validate year - it's an integer
            const MAX_AGE = 100;
            const CURRENT_YEAR = new Date().getFullYear;

            if (!Number.isInteger(document.year) ||
                document.year < (CURRENT_YEAR-MAX_AGE) ||
                document.year > CURRENT_YEAR) {
                this._log(Qualification.LOG_ERROR, `year failed validation: must be an integer, must be <= this year and not more than ${MAX_AGE} years ago`);
                return false;
            }

            validatedQualificationRecord.year = document.year;
        } else {
            validatedQualificationRecord.year = null;
        }

        // notes - allow for notes of empty string
        if (document.notes) {
            // validate title
            const MAX_LENGTH=1000;
            if (document.notes.length > MAX_LENGTH) {
                this._log(Qualification.LOG_ERROR, 'notes failed validation: MAX length');
                return false;
            }

            validatedQualificationRecord.notes = document.notes;
        } else {
            // notes not present - resetting
            validatedQualificationRecord.notes = null;
        }

        return validatedQualificationRecord;
    }

    // takes the given JSON document and updates self (internal properties)
    // Thows "Error" on error.
    async load(document) {
        try {
            const validatedQualificationRecord = await this.validateQualificationRecord(document);

            if (validatedQualificationRecord !== false) {
                this.qualification = validatedQualificationRecord.qualification;
                this.year = validatedQualificationRecord.year;
                this.notes = validatedQualificationRecord.notes;
            } else {
                this._log(Qualification.LOG_ERROR, `Qualification::load - failed`);
                throw new Error('Failed Validation');
            }
        } catch (err) {
            this._log(Qualification.LOG_ERROR, `Qualification::load - failed: ${err}`);
            return false;
        }
        return this.isValid();
    }

    // returns true if Qualification is valid, otherwise false
    isValid() {
        if (this.hasMandatoryProperties === true) {
            return true;
        } else {
            this._log(Qualification.LOG_ERROR, `Invalid properties`);
            return false;
        }
    }

    // saves the Qualification record to DB. Returns true if saved; false if not.
    // Throws "Error" on error
    async save(savedBy, ttl=0, externalTransaction=null) {
        let mustSave = this._initialise();

        if (!this.uid) {
            this._log(Qualification.LOG_ERROR, 'Not able to save an unknown qualification uid');
            throw Error('Invalid Qualification UID');
        }

        if (mustSave && this._isNew) {
            // create new Qualification Record
            try {
                // must validate the Worker record - to get the workerFk (integer)
                const workerRecord = await models.worker.findOne({
                    where: {
                        establishmentFk: this._establishmentId,
                        uid: this._workerUid,
                        archived: false
                    },
                    attributes: ['id']
                });

                if (workerRecord && workerRecord.id) {

                    const now = new Date();
                    const creationDocument = {
                        workerFk: workerRecord.id,
                        uid: this._uid,
                        created: now,
                        updated: now,
                        updatedBy: savedBy,
                        qualificationFk: this._qualification.id,
                        year: this._year,
                        notes: this._notes,
                        attributes: ['uid', 'created', 'updated'],
                    };

                    //console.log("WA DEBUG creation document: ", creationDocument)
    
                    // need to create the Training record only
                    //  in one transaction
                    await models.sequelize.transaction(async t => {
                        // the saving of an Training record can be initiated within
                        //  an external transaction
                        const thisTransaction = externalTransaction ? externalTransaction : t;
    
                        // now save the document
                        let creation = await models.workerQualifications.create(creationDocument, {transaction: thisTransaction});
    
                        const sanitisedResults = creation.get({plain: true});
    
                        this._id = sanitisedResults.ID;
                        this._created = sanitisedResults.created;
                        this._updated = sanitisedResults.updated;
                        this._updatedBy = savedBy;
                        this._isNew = false;
    
                        this._log(Qualification.LOG_INFO, `Created Qualification Record with uid (${this.uid})`);
                    });
                } else {
                    throw new Error('Worker record not found');
                }
                
            } catch (err) {
                // catch duplicate error
                if (err.name && err.name === 'SequelizeUniqueConstraintError') {
                    if (err.parent.constraint && err.parent.constraint === 'Workers_WorkerQualifications_unq') {
                        throw new QualificationDuplicateException();
                    }
                }

                this._log(Qualification.LOG_ERROR, `Failed to save new qualification record: ${err}`);
                throw new Error('Failed to save new Qualification record');
            }
        } else {
            // we are updating an existing Qualification Record
            try {
                const updatedTimestamp = new Date();

                // need to update the existing Qualification record only within a single transaction
                await models.sequelize.transaction(async t => {
                    // the saving of an Qualification record can be initiated within
                    //  an external transaction
                    const thisTransaction = externalTransaction ? externalTransaction : t;

                    const updateDocument = {
                        qualificationFk: this._qualification.id,
                        year: this._year,
                        notes: this._notes,
                        updated: updatedTimestamp,
                        updatedBy: savedBy
                    };

                    // now save the document
                    let [updatedRecordCount, updatedRows] =
                        await models.workerQualifications.update(updateDocument,
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
                        this._updatedBy = savedBy;
                        this._id = updatedRecord.ID;

                        this._log(Qualification.LOG_INFO, `Updated Qualification record with uid (${this.uid})`);

                    } else {
                        this._log(Qualification.LOG_ERROR, `Failed to update resulting Qualification record with id (${this._id})`);
                        throw new Error('Failed to update Qualification record');
                    }

                });
                
            } catch (err) {
                // catch duplicate error
                if (err.name && err.name === 'SequelizeUniqueConstraintError') {
                    if (err.parent.constraint && err.parent.constraint === 'Workers_WorkerQualifications_unq') {
                        throw new QualificationDuplicateException();
                    }
                }

                this._log(Qualification.LOG_ERROR, `Failed to update Qualification record with id (${this._id})`);
                throw new Error('Failed to update Qualification record');
            }

        }

        return mustSave;
    };

    // loads the Qualification record (with given uid) from DB, but only if it belongs to the given Worker
    // returns true on success; false if no Qualification Record
    // Can throw Error exception.
    async restore(uid) {

        if (!this.uuidV4Regex.test(uid)) {
            this._log(Qualification.LOG_ERROR, 'Failed to restore Qualification record with invalid UID');
            throw new Error('Failed to restore');
        }

        if (!this._establishmentId ||
            !this._workerUid) {
            this._log(Qualification.LOG_ERROR, 'Failed to restore Qualification record with unknown worker id and establishment id');
            throw new Error('Failed to restore');
        }

        try {
            // by including the worker id in the fetch, we are sure to only fetch those
            //  Qualification records associated to the given Worker   
            const fetchQuery = {
                where: {
                    uid: uid,
                },
                include: [
                    {
                        model: models.worker,
                        as: 'worker',
                        attributes: ['id', 'uid'],
                        where: {
                            uid: this._workerUid
                        }
                    },
                    {
                        model: models.workerAvailableQualifications,
                        as: 'qualification',
                    }
                ]
            };

            const fetchResults = await models.workerQualifications.findOne(fetchQuery);
            if (fetchResults && fetchResults.id && Number.isInteger(fetchResults.id)) {
                // update self - don't use setters because they modify the change state
                this._isNew = false;
                this._id = fetchResults.id;
                this._uid = fetchResults.uid;

                this._qualification = {
                    id: fetchResults.qualificationFk,
                    group: fetchResults.qualification.group,
                    title: fetchResults.qualification.title,
                    level: fetchResults.qualification.level,
                };
                this._year = fetchResults.year;
                this._notes = fetchResults.notes !== null && fetchResults.notes.length === 0 ? null : fetchResults.notes;
                
                this._created = fetchResults.created;
                this._updated = fetchResults.updated;
                this._updatedBy = fetchResults.updatedBy;

                return true;
            }

            return false;

        } catch (err) {
            // typically errors when making changes to model or database schema!
            this._log(Qualification.LOG_ERROR, err);

            throw new Error(`Failed to load Qualification record with uid (${this.uid})`);
        }
    };

    // deletes this Qualification Record from DB
    // Can throw "Error"
    async delete() {
        if (this._workerUid === null ||
            this._establishmentId === null) {
            this._log(Qualification.LOG_ERROR, 'Cannot delete a qualification record having unknown establishment uid or worker uid');
            throw new Error('Failed to delete');
        }

        try {
            // by getting here, we known the Qualification record belongs to the Worker, because it's been validated by restoring the training record first
            const fetchQuery = {
                where: {
                    uid: this._uid,
                },
                include: [
                    {
                        model: models.worker,
                        as: 'worker',
                        attributes: ['id', 'uid'],
                        where: {
                            uid: this._workerUid
                        }
                    }
                ]
            };

            const deleteResults = await models.workerQualifications.destroy(fetchQuery);  // returns the number of records deleted
            if (deleteResults === 1) {
                // reset self - don't use setters because they modify the change state
                this._isNew = false;
                this._id = null;
                this._uid = null;
                this._workerUid = null;
                this._establishmentId = null;

                this._qualification = null;
                this._year = null;
                this._notes = null;

                this._created = null;
                this._updated = null;
                this._updatedBy = null;

                return true;
            }

            return false;

        } catch (err) {
            // typically errors when making changes to model or database schema!
            this._log(Qualification.LOG_ERROR, err);

            throw new Error(`Failed to delete Qualification record with uid (${this.uid})`);
        }
    };

    // returns a set of Workers' Qualification Records based on given filter criteria (all if no filters defined) - restricted to the given Worker
    static async fetch(establishmentId, workerId, filters=null) {
        if (filters) throw new Error("Filters not implemented");

        const allQualificationRecords = [];
        const fetchResults = await models.workerQualifications.findAll({
            include: [
                {
                    model: models.worker,
                    as: 'worker',
                    attributes: ['id', 'uid'],
                    where: {
                        uid: workerId
                    }
                },
                {
                    model: models.workerAvailableQualifications,
                    as: 'qualification',
                    attributes: ['id', 'group', 'title', 'level']
                }
            ],
            order: [
                //['completed', 'DESC'],
                ['updated', 'DESC']
            ]           
        });

        if (fetchResults) {
            fetchResults.forEach(thisRecord => {
                allQualificationRecords.push({
                    uid: thisRecord.uid,
                    qualification: {
                        id: thisRecord.qualification.id,
                        group: thisRecord.qualification.group,
                        title: thisRecord.qualification.title,
                        level: thisRecord.qualification.level,
                    },
                    year: thisRecord.year != null ? thisRecord.year : undefined,
                    notes: thisRecord.notes !== null && thisRecord.notes.length > 0 ? unescape(thisRecord.notes) : undefined,
                    created:  thisRecord.created.toISOString(),
                    updated: thisRecord.updated.toISOString(),
                    updatedBy: thisRecord.updatedBy,
                })
            });
        }

        let lastUpdated = null;
        if (fetchResults && fetchResults.length === 1) {
            lastUpdated = fetchResults[0];
        } else if (fetchResults && fetchResults.length > 1) {
            lastUpdated = fetchResults.reduce((a, b) => { return a.updated > b.updated ? a : b; });;
        }
        
        const response = {
            workerUid: workerId,
            count: allQualificationRecords.length,
            lastUpdated: lastUpdated ? lastUpdated.updated.toISOString() : undefined,
            qualifications: allQualificationRecords,
        };

        return response;
    };

    // returns a Javascript object which can be used to present as JSON
    toJSON() {
        // add worker default properties
        const myDefaultJSON = {
            uid:  this.uid,
            workerUid: this._workerUid,
            created: this.created.toJSON(),
            updated: this.updated.toJSON(),
            updatedBy: this.updatedBy,
            qualification: this.qualification,
            year: this.year !== null ? this.year : undefined,
            notes: this._notes !== null ? this.notes : undefined
        };

        return myDefaultJSON;

    }

    // HELPERS
    // returns true if all mandatory properties for a Training Record exist and are valid
    get hasMandatoryProperties() {
        let allExistAndValid = true;    // assume all exist until proven otherwise
        
        // qualification must exist
        if (this.qualification === null) allExistAndValid = true

        return allExistAndValid;
    }

    // returns a list of all the available qualifications (types) nminus those already "in use"
    async myAvailableQualifications(byType) {
        if (!QUALIFICATION_TYPE.includes(byType)) return false;

        const currentSetOfWorkerQualsResults = await models.workerQualifications.findAll({
            attributes: ['qualificationFk'],
            include: [
                {
                    model: models.worker,
                    as: 'worker',
                    attributes: ['id', 'uid'],
                    where: {
                        uid: this._workerUid
                    }
                }
            ]
        });

        const currentSetOfWorkerQuals = [];
        
        if (currentSetOfWorkerQualsResults && Array.isArray(currentSetOfWorkerQualsResults)) {
            currentSetOfWorkerQualsResults.forEach(thisQual => {
                currentSetOfWorkerQuals.push(thisQual.qualificationFk);
            });
        }

        // filter qualifications list by the given type
        const qualifications = await models.workerAvailableQualifications.findAll({
            attributes: ['id', 'seq', 'group', 'title', 'level', 'code', 'from', 'until'],
            where: {
                group: byType,
                id: {
                    [models.Sequelize.Op.notIn] : currentSetOfWorkerQuals
                }
            },
            order: [
                ["seq", "ASC"]
            ]
        });

        if (qualifications && Array.isArray(qualifications)) {
            return qualifications.map(thisQual => {
                return {
                    id: thisQual.id,
                    title: thisQual.title,
                    level: thisQual.level,
                    code: thisQual.code,
                    from: thisQual.from !== null ? thisQual.from : undefined,
                    until: thisQual.until !== null? thisQual.until : undefined,
                };
            });
        }
    }
};

module.exports.Qualification = Qualification;
module.exports.QualificationDuplicateException = QualificationDuplicateException;