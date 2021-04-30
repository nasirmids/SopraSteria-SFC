import { Component, Input, OnInit } from '@angular/core';
import { Establishment } from '@core/model/establishment.model';
import { URLStructure } from '@core/model/url.model';
import { EstablishmentService } from '@core/services/establishment.service';
import { PermissionsService } from '@core/services/permissions/permissions.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-workplace-tab',
  templateUrl: './workplace-tab.component.html',
})
export class WorkplaceTabComponent implements OnInit {
  @Input() workplace: Establishment;
  @Input() summaryReturnUrl: URLStructure = { url: ['/dashboard'], fragment: 'workplace' };
  @Input() showCqcRegistrationAlert: boolean;

  protected subscriptions: Subscription = new Subscription();

  public updateWorkplaceAlert: boolean;
  public showCqcRegistrationAlertBanner: boolean;

  constructor(private permissionsService: PermissionsService, private establishmentService: EstablishmentService) {}

  ngOnInit() {
    this.showCqcRegistrationAlertBanner = this.showCqcRegistrationAlert;

    this.updateWorkplaceAlert =
      !this.workplace.employerType && this.permissionsService.can(this.workplace.uid, 'canEditEstablishment');
  }
}
