const expect = require('chai').expect;
const { PermissionCache } = require('../../../../../models/cache/singletons/permissions');
const buildUser = require('../../../../factories/user');
const sinon = require('sinon');
const { Establishment } = require('../../../../../models/classes/establishment');
const models = require('../../../../../models/');
describe('Permissions Cache', () => {
  afterEach(() => {
    sinon.restore();
  });
  it('should include become a parent permission if edit user', async () => {
    sinon.stub(Establishment.prototype, 'restore');
    sinon.stub(models.Approvals, 'becomeAParentRequests');
    sinon.stub(Establishment.prototype, 'mainService').value({
      id: 8,
    });
    const user = buildUser();
    const req = {
      username: user.username,
      role: 'Edit',
      establishment: {
        isSubsidiary: false,
        isParent: false,
      },
    };
    const permissions = await PermissionCache.myPermissions(req);
    const filteredPerms = permissions.filter((permission) => Object.keys(permission)[0] === 'canBecomeAParent');

    expect(filteredPerms.length).to.deep.equal(1);
  });
  it('should not include become a parent permission if read only user', async () => {
    sinon.stub(Establishment.prototype, 'restore');
    sinon.stub(models.Approvals, 'becomeAParentRequests');
    sinon.stub(Establishment.prototype, 'mainService').value({
      id: 8,
    });
    const req = {
      role: 'Read',
      establishment: {
        isSubsidiary: false,
        isParent: false,
      },
    };
    const permissions = await PermissionCache.myPermissions(req);
    const filteredPerms = permissions.filter((permission) => Object.keys(permission)[0] === 'canBecomeAParent');

    expect(filteredPerms.length).to.deep.equal(0);
  });
  describe('canViewBenchmarks', () => {
    it('should return canViewBenchmarks:true if service is one of the top 3 & regulated ', async () => {
      sinon.stub(Establishment.prototype, 'restore');
      sinon.stub(models.Approvals, 'becomeAParentRequests');
      sinon.stub(Establishment.prototype, 'mainService').value({
        id: 25,
        isCQC: true,
        name: 'commanMainService',
      });
      sinon.stub(Establishment.prototype, 'isRegulated').value(true);
      const user = buildUser();
      const req = {
        username: user.username,
        role: 'Edit',
        establishment: {
          isSubsidiary: false,
          isParent: false,
        },
      };

      const permissions = await PermissionCache.myPermissions(req);
      const filteredPerms = permissions.filter((permission) => Object.keys(permission)[0] === 'canBecomeAParent');

      expect(filteredPerms.length).to.deep.equal(0);
    });
    it('should return canViewBenchmarks:false if service is one of the top 3 but not regulated ', async () => {
      const req = createReq();

      const thisEstablishment = establishmentBuilder();
      thisEstablishment.mainService = { id: 25, name: 'commanMainService', isCQC: false };
      thisEstablishment.isRegulated = false;

      const res = httpMocks.createResponse();

      await permissionsCheck(thisEstablishment, user, null, req, res);

      const permissionData = res._getJSONData();
      expect(res.statusCode).to.deep.equal(200);
      expect(permissionData.permissions.canViewBenchmarks).to.deep.equal(false);
    });
    it('should return canViewBenchmarks:false if service is not one of the top 3 but regulated ', async () => {
      const req = createReq();

      const thisEstablishment = establishmentBuilder();
      thisEstablishment.mainService = { id: 10, name: 'NOTcommanMainService', isCQC: false };
      thisEstablishment.isRegulated = true;

      const res = httpMocks.createResponse();

      await permissionsCheck(thisEstablishment, user, null, req, res);

      const permissionData = res._getJSONData();
      expect(res.statusCode).to.deep.equal(200);
      expect(permissionData.permissions.canViewBenchmarks).to.deep.equal(false);
    });
    it('should return canViewBenchmarks:false if service is not one of the top 3 and not regulated', async () => {
      const req = createReq();

      const thisEstablishment = establishmentBuilder();
      thisEstablishment.mainService = { id: 10, name: 'UNcommanMainService', isCQC: false };
      thisEstablishment.isRegulated = false;

      const res = httpMocks.createResponse();

      await permissionsCheck(thisEstablishment, user, null, req, res);

      const permissionData = res._getJSONData();
      expect(res.statusCode).to.deep.equal(200);
      expect(permissionData.permissions.canViewBenchmarks).to.deep.equal(false);
    });
  });
  describe('canLinkToParent', () => {
    it('should return canLinkToParent:true if it isnt a parent,there are not any parent requests and doesnt have a parent ID ', async () => {
      const req = createReq();

      const thisEstablishment = establishmentBuilder();
      thisEstablishment.isParent = false;
      thisEstablishment.parentId = null;
      becomeAParentRequest = null;

      const res = httpMocks.createResponse();

      await permissionsCheck(thisEstablishment, user, becomeAParentRequest, req, res);

      const permissionData = res._getJSONData();
      expect(res.statusCode).to.deep.equal(200);
      expect(permissionData.permissions.canLinkToParent).to.deep.equal(true);
    });
    it('should return canLinkToParent:false if it is a parent,there are not any parent requests and doesnt have a parent ID ', async () => {
      const req = createReq();
      const thisEstablishment = establishmentBuilder();
      thisEstablishment.isParent = true;
      thisEstablishment.parentId = null;
      becomeAParentRequest = null;

      const res = httpMocks.createResponse();

      await permissionsCheck(thisEstablishment, user, becomeAParentRequest, req, res);

      const permissionData = res._getJSONData();
      expect(res.statusCode).to.deep.equal(200);
      expect(permissionData.permissions.canLinkToParent).to.deep.equal(false);
    });
    it('should return canLinkToParent:false if it is NOT a parent,there ARE parent requests and doesnt have a parent ID ', async () => {
      const req = createReq();
      const thisEstablishment = establishmentBuilder();
      thisEstablishment.isParent = false;
      thisEstablishment.parentId = null;
      becomeAParentRequest = { status: 'pending' };

      const res = httpMocks.createResponse();

      await permissionsCheck(thisEstablishment, user, becomeAParentRequest, req, res);

      const permissionData = res._getJSONData();
      expect(res.statusCode).to.deep.equal(200);
      expect(permissionData.permissions.canLinkToParent).to.deep.equal(false);
    });
    it('should return canLinkToParent:false if it is NOT a parent,there are NO parent requests but it HAS parent ID ', async () => {
      const req = createReq();
      const thisEstablishment = establishmentBuilder();
      thisEstablishment.isParent = false;
      thisEstablishment.parentId = 201;
      becomeAParentRequest = null;

      const res = httpMocks.createResponse();

      await permissionsCheck(thisEstablishment, user, becomeAParentRequest, req, res);

      const permissionData = res._getJSONData();
      expect(res.statusCode).to.deep.equal(200);
      expect(permissionData.permissions.canLinkToParent).to.deep.equal(false);
    });
  });
  describe('canRemoveParentAssociation', () => {
    it('should return canRemoveParentAssociation:true if it isnt a parent, does have a parent ID and user had Edit permissions ', async () => {
      const req = createReq();

      const thisEstablishment = establishmentBuilder();
      thisEstablishment.isParent = false;
      thisEstablishment.parentId = 25;
      becomeAParentRequest = null;
      user.role = 'Edit';
      const res = httpMocks.createResponse();

      await permissionsCheck(thisEstablishment, user, becomeAParentRequest, req, res);

      const permissionData = res._getJSONData();
      expect(res.statusCode).to.deep.equal(200);
      expect(permissionData.permissions.canRemoveParentAssociation).to.deep.equal(true);
    });
  });
  describe('canDownloadWdfReport', () => {
    it('should return canDownloadWdfReport:true if it is a parent, user had Edit permissions ', async () => {
      const req = createReq();

      const thisEstablishment = establishmentBuilder();
      thisEstablishment.isParent = true;
      user.role = 'Edit';
      const res = httpMocks.createResponse();

      await permissionsCheck(thisEstablishment, user, null, req, res);

      const permissionData = res._getJSONData();
      expect(res.statusCode).to.deep.equal(200);
      expect(permissionData.permissions.canDownloadWdfReport).to.deep.equal(true);
    });
    it('should return canDownloadWdfReport:false if it is NOT a parent, user had Edit permissions ', async () => {
      const req = createReq();

      const thisEstablishment = establishmentBuilder();
      thisEstablishment.isParent = false;
      user.role = 'Edit';
      const res = httpMocks.createResponse();

      await permissionsCheck(thisEstablishment, user, null, req, res);

      const permissionData = res._getJSONData();
      expect(res.statusCode).to.deep.equal(200);
      expect(permissionData.permissions.canDownloadWdfReport).to.deep.equal(false);
    });
    it('should return canDownloadWdfReport:false if it is a parent, user does NOT have Edit permissions ', async () => {
      const req = createReq();

      const thisEstablishment = establishmentBuilder();
      thisEstablishment.isParent = false;
      user.role = 'Read';
      const res = httpMocks.createResponse();

      await permissionsCheck(thisEstablishment, user, null, req, res);

      const permissionData = res._getJSONData();
      expect(res.statusCode).to.deep.equal(200);
      expect(permissionData.permissions.canDownloadWdfReport).to.deep.equal(false);
    });
  });
});
