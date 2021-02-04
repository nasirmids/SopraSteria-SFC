import { HttpClientTestingModule } from '@angular/common/http/testing';
import { getTestBed } from '@angular/core/testing';
import { FormBuilder } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { BackService } from '@core/services/back.service';
import { BreadcrumbService } from '@core/services/breadcrumb.service';
import { BulkUploadService } from '@core/services/bulk-upload.service';
import { ErrorSummaryService } from '@core/services/error-summary.service';
import { EstablishmentService } from '@core/services/establishment.service';
import { WorkerService } from '@core/services/worker.service';
import { MockBreadcrumbService } from '@core/test-utils/MockBreadcrumbService';
import { MockBulkUploadService } from '@core/test-utils/MockBulkUploadService';
import { MockEstablishmentService } from '@core/test-utils/MockEstablishmentService';
import { MockWorkerService, workerBuilder } from '@core/test-utils/MockWorkerService';
import { BulkUploadV2Module } from '@features/bulk-upload-v2/bulk-upload.module';
import { SharedModule } from '@shared/shared.module';
import { render } from '@testing-library/angular';

import { StaffReferencesComponent } from './staff-references-page.component';

describe('WorkplaceReferencesComponent', () => {
  async function setup(references: Worker[] = []) {
    const component = await render(StaffReferencesComponent, {
      imports: [SharedModule, RouterModule, RouterTestingModule, HttpClientTestingModule, BulkUploadV2Module],
      providers: [
        {
          provide: EstablishmentService,
          useClass: MockEstablishmentService,
        },
        {
          provide: WorkerService,
          useClass: MockWorkerService,
        },
        {
          provide: BulkUploadService,
          useClass: MockBulkUploadService,
        },
        {
          provide: BreadcrumbService,
          useClass: MockBreadcrumbService,
        },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              data: {
                references: references,
              },
              paramMap: {
                get(uid) {
                  return 123;
                },
              },
            },
          },
        },
        BackService,
        FormBuilder,
        ErrorSummaryService,
      ],
    });

    const injector = getTestBed();
    const establishmentService = injector.inject(EstablishmentService) as EstablishmentService;
    const router = injector.inject(Router) as Router;

    return {
      component,
      establishmentService,
      router,
    };
  }

  const event = new Event('click');

  it('should render a StaffReferencesComponent', async () => {
    const { component } = await setup();
    expect(component).toBeTruthy();
  });

  it('should show missing worker error when submitting with empty field(2 messages - 1 top, 1 under field)', async () => {
    const worker = workerBuilder();
    const references = [worker] as Worker[];
    const { component } = await setup(references);
    const form = component.fixture.componentInstance.form;
    const errorMessage = 'Enter the missing workplace reference.';

    expect(component.queryByText(errorMessage, { exact: false })).toBeNull();
    form.controls[`reference-${worker.uid}`].setValue('');
    component.fixture.componentInstance.onSubmit(event);
    component.fixture.detectChanges();
    expect(form.invalid).toBeTruthy();
    expect(component.getAllByText(errorMessage, { exact: false }).length).toBe(2);
    expect(form.controls[`reference-${worker.uid}`].errors).toEqual({ required: true });
  });

  it('should show maxlength error when submitting with field which is too long(2 messages - 1 top, 1 under field)', async () => {
    const worker = workerBuilder();
    const references = [worker] as Worker[];
    const { component } = await setup(references);
    const maxLength = component.fixture.componentInstance.maxLength;
    const workerReference = 'This is over fifty characters................................................';
    const errorMessage = `The reference must be ${maxLength} characters or less.`;
    const form = component.fixture.componentInstance.form;

    expect(component.queryByText(errorMessage, { exact: false })).toBeNull();
    form.controls[`reference-${worker.uid}`].setValue(workerReference);
    component.fixture.componentInstance.onSubmit(event);
    component.fixture.detectChanges();
    expect(form.invalid).toBeTruthy();
    expect(component.getAllByText(errorMessage, { exact: false }).length).toBe(2);
    expect(form.controls[`reference-${worker.uid}`].errors).toEqual({
      maxlength: {
        requiredLength: maxLength,
        actualLength: workerReference.length,
      },
    });
  });

  it('should show duplicate error when submitting with same input in multiple boxes(4 messages - 2 top, 2 under fields)', async () => {
    const workers = [workerBuilder(), workerBuilder()];
    const references = workers as Worker[];
    const { component } = await setup(references);
    const form = component.fixture.componentInstance.form;
    const errorMessage = 'Enter a different workplace reference.';

    expect(component.queryByText(errorMessage, { exact: false })).toBeNull();
    form.controls[`reference-${workers[0].uid}`].setValue('abc');
    form.controls[`reference-${workers[1].uid}`].setValue('abc');
    component.fixture.componentInstance.onSubmit(event);
    component.fixture.detectChanges();
    expect(form.invalid).toBeTruthy();
    expect(component.getAllByText(errorMessage, { exact: false }).length).toBe(4);
    expect(form.controls[`reference-${workers[0].uid}`].errors).toEqual({ duplicate: true });
    expect(form.controls[`reference-${workers[1].uid}`].errors).toEqual({ duplicate: true });
  });
});
