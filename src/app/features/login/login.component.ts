import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormGroup, FormBuilder, Validators, AbstractControl } from '@angular/forms';

import { Router, ActivatedRoute } from '@angular/router';

//import { LoginUser } from './login-user';

import { MessageService } from "../../core/services/message.service"
import { AuthService } from '../../core/services/auth-service';
import { EstablishmentService } from "../../core/services/establishment.service"

import { LoginApiModel } from '../../core/model/loginApi.model';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit, OnDestroy {
  loginForm: FormGroup;
  //loginUser = new LoginUser();

  login: LoginApiModel;

  // Login values
  usernameValue: string;
  userPasswordValue: string;

  private subscriptions = []

  // Set up Validation messages
  usernameMessage: string;
  passwordMessage: string;

  constructor(
    private _loginService: AuthService,
    private establishmentService: EstablishmentService,
    private messageService: MessageService,
    private router: Router,
    private route: ActivatedRoute,
    private fb: FormBuilder) {}

  // Get user fullname
  get getUsernameInput() {
    return this.loginForm.get('username');
  }

  // Get user job title
  get getPasswordInput() {
    return this.loginForm.get('password');
  }

  ngOnInit() {
    this.loginForm = this.fb.group({
      username: ['', [Validators.required, Validators.maxLength(120)]],
      password: ['', [Validators.required, Validators.maxLength(120)]]
    });

    this.subscriptions.push(
      this.loginForm.valueChanges.subscribe(value => {
        if (this.loginForm.valid) {
          this.messageService.clearError()
        }})
    )

    this.subscriptions.push(
      this._loginService.auth$.subscribe(login => this.login = login))
  }

  onSubmit() {
    this.usernameValue = this.getUsernameInput.value;
    this.userPasswordValue = this.getPasswordInput.value;

    if (this.loginForm.invalid) {
      this.messageService.clearError()
      this.messageService.show("error", "Please fill the required fields.")
    }
    else {
      this.save();
    }
  }

  save() {
    this.login.username = this.usernameValue;
    this.login.password = this.userPasswordValue;
    this.messageService.clearError()

    this.subscriptions.push(
    this._loginService.postLogin(this.login)
      .subscribe(
        (response) => {
          this._loginService.updateState(response.body);

          // // update the establishment service state with the given establishment oid
          this.establishmentService.establishmentId = response.body.establishment.id;

          // store the authorization token
          localStorage.setItem("auth-token", response.headers.get('authorization'))
          localStorage.setItem("auth-token-expiry", response.body.expiryDate)
        },
        (err) => {
<<<<<<< HEAD
          // TODO - better handling and display of errors
          console.log(err.error);
=======
          const message = err.friendlyMessage || "Invalid username or password."
          this.messageService.show("error", message)
>>>>>>> a0d1253fe67b06ed748275c3bec97270b3a1c9fa
        },
        () => {
          this.router.navigate(['/welcome']);
        }
      ))
  }

  ngOnDestroy() {
    this.subscriptions.forEach(s => s.unsubscribe())
    this.messageService.clearAll()
  }
}
