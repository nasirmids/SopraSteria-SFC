/* jshint indent: 2 */
const models = require('./index');
var bcrypt = require('bcrypt-nodejs');

module.exports = function(sequelize, DataTypes) {
  const Login = sequelize.define('login', {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      autoIncrement: true,
      field: '"ID"'
    },
    registrationId: {
      type: DataTypes.TEXT,
      allowNull: false,
      unique: true,
      field: '"RegistrationID"'
    },
    username: {
      type: DataTypes.TEXT,
      allowNull: false,
      unique: true,
      field: '"Username"'
    },
   isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      field: '"Active"'
    },
    invalidAttempt: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: '"InvalidAttempt"'
    },
    firstLogin: {
      type: DataTypes.DATE,
      allowNull: true,
      field: '"FirstLogin'
    },
    Hash: {
      type: DataTypes.TEXT,
      allowNull: false,
      field: "Hash"
    },
    passwdLastChanged: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      allowNull: false,
      field: '"PasswdLastChanged'
    },
    lastLogin: {
      type: DataTypes.DATE,
      allowNull: true,
      field: '"LastLoggedIn"'
    }
  }, {
    tableName: '"Login"',
    schema: 'cqc',
    createdAt: false,
    updatedAt: false
  });

  // uses the current 
  Login.prototype.hashPassword = function () {
    return bcrypt.hashSync(this.password, bcrypt.genSaltSync(10), null);
  };

  Login.prototype.comparePassword = function (passw, cb) {

    bcrypt.compare(passw, this.Hash, function (err, isMatch) {
     // console.log("inside")
        if (err) {
            return cb(err);
        }
        cb(null, isMatch);
    });
  };
  Login.associate = (models) => {
    Login.belongsTo(models.user, {
      foreignKey: 'registrationId',
      targetKey: 'id'
    });
  };

  return Login;
};
