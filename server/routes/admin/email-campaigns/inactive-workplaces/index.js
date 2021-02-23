const express = require('express');
const router = express.Router();

const findInactiveWorkplaces = require('./findInactiveWorkplaces');
const sendEmail = require('./sendEmail');

const getInactiveWorkplaces = async (_, res) => {
  const inactiveWorkplaces = await findInactiveWorkplaces.findInactiveWorkplaces();

  return res.json({
    inactiveWorkplaces: inactiveWorkplaces.length,
  });
}

const createCampaign = async (_, res) => {
  try {
    const inactiveWorkplaces = await findInactiveWorkplaces.findInactiveWorkplaces();
    inactiveWorkplaces.map(sendEmail.sendEmail);

    const newCampaign = {
      date: '2021-02-05',
      emails: 5673,
    };

    return res.json(newCampaign);
  } catch (err) {
    console.error(err);
    return res.status(503).json();
  }
}

const getHistory = async (_, res) => {
  const history = [
    {
      date: '2021-01-05',
      emails: 1356,
    },
    {
      date: '2020-12-05',
      emails: 278,
    },
  ];

  return res.json(history);
}

router.route('/').get(getInactiveWorkplaces);
router.route('/').post(createCampaign);
router.route('/history').get(getHistory);
router.use('/report', require('./report'));

module.exports = router;
module.exports.createCampaign = createCampaign;
module.exports.getHistory = getHistory;
module.exports.getInactiveWorkplaces = getInactiveWorkplaces;