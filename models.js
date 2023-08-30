const sequelize = require('./db');
const {DataTypes} = require('sequelize');

const UserModel = sequelize.define( 'user', {
    id: {type: DataTypes.SMALLINT, primaryKey: true, unique: true, autoIncrement: true},
    chatId: {type: DataTypes.BIGINT, unique:true},
    right: {type: DataTypes.SMALLINT, defaultValue: 0},
    wrong: {type: DataTypes.SMALLINT, defaultValue: 0},
    firstName: {type: DataTypes.TEXT('tiny')},
    lastName: {type: DataTypes.TEXT('tiny')},
    nickname: {type: DataTypes.TEXT('tiny')},
    email: {type: DataTypes.TEXT('tiny')},
    brand: {type: DataTypes.TEXT('tiny')},
    vendorCode: {type: DataTypes.TEXT('tiny')},
    reserveNumber: {type: DataTypes.SMALLINT},
    catalog: {type: DataTypes.TEXT('tiny')},
    vendor: {type: DataTypes.TEXT('tiny')},
    vendorEmail: {type: DataTypes.TEXT('tiny')},
})

/*
const BrandModel = sequelize.define( 'brand', {
    id: {type: DataTypes.SMALLINT, primaryKey: true, unique: true, autoIncrement: true},
    brand: {type: DataTypes.TEXT('tiny')},
    provider: {type: DataTypes.TEXT},
    link: {type: DataTypes.TEXT},

})
*/

module.exports = UserModel;
//module.exports = BrandModel;