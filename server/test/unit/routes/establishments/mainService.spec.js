const dbmodels = require('../../../../models');
const sinon = require('sinon');
sinon.stub(dbmodels.status, 'ready').value(false);
sinon.stub(dbmodels.status, 'on');
const expect = require('chai').expect;
const setMainService = require('../../../../routes/establishments/mainService').setMainService;
const Establishment = require('../../../../models/classes/establishment');
const ServiceCache = require('../../../../models/cache/singletons/services').ServiceCache;
const httpMocks = require('node-mocks-http');

describe('mainService', () => {
  beforeEach(() => {
    sinon.stub(ServiceCache, 'allMyServices').returns([
      {
        id: 1,
        name: 'foo',
        category: 'foo',
      },
      {
        id: 2,
        name: 'foo',
        category: 'foo',
      },
      {
        id: 3,
        name: 'foo',
        category: 'foo',
      },
      {
        id: 4,
        name: 'foo',
        category: 'foo',
      },
    ]);

    sinon.stub(dbmodels.establishmentCapacity, 'findAll').returns([]);
  });
  afterEach(() => {
    sinon.restore();
  });

  it('should change the main service (with no other changes) if regulation state does not change (true)', async () => {
    const username = 'foo';
    const establishmentId = 123;

    const establishment = new Establishment.Establishment(username);
    establishment._isRegulated = true;

    sinon.stub(establishment, 'save');
    sinon.stub(establishment._properties, 'restore');
    sinon.stub(dbmodels.user, 'findByUUID').returns({
      id: 123,
    });

    const req = httpMocks.createRequest({
      method: 'GET',
      url: `/api/establishment/${establishmentId}/mainService`,
      params: {
        establishmentId,
      },
      body: {
        mainService: {
          id: 16,
        },
        cqc: true,
      },
    });

    req.username = username;
    req.userUid = '1234';
    req.establishment = {
      id: establishmentId,
    };

    const res = httpMocks.createResponse();

    await setMainService(req, res, establishment);

    expect(establishment._isRegulated).to.equal(true);
  });

  it('should change the main service (with no other changes) if regulation state does not change (false)', async () => {
    const username = 'foo';
    const establishmentId = 123;

    const establishment = new Establishment.Establishment(username);
    establishment._isRegulated = false;
    sinon.stub(establishment, 'save');
    sinon.stub(establishment._properties, 'restore');
    sinon.stub(dbmodels.user, 'findByUUID').returns({
      id: 123,
    });

    const req = httpMocks.createRequest({
      method: 'GET',
      url: `/api/establishment/${establishmentId}/mainService`,
      params: {
        establishmentId,
      },
      body: {
        mainService: {
          id: 16,
        },
        cqc: false,
      },
    });

    req.username = username;
    req.userUid = '1234';
    req.establishment = {
      id: establishmentId,
    };

    const res = httpMocks.createResponse();

    await setMainService(req, res, establishment);

    expect(establishment._isRegulated).to.equal(false);
  });

  it('should change the main service (with no other changes) if regulation change not specified (true)', async () => {
    const establishment = new Establishment.Establishment('foo');
    establishment._isRegulated = true;

    sinon.stub(dbmodels.user, 'findByUUID').returns({
      id: 123,
    });
    sinon.stub(establishment, 'save');
    sinon.stub(establishment._properties, 'restore');

    const establishmentId = 123;
    const req = httpMocks.createRequest({
      method: 'GET',
      url: `/api/establishment/${establishmentId}/mainService`,
      params: {
        establishmentId,
      },
      body: {
        mainService: {
          id: 16,
        },
      },
    });

    req.username = 'aylingw';
    req.userUid = '1234';
    req.establishment = {
      id: establishmentId,
    };

    const res = httpMocks.createResponse();

    await setMainService(req, res, establishment);

    expect(establishment._isRegulated).to.equal(true);
  });

  it.skip('should remove CQC related properties when going from CQC -> Non-CQC', async () => {
    const establishment = new Establishment.Establishment('foo');

    const otherServices = [
      {
        id: 1,
        name: 'foo',
        category: 'foo',
      },
      {
        id: 2,
        name: 'foo',
        category: 'foo',
      },
      {
        id: 5,
        name: 'foo',
        category: 'foo',
      },
    ];

    sinon.stub(dbmodels.user, 'findByUUID').returns({
      id: 123,
    });

    sinon.stub(establishment, 'save');

    sinon.stub(establishment, 'otherServices').get(() => {
      return otherServices;
    });

    await establishment.load({
      name: 'Test Workplace',
      address1: '123 Fake Street',
      postcode: 'LS11AA',
      mainService: {
        id: 16,
      },
      isRegulated: true,
      share: {
        enabled: true,
        with: ['CQC'],
      },
      services: otherServices,
    });

    const establishmentId = 123;
    const req = httpMocks.createRequest({
      method: 'GET',
      url: `/api/establishment/${establishmentId}/mainService`,
      params: {
        establishmentId,
      },
      body: {
        mainService: {
          id: 16,
        },
        cqc: false,
      },
    });

    req.username = 'aylingw';
    req.userUid = '1234';
    req.establishment = {
      id: establishmentId,
    };

    const res = httpMocks.createResponse();

    await setMainService(req, res, establishment);

    expect(establishment.isRegulated).to.equal(false);
    expect(establishment.locationId).to.equal(null);
    expect(establishment.shareWith.with).to.not.include('CQC');
    expect(establishment._properties.get('OtherServices').property).to.deep.equal([
      {
        id: 1,
        name: 'foo',
        category: 'foo',
        other: undefined,
      },
      {
        id: 2,
        name: 'foo',
        category: 'foo',
        other: undefined,
      },
    ]);
  });
});
