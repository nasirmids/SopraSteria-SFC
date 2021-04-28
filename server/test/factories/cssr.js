const { build, sequence } = require('@jackfranklin/test-data-bot');

module.exports = build('cssr', {
  fields: {
    id: sequence(),
    name: 'Harrow',
    nmdsIdLetter: 'G'
  }
});
