const sequelize = require('./db');
const {DataTypes} = require('sequelize');

const User = sequelize.define( 'user', {
    id: {type: DataTypes.INTEGER, primaryKey: true, unique: true, autoIncrement: true},
    chatId: {type: DataTypes.INTEGER, unique:true},
    right: {type: DataTypes.INTEGER, defaultValue: 0},
    wrong: {type: DataTypes.INTEGER, defaultValue: 0},
    lastCommand: {type: DataTypes.INTEGER, defaultValue: 'отсутствует'},
    prelastCommand: {type: DataTypes.INTEGER, defaultValue: 'отсутствует'},
})

module.exports = User;