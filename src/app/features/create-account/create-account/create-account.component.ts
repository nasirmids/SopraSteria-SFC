import { Component } from '@angular/core';
import { FormBuilder, FormControl, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { RadioField } from '@core/model/form-controls.model';
import { BackService } from '@core/services/back.service';
import { CreateAccountService } from '@core/services/create-account/create-account.service';
import { ErrorSummaryService } from '@core/services/error-summary.service';
import { AccountDetails } from '@features/account/account-details/account-details';

@Component({
  selector: 'app-create-account',
  templateUrl: './create-account.component.html',
})
export class CreateAccountComponent extends AccountDetails {
  public callToActionLabel = 'Save user account';
  public permissionsRadios: RadioField[] = [
    {
      value: 'edit',
      label: 'Edit'
    },
    {
      value: 'read',
      label: 'Read-only'
    },
  ];

  constructor(
    protected backService: BackService,
    protected errorSummaryService: ErrorSummaryService,
    protected fb: FormBuilder,
    protected router: Router,
    private createAccountService: CreateAccountService
  ) {
    super(backService, errorSummaryService, fb, router);
  }

  protected init(): void {
    this.addFormControls();
  }

  private addFormControls(): void {
    this.form.addControl('permissions', new FormControl(null, Validators.required));

    this.formErrorsMap.push({
      item: 'permissions',
      type: [
        {
          name: 'required',
          message: 'Please specify permissions for the new account.',
        }
      ],
    });
  }

  protected save() {
    this.createAccountService.accountDetails$.next(this.setUserDetails());
    this.router.navigate(['/create-account/create-username']);
  }
}
