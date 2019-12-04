import { Overlay } from '@angular/cdk/overlay';
import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Establishment } from '@core/model/establishment.model';
import { Roles } from '@core/model/roles.enum';
import { UserDetails } from '@core/model/userDetails.model';
import { AlertService } from '@core/services/alert.service';
import { BulkUploadService } from '@core/services/bulk-upload.service';
import { DialogService } from '@core/services/dialog.service';
import { EstablishmentService } from '@core/services/establishment.service';
import { NotificationsService } from '@core/services/notifications/notifications.service';
import { PermissionsService } from '@core/services/permissions/permissions.service';
import { UserService } from '@core/services/user.service';
import { WorkerService } from '@core/services/worker.service';
import {
  CancelDataOwnerDialogComponent,
} from '@shared/components/cancel-data-owner-dialog/cancel-data-owner-dialog.component';
import {
  ChangeDataOwnerDialogComponent,
} from '@shared/components/change-data-owner-dialog/change-data-owner-dialog.component';
import { LinkToParentDialogComponent } from '@shared/components/link-to-parent/link-to-parent-dialog.component';
import {
  SetDataPermissionDialogComponent,
} from '@shared/components/set-data-permission/set-data-permission-dialog.component';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-home-tab',
  templateUrl: './home-tab.component.html',
  providers: [DialogService, Overlay],
})
export class HomeTabComponent implements OnInit, OnDestroy {
  @Input() workplace: Establishment;

  private subscriptions: Subscription = new Subscription();
  public adminRole: Roles = Roles.Admin;
  public canBulkUpload: boolean;
  public canEditEstablishment: boolean;
  public canViewWorkplaces: boolean;
  public canViewReports: boolean;
  public isParent: boolean;
  public updateStaffRecords: boolean;
  public user: UserDetails;
  public canViewChangeDataOwner: boolean;
  public canViewDataPermissionsLink: boolean;
  public ownershipChangeRequestId: any = [];
  public isOwnershipRequested = false;
  public primaryWorkplace: Establishment;
  public canLinkToParent: boolean;

  constructor(
    private bulkUploadService: BulkUploadService,
    private permissionsService: PermissionsService,
    private userService: UserService,
    private workerService: WorkerService,
    private notificationsService: NotificationsService,
    private dialogService: DialogService,
    private alertService: AlertService,
    private router: Router,
    private establishmentService: EstablishmentService
  ) {}

  ngOnInit() {
    this.user = this.userService.loggedInUser;
    const workplaceUid: string = this.workplace ? this.workplace.uid : null;
    this.canEditEstablishment = this.permissionsService.can(workplaceUid, 'canEditEstablishment');
    this.canBulkUpload = this.permissionsService.can(workplaceUid, 'canBulkUpload');
    this.canViewWorkplaces = this.workplace && this.workplace.isParent;
    this.canViewChangeDataOwner =
      this.workplace && this.workplace.parentUid != null && this.workplace.dataOwner !== 'Workplace';
    this.canViewDataPermissionsLink =
      this.workplace && this.workplace.parentUid != null && this.workplace.dataOwner === 'Workplace';
    this.primaryWorkplace = this.establishmentService.primaryWorkplace;
    this.canViewReports =
      this.permissionsService.can(workplaceUid, 'canViewWdfReport') ||
      this.permissionsService.can(workplaceUid, 'canRunLocalAuthorityReport');

    if (this.workplace && this.canEditEstablishment) {
      this.subscriptions.add(
        this.workerService.workers$.pipe(filter(workers => workers !== null)).subscribe(workers => {
          this.updateStaffRecords = !(workers.length > 0);
        })
      );
    }
    if (this.canViewChangeDataOwner && this.workplace.dataOwnershipRequested) {
      this.isOwnershipRequested = true;
    }
    // this.canLinkToParent = this.permissionsService.can(workplaceUid, 'canLinkToParent');
    this.canLinkToParent = true;
  }

  public onChangeDataOwner($event: Event) {
    $event.preventDefault();
    const dialog = this.dialogService.open(ChangeDataOwnerDialogComponent, this.workplace);
    dialog.afterClosed.subscribe(changeDataOwnerConfirmed => {
      if (changeDataOwnerConfirmed) {
        this.changeDataOwnerLink();
        this.router.navigate(['/dashboard']);
        this.alertService.addAlert({
          type: 'success',
          message: `Request to change data owner has been sent to ${this.workplace.parentName} `,
        });
      }
    });
  }

  public cancelChangeDataOwnerRequest($event: Event) {
    $event.preventDefault();
    this.ownershipChangeRequestId = [];
    this.subscriptions.add(
      this.establishmentService.changeOwnershipDetails(this.workplace.uid).subscribe(
        data => {
          if (data && data.length > 0) {
            data.forEach(element => {
              this.ownershipChangeRequestId.push(element.ownerChangeRequestUID);
            });
            this.workplace.ownershipChangeRequestId = this.ownershipChangeRequestId;
            const dialog = this.dialogService.open(CancelDataOwnerDialogComponent, this.workplace);
            dialog.afterClosed.subscribe(cancelDataOwnerConfirmed => {
              if (cancelDataOwnerConfirmed) {
                this.changeDataOwnerLink();
                this.router.navigate(['/dashboard']);
                this.alertService.addAlert({
                  type: 'success',
                  message: 'Request to change data owner has been cancelled ',
                });
              }
            });
          }
        },
        error => {
          console.error(error.error.message);
        }
      )
    );
  }

  public setDataPermissions($event: Event) {
    $event.preventDefault();
    const dialog = this.dialogService.open(SetDataPermissionDialogComponent, this.workplace);
    dialog.afterClosed.subscribe(setPermissionConfirmed => {
      if (setPermissionConfirmed) {
        this.router.navigate(['/dashboard']);
        this.alertService.addAlert({
          type: 'success',
          message: `Data permissions for ${this.workplace.parentName} have been set.`,
        });
      }
    });
  }

  private changeDataOwnerLink(): void {
    this.isOwnershipRequested = !this.isOwnershipRequested;
  }

  public setReturn(): void {
    this.bulkUploadService.setReturnTo({ url: ['/dashboard'] });
  }

  get numberOfNewNotifications() {
    const newNotifications = this.notificationsService.notifications.filter(notification => !notification.isViewed);
    return newNotifications.length;
  }
  /**
   * Function used to open modal box for link a workplace to parent organisation
   * @param {event} triggred event
   * @return {void}
   */
  public linkToParent($event: Event) {
    $event.preventDefault();
    const dialog = this.dialogService.open(LinkToParentDialogComponent, this.workplace);
    dialog.afterClosed.subscribe(setPermissionConfirmed => {
      if (setPermissionConfirmed) {
        this.router.navigate(['/dashboard']);
        //To Do once funcationality is ready. Need to add selected parent name.
        this.alertService.addAlert({
          type: 'success',
          message: `Request to link to parent has been sent.`,
        });
      }
    });
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }
}
