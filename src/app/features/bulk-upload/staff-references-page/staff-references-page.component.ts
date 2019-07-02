import { HttpErrorResponse } from '@angular/common/http';
import { Component } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { BulkUploadFileType } from '@core/model/bulk-upload.model';
import { Worker } from '@core/model/worker.model';
import { AuthService } from '@core/services/auth.service';
import { ErrorSummaryService } from '@core/services/error-summary.service';
import { WorkerService } from '@core/services/worker.service';
import { BulkUploadReferences } from '@features/bulk-upload/bulk-upload-references/bulk-upload-references';
import { take } from 'rxjs/operators';

@Component({
  selector: 'app-workplace-references-page',
  templateUrl: '../bulk-upload-references/bulk-upload-references.html',
  styleUrls: ['../bulk-upload-references/bulk-upload-references.scss'],
})
export class StaffReferencesPageComponent extends BulkUploadReferences {
  // TODO check if needed
  public referencesUpdated = false;
  public referenceType = BulkUploadFileType.Worker;
  public referenceTypeInfo = 'You must create unique references for each member of staff.';
  public columnOneLabel = 'Name';
  public columnTwoLabel = 'Staff reference';

  constructor(
    protected authService: AuthService,
    protected router: Router,
    protected formBuilder: FormBuilder,
    protected errorSummaryService: ErrorSummaryService,
    protected workerService: WorkerService,
    private activatedRoute: ActivatedRoute
  ) {
    super(authService, router, formBuilder, errorSummaryService);
  }

  /** TODO check if needed
   public updateReferences() {
    this.referencesUpdated = true;
    this.authService.isFirstBulkUpload = false;
  }
   **/

  protected init(): void {
    this.subscriptions.add(
      this.activatedRoute.params.pipe(take(1)).subscribe(params => this.getReferences(params.uid))
    );
  }

  protected getReferences(establishmentUid: string): void {
    this.subscriptions.add(
      this.workerService.getAllWorkersByUid(establishmentUid).subscribe(
        (references: Worker[]) => {
          if (references) {
            this.references = references;
            if (this.references.length) {
              this.updateForm();
            }
          }
        },
        (error: HttpErrorResponse) => this.onError(error)
      )
    );
  }
}
