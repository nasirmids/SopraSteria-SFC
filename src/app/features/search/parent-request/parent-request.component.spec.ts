import { SharedModule } from '@shared/shared.module';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { render, within } from '@testing-library/angular';
import { spy } from 'sinon';

import { ParentRequestComponent } from './parent-request.component';

const testUsername = 'Mary Poppins';
const testOrgname = 'Fawlty Towers';
const testUserId = 1111;
const testEstablishmentId = 2222;
const testWorkplaceId = 'B1234567';
const testRequestedDate = new Date();
const testRejectionReason = 'Because I can!';

describe('ParentRequestComponent', () => {
  async function getParentRequestComponent() {
    const parentRequest = {
      establishmentId: testEstablishmentId,
      userId: testUserId,
      workplaceId: testWorkplaceId,
      userName: testUsername,
      orgName: testOrgname,
      requested: testRequestedDate
    };

    return render(ParentRequestComponent, {
      imports: [
        ReactiveFormsModule,
        HttpClientTestingModule,
        SharedModule],
      componentProperties: {
        index: 0,
        removeParentRequest: {
          emit: spy(),
        } as any,
        parentRequest,
      },
    });
  }

  it('should create', async() => {
    const component = await getParentRequestComponent();

    expect(component).toBeTruthy();
  });

  it('should be able to approve a become-a-parent request', async () => {
    const component = await getParentRequestComponent();

    const { componentInstance } = component.fixture;
    
    const parentRequestApproval = spyOn(componentInstance.parentRequestsService, 'parentApproval').and.callThrough();
    
    const approveButton = component.getByText('Approve');
    approveButton.click();

    const modalConfirmationDialog = await within(document.body).findByRole('dialog');
    const confirm = within(modalConfirmationDialog).getByText('Approve request');
    confirm.click();

    expect(parentRequestApproval).toHaveBeenCalledWith({
      establishmentId: testEstablishmentId,
      userId: testUserId,
      rejectionReason: 'Approved',
      approve: true,
    });
  });

  it('should be able to reject a become-a-parent request', async () => {
    const component = await getParentRequestComponent();

    const { componentInstance } = component.fixture;
    
    const parentRequestApproval = spyOn(componentInstance.parentRequestsService, 'parentApproval').and.callThrough();
    
    const approveButton = component.getByText('Reject');
    approveButton.click();

    const modalConfirmationDialog = await within(document.body).findByRole('dialog');
    const confirm = within(modalConfirmationDialog).getByText('Approve request');
    confirm.click();

    expect(parentRequestApproval).toHaveBeenCalledWith({
      establishmentId: testEstablishmentId,
      userId: testUserId,
      rejectionReason: 'Because I say so',
      approve: false,
    });
  });

  it('should show confirmation modal when approving a request', async () => {
    const { click, getByText, fixture } = await getParentRequestComponent();

    const { componentInstance: component } = fixture;

    const confirmationModal = spyOn(component.dialogService, 'open').and.callThrough();

    click(getByText('Approve'));

    expect(confirmationModal).toHaveBeenCalled();
  });

  /*it('should send rejection reason when rejecting a become-a-parent request', async () => {
    const { click, getByText, fixture } = await getParentRequestComponent();

    const { componentInstance: component } = fixture;

    const parentRequestApproval = spyOn(component.parentRequestsService, 'parentApproval').and.callThrough();

    click(getByText('Approve'));

    expect(parentRequestApproval).toHaveBeenCalledWith({
      rejectionReason: testRejectionReason,
      approve: false,
    });
  });*/
});
