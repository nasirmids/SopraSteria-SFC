const { build, sequence, fake } = require('@jackfranklin/test-data-bot');

module.exports = build('services', {
  fields: {
    id: sequence(),
    name: fake(f => f.random.words(2)),
    category: fake(f => f.random.words(2)),
    iscqcregistered: fake(f => f.random.boolean),
    isMain: fake(f => f.random.boolean),
    other: fake(f => f.random.boolean),
    reportingID: sequence(),
  }
});
