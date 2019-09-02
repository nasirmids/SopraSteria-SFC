import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { Establishment } from '@core/model/establishment.model';
import { Worker } from '@core/model/worker.model';
import { EstablishmentService } from '@core/services/establishment.service';
import { PermissionsService } from '@core/services/permissions/permissions.service';
import { WorkerService } from '@core/services/worker.service';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-staff-records-tab',
  templateUrl: './staff-records-tab.component.html',
})
export class StaffRecordsTabComponent implements OnInit, OnDestroy {
  @Input() workplace: Establishment;

  private subscriptions: Subscription = new Subscription();
  public createStaffResponse = null;
  public errors;
  public incomplete = 0;
  public totalStaff: number;
  public workers: Worker[];
  public canAddWorker: boolean;

  constructor(
    private establishmentService: EstablishmentService,
    private permissionsService: PermissionsService,
    private workerService: WorkerService
  ) {}

  ngOnInit() {
    this.subscriptions.add(
      this.workerService.workers$.pipe(filter(workers => workers !== null)).subscribe(workers => {
        this.workers = workers;
        this.incomplete = this.workers.filter(worker => !worker.completed).length;
      })
    );

    this.subscriptions.add(
      this.establishmentService.getStaff(this.workplace.uid).subscribe(totalStaff => {
        this.totalStaff = totalStaff;
      })
    );

    this.createStaffResponse = this.workerService.getCreateStaffResponse();
    this.canAddWorker = this.permissionsService.can(this.workplace.uid, 'canAddWorker');
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }
}
