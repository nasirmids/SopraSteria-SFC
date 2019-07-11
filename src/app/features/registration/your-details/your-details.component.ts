import { Component } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { Router } from '@angular/router';
import { BackService } from '@core/services/back.service';
import { ErrorSummaryService } from '@core/services/error-summary.service';
import { UserService } from '@core/services/user.service';
import { AccountDetails } from '@features/account/account-details/account-details';

@Component({
  selector: 'app-your-details',
  templateUrl: './your-details.component.html',
})
export class YourDetailsComponent extends AccountDetails {
  constructor(
    protected backService: BackService,
    protected errorSummaryService: ErrorSummaryService,
    protected fb: FormBuilder,
    protected router: Router,
    protected userService: UserService
  ) {
    super(backService, errorSummaryService, fb, router, userService);
  }

  protected init() {
    console.log('init fired');
  }

  protected save() {
    console.log('save fired in child');
    this.userService.updateState(this.setUserDetails());
    this.router.navigate(['/registration/create-username']);
  }
}
