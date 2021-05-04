const { build, fake } = require('@jackfranklin/test-data-bot');

module.exports = build('EstablishmentCSV', {
  fields: {
    LOCALESTID: fake(f => f.random.uuid()),
    STATUS: 'NEW',
    ESTNAME: fake(f => f.company.companyName()),
    ADDRESS1: fake(f => f.address.streetAddress()),
    ADDRESS2: fake(f => f.address.secondaryAddress()),
    ADDRESS3: '',
    POSTTOWN: fake(f => f.address.city()),
    POSTCODE: fake(f => f.address.zipCode('??# #??')),
    ESTTYPE: '6',
    OTHERTYPE: '',
    PERMCQC: '1',
    PERMLA: '1',
    SHARELA: '708;721;720',
    REGTYPE: '2',
    PROVNUM: fake(f => f.helpers.replaceSymbolWithNumber('#-########')),
    LOCATIONID: fake(f => f.helpers.replaceSymbolWithNumber('#-########')),
    MAINSERVICE: '8',
    ALLSERVICES: '8;13',
    CAPACITY: '0;0',
    UTILISATION: '0;0',
    SERVICEDESC: '1;1',
    SERVICEUSERS: '',
    OTHERUSERDESC: '',
    TOTALPERMTEMP: '1',
    ALLJOBROLES: '34;8;4',
    STARTERS: '0;0;0',
    LEAVERS: '999;0;0',
    VACANCIES: '999;333;1',
    REASONS: '',
    REASONNOS: '',
  },
});
