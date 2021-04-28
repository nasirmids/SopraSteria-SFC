const { build, fake } = require('@jackfranklin/test-data-bot');
const faker = require('faker');

module.exports = build('pcodedata', {
  fields: {
    uprn: faker.unique(faker.helpers.replaceSymbolWithNumber, ['############']),
    sub_building_name: fake(f => f.random.words(2)),
    building_name: fake(f => f.random.words(2)),
    building_number: fake(f => f.random.number()),
    street_description: fake(f => f.address.streetName()),
    post_town: fake(f => f.address.city()),
    postcode: fake(f => f.address.zipCode('??# #??')),
    local_custodian_code: faker.unique(faker.helpers.replaceSymbolWithNumber, ['####']),
    county: fake(f => f.address.county()),
    rm_organisation_name: fake(f => f.random.words(2)),
  }
});
