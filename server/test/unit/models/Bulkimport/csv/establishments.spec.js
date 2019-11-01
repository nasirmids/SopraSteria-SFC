const expect = require('chai').expect;
const establishments = require('../../../mockdata/establishment').data;
const knownHeaders = require('../../../mockdata/establishment').knownHeaders;

const testUtils = require('../../../../../utils/testUtils');
const csv = require('csvtojson');

const mapCsvToEstablishment = (establishment, headers) =>
  headers.reduce((mapped, header, index) => {
    mapped[header] = establishment[index];

    return mapped;
  }, {});

const getUnitInstance = () => {
  const ALL_CAPACITIES = null;
  const ALL_UTILISATIONS = null;
  const BUDI_TO_ASC = 100;

  const bulkUpload = testUtils.sandBox(
    'server/models/BulkImport/csv/establishments.js',
    {
      locals: {
        require: testUtils.wrapRequire({
          '../BUDI': {
            BUDI: {
              services: (direction, originalCode) => {
                const fixedMapping = [
                  { ASC: 24, BUDI: 1 },
                  { ASC: 25, BUDI: 2 },
                  { ASC: 13, BUDI: 53 },
                  { ASC: 12, BUDI: 5 },
                  { ASC: 9, BUDI: 6 },
                  { ASC: 10, BUDI: 7 },
                  { ASC: 20, BUDI: 8 },
                  { ASC: 35, BUDI: 73 },
                  { ASC: 11, BUDI: 10 },
                  { ASC: 21, BUDI: 54 },
                  { ASC: 23, BUDI: 55 },
                  { ASC: 18, BUDI: 12 },
                  { ASC: 22, BUDI: 74 },
                  { ASC: 1, BUDI: 13 },
                  { ASC: 7, BUDI: 14 },
                  { ASC: 2, BUDI: 15 },
                  { ASC: 8, BUDI: 16 },
                  { ASC: 19, BUDI: 17 },
                  { ASC: 3, BUDI: 18 },
                  { ASC: 5, BUDI: 19 },
                  { ASC: 4, BUDI: 20 },
                  { ASC: 6, BUDI: 21 },
                  { ASC: 27, BUDI: 61 },
                  { ASC: 28, BUDI: 62 },
                  { ASC: 26, BUDI: 63 },
                  { ASC: 29, BUDI: 64 },
                  { ASC: 30, BUDI: 66 },
                  { ASC: 32, BUDI: 67 },
                  { ASC: 31, BUDI: 68 },
                  { ASC: 33, BUDI: 69 },
                  { ASC: 34, BUDI: 70 },
                  { ASC: 17, BUDI: 71 },
                  { ASC: 15, BUDI: 52 },
                  { ASC: 16, BUDI: 72 },
                  { ASC: 36, BUDI: 60 },
                  { ASC: 14, BUDI: 75 }
                ];

                if (direction === BUDI_TO_ASC) {
                  const found = fixedMapping.find(thisService => thisService.BUDI === originalCode);
                  return found ? found.ASC : null;
                } else {
                  const found = fixedMapping.find(thisService => thisService.ASC === originalCode);
                  return found ? found.BUDI : null;
                }
              },
              serviceFromCapacityId: (serviceCapacityId) => {
                if (Array.isArray(ALL_CAPACITIES)) {
                  const foundCapacity = ALL_CAPACITIES.find(thisCapacity => thisCapacity.serviceCapacityId === serviceCapacityId);

                  // foundCapacity will be undefined if not found
                  if (typeof foundCapacity !== 'undefined') {
                    return foundCapacity.serviceId;
                  }
                }

                return null;
              },

              serviceFromUtilisationId: (serviceCapacityId) => {
                if (Array.isArray(ALL_UTILISATIONS)) {
                  const foundCapacity = ALL_UTILISATIONS.find(thisCapacity => thisCapacity.serviceCapacityId === serviceCapacityId);

                  // foundCapacity will be undefined if not found
                  if (typeof foundCapacity !== 'undefined') {
                    return foundCapacity.serviceId;
                  }
                }

                return null;
              },

              establishmentType: (direction, originalCode) => {
                const fixedMapping = [
                  { ASC: 'Local Authority (adult services)', BUDI: 1 },
                  { ASC: 'Local Authority (generic/other)', BUDI: 3 },
                  { ASC: 'Private Sector', BUDI: 6 },
                  { ASC: 'Voluntary / Charity', BUDI: 7 },
                  { ASC: 'Other', BUDI: 8 }
                ];

                if (direction === BUDI_TO_ASC) {
                  const found = fixedMapping.find(thisTrainingCategory => thisTrainingCategory.BUDI === originalCode);
                  return found ? { type: found.ASC } : null;
                }

                const found = fixedMapping.find(thisType => thisType.ASC === originalCode);
                return found ? found.BUDI : 8;
              },
              serviceUsers: (direction, originalCode) => {
                const fixedMapping = [
                  { ASC: 1, BUDI: 1 },
                  { ASC: 2, BUDI: 2 },
                  { ASC: 3, BUDI: 22 },
                  { ASC: 4, BUDI: 23 },
                  { ASC: 5, BUDI: 25 },
                  { ASC: 6, BUDI: 26 },
                  { ASC: 8, BUDI: 46 },
                  { ASC: 7, BUDI: 27 },
                  { ASC: 9, BUDI: 3 },
                  { ASC: 10, BUDI: 28 },
                  { ASC: 11, BUDI: 6 },
                  { ASC: 12, BUDI: 29 },
                  { ASC: 13, BUDI: 5 },
                  { ASC: 14, BUDI: 4 },
                  { ASC: 15, BUDI: 7 },
                  { ASC: 16, BUDI: 8 },
                  { ASC: 17, BUDI: 31 },
                  { ASC: 18, BUDI: 9 },
                  { ASC: 19, BUDI: 45 },
                  { ASC: 20, BUDI: 18 },
                  { ASC: 21, BUDI: 19 },
                  { ASC: 22, BUDI: 20 },
                  { ASC: 23, BUDI: 21 }
                ];

                if (direction === BUDI_TO_ASC) {
                  const found = fixedMapping.find(thisService => thisService.BUDI === originalCode);
                  return found ? found.ASC : null;
                } else {
                  const found = fixedMapping.find(thisService => thisService.ASC === originalCode);
                  return found ? found.BUDI : null;
                }
              },
              jobRoles: (direction, originalCode) => {
                const fixedMapping = [
                  { ASC: 26, BUDI: 1 },
                  { ASC: 15, BUDI: 2 },
                  { ASC: 13, BUDI: 3 },
                  { ASC: 22, BUDI: 4 },
                  { ASC: 28, BUDI: 5 },
                  { ASC: 27, BUDI: 6 },
                  { ASC: 25, BUDI: 7 },
                  { ASC: 10, BUDI: 8 },
                  { ASC: 11, BUDI: 9 },
                  { ASC: 12, BUDI: 10 },
                  { ASC: 3, BUDI: 11 },
                  { ASC: 18, BUDI: 15 },
                  { ASC: 23, BUDI: 16 },
                  { ASC: 4, BUDI: 17 },
                  { ASC: 29, BUDI: 22 },
                  { ASC: 20, BUDI: 23 },
                  { ASC: 14, BUDI: 24 },
                  { ASC: 2, BUDI: 25 },
                  { ASC: 5, BUDI: 26 },
                  { ASC: 21, BUDI: 27 },
                  { ASC: 1, BUDI: 34 },
                  { ASC: 24, BUDI: 35 },
                  { ASC: 19, BUDI: 36 },
                  { ASC: 17, BUDI: 37 },
                  { ASC: 16, BUDI: 38 },
                  { ASC: 7, BUDI: 39 },
                  { ASC: 8, BUDI: 40 },
                  { ASC: 9, BUDI: 41 },
                  { ASC: 6, BUDI: 42 }
                ];

                if (direction === BUDI_TO_ASC) {
                  const found = fixedMapping.find(thisJob => thisJob.BUDI === originalCode);
                  return found ? found.ASC : null;
                } else {
                  const found = fixedMapping.find(thisJob => thisJob.ASC === originalCode);
                  return found ? found.BUDI : null;
                }
              }
            }
          }
        })
      }
    }
  );

  expect(bulkUpload).to.have.property('Establishment');

  expect(bulkUpload.Establishment).to.be.a('function');

  return new (bulkUpload.Establishment)();
};

describe('/server/models/Bulkimport/csv/establishment.js', () => {
  describe('get headers', () => {
    it('should return the correct list of headers', () => {
      const bulkUpload = getUnitInstance();

      expect(bulkUpload).to.have.property('headers');

      const columnHeaders = bulkUpload.headers;

      expect(columnHeaders).to.be.a('string');

      expect(columnHeaders.split(',')).to.deep.equal(knownHeaders);
    });
  });

  establishments.forEach((establishment, index) => {
    describe('toCSV(entity) with establishment ' + index, () => {
      it('should match the header values', async () => {
        let otherservices = '';
        let localauthorities = '';
        let capacities = '';
        let serviceDesc = '';
        let serviceUsers = '';
        let otherServiceUsers = '';
        const jobs = [];
        let alljobs = '';
        let allStarters = '';
        let allLeavers = '';
        let allVacancies = '';
        let reasons = '';
        let reasonCount = '';

        const bulkImportEstablishment = getUnitInstance();

        expect(bulkImportEstablishment).to.have.property('toCSV');
        expect(bulkImportEstablishment.toCSV).to.be.a('function');

        const establishmentCSV = bulkImportEstablishment.toCSV(establishment);

        expect(establishmentCSV).to.be.a('string');

        const foundValues = (await csv({
          noheader: true,
          output: 'csv'
        }).fromString(establishmentCSV))[0];

        expect(foundValues.length).to.equal(knownHeaders.length);

        if (Array.isArray(establishment.otherServices)) {
          establishment.otherServices.forEach((service, index) => {
            otherservices += service.budi;
            index < (establishment.otherServices.length - 1) ? otherservices += ';' : otherservices += '';
          });
        } else {
          expect(establishment.otherServices).to.equal(null);
        }

        if (Array.isArray(establishment.shareWithLA)) {
          establishment.shareWithLA.forEach((la, index) => {
            localauthorities += la.cssrId;
            index < (establishment.shareWithLA.length - 1) ? localauthorities += ';' : localauthorities += '';
          });
        } else {
          expect(establishment.shareWithLA).to.equal(null);
        }

        if (Array.isArray(establishment.capacities)) {
          establishment.capacities.forEach((capacity, index) => {
            if (capacity.reference.other) {
              serviceDesc += capacity.reference.other;
            }
            if (index < (establishment.capacities.length - 1)) {
              capacities += ';';
              serviceDesc += ';';
            } else {
              capacities += '';
              serviceDesc += '';
            }
          });
        } else {
          expect(establishment.capacities).to.equal(null);
        }

        if (Array.isArray(establishment.serviceUsers)) {
          establishment.serviceUsers.forEach((sUser, index) => {
            if (sUser.other) {
              otherServiceUsers += sUser.other;
            }
            serviceUsers += sUser.budi;
            if (index < (establishment.serviceUsers.length - 1)) {
              serviceUsers += ';';
              otherServiceUsers += ';';
            } else {
              serviceUsers += '';
              otherServiceUsers += '';
            }
          });
        } else {
          expect(establishment.serviceUsers).to.equal(null);
        }

        if (Array.isArray(establishment.starters)) {
          establishment.starters.forEach(job => {
            if (!jobs.includes(job.budi)) {
              jobs.push(job.budi);
            }
          });
        } else {
          expect(establishment.starters).to.equal(null);
        }

        if (Array.isArray(establishment.leavers)) {
          establishment.leavers.forEach(job => {
            if (!jobs.includes(job.budi)) {
              jobs.push(job.budi);
            }
          });
        } else {
          expect(establishment.leavers).to.equal(null);
        }

        if (Array.isArray(establishment.vacancies)) {
          establishment.vacancies.forEach(job => {
            if (!jobs.includes(job.budi)) {
              jobs.push(job.budi);
            }
          });
        } else {
          expect(establishment.vacancies).to.equal(null);
        }

        jobs.forEach((job, index) => {
          alljobs += job;

          allStarters += (establishment.starters.findIndex(starters => job === starters.budi) !== -1 ? '' : '0');
          allLeavers += (establishment.leavers.findIndex(leavers => job === leavers.budi) !== -1 ? '' : '0');
          allVacancies += (establishment.vacancies.findIndex(vacancies => job === vacancies.budi) !== -1 ? '' : '0');

          if (index < (jobs.length - 1)) {
            alljobs += ';';
            allStarters += ';';
            allLeavers += ';';
            allVacancies += ';';
          } else {
            alljobs += '';
            allStarters += '';
            allLeavers += '';
            allVacancies += '';
          }
        });

        if (establishment.reasonsForLeaving) {
          const reasonsForLeaving = establishment.reasonsForLeaving.split('|');

          reasonsForLeaving.forEach((reason, index) => {
            const reasonarray = reason.split(':');
            reasons += reasonarray[0];
            reasonCount += reasonarray[1];

            if (index < (reasonsForLeaving.length - 1)) {
              reasons += ';';
              reasonCount += ';';
            } else {
              reasons += '';
              reasonCount += '';
            }
          });
        }

        const mappedCsv = mapCsvToEstablishment(foundValues, knownHeaders);

        expect(mappedCsv.LOCALESTID).to.equal(establishment.localIdentifier);
        expect(mappedCsv.STATUS).to.equal('UNCHECKED');
        expect(mappedCsv.ESTNAME).to.equal(establishment.name);
        expect(mappedCsv.ADDRESS1).to.equal(establishment.address1);
        expect(mappedCsv.ADDRESS2).to.equal(establishment.address2);
        expect(mappedCsv.ADDRESS3).to.equal(establishment.address3);
        expect(mappedCsv.POSTTOWN).to.equal(establishment.town);
        expect(mappedCsv.POSTCODE).to.equal(establishment.postcode);

        if (establishment.employerType.id) {
          expect(parseInt(mappedCsv.ESTTYPE)).to.equal(establishment.employerType.id);
          expect(mappedCsv.OTHERTYPE).to.equal('');
        } else {
          expect(mappedCsv.OTHERTYPE).to.equal('');
        }

        expect(mappedCsv.PERMCQC).to.equal(establishment.shareWith.enabled && establishment.shareWith.with.indexOf('CQC') > -1 ? '1' : '');
        expect(mappedCsv.PERMLA).to.equal(establishment.shareWith.enabled && establishment.shareWith.with.indexOf('Local Authority') > -1 ? '1' : '');
        expect(mappedCsv.SHARELA).to.equal(localauthorities);
        expect(mappedCsv.REGTYPE).to.equal(establishment.isRegulated ? '2' : '0');
        expect(mappedCsv.PROVNUM).to.equal(establishment.provId);
        expect(mappedCsv.LOCATIONID).to.equal(establishment.locationId);
        expect(parseInt(mappedCsv.MAINSERVICE)).to.equal(establishment.mainService.budi);
        expect(mappedCsv.ALLSERVICES).to.equal(otherservices);
        expect(mappedCsv.CAPACITY).to.equal(capacities);
        expect(mappedCsv.UTILISATION).to.equal(capacities);
        expect(mappedCsv.SERVICEDESC).to.equal(serviceDesc);
        expect(mappedCsv.SERVICEUSERS).to.equal(serviceUsers);
        expect(mappedCsv.OTHERUSERDESC).to.equal(otherServiceUsers);
        expect(parseInt(mappedCsv.TOTALPERMTEMP)).to.equal(establishment.numberOfStaff);
        expect(mappedCsv.ALLJOBROLES).to.equal(alljobs);
        expect(mappedCsv.STARTERS).to.equal(allStarters);
        expect(mappedCsv.LEAVERS).to.equal(allLeavers);
        expect(mappedCsv.VACANCIES).to.equal(allVacancies);
        expect(mappedCsv.REASONS).to.equal(reasons);
        expect(mappedCsv.REASONNOS).to.equal(reasonCount);
      });
    });
  });
});
