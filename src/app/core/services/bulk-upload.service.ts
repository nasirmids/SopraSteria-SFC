import { HttpClient, HttpHeaders, HttpResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { FormGroup } from '@angular/forms';
import {
  BulkUploadFileType,
  PresignedUrlResponseItem,
  PresignedUrlsRequest,
  ReportTypeRequestItem,
  UploadedFilesRequestToDownloadResponse,
  UploadedFilesResponse,
  ValidatedFile,
  ValidatedFilesResponse,
} from '@core/model/bulk-upload.model';
import { ErrorDefinition, ErrorDetails } from '@core/model/errorSummary.model';
import { Workplace } from '@core/model/my-workplaces.model';
import { URLStructure } from '@core/model/url.model';
import { EstablishmentService } from '@core/services/establishment.service';
import { BehaviorSubject, Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';

import { UserService } from './user.service';

@Injectable({
  providedIn: 'root',
})
export class BulkUploadService {
  private _workPlaceReferences$: BehaviorSubject<Workplace[]> = new BehaviorSubject(null);
  private returnTo$ = new BehaviorSubject<URLStructure>(null);
  public exposeForm$: BehaviorSubject<FormGroup> = new BehaviorSubject(null);
  public preValidationError$: BehaviorSubject<boolean> = new BehaviorSubject(null);
  public preValidateFiles$: BehaviorSubject<boolean> = new BehaviorSubject(null);
  public selectedFiles$: BehaviorSubject<File[]> = new BehaviorSubject(null);
  public serverError$: BehaviorSubject<string> = new BehaviorSubject(null);
  public uploadedFiles$: BehaviorSubject<ValidatedFile[]> = new BehaviorSubject(null);
  public validationErrors$: BehaviorSubject<Array<ErrorDefinition>> = new BehaviorSubject(null);

  constructor(
    private http: HttpClient,
    private establishmentService: EstablishmentService,
    private userService: UserService
  ) {}

  public get workPlaceReferences$() {
    if (this._workPlaceReferences$.value !== null) {
      return this._workPlaceReferences$.asObservable();
    }
    return this.userService.getEstablishments().pipe(
      map(response => {
        const references = [];
        if (response.primary) {
          references.push(response.primary);
        }
        if (response.subsidaries) {
          references.push(...response.subsidaries.establishments);
        }
        return references;
      }),
      tap(references => {
        this._workPlaceReferences$.next(references);
      })
    );
  }

  public get returnTo(): URLStructure {
    return this.returnTo$.value;
  }

  public setReturnTo(returnTo: URLStructure): void {
    this.returnTo$.next(returnTo);
  }

  public getPresignedUrls(payload: PresignedUrlsRequest): Observable<PresignedUrlResponseItem[]> {
    return this.http.post<PresignedUrlResponseItem[]>(
      `/api/establishment/${this.establishmentService.establishmentId}/bulkupload/uploaded`,
      payload
    );
  }

  public uploadFile(file: File, signedURL: string): Observable<any> {
    const headers = new HttpHeaders({ 'Content-Type': file.type });
    return this.http.put(signedURL, file, { headers, reportProgress: true, observe: 'events' });
  }

  public getFileType(fileName: string): string {
    const parts: Array<string> = fileName.split('.');
    return parts[parts.length - 1].toUpperCase();
  }

  public preValidateFiles(establishmentId: number): Observable<ValidatedFile[]> {
    return this.http.put<ValidatedFile[]>(`/api/establishment/${establishmentId}/bulkupload/uploaded`, null);
  }

  public getUploadedFiles(establishmentId: number): Observable<ValidatedFile[]> {
    return this.http
      .get<UploadedFilesResponse>(`/api/establishment/${establishmentId}/bulkupload/uploaded`)
      .pipe(map(response => response.files));
  }

  public getUploadedFileSignedURL(establishmentId: number, key: string): Observable<string> {
    return this.http
      .get<UploadedFilesRequestToDownloadResponse>(`/api/establishment/${establishmentId}/bulkupload/uploaded/${key}`)
      .pipe(map(response => response.file.signedUrl));
  }

  public validateFiles(establishmentId: number): Observable<ValidatedFilesResponse> {
    return this.http.put<ValidatedFilesResponse>(`/api/establishment/${establishmentId}/bulkupload/validate`, null);
  }

  public getReport(establishmentId: number, reportType: ReportTypeRequestItem): Observable<HttpResponse<Blob>> {
    return this.http.get<Blob>(`/api/establishment/${establishmentId}/bulkupload/report/${reportType}`, {
      observe: 'response',
      responseType: 'blob' as 'json',
    });
  }

  public getDataCSV(establishmentId: number, type: BulkUploadFileType): Observable<any> {
    let url: string;
    // TODO: Would love for this ENUM to be consistent across BE endpoints,
    //       we currently have Establishment, establishments, Workplace,
    //       Staff, workers, Training, training cross multiple endpoints and types
    switch (type) {
      case BulkUploadFileType.Establishment:
        url = 'establishments';
        break;
      case BulkUploadFileType.Worker:
        url = 'workers';
        break;
      case BulkUploadFileType.Training:
        url = 'training';
        break;
    }
    return this.http.get<Blob>(`/api/establishment/${establishmentId}/bulkupload/download/${url}`, {
      observe: 'response',
      responseType: 'blob' as 'json',
    });
  }

  public complete(establishmentId: number) {
    return this.http.post(`/api/establishment/${establishmentId}/bulkupload/complete`, null);
  }

  public resetBulkUpload(): void {
    this.uploadedFiles$.next(null);
    this.validationErrors$.next(null);
    this.serverError$.next(null);
  }

  public formErrorsMap(): Array<ErrorDetails> {
    return [
      {
        item: 'fileUpload',
        type: [
          {
            name: 'required',
            message: 'No files selected',
          },
          {
            name: 'filecount',
            message: 'Please select between 2 and 3 files.',
          },
          {
            name: 'filesize',
            message: 'The selected files must be smaller than 20MB.',
          },
          {
            name: 'filetype',
            message: 'The selected files must be a CSV or ZIP.',
          },
          {
            name: 'prevalidation',
            message: 'Please ensure both workplace and staff files are uploaded.',
          },
        ],
      },
    ];
  }

  public serverErrorsMap(): Array<ErrorDefinition> {
    return [
      {
        name: 400,
        message: 'Validation failed.',
      },
      {
        name: 503,
        message: 'There is a problem with the service.',
      },
    ];
  }
}
