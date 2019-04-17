import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { RegisterGuard } from '@core/guards/register/register.guard';
import {
  ConfirmAccountDetailsComponent,
} from '@features/registration/confirm-account-details/confirm-account-details.component';
import {
  ConfirmWorkplaceDetailsComponent,
} from '@features/registration/confirm-workplace-details/confirm-workplace-details.component';
import { CreateUsernameComponent } from '@features/registration/create-username/create-username.component';
import {
  EnterWorkplaceAddressComponent,
} from '@features/registration/enter-workplace-address/enter-workplace-address.component';
import { RegistrationCompleteComponent } from '@features/registration/registration-complete/registration-complete.component';
import { RegulatedByCqcComponent } from '@features/registration/regulated-by-cqc/regulated-by-cqc.component';
import { SecurityQuestionComponent } from '@features/registration/security-question/security-question.component';
import { SelectMainServiceComponent } from '@features/registration/select-main-service/select-main-service.component';
import {
  SelectWorkplaceAddressComponent,
} from '@features/registration/select-workplace-address/select-workplace-address.component';
import { SelectWorkplaceComponent } from '@features/registration/select-workplace/select-workplace.component';
import { UserDetailsComponent } from '@features/registration/user-details/user-details.component';

const routes: Routes = [
  {
    path: 'regulated-by-cqc',
    component: RegulatedByCqcComponent,
    data: { title: 'Regulated by CQC' },
  },
  {
    path: 'select-workplace',
    component: SelectWorkplaceComponent,
    canActivate: [RegisterGuard],
    data: { title: 'Select Workplace' },
  },
  {
    path: 'confirm-workplace-details',
    component: ConfirmWorkplaceDetailsComponent,
    canActivate: [RegisterGuard],
    data: { title: 'Confirm Workplace Details' },
  },
  {
    path: 'user-details',
    component: UserDetailsComponent,
    canActivate: [RegisterGuard],
    data: { title: 'User Details' },
  },
  {
    path: 'create-username',
    component: CreateUsernameComponent,
    canActivate: [RegisterGuard],
    data: { title: 'Create Username' },
  },
  {
    path: 'security-question',
    component: SecurityQuestionComponent,
    canActivate: [RegisterGuard],
    data: { title: 'Security Question' },
  },
  {
    path: 'confirm-account-details',
    component: ConfirmAccountDetailsComponent,
    canActivate: [RegisterGuard],
    data: { title: 'Confirm Account Details' },
  },
  {
    path: 'complete',
    component: RegistrationCompleteComponent,
    canActivate: [RegisterGuard],
    data: { title: 'Complete' },
  },
  {
    path: 'select-workplace-address',
    component: SelectWorkplaceAddressComponent,
    canActivate: [RegisterGuard],
    data: { title: 'Select Workplace Address' },
  },
  {
    path: 'enter-workplace-address',
    component: EnterWorkplaceAddressComponent,
    canActivate: [RegisterGuard],
    data: { title: 'Enter Workplace Address' },
  },
  {
    path: 'select-main-service',
    component: SelectMainServiceComponent,
    canActivate: [RegisterGuard],
    data: { title: 'Select Main Service' },
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class RegistrationRoutingModule {}
