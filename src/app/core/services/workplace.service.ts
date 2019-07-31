import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { LocationAddress } from '@core/model/location.model';
import { Service, ServiceGroup } from '@core/model/services.model';
import { AddWorkplaceRequest, AddWorkplaceResponse } from '@core/model/workplace.model';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class WorkplaceService {
  constructor(private http: HttpClient) {}
  public addWorkplaceInProgress$: BehaviorSubject<boolean> = new BehaviorSubject(false);
  public locationAddresses$: BehaviorSubject<Array<LocationAddress>> = new BehaviorSubject(null);
  public selectedLocationAddress$: BehaviorSubject<LocationAddress> = new BehaviorSubject(null);
  public selectedWorkplaceService$: BehaviorSubject<Service> = new BehaviorSubject(null);

  public isRegulated(location: LocationAddress): boolean {
    return location.isRegulated === true || location.locationId ? true : false;
  }

  public getServicesByCategory(isRegulated: boolean): Observable<Array<ServiceGroup>> {
    return this.http.get<Array<ServiceGroup>>(`/api/services/byCategory?cqc=${isRegulated}`);
  }

  public addWorkplace(establishmentuid: string, request: AddWorkplaceRequest): Observable<AddWorkplaceResponse> {
    return this.http.post<AddWorkplaceResponse>(`/api/establishment/${establishmentuid}`, request);
  }

  public addWorkplaceRequest(locationAddress: LocationAddress, workplace: Service): AddWorkplaceRequest {
    return {
      addressLine1: locationAddress.addressLine1,
      addressLine2: locationAddress.addressLine2,
      county: locationAddress.county,
      isRegulated: workplace.isCQC,
      locationName: locationAddress.locationName,
      mainService: workplace.name,
      postalCode: locationAddress.postalCode,
      townCity: locationAddress.townCity,
    };
  }
}
