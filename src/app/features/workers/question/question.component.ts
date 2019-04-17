import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { ErrorDefinition, ErrorDetails } from '@core/model/errorSummary.model';
import { Worker } from '@core/model/worker.model';
import { ErrorSummaryService } from '@core/services/error-summary.service';
import { WorkerService } from '@core/services/worker.service';
import { Subscription } from 'rxjs';
import { take } from 'rxjs/operators';
import { isNull } from 'util';

@Component({
  selector: 'app-question',
  template: '',
})
export class QuestionComponent implements OnInit, OnDestroy {
  public form: FormGroup;
  public worker: Worker;
  public submitted = false;

  public return: string[];
  public previous: string[];
  public next: string[];
  public back: string[];

  public formErrorsMap: Array<ErrorDetails>;
  public serverErrorsMap: Array<ErrorDefinition>;
  protected subscriptions: Subscription = new Subscription();

  constructor(
    protected formBuilder: FormBuilder,
    protected router: Router,
    protected errorSummaryService: ErrorSummaryService,
    protected workerService: WorkerService
  ) {}

  ngOnInit() {
    this.return = null; //this.workerService.returnToSummary;

    this.subscriptions.add(
      this.workerService.worker$.pipe(take(1)).subscribe(worker => {
        this.worker = worker;

        this.init();

        this.back = this.return ? this.return : this.previous;
      })
    );

    this.setupFormErrorsMap();
    this.setupServerErrorsMap();
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  public getFormErrorMessage(item: string, errorType: string): string {
    return this.errorSummaryService.getFormErrorMessage(item, errorType, this.formErrorsMap);
  }

  protected init() {}
  protected setupFormErrorsMap() {}
  protected setupServerErrorsMap() {}
  protected generateUpdateProps() {}

  protected navigate(action): void {
    switch (action) {
      case 'continue':
        this.router.navigate(this.next);
        break;

      case 'summary':
        this.router.navigate(['/worker', this.worker.uid, 'summary']);
        break;

      case 'exit':
        this.router.navigate(['/dashboard'], { fragment: 'staff-records' });
        break;

      case 'return':
        this.router.navigate(this.return);
        break;
    }
  }

  public onSubmit(payload: { action: string; save: boolean }) {
    if (!payload.save) {
      this.navigate(payload.action);
      return;
    }

    this.submitted = true;
    this.errorSummaryService.syncFormErrorsEvent.next(true);

    if (!this.form.valid) {
      this.errorSummaryService.scrollToErrorSummary();
      return;
    }

    const props = this.generateUpdateProps();

    if (isNull(props)) {
      this.navigate(payload.action);
      return;
    }

    this.subscriptions.add(
      this.workerService
        .updateWorker(this.worker.uid, props)
        .subscribe(data => this.onSuccess(data, payload.action), error => this.onError(error))
    );
  }

  onSuccess(data, action) {
    this.workerService.setState({ ...this.worker, ...data });
    this.navigate(action);
  }

  onError(error) {
    console.log(error);
  }
}
