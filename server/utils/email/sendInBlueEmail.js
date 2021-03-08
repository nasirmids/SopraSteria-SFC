const SibApiV3Sdk = require('sib-api-v3-sdk');
const config = require('../../config/config');
const defaultClient = SibApiV3Sdk.ApiClient.instance;

const apiKey = defaultClient.authentications['api-key'];
apiKey.apiKey = config.get('sendInBlue.apiKey');

const sendEmail = async (to, templateId, params) => {
  try {
    const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();

    sendSmtpEmail.to = [to];
    sendSmtpEmail.templateId = templateId;
    sendSmtpEmail.params = params;

    await apiInstance.sendTransacEmail(sendSmtpEmail);
  } catch (error) {
    console.log(error);
    throw new Error(error);
  }
};

exports.sendEmail = sendEmail;