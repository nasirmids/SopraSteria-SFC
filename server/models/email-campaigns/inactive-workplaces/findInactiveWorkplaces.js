const moment = require('moment');

const config = require('../../../config/config');
const models = require('../../index');

const nextEmailTemplate = (inactiveWorkplace) => {
  const lastUpdated = moment(inactiveWorkplace.LastUpdated).startOf('day');

  const sixMonths = moment().startOf('day').subtract(6, 'months');
  const twelveMonths = moment().startOf('day').subtract(12, 'months');
  const eighteenMonths = moment().startOf('day').subtract(18, 'months');
  const twentyFourMonths = moment().startOf('day').subtract(24, 'months');

  if (lastUpdated.isSameOrBefore(sixMonths) && lastUpdated.isAfter(twelveMonths)) {
    const nextTemplate = config.get('sendInBlue.templates.sixMonthsInactive');

    return inactiveWorkplace.LastTemplate !== nextTemplate ? nextTemplate : null;
  }

  if (lastUpdated.isSameOrBefore(twelveMonths) && lastUpdated.isAfter(eighteenMonths)) {
    const nextTemplate = config.get('sendInBlue.templates.twelveMonthsInactive');

    return inactiveWorkplace.LastTemplate !== nextTemplate ? nextTemplate : null;
  }

  if (lastUpdated.isBefore(twelveMonths) && lastUpdated.isSameOrAfter(eighteenMonths)) {
    const nextTemplate = config.get('sendInBlue.templates.eighteenMonthsInactive');

    return inactiveWorkplace.LastTemplate !== nextTemplate ? nextTemplate : null;
  }

  if (lastUpdated.isSameOrBefore(twentyFourMonths)) {
    const nextTemplate = config.get('sendInBlue.templates.twentyFourMonthsInactive');

    return inactiveWorkplace.LastTemplate !== nextTemplate ? nextTemplate : null;
  }

  return null;
};

const findInactiveWorkplaces = async () => {
  await models.sequelize.query('REFRESH MATERIALIZED VIEW cqc."LastUpdatedEstablishments"');

  const inactiveWorkplaces = await models.sequelize.query(
    `
  SELECT
	"EstablishmentID",
  "NameValue",
  "NmdsID",
  "DataOwner",
  "PrimaryUserName",
  "PrimaryUserEmail",
	"LastUpdated",
  (
		SELECT
			"template"
		FROM
			cqc."EmailCampaignHistories" ech
		WHERE
			ech. "establishmentID" = e. "EstablishmentID"
    ORDER BY ech. "createdAt" DESC
    LIMIT 1) AS "LastTemplate"
		FROM
			cqc. "LastUpdatedEstablishments" e
		WHERE
      "ParentID" IS NULL
      AND "IsParent" = FALSE
			AND "LastUpdated" < :lastUpdated
			AND NOT EXISTS (
				SELECT
					ech. "establishmentID"
				FROM
					cqc."EmailCampaignHistories" ech
        JOIN cqc."EmailCampaigns" ec ON ec."id" = ech."emailCampaignID"
				WHERE
          ec."type" = 'inactiveWorkplaces'
					AND ech."createdAt" > :lastUpdated
					AND ech. "establishmentID" = e. "EstablishmentID");`,
    {
      type: models.sequelize.QueryTypes.SELECT,
      replacements: {
        lastUpdated: moment().subtract(1, 'months').endOf('month').subtract(6, 'months').format('YYYY-MM-DD'),
      },
    },
  );

  return inactiveWorkplaces
    .filter((inactiveWorkplace) => {
      return nextEmailTemplate(inactiveWorkplace) !== null;
    })
    .map((inactiveWorkplace) => {
      return {
        id: inactiveWorkplace.EstablishmentID,
        name: inactiveWorkplace.NameValue,
        nmdsId: inactiveWorkplace.NmdsID,
        lastUpdated: inactiveWorkplace.LastUpdated,
        emailTemplateId: nextEmailTemplate(inactiveWorkplace),
        dataOwner: inactiveWorkplace.DataOwner,
        user: {
          name: inactiveWorkplace.PrimaryUserName,
          email: inactiveWorkplace.PrimaryUserEmail,
        },
      };
    });
};

module.exports = {
  findInactiveWorkplaces,
  nextEmailTemplate,
};