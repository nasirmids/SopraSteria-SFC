const config = require('../../config/config');
const uuid = require('uuid');

const GovNotifyClient = require('notifications-node-client').NotifyClient;
const notifyClient = new GovNotifyClient(config.get('notify.key'));

const REPLY_TO_ID = config.get('notify.replyTo');

exports.sendPasswordReset = async (emailAddress, name, resetUuid) => {
  const RESET_UUID = uuid.v4();
  if (
      config.get('notify.key') === 'unknown' ||
      config.get('notify.replyTo') === '80d54020-c420-46f1-866d-b8cc3196809d' ||
      config.get('notify.templates.resetPassword') === '80d54020-c420-46f1-866d-b8cc3196809d'
     ) {
    // gov.uk notify is not configured
    // intentionally living this comment (as assist with supporting in production environment)
    console.log("INFO - gov.uk notify is not configured");
    return;
  }

  try {
    const response = await notifyClient.sendEmail(
      config.get('notify.templates.resetPassword'),
      emailAddress,
      {
          personalisation: {
              name,
              resetUuid
          },
          reference: config.get('env') + '-password-reset-' + uuid.v4(),
          emailReplyToId: REPLY_TO_ID
      }
    )

    // intentionally living this comment (as assist with supporting in production environment)
    console.log('Successfully sent (requested) email to: ', emailAddress);
  
  } catch (err) {
    // localise the exception - failing to send the email should not cause the calling API endpoint to fail
    console.error('FAILED to send (requets) email to: ', emailAddress);
  }
};