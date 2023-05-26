const sequelize = require('./db');
const {DataTypes} = require('sequelize');

const UserModel = sequelize.define( 'user', {
    id: {type: DataTypes.INTEGER, primaryKey: true, unique: true, autoIncrement: true},
    chatId: {type: DataTypes.INTEGER, unique:true},
    right: {type: DataTypes.INTEGER, defaultValue: 0},
    wrong: {type: DataTypes.INTEGER, defaultValue: 0},
    firstName: {type: DataTypes.CHAR, defaultValue: 'отсутствует'},
    lastName: {type: DataTypes.CHAR, defaultValue: 'отсутствует'},
    lastCommand: {type: DataTypes.CHAR, defaultValue: 'отсутствует'},
    preLastCommand: {type: DataTypes.CHAR, defaultValue: 'отсутствует'},
    brand: {type: DataTypes.CHAR, defaultValue: 'отсутствует'},
    vendorCode: {type: DataTypes.CHAR, defaultValue: 'отсутствует'},
})

module.exports = UserModel;