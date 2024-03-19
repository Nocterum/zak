const sequelize = require('./db');
const {DataTypes} = require('sequelize');

const UserModel = sequelize.define( 'user', {
    id: {type: DataTypes.SMALLINT, primaryKey: true, unique: true, autoIncrement: true},
    chatId: {type: DataTypes.BIGINT, unique:true},
    firstName: {type: DataTypes.STRING},
    lastName: {type: DataTypes.STRING},
    nickname: {type: DataTypes.STRING},
    email: {type: DataTypes.STRING},
    brand: {type: DataTypes.STRING},
    vendorCode: {type: DataTypes.STRING},
    reserveNumber: {type: DataTypes.STRING},
    catalog: {type: DataTypes.STRING},
    vendor: {type: DataTypes.STRING},
    vendorEmail: {type: DataTypes.STRING},
    lastCommand: {type: DataTypes.STRING},
    subject: {type: DataTypes.TEXT},
    textMail: {type: DataTypes.TEXT},
    cookie: {type: DataTypes.TEXT},
    authToken: {type: DataTypes.TEXT},
    messageId: {type: DataTypes.TEXT},
})

module.exports = UserModel;