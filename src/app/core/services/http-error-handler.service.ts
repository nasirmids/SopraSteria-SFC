import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, isDevMode } from '@angular/core';
import { Router, RouterStateSnapshot } from '@angular/router';
import { throwError } from 'rxjs';

import { AuthService } from './auth.service';
import { MessageService } from './message.service';

@Injectable({
  providedIn: 'root',
})
export class HttpErrorHandler {
  constructor(
    private router: Router,
    private state: RouterStateSnapshot,
    private messageService: MessageService,
    private authService: AuthService
  ) {
    this.handleHttpError = this.handleHttpError.bind(this);
  }

  handleHttpError(error: HttpErrorResponse) {
    if (error.status === 403) {
      this.authService.redirect = this.state.url;
      this.authService.logout();
      return throwError('403');
    }

    if (error.status >= 500) {
      this.router.navigate(['/problem-with-the-service']);
    }

    const message = error.error ? error.error.message : 'Server error. Please try again later, sorry.';

    if (isDevMode()) {
      console.error('HTTP error', error);
    }

    this.messageService.show('error', message);
    return throwError(error);
  }
}
