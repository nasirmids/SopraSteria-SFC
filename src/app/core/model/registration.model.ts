
export interface RegistrationModel {
  success: number;
  message: string;
  detailsChanged: boolean;
  locationdata: [{
    locationId: string;
    locationName: string;
    addressLine1: string;
    addressLine2: string;
    townCity: string;
    county: string;
    postalCode: string;
    mainService: string;
    isRegulated: boolean;
    user: {
      fullname: string;
      jobTitle: string;
      emailAddress: string;
      contactNumber: string;
      username: string;
      password: string;
      securityQuestion: string;
      securityAnswer: string;
    }
  }];
  //  fullname: string;
  //  jobTitle: string;
  //  emailAddress: string;
  //  contactNumber: string;
  //  username: string;
  //  password: string;
  //  securityQuestion: string;
  //  securityAnswer: string;
  //}],

}

