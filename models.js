const sequelize = require('./db');
const {DataTypes} = require('sequelize');

const UserModel = sequelize.define( 'user', {
    id: {type: DataTypes.SMALLINT, primaryKey: true, unique: true, autoIncrement: true},
    chatId: {type: DataTypes.BIGINT, unique:true},
    right: {type: DataTypes.SMALLINT, defaultValue: 0},
    wrong: {type: DataTypes.SMALLINT, defaultValue: 0},
    firstName: {type: DataTypes.CHAR,},
    lastName: {type: DataTypes.CHAR},
    nickname: {type: DataTypes.CHAR},
    email: {type: DataTypes.CHAR},
    brand: {type: DataTypes.CHAR},
    vendorCode: {type: DataTypes.CHAR},
    typeFind: {type: DataTypes.TEXT('tiny')},
})

module.exports = UserModel;