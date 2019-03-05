import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Worker } from '@core/model/worker.model';
import { MessageService } from '@core/services/message.service';
import { WorkerEditResponse, WorkerService } from '@core/services/worker.service';
import { Subscription } from 'rxjs';
import { isNull } from 'util';

@Component({
  selector: 'app-days-of-sickness',
  templateUrl: './days-of-sickness.component.html',
})
export class DaysOfSicknessComponent implements OnInit, OnDestroy {
  public form: FormGroup;
  public daysSicknessMin = 0;
  public daysSicknessMax = 366;
  private worker: Worker;
  private subscriptions: Subscription = new Subscription();

  constructor(
    private formBuilder: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private workerService: WorkerService,
    private messageService: MessageService
  ) {
    this.saveHandler = this.saveHandler.bind(this);
    this.otherChangeHandler = this.otherChangeHandler.bind(this);
    this.valueValidator = this.valueValidator.bind(this);
  }

  ngOnInit() {
    this.worker = this.route.parent.snapshot.data.worker;

    this.form = this.formBuilder.group({
      valueKnown: null,
      value: [null, [Validators.min(this.daysSicknessMin), Validators.max(this.daysSicknessMax), this.valueValidator]],
    });

    if (this.worker.daysSick) {
      this.form.patchValue({
        valueKnown: this.worker.daysSick.value,
        value: this.worker.daysSick.days ? this.worker.daysSick.days : null,
      });
    }
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
    this.messageService.clearAll();
  }

  async submitHandler() {
    try {
      await this.saveHandler();
      this.router.navigate(['/worker', this.worker.uid, 'contract-with-zero-hours']);
    } catch (err) {
      // keep typescript transpiler silent
    }
  }

  saveHandler(): Promise<WorkerEditResponse> {
    return new Promise((resolve, reject) => {
      const { valueKnown, value } = this.form.controls;
      this.messageService.clearError();

      if (this.form.valid) {
        if (valueKnown.value) {
          this.worker.daysSick = {
            value: valueKnown.value,
            days: Math.round(value.value * 2) / 2,
          };
        }

        this.subscriptions.add(this.workerService.setWorker(this.worker).subscribe(resolve, reject));
      } else {
        if (value.errors.required) {
          this.messageService.show('error', `'Number of days' is required.`);
        }

        if (value.errors.min || value.errors.max) {
          this.messageService.show(
            'error',
            `Number of days must be between ${this.daysSicknessMin} and ${this.daysSicknessMax}.`
          );
        }

        reject();
      }
    });
  }

  otherChangeHandler() {
    this.form.controls.value.reset();
  }

  valueValidator() {
    if (this.form) {
      const { valueKnown } = this.form.value;
      const value = this.form.controls.value.value;
      console.log(value);
      if (valueKnown === 'Yes' && !isNull(value)) {
        return { required: true };
      }
    }

    return null;
  }
}
