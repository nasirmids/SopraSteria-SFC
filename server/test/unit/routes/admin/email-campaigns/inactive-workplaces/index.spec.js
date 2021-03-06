const expect = require('chai').expect;
const httpMocks = require('node-mocks-http');
const sinon = require('sinon');
const moment = require('moment');

const models = require('../../../../../../models');
const findInactiveWorkplaces = require('../../../../../../services/email-campaigns/inactive-workplaces/findInactiveWorkplaces');
const findParentWorkplaces = require('../../../../../../services/email-campaigns/inactive-workplaces/findParentWorkplaces');
const sendEmail = require('../../../../../../services/email-campaigns/inactive-workplaces/sendEmail');
const inactiveWorkplaceRoutes = require('../../../../../../routes/admin/email-campaigns/inactive-workplaces');

describe('server/routes/admin/email-campaigns/inactive-workplaces', () => {
  afterEach(() => {
    sinon.restore();
  });

  const endOfLastMonth = moment().subtract(1, 'months').endOf('month').endOf('day');
  const sixMonthTemplateId = 13;
  const twelveMonthTemplateId = 14;
  const parentTemplateId = 15;

  const dummyInactiveWorkplaces = [
    {
      id: 478,
      name: 'Workplace Name',
      nmdsId: 'J1234567',
      lastUpdated: '2020-06-01',
      emailTemplate: {
        id: sixMonthTemplateId,
      },
      dataOwner: 'Workplace',
      user: {
        name: 'Test Name',
        email: 'test@example.com',
      },
    },
    {
      id: 479,
      name: 'Second Workplace Name',
      nmdsId: 'A0012345',
      lastUpdated: '2020-01-01',
      emailTemplate: {
        id: twelveMonthTemplateId,
      },
      dataOwner: 'Workplace',
      user: {
        name: 'Name McName',
        email: 'name@mcname.com',
      },
    },
  ];

  const dummyParentWorkplaces = [
    {
      id: 1,
      name: 'Test Name',
      nmdsId: 'A1234567',
      lastUpdated: endOfLastMonth.clone().subtract(6, 'months').format('YYYY-MM-DD'),
      emailTemplate: {
        id: parentTemplateId,
        name: 'Parent',
      },
      dataOwner: 'Workplace',
      user: {
        name: 'Test Person',
        email: 'test@example.com',
      },
      subsidiaries: [
        {
          id: 2,
          name: 'Workplace Name',
          nmdsId: 'A0045232',
          lastUpdated: endOfLastMonth.clone().subtract(6, 'months').format('YYYY-MM-DD'),
          dataOwner: 'Parent',
        },
        {
          id: 3,
          name: 'Workplace Name',
          nmdsId: 'A1245232',
          lastUpdated: endOfLastMonth.clone().subtract(6, 'months').format('YYYY-MM-DD'),
          dataOwner: 'Parent',
        },
      ],
    },
  ];

  describe('getInactiveWorkplaces', () => {
    it('should get the number of inactive workplaces', async () => {
      sinon.stub(findInactiveWorkplaces, 'findInactiveWorkplaces').returns(dummyInactiveWorkplaces);
      sinon.stub(findParentWorkplaces, 'findParentWorkplaces').returns(dummyParentWorkplaces);

      const req = httpMocks.createRequest({
        method: 'GET',
        url: '/api/admin/email-campaigns/inactive-workplaces',
      });

      req.role = 'Admin';

      const res = httpMocks.createResponse();
      await inactiveWorkplaceRoutes.getInactiveWorkplaces(req, res);
      const response = res._getJSONData();

      expect(response.inactiveWorkplaces).to.deep.equal(3);
    });

    it('should return an error if inactive workplaces throws an exception', async () => {
      sinon.stub(findInactiveWorkplaces, 'findInactiveWorkplaces').rejects();
      sinon.stub(findParentWorkplaces, 'findParentWorkplaces').rejects();

      const req = httpMocks.createRequest({
        method: 'GET',
        url: '/api/admin/email-campaigns/inactive-workplaces',
      });

      req.role = 'Admin';

      const res = httpMocks.createResponse();
      await inactiveWorkplaceRoutes.getInactiveWorkplaces(req, res);

      const response = res._getJSONData();

      expect(res.statusCode).to.equal(503);
      expect(response).to.deep.equal({});
    });
  });

  describe('createCampaign', async () => {
    it('should create a campaign', async () => {
      sinon.stub(findInactiveWorkplaces, 'findInactiveWorkplaces').returns(dummyInactiveWorkplaces);
      sinon.stub(findParentWorkplaces, 'findParentWorkplaces').returns(dummyParentWorkplaces);

      const sendEmailMock = sinon.stub(sendEmail, 'sendEmail').returns();
      const userMock = sinon.stub(models.user, 'findByUUID').returns({
        id: 1,
      });
      const createEmailCampaignMock = sinon.stub(models.EmailCampaign, 'create').returns({
        id: 1,
        userID: 1,
        createdAt: '2021-01-01',
        updatedAt: '2021-01-01',
      });
      const createEmailCampaignHistoryMock = sinon.stub(models.EmailCampaignHistory, 'bulkCreate');

      const req = httpMocks.createRequest({
        method: 'POST',
        url: '/api/admin/email-campaigns/inactive-workplaces',
      });

      req.role = 'Admin';
      req.userUid = '1402bf74-bf25-46d3-a080-a633f748b441';

      const res = httpMocks.createResponse();
      await inactiveWorkplaceRoutes.createCampaign(req, res);
      const response = res._getJSONData();

      expect(response).to.deep.equal({
        date: '2021-01-01',
        emails: 3,
      });

      sinon.assert.calledOnce(createEmailCampaignHistoryMock);
      sinon.assert.calledWith(userMock, '1402bf74-bf25-46d3-a080-a633f748b441');
      sinon.assert.calledWith(createEmailCampaignMock, {
        userID: 1,
        type: 'inactiveWorkplaces',
      });
      sinon.assert.calledWith(sendEmailMock, dummyInactiveWorkplaces[0]);
      sinon.assert.calledWith(sendEmailMock, dummyInactiveWorkplaces[1]);
      sinon.assert.calledWith(sendEmailMock, dummyParentWorkplaces[0]);
    });

    it('should get the email campaign history', async () => {
      const findAllMock = sinon.stub(models.EmailCampaign, 'findAll').returns([
        {
          toJSON: () => {
            return {
              id: 1,
              createdAt: '2021-01-05 09:00:00',
              emails: 1356,
            };
          },
        },
        {
          toJSON: () => {
            return {
              id: 2,
              createdAt: '2020-12-05 10:00:00',
              emails: 278,
            };
          },
        },
      ]);

      const req = httpMocks.createRequest({
        method: 'GET',
        url: '/api/admin/email-campaigns/inactive-workplaces/history',
      });

      req.role = 'Admin';

      const res = httpMocks.createResponse();
      await inactiveWorkplaceRoutes.getHistory(req, res);
      const response = res._getJSONData();

      sinon.assert.called(findAllMock);
      expect(response).to.deep.equal([
        {
          date: '2021-01-05',
          emails: 1356,
        },
        {
          date: '2020-12-05',
          emails: 278,
        },
      ]);
    });
  });
});
