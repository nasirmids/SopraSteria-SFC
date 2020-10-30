const { build, fake } = require('@jackfranklin/test-data-bot');
const moment = require('moment');

module.exports = build('WorkerCSV', {
  fields: {
    LOCALESTID: fake(f => f.random.uuid()),
    UNIQUEWORKERID: fake(f => f.random.uuid()),
    CHGUNIQUEWRKID: '',
    STATUS: 'NEW',
    DISPLAYID: fake(f => f.company.companyName()),
    FLUVAC: '2',
    NINUMBER: '',
    POSTCODE: fake(f => f.address.zipCode('??# #??')),
    DOB : moment(fake(f => f.date.past())).format('DD/MM/YYYY'),
    GENDER : '2',
    ETHNICITY : '31',
    NATIONALITY : '826',
    BRITISHCITIZENSHIP : '',
    COUNTRYOFBIRTH : '826',
    YEAROFENTRY : moment(fake(f => f.date.past())).format('YYYY'),
    DISABLED : '0',
    CARECERT : '2',
    RECSOURCE : '12',
    STARTDATE : moment(fake(f => f.date.past())).format('YYYY'),
    STARTINSECT : moment(fake(f => f.date.past())).format('YYYY'),
    APPRENTICE : '999',
    EMPLSTATUS : 1,
    ZEROHRCONT : '2',
    DAYSSICK : '0',
    SALARYINT : '3',
    SALARY : '',
    HOURLYRATE : '25.9',
    MAINJOBROLE : '11',
    MAINJRDESC : '',
    CONTHOURS : '40',
    AVGHOURS : '',
    OTHERJOBROLE : '25',
    OTHERJRDESC : '',
    NMCREG : '',
    NURSESPEC : '',
    AMHP : '',
    SCQUAL : '1;3',
    NONSCQUAL : '1;3',
    QUALACH01 : '2;2011',
    QUALACH01NOTES : '',
    QUALACH02 : '38;2012',
    QUALACH02NOTES : '',
    QUALACH03 : '',
    QUALACH03NOTES : '',
    QUALACH04 : '',
    QUALACH04NOTES : '',
  },
});
