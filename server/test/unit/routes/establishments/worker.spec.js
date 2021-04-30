const expect = require('chai').expect;
const sinon = require('sinon');

const { build, fake, sequence } = require('@jackfranklin/test-data-bot');
const httpMocks = require('node-mocks-http');
const moment = require('moment');

const models = require('../../../../models/index');
const workerRoute = require('../../../../routes/establishments/worker');

let i = 0;
const worker = {
  establishmentId: 1,
  workerId: '29155c11-11bb-4ab3-ada0-bccac7acecc1',
  id: 1,
  i,
};
const establishment = {
  establishmentId: 2,
};

describe('worker route', () => {
  before(() => {
    sinon.stub(models.worker, 'findOne').callsFake(async (args) => {
      return args.i === 3 ? {} : worker;
    });
    sinon.stub(models.worker, 'create').callsFake(async (args) => {
      return worker;
    });
    sinon.stub(models.worker, 'update').callsFake(async (args) => {
      const mockWorker = {
        get: () => {
          return worker;
        },
      };
      return [1, [mockWorker]];
    });
    sinon.stub(models.workerAudit, 'bulkCreate').callsFake(async (args) => {
      return {};
    });
    sinon.stub(models.establishment, 'findOne').callsFake(async (args) => {
      return establishment;
    });
  });

  after(() => {
    sinon.restore();
  });

  describe.skip('editWorker()', () => {
    it('should return worker changes', async () => {
      const updateStatus = (status) => {
        expect(status).to.deep.equal(200);
      };
      const updateJson = (json) => {
        expect(typeof json).to.deep.equal('object');
        expect(json.uid).to.deep.equal(worker.workerId);
        expect(json.establishmentFk).to.deep.equal(worker.establishmentId);
      };
      await workerRoute.editWorker(
        {
          establishmentId: establishment.establishmentId,
          username: 'test123',
          params: {
            workerId: worker.workerId,
          },
          body: {
            establishmentId: worker.establishmentId,
          },
          headers: {
            'x-override-put-return-all': false,
          },
        },
        { status: updateStatus, json: updateJson, send: updateJson },
      );
    });
    it('should return an error when the worker id is not valid', async () => {
      const updateStatus = (status) => {
        expect(status).to.deep.equal(400);
      };
      const updateJson = (json) => {
        expect(json).to.deep.equal('Unexpected worker id');
      };
      await workerRoute.editWorker(
        {
          establishmentId: establishment.establishmentId,
          username: 'test123',
          params: {
            workerId: worker.workerId + 1,
          },
          body: {
            establishmentId: worker.establishmentId,
          },
          headers: {
            'x-override-put-return-all': false,
          },
        },
        { status: updateStatus, json: updateJson, send: updateJson },
      );
    });
    it('should return an error when the worker is not valid', async () => {
      const updateStatus = (status) => {
        expect(status).to.deep.equal(400);
      };
      const updateJson = (json) => {
        expect(json).to.deep.equal('Unexpected Input.');
      };
      await workerRoute.editWorker(
        {
          establishmentId: establishment.establishmentId,
          username: 'test123',
          params: {
            workerId: worker.workerId,
          },
          body: {
            otherJobs: false,
          },
          headers: {
            'x-override-put-return-all': false,
          },
        },
        { status: updateStatus, json: updateJson, send: updateJson },
      );
    });
    it('should return an error when the worker is not found', async () => {
      const updateStatus = (status) => {
        expect(status).to.deep.equal(404);
      };
      const updateJson = (json) => {
        expect(json).to.deep.equal('Unexpected Input.');
      };
      await workerRoute.editWorker(
        {
          establishmentId: establishment.establishmentId,
          username: 'test123',
          params: {
            workerId: worker.workerId,
          },
          headers: {
            'x-override-put-return-all': false,
          },
        },
        { status: updateStatus, json: updateJson, send: updateJson },
      );
    });
  });

  describe('getTotalWorkers()', () => {
    const workerBuilder = build('Worker', {
      fields: {
        uid: fake((f) => f.random.uuid()),
      },
    });

    const worker = workerBuilder();
    beforeEach(() => {
      sinon.stub(models.establishment, 'workers').returns({
        id: 123,
        workers: [worker],
      });
    });
    afterEach(() => {
      sinon.restore();
    });
    it('should return a total number of staff', async () => {
      const req = httpMocks.createRequest({
        method: 'GET',
        url: '/api/establishment/123/worker/total',
        params: {
          establishmentId: 123,
        },
      });

      req.username = 'aylingw';
      req.userUid = '1234';
      req.establishment = {
        id: 123,
      };

      const res = httpMocks.createResponse();
      await workerRoute.getTotalWorkers(req, res);

      expect(res.statusCode).to.deep.equal(200);
      expect(res._getJSONData()).to.deep.equal({
        total: 1,
      });
    });
  });
});
