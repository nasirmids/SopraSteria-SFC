var express = require('express');
var router = express.Router();
const pCodeCheck = require('../utils/postcodeSanitizer');
const models = require('../models/index');

/* GET with Postcode parameter to find matching addresses */
router
  .route('/:postcode')

  .get(async (req, res) => {
    let postcodeData = [];

    try {
      //Clean user submitted postcode
      let cleanPostcode = pCodeCheck.sanitisePostcode(req.params.postcode);

      if (cleanPostcode != null) {
        //Find matching postcode data
        let results = await models.pcodedata.findAll({
          where: {
            postcode: cleanPostcode,
          },
          order: [['uprn', 'ASC']],
        });

        //Go through any results found from DB and map to JSON
        for (let i = 0, len = results.length; i < len; i++) {
          let data = results[i].dataValues;

          const numberAndStreet = data.building_number
            ? `${data.building_number} ${data.street_description}`
            : data.street_description;
          const dataValues = [data.sub_building_name, data.building_name, numberAndStreet];
          const filteredDataValues = dataValues.filter((value) => {
            return value != '';
          });

          let myObject = {
            locationName: data.rm_organisation_name,
            addressLine1: filteredDataValues[0],
            addressLine2: filteredDataValues[1] ? filteredDataValues[1] : '',
            addressLine3: filteredDataValues[2] ? filteredDataValues[2] : '',
            townCity: data.post_town,
            county: data.county,
            postalCode: data.postcode,
          };

          postcodeData.push(myObject);
        }
      } else {
        res.status(400);
        return res.send({
          success: 0,
          message: 'Invalid Postcode',
        });
      }

      if (postcodeData.length === 0) {
        res.status(404);
        return res.send({
          success: 0,
          message: 'No addresses found',
        });
      } else {
        res.status(200);
        return res.json({
          success: 1,
          message: 'Addresses Found',
          postcodedata: postcodeData,
        });
      }
    } catch (err) {
      console.error('[GET] .../api/postcode/:postcode - failed: ', err);
      return res.status(503).send();
    }
  });

module.exports = router;
