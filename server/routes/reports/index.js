// default route for reports
const express = require('express');
const router = express.Router();

const isAdmin = require('../../utils/security/isAuthenticated').isAdmin;

const WDF = require('./wdf');
const WDFsummary = require('./wdfSummary');
const DailySnapshot = require('./dailySnapshot');
const LocalAuthority = require('./localAuthorityReport/index');
const TrainingReport = require('./trainingReport');
const DeleteReport = require('./deleteReport');
const satisfactionSurveyReport = require('./satisfactionSurveyReport');

router.use('/wdf', WDF);
router.use('/wdfSummary', WDFsummary);
router.use('/dailySnapshot', DailySnapshot);
router.use('/localAuthority', LocalAuthority);
router.use('/training', TrainingReport);
router.use('/delete', [isAdmin, DeleteReport]);
router.use('/satisfactionSurvey', [isAdmin, satisfactionSurveyReport]);

router.route('/').get(async (req, res) => {
  return res.status(501).send();
});

module.exports = router;
