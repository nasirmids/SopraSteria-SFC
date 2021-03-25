const chai = require('chai');
const expect = chai.expect;
const sinon = require('sinon');
const sinonChai = require('sinon-chai');
chai.should();
chai.use(sinonChai);
const httpMocks = require('node-mocks-http');

const models = require('../../../models');

const registrationSurvey = require('../../../routes/registrationSurvey');

describe('registrationSurvey', async () => {
  afterEach(() => {
    sinon.restore();
  });

  it('should return 200 with all questions answered', async () => {
    const request = {
      method: 'POST',
      url: '/api/registrationSurvey',
      user: {
        id: 1234,
      },
      body: {
        participation: {
          answer: 'Yes',
        },
        whyDidYouCreateAccount: {
          answer: ['Other', 'To record and manage staff records'],
        },
        howDidYouHearAboutASCWDS: {
          answer: ['From our local authority'],
        },
      },
    };

    const expectedRegistrationSurveyParams = {
      userFk: 1234,
      participation: {
        answer: 'Yes',
      },
      whyDidYouCreateAccount: {
        answer: ['Other', 'To record and manage staff records'],
      },
      howDidYouHearAboutASCWDS: {
        answer: ['From our local authority'],
      },
    };

    const registrationSurveyStub = sinon.stub(models.registrationSurvey, 'create');

    const req = httpMocks.createRequest(request);
    const res = httpMocks.createResponse();
    await registrationSurvey.submitSurvey(req, res);

    expect(res.statusCode).to.deep.equal(200);
    registrationSurveyStub.should.have.been.calledWith(expectedRegistrationSurveyParams);
  });

  it('should return 200 when questions are skipped', async () => {
    const request = {
      method: 'POST',
      url: '/api/registrationSurvey',
      user: {
        id: 1234,
      },
      body: {
        participation: {
          answer: 'Yes',
        },
        whyDidYouCreateAccount: {
          answer: [],
        },
        howDidYouHearAboutASCWDS: {
          answer: [],
        },
      },
    };

    const expectedRegistrationSurveyParams = {
      userFk: 1234,
      participation: {
        answer: 'Yes',
      },
      whyDidYouCreateAccount: {
        answer: [],
      },
      howDidYouHearAboutASCWDS: {
        answer: [],
      },
    };

    const registrationSurveyStub = sinon.stub(models.registrationSurvey, 'create');

    const req = httpMocks.createRequest(request);
    const res = httpMocks.createResponse();
    await registrationSurvey.submitSurvey(req, res);

    expect(res.statusCode).to.deep.equal(200);
    registrationSurveyStub.should.have.been.calledWith(expectedRegistrationSurveyParams);
  });

  it('should return a 500 if create fails', async () => {
    const request = {
      method: 'POST',
      url: '/api/registrationSurvey',
      user: {
        id: 1234,
      },
      body: {},
    };

    sinon.stub(models.registrationSurvey, 'create').throws();

    const req = httpMocks.createRequest(request);
    const res = httpMocks.createResponse();
    await registrationSurvey.submitSurvey(req, res);

    expect(res.statusCode).to.deep.equal(500);
  });
});
