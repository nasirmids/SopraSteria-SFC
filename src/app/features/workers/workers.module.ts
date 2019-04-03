import { OverlayModule } from '@angular/cdk/overlay';
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { DialogService } from '@core/services/dialog.service';
import { SharedModule } from '@shared/shared.module';

import { AdultSocialCareStartedComponent } from './adult-social-care-started/adult-social-care-started.component';
import { ApprenticeshipTrainingComponent } from './apprenticeship-training/apprenticeship-training.component';
import { AverageWeeklyHoursComponent } from './average-weekly-hours/average-weekly-hours.component';
import { BritishCitizenshipComponent } from './british-citizenship/british-citizenship.component';
import { CareCertificateComponent } from './care-certificate/care-certificate.component';
import { CheckStaffRecordComponent } from './check-staff-record/check-staff-record.component';
import { ContractWithZeroHoursComponent } from './contract-with-zero-hours/contract-with-zero-hours.component';
import { CountryOfBirthComponent } from './country-of-birth/country-of-birth.component';
import {
  CreateStaffRecordStartScreenComponent,
} from './create-staff-record-start-screen/create-staff-record-start-screen.component';
import { CreateStaffRecordComponent } from './create-staff-record/create-staff-record.component';
import { DateOfBirthComponent } from './date-of-birth/date-of-birth.component';
import { DaysOfSicknessComponent } from './days-of-sickness/days-of-sickness.component';
import { DeleteSuccessComponent } from './delete-success/delete-success.component';
import { DeleteWorkerDialogComponent } from './delete-worker-dialog/delete-worker-dialog.component';
import { DisabilityComponent } from './disability/disability.component';
import { EditWorkerComponent } from './edit-worker/edit-worker.component';
import { EthnicityComponent } from './ethnicity/ethnicity.component';
import { GenderComponent } from './gender/gender.component';
import { HomePostcodeComponent } from './home-postcode/home-postcode.component';
import { MainJobStartDateComponent } from './main-job-start-date/main-job-start-date.component';
import { MentalHealthProfessionalComponent } from './mental-health-professional/mental-health-professional.component';
import { NationalInsuranceNumberComponent } from './national-insurance-number/national-insurance-number.component';
import { NationalityComponent } from './nationality/nationality.component';
import { OtherJobRolesComponent } from './other-job-roles/other-job-roles.component';
import { OtherQualificationsLevelComponent } from './other-qualifications-level/other-qualifications-level.component';
import { OtherQualificationsComponent } from './other-qualifications/other-qualifications.component';
import { RecruitedFromComponent } from './recruited-from/recruited-from.component';
import { SalaryComponent } from './salary/salary.component';
import {
  SocialCareQualificationLevelComponent,
} from './social-care-qualification-level/social-care-qualification-level.component';
import { SocialCareQualificationComponent } from './social-care-qualification/social-care-qualification.component';
import { StaffDetailsComponent } from './staff-details/staff-details.component';
import { BasicRecordComponent } from './staff-record-summary/basic-record/basic-record.component';
import { EmploymentComponent } from './staff-record-summary/employment/employment.component';
import { PersonalDetailsComponent } from './staff-record-summary/personal-details/personal-details.component';
import {
  QualificationsAndTrainingComponent,
} from './staff-record-summary/qualifications-and-training/qualifications-and-training.component';
import { StaffRecordSummaryComponent } from './staff-record-summary/staff-record-summary.component';
import { StaffRecordComponent } from './staff-record/staff-record.component';
import { WeeklyContractedHoursComponent } from './weekly-contracted-hours/weekly-contracted-hours.component';
import { WorkerSaveSuccessComponent } from './worker-save-success/worker-save-success.component';
import { WorkerResolver } from './worker.resolver';
import { WorkersRoutingModule } from './workers-routing.module';
import { YearArrivedUkComponent } from './year-arrived-uk/year-arrived-uk.component';
import { QualificationsComponent } from './staff-record-summary/qualifications/qualifications.component';
import { AddTrainingComponent } from './add-training/add-training.component';

@NgModule({
  imports: [CommonModule, ReactiveFormsModule, SharedModule, WorkersRoutingModule, OverlayModule],
  declarations: [
    AdultSocialCareStartedComponent,
    ApprenticeshipTrainingComponent,
    AverageWeeklyHoursComponent,
    BasicRecordComponent,
    BritishCitizenshipComponent,
    CareCertificateComponent,
    CheckStaffRecordComponent,
    ContractWithZeroHoursComponent,
    CountryOfBirthComponent,
    CreateStaffRecordStartScreenComponent,
    CreateStaffRecordComponent,
    DateOfBirthComponent,
    DaysOfSicknessComponent,
    DeleteSuccessComponent,
    DeleteWorkerDialogComponent,
    DisabilityComponent,
    EditWorkerComponent,
    EmploymentComponent,
    EthnicityComponent,
    GenderComponent,
    HomePostcodeComponent,
    MainJobStartDateComponent,
    MentalHealthProfessionalComponent,
    NationalInsuranceNumberComponent,
    NationalityComponent,
    OtherJobRolesComponent,
    OtherQualificationsLevelComponent,
    OtherQualificationsComponent,
    PersonalDetailsComponent,
    QualificationsAndTrainingComponent,
    RecruitedFromComponent,
    SalaryComponent,
    SocialCareQualificationLevelComponent,
    SocialCareQualificationComponent,
    StaffDetailsComponent,
    StaffRecordComponent,
    StaffRecordSummaryComponent,
    WeeklyContractedHoursComponent,
    WorkerSaveSuccessComponent,
    YearArrivedUkComponent,
    QualificationsComponent,
    AddTrainingComponent,
  ],
  providers: [WorkerResolver, DialogService],
  entryComponents: [DeleteWorkerDialogComponent],
})
export class WorkersModule {}
