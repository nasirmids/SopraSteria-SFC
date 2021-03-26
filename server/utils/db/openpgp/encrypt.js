const openpgp = require('openpgp');
var config = require('../../../../server/config/config');
const textEncoding = require('text-encoding-utf-8');

global.TextEncoder = textEncoding.TextEncoder;
global.TextDecoder = textEncoding.TextDecoder;

const encrypt = async (message) => {
  if (!message) {
    return null;
  }

  try {
    const publicKeyArmored = config.get('encryption.publicKey');
    const publicKey = await openpgp.readKey({ armoredKey: publicKeyArmored });

    const encryptedData = await openpgp.encrypt({
      message: openpgp.Message.fromText(message), // input as Message object
      publicKeys: publicKey, // for encryption
    });
    return encryptedData;
  } catch (e) {
    console.log(e);
    return null;
  }
};

module.exports.encrypt = encrypt;
