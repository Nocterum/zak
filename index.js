const TelegramApi = require('node-telegram-bot-api');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');
const token = '6076442091:AAGUxzIT8C7G7_hx4clixZpIi0Adtb2p2MA';
const bot = new TelegramApi(token, {
    polling: {
        interval: 300, //между запросами с клиента на сервер тг "млсек"
        autoStart: true, //обработка всех команд отправленных до запуска программы
        params: {
            timeout:10 //таймаут между запросами "млсек"
        }
    }
});

//ИМПОРТЫ
const {gameOptions, againOptions, resetOptions,
     workOptions, VCOptions, startFindOptions, startFind2Options, 
     beginWorkOptions, beginWork2Options, mainMenuOptions, 
     enterReserveNumberOptions, sendReserveOptions, beginWork3Options} = require('./options');
const sequelize = require('./db');
const UserModel = require('./models');
const {transporter, recipient} = require('./nodemailer');
const clientRDP = require('./rdp');
const nodemailer = require('./nodemailer');
//const BrandModel = require('./models');

//ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
password = {};
chats = {};
let backLc = '/mainmenu'; //предпоследняя команда для опции "назад"
lc = {};    //последняя команда
findCatalogIndex = {};   //состояние: нужно ли зайдествовать функцию поиска каталога текстиля.
botMsgIdx = {};    //айди последнего сообщения от бота
sorry = 'Извините, я этому пока ещё учусь😅\nПрошу вас, обратитесь с данным запросом к\npurchasing_internal@manders.ru';
let subject = {};   //тема письма
let textMail = {};  //текст письма

module.exports = backLc;

//МЕНЮ КОМАНД
bot.setMyCommands([
    {command: '/mainmenu', description:'Главное меню'},
    {command: '/beginwork', description:'Начало работы'},
    {command: '/infowork', description:'Проверка введенных параметров'},
])

//ФУНКЦИИ=========================================================================================

// Функция ввода емейла
const editEmail = async (chatId) => {
    lc = '/editEmail'
    return bot.sendMessage(chatId, `Можете ввести Ваш рабочий e-mail:`)
}

// Функция ввода никнейма
const editNickname = async (chatId) => {
    lc = '/editNickname'
    return bot.sendMessage(chatId, `Можете ввести Ваш никнейм:`)
}

const startRequest1C = async (chatId) => {
    try {
        
        const search = 'http://post.manders.ru:10001/QuantityProduct.php';

        
        const axiosPost = await axios.post(search, {
            Артикул: 'PLGUM5'
        });
        
        const response = await axios.get(search);
        
        await bot.sendmessage(chatId, '');
        const $ = cheerio.load(response.data);
        const results = $('');

    } catch (e) {
        console.log(e);
    }
}

// Функция html запроса по данным из БД
const startFind = async (chatId) => {
    lc = '/enterVC';

    const user = await UserModel.findOne({
        where: {
            chatId: chatId
        }
    });

    try {

        //Формируем URL для поиска
        const searchUrl = `https://opusdeco.ru/search/?type=catalog&q=${user.brand}+${user.vendorCode}`;
        console.log('сформированна ссылка');

        //Отправляем запрос на сайт
        const response = await axios.get(searchUrl);
        const $ = cheerio.load(response.data);
        console.log('запрос на сайт отправлен');

        //Создаём переменную с ссылкой на первый товар из поиска 
        const firstProductLink = $('h3.item__card__title.card-product-general__title.mb-2 a').attr('href');

        if (firstProductLink) {
            // Переходим на страницу товара
            const productResponse = await axios.get(`https://opusdeco.ru${firstProductLink}`);
            const $$ = cheerio.load(productResponse.data);
            console.log('успешно зашёл на страницу товара');
            
            // Создаем пустую строку для хранения текстового содержимого таблицы
            let availabilityContent = ``;
            // Создаем пустую строку для хранения текстового содержимого таблицы ожидаемого поступления
            let expectedArrivalContent = ``;

            const modalBody = $$('#stockAvailabilityModal .modal-body');
            // Находим таблицу с наличием товара
            const availabilityTable = modalBody.find('table').eq(0);
            // Находим таблицу ожидаемого поступления
            const expectedArrivalTable = modalBody.find('table').eq(1);
            // Находим строки с данными о наличии товара
            const rowsValueAV = availabilityTable.find('tbody tr');
            // Находим строки с данными о поступлении товара
            const rowsValueEX = expectedArrivalTable.find('tbody tr');


            //Итерируем по строкам таблицы наличия товара
            availabilityTable.each((index, row) => {

                const rowsNames = $$(row).find('thead tr');
                const names = $$(rowsNames).find('th[scope=col]');
                
                rowsValueAV.each((index, rowValue) => {
                    const cells = $$(rowValue).find('td');
                
                // Присваиваим переменным соответствующие наименования
                availabilityContent += 'Наличие на складе:\n';
                availabilityContent += `${$$(names[0]).text()}: <pre>${$$(cells[0]).text()}</pre>\n`;
                availabilityContent += `${$$(names[1]).text()}: ${$$(cells[1]).text()}\n`;
                availabilityContent += `${$$(names[2]).text()}: ${$$(cells[2]).text()}\n`;
                availabilityContent += `${$$(names[3]).text()}: ${$$(cells[3]).text()}\n\n`;
            });
        });

            //Итерируем по строкам таблицу 
            expectedArrivalTable.each((index, row) => {
                
                const rowsNames = $$(row).find('thead tr');
                const names = $$(rowsNames).find('th[scope=col]');

                rowsValueEX.each((index, rowValue) => {
                    const cells = $$(rowValue).find('td');
                
                // Присваиваим переменным соответствующие наименования
                expectedArrivalContent += `Ожидаемое поступление:\n`;
                expectedArrivalContent += `${$$(names[0]).text()}: <pre>${$$(cells[0]).text()}</pre>\n`;
                expectedArrivalContent += `${$$(names[1]).text()}: ${$$(cells[1]).text()}\n`;
                expectedArrivalContent += `${$$(names[2]).text()}: ${$$(cells[2]).text()}\n`;
                expectedArrivalContent += `${$$(names[3]).text()}: ${$$(cells[3]).text()}\n\n`;
            });
        });

            await bot.deleteMessage(chatId, botMsgIdx);
            // Проверяем наличие таблицы
            if (availabilityTable.length === 0) {

                if (expectedArrivalTable.length === 1) {
                    // Отправляем информацию о поставках товара
                    bot.sendMessage(chatId, `${expectedArrivalContent}`, startFindOptions);
                    console.log('информация о поставках при отсутсвии наличия, успешно отправлена');
                    return;

                } else {

                    // Отправляем сообщение о отсутствии товара
                    bot.sendMessage(chatId, 'В данный момент товар отсутствует на складе поставщика', startFindOptions);
                    console.log('информация об отсутствии товара отправленна');
                    return;
                }
            }
                
            if (expectedArrivalTable.length === 0) {
                // Отправляем информацию о наличии товара
                bot.sendMessage(chatId, `${availabilityContent}`, startFindOptions);
                console.log('информация о наличии успешно отправлена');
                return;
            }
            
            if (availabilityTable !== expectedArrivalTable) {
            bot.sendMessage(chatId, `${availabilityContent}${expectedArrivalContent}`, startFindOptions);
            console.log('информация о наличии и поставках успешно отправленна');
            return;
            }

        } else {
            await bot.deleteMessage(chatId, botMsgIdx);
            bot.sendMessage(chatId, 'Товары не найдены. Проверьте правильное написание артикула и бренда.', startFindOptions);
            return;
        }

    } catch (e) {
        console.log('Ошибка при выполнении запроса', e);
        bot.sendMessage(chatId, 'Произошла ошибка при выполнении запроса.', startFindOptions);
        return bot.deleteMessage(chatId, botMsgIdx);
    }
   
}

// Функция отправки емейла с запросом на резервирование
const sendReserveEmail = async (chatId) => {

    const user = await UserModel.findOne({
        where: {
            chatId: chatId
        }
    });
    //
    const copy = `${user.email}`;   //ВАЖНО: Ставить в копию только     purchasing_internal@manders.ru

    try {

        let result = transporter.sendMail({
            from: 'zakupki_bot@manders.ru',
            to: `${recipient}, ${copy}`,
            subject: subject,
            text: textMail,
        });
        
        console.log(result);
        bot.sendMessage(chatId, `Сообщение с темой: \n<pre>"${subject}"</pre>\nуспешно отправлено поставщику и в отдел закупок.\n\nЧтобы узнать о состоянии резерва напишите письмо с вышеупомянутой темой на <b>purchasing_internal@manders.ru</b>.`, beginWork2Options)

      } catch (e) {
        console.error(e);
        throw new Error('Ошибка при отправке е-мейла');
    }
}

// Функция для поиска эксель файла
async function findExcelFile(
    fileNameWallpaper = '', 
    fileNameTextile = '', 
    fileNamePricelist = '',
    fileNameOracMSK = '', 
    fileNameOracSPB = '',
    fileNameVendor = ''
    ) {
    const folderPath = '/root/zak/xl';
    const files = await fs.promises.readdir(folderPath);

    for (const file of files) {

        const filePath = path.join(folderPath, file);
        const stat = await fs.promises.stat(filePath);

        if (stat.isDirectory()) {

            const result = await findExcelFile(filePath, 
                fileNameWallpaper, 
                fileNameTextile, 
                fileNamePricelist, 
                fileNameOracMSK, 
                fileNameOracSPB,
                fileNameVendor
                );

            if (result.fileNameWallpaper) {
                fileNameWallpaper = result.fileNameWallpaper;
            }
            if (result.fileNameTextile) {
                fileNameTextile = result.fileNameTextile;
            }
            if (result.fileNamePricelist) {
                fileNamePricelist = result.fileNamePricelist;
            }
            if (result.fileNameOracMSK) {
                fileNameOracMSK = result.fileNameOracMSK;
            }
            if (result.fileNameOracSPB) {
                fileNameOracSPB = result.fileNameOracSPB;
            }
            if (result.fileNameVendor) {
                fileNameVendor = result.fileNameVendor;
            }
        } else if (path.extname(file) === '.xlsx') {
            if (file.toLowerCase().includes('каталоги_распределение_в_салоны_26_09_19')) {
                fileNameWallpaper = filePath;
            } else if (file.toLowerCase().includes('текстиль_каталоги_распределение_в_салоны')) {
                fileNameTextile = filePath;
            } else if (file.toLowerCase().includes('список_прайслистов')) {
                fileNamePricelist = filePath;
            } else if (file.toLowerCase().includes('остатки_мск')) {
                fileNameOracMSK = filePath;
            } else if (file.toLowerCase().includes('остатки_спб')) {
                fileNameOracSPB = filePath;
            } else if (file.toLowerCase().includes('список_поставщиков')) {
                fileNameVendor = filePath;
            }
        }
        if (fileNameWallpaper && 
            fileNameTextile && 
            fileNamePricelist && 
            fileNameOracMSK &&
            fileNameOracSPB && 
            fileNameVendor
            ) {
            break;
        }
    }
    return { 
        fileNameWallpaper, 
        fileNameTextile, 
        fileNamePricelist, 
        fileNameOracMSK,
        fileNameOracSPB,
        fileNameVendor
    };
}


// Функция поиска артикула ORAC
async function findOrac(chatId) {
    
    let fileNameOracMSK = 'остатки_мск.xlsx';
    fileNameOracMSK = fileNameOracMSK.toLowerCase();
    
    let fileNameOracSPB = 'остатки_спб.xlsx';
    fileNameOracSPB = fileNameOracSPB.toLowerCase();
    
    const resultMSK = await findExcelFile(fileNameOracMSK);
    const resultSPB = await findExcelFile(fileNameOracSPB);
    
    const filePathMSK = resultMSK.fileNameOracMSK;
    const filePathSPB = resultSPB.fileNameOracSPB;
    
    let messageORAC = '';
    
    const user = await UserModel.findOne({
        where: {
            chatId: chatId
        }
    });
    
    if (filePathMSK) {
        try {
            
            const workbookMSK = new ExcelJS.Workbook();
            const streamMSK = fs.createReadStream(filePathMSK);
            const worksheetMSK = await workbookMSK.xlsx.read(streamMSK);
            const firstWorksheetMSK = worksheetMSK.worksheets[0];
            
            let foundMatchOracMSK = false;
            
            firstWorksheetMSK.eachRow( async (row, rowNumber) => {
                const cellValue = row.getCell('A').value; //Артикул
                const formatedCellValue = cellValue.toString().trim();
                const formatedUserVC = user.vendorCode.toString().trim();
                
                if (formatedCellValue === formatedUserVC) {
                    foundMatchOracMSK = true;

                    const bValue = row.getCell('B').value; //Еденицы измерения
                    const cValue = row.getCell('C').value; //Колличество
                    let a3Value = firstWorksheetMSK.getCell('A3').value; //Название склада
                    a3Value = a3Value.toString().split( "(" )[0];
                    
                    messageORAC += `Артикул <b>${cellValue}</b> имеется на складе <b>${a3Value}</b>\nв колличестве <b>${cValue}</b> <b>${bValue}</b>\n\n`;
                    
                    if (botMsgIdx !== null) {
                        bot.deleteMessage(chatId, botMsgIdx);
                        botMsgIdx = null;
                    }
                }
                
            });

            if (!foundMatchOracMSK) {

                if (botMsgIdx !== null) {
                    bot.deleteMessage(chatId, botMsgIdx);
                    botMsgIdx = null;
                }

                messageORAC += `На складе в Москве артикул <b>${user.vendorCode}</b> отсутсвует.\n\n`;
            }

        } catch (error) {
            console.error(`Ошибка при чтении файла ${filePathMSK}:`, error); 
        }
    }

    if (filePathSPB) {
        try {

            const workbookSPB = new ExcelJS.Workbook();
            const streamSPB = fs.createReadStream(filePathSPB);
            const worksheetSPB = await workbookSPB.xlsx.read(streamSPB);
            const firstWorksheetSPB = worksheetSPB.worksheets[0];

            let foundMatchOracSPB = false;

            firstWorksheetSPB.eachRow( async (row, rowNumber) => {
                const cellValue = row.getCell('A').value; //Артикул
                const formatedCellValue = cellValue.toString().trim();
                const formatedUserVC = user.vendorCode.toString().trim();
                
                if (formatedCellValue === formatedUserVC) {
                    foundMatchOracSPB = true;
                    const cValue = row.getCell('C').value; //Еденицы измерения
                    const dValue = row.getCell('D').value; //Колличество
                    let a3Value = firstWorksheetSPB.getCell('A3').value; //Название склада
                    a3Value = a3Value.toString().split( "(" )[0];
                    
                    messageORAC += `Артикул <b>${cellValue}</b> имеется на складе <b>${a3Value}</b>\nв колличестве <b>${dValue}</b> <b>${cValue}</b>\n\n`;
                    
                    if (botMsgIdx !== null) {
                        bot.deleteMessage(chatId, botMsgIdx);
                        botMsgIdx = null;
                    }
                }

            });
            
            if (!foundMatchOracSPB) {
                
                if (botMsgIdx !== null) {
                    bot.deleteMessage(chatId, botMsgIdx);
                    botMsgIdx = null;
                }
                
                messageORAC += `На складе в Санкт-Петербурге артикул <b>${user.vendorCode}</b> отсутсвует.\n\n`;
            }
            
        } catch (error) {
            console.error(`Ошибка при чтении файла ${filePathSPB}:`, error); 
        }
    }
    messageORAC += `<strong><u>Если вы хотите заказать товар через 2 склада поставщика для 1ого клиента, то делайте 2 ЗАКАЗА ПОСТАВЩИКУ!!</u></strong>\n\n<strong>ВАЖНО</strong>: максимальный срок для возврата = НЕ более 5 месяцев (от даты доставки товара на наш склад)\n`;
    return bot.sendMessage(chatId, messageORAC, { parse_mode: "HTML" });
    
};

//Функция поиска каталога обоев
async function findCatalogWallpaper(chatId) {

    let fileNameWallpaper = 'Каталоги_распределение_в_салоны_26_09_19.xlsx';
    fileNameWallpaper = fileNameWallpaper.toLowerCase();
    const result = await findExcelFile(fileNameWallpaper);
    const filePath = result.fileNameWallpaper;

    if (filePath) {

        const user = await UserModel.findOne({
            where: {
              chatId: chatId
            }
        });

        try { 

            const workbook = new ExcelJS.Workbook();
            const stream = fs.createReadStream(filePath);
            const worksheet = await workbook.xlsx.read(stream);
            const firstWorksheet = worksheet.worksheets[0];

            let foundMatchWallpaper = false;

            firstWorksheet.eachRow( async (row, rowNumber) => {
                const cellValue = row.getCell('D').value;
                if (cellValue !== null) {

                    const formatedCellValue = cellValue.toString().split("/")[0].replace(/\s/g, '').toLowerCase();
                    const formatedUserCatalog = user.catalog.toString().replace(/\s/g, '').toLowerCase();
                    
                    if (formatedCellValue.includes(formatedUserCatalog)) {
                        foundMatchWallpaper = true;
                        let message = '';
                        
                        let cValue = row.getCell('C').value.toString();
                        const hValue = row.getCell('H').value;
                        const iValue = row.getCell('I').value;
                        const jValue = row.getCell('J').value;
                        const kValue = row.getCell('K').value;
                        const mValue = row.getCell('M').value;
                        const nValue = row.getCell('N').value;
                        const oValue = row.getCell('O').value;
                        const pValue = row.getCell('P').value;
                        await user.update({brand: cValue.toUpperCase()});
                        let messagePrice = await findPricelistLink(chatId, cValue);
                        
                        if (
                            hValue !== null ||
                            iValue !== null ||
                            jValue !== null ||
                            kValue !== null ||
                            mValue !== null || 
                            nValue !== null
                            ) {
                                const h1Value = firstWorksheet.getCell('H1').value;
                                const i1Value = firstWorksheet.getCell('I1').value;
                                const j1Value = firstWorksheet.getCell('J1').value;
                                const k1Value = firstWorksheet.getCell('K1').value;
                                const m1Value = firstWorksheet.getCell('M1').value;
                                const n1Value = firstWorksheet.getCell('N1').value;
                                const p1Value = firstWorksheet.getCell('P1').value;
                                const o1Value = firstWorksheet.getCell('O1').value;

                            message += `<b>${cellValue.trim()}</b> бренда <b>${cValue.toUpperCase()}</b> имеется в следующих магазинах:\n`;
                            
                            if (hValue !== null) {
                                message += `${h1Value}: ${hValue}\n`;
                            }
                            if (iValue !== null) {
                                message += `${i1Value}: ${iValue}\n`;
                            }
                            if (jValue !== null) {
                                message += `${j1Value}: ${jValue}\n`;
                            }
                            if (kValue !== null) {
                                message += `${k1Value}: ${kValue}\n`;
                            }
                            if (mValue !== null) {
                                message += `${m1Value}: ${mValue}\n`;
                            }
                            if (nValue !== null) {
                                message += `${n1Value}: ${nValue}\n`;
                            }
                            if (pValue !== null) {
                                message += `${p1Value}: ${pValue}\n`;
                            }
                            if (oValue !== null) {
                                message += `${o1Value}: ${oValue}\n`;
                            }
                            message += `\n${messagePrice}`
                            
                            if (botMsgIdx !== null) {
                                bot.deleteMessage(chatId, botMsgIdx);
                                botMsgIdx = null;
                            }
                            await bot.sendMessage(chatId, message, beginWork3Options);
                        
                        } else {
                            if (botMsgIdx !== null) {
                                bot.deleteMessage(chatId, botMsgIdx);
                                botMsgIdx = null;
                            }
                            return bot.sendMessage(chatId, `Каталога в салонах нет.\nОбратитесь к Юлии Скрибника за уточнением возможности заказа данного артикула.\nskribnik@manders.ru\n+7 966 321-80-08\n\n${messagePrice}`, {parse_mode: 'HTML'});
                        }
                    }
                }
            });

            if (!foundMatchWallpaper) {
                return findCatalogTextile(chatId);
            }

        } catch (error) {
            console.error('Ошибка при чтении файла Excel:', error);
        }
    }
};

//Функция поиска каталога текстиля
async function findCatalogTextile(chatId) {

    let fileNameTextile = 'Текстиль_Каталоги_распределение_в_салоны.xlsx';
    fileNameTextile = fileNameTextile.toLowerCase();
    const result = await findExcelFile(fileNameTextile);
    const filePath = result.fileNameTextile;

    if (filePath) {

        const user = await UserModel.findOne({
            where: {
              chatId: chatId
            }
        });

        try { 

            const workbook = new ExcelJS.Workbook();
            const stream = fs.createReadStream(filePath);
            const worksheet = await workbook.xlsx.read(stream);
            const firstWorksheet = worksheet.worksheets[0];

            let foundMatchTextile = false;
            let message = '';

            firstWorksheet.eachRow( async (row, rowNumber) => {
                const cellValue = row.getCell('D').value;
                if (cellValue !== null) {

                    const formatedCellValue = cellValue.toString().split("/")[0].replace(/\s/g, '').toLowerCase();
                    const formatedUserCatalog = user.catalog.toString().replace(/\s/g, '').toLowerCase();
                
                    if (formatedCellValue.includes(formatedUserCatalog)) {
                        foundMatchTextile = true;
                        let message = '';

                        let cValue = row.getCell('C').value.toString();
                        const iValue = row.getCell('I').value;
                        const jValue = row.getCell('J').value;
                        const kValue = row.getCell('K').value;
                        const lValue = row.getCell('L').value;
                        const nValue = row.getCell('N').value;
                        const oValue = row.getCell('O').value;
                        const pValue = row.getCell('P').value;
                        await user.update({brand: cValue.toUpperCase()});
                        let messagePrice = await findPricelistLink(chatId, cValue);

                        if (iValue !== null ||
                            jValue !== null ||
                            kValue !== null ||
                            lValue !== null ||
                            nValue !== null || 
                            oValue !== null
                            ) {

                                const i1Value = firstWorksheet.getCell('I1').value;
                                const j1Value = firstWorksheet.getCell('J1').value;
                                const k1Value = firstWorksheet.getCell('K1').value;
                                const l1Value = firstWorksheet.getCell('L1').value;
                                const n1Value = firstWorksheet.getCell('N1').value;
                                const o1Value = firstWorksheet.getCell('O1').value;
                                const p1Value = firstWorksheet.getCell(`P1`).value;

                            message += `<b>${cellValue.trim()}</b> бренда <b>${cValue.toUpperCase()}</b> имеется в следующих магазинах:\n`;
                            if (iValue !== null) {
                                message += `${i1Value}: ${iValue}\n`;
                            }
                            if (jValue !== null) {
                                message += `${j1Value}: ${jValue}\n`;
                            }
                            if (kValue !== null) {
                                message += `${k1Value}: ${kValue}\n`;
                            }
                            if (lValue !== null) {
                                message += `${l1Value}: ${lValue}\n`;
                            }
                            if (nValue !== null) {
                                message += `${n1Value}: ${nValue}\n`;
                            }
                            if (oValue !== null) {
                              message += `${o1Value}: ${oValue}\n`;
                            }
                            if (pValue !== null) {
                                message += `${p1Value}: ${pValue}\n`;
                            }
                            message += `\n${messagePrice}`

                            if (botMsgIdx !== null) {
                                bot.deleteMessage(chatId, botMsgIdx);
                                botMsgIdx = null;
                            }
                            await bot.sendMessage(chatId, message, beginWork3Options);
                        } else {
                            if (botMsgIdx !== null) {
                                bot.deleteMessage(chatId, botMsgIdx);
                                botMsgIdx = null;
                            }
                            return bot.sendMessage(chatId, `Каталога в салонах нет.\nОбратитесь к Юлии Скрибника за уточнением возможности заказа данного артикула.\nskribnik@manders.ru\n+7 966 321-80-08\n\n${messagePrice}`, {parse_mode: 'HTML'});
                        }
                    }
                }
            });

            if (!foundMatchTextile) {
                if (botMsgIdx !== null) {
                    bot.deleteMessage(chatId, botMsgIdx);
                    botMsgIdx = null;
                }
                return bot.sendMessage(chatId, `Каталога в салонах нет.\nОбратитесь к Юлии Скрибника за уточнением возможности заказа данного артикула.\nskribnik@manders.ru\n+7 966 321-80-08\n\n`, {parse_mode: 'HTML'});
            }

        } catch (error) {
            console.error('Ошибка при чтении файла Excel:', error);
        }
    }
};

//Функция поиска ссылки на прайслист
async function findPricelistLink(chatId, cValue) {

    let fileNamePricelist = 'cписок_прайслистов.xlsx';
    fileNamePricelist = fileNamePricelist.toLowerCase();
    const result = await findExcelFile(fileNamePricelist);
    const filePath = result.fileNamePricelist;

    if (filePath) {

        const user = await UserModel.findOne({
            where: {
              chatId: chatId
            }
        });

        try { 

            const workbook = new ExcelJS.Workbook();
            const stream = fs.createReadStream(filePath);
            const worksheet = await workbook.xlsx.read(stream);
            const firstWorksheet = worksheet.worksheets[0];

            let foundMatchPricelist = false;
            let messagePrice = '';

            firstWorksheet.eachRow((row, rowNumber) => {
                const cellValue = row.getCell('B').value;
                if (cellValue !== null) {

                    const formatedCellValue = cellValue.toString().toUpperCase().replace(/[\s-]/g, '');
                    const formaterdCValue = cValue.toString().toUpperCase().replace(/[\s-]/g, '');
    
                    if (formatedCellValue.includes(formaterdCValue)) {
                        foundMatchPricelist = true;

                        const aValue = row.getCell('A').value;  // Поставщик
                        const bValue = row.getCell('B').value;  // Бренд
                        const cValue = row.getCell('C').value;  // Ссылка на прайслист
                        const dValue = row.getCell('D').value;
                        user.update({vendor: aValue.toUpperCase()});
                        if (dValue !== null) {
                        user.update({vendorEmail: dValue.toLowerCase()});
                        }

    
                        if (cValue !== null ) {
                            const formattedCValue = cValue.toString().replace(/\\/g, '\\');
                            messagePrice += `Ссылка на папку с прайс-листом бренда <b>${bValue.toUpperCase()}</b> поставщика <b>${aValue.toUpperCase()}</b>:<pre>${formattedCValue}</pre>`;
                        } else {
                            messagePrice += `Я пока не знаю в какой папке лежит прайс-лист бренда <b>${bValue.toUpperCase()}</b> поставщика <b>${aValue.toUpperCase()}</b>.😢\nЗапросите прайсы в отделе закупок.`
                        }
                    }
                }
            });

            if (!foundMatchPricelist) {
                messagePrice += `Прайс-лист по бренду <b>${user.brand}</b> в локальных файлах не найден.\nЗапросите прайсы в отделе закупок.`;
            }

            return messagePrice;
        } catch (error) {
            console.error('Ошибка при чтении файла Excel:', error);
        }
    }
};

// Функция поиска по бренду поставщика, ссылки на стоки и его почтового адреса
// async function findVendor(chatId) {

//     let fileNameVendor = 'список_поставщиков.xlsx';
//     fileNameVendor = fileNameVendor.toLowerCase();

//     const result = await findExcelFile(fileNameVendor);
//     const filePath = result.fileNameVendor;

//     const user = await UserModel.findOne({
//         where: {
//             chatId: chatId
//         }
//     });

//     if (filePath) {
//         try {

//             const workbook = new ExcelJS.Workbook();
//             const stream = fs.createReadStream(filePath);
//             const worksheet = await workbook.xlsx.read(stream);
//             const firstWorksheet = worksheet.worksheets[0];

//             let foundMatchBrand = false;

//             firstWorksheet.eachRow( async (row, rowNumber) => {
//                 const cellValue = row.getCell('C').value; // Бренд
//                 if (cellValue !== null) {
//                     const formatedCellValue = cellValue.toString().trim();
//                     const formatedUserBrand = user.brand.toString().trim();

//                     if (formatedCellValue.toLowerCase() === formatedUserBrand.toLowerCase()) {
//                         foundMatchBrand = true;

//                         const dValue = row.getCell('D').value; // Поставщик
//                         user.update({vendor: dValue.toUpperCase()});
//                         console.log ( `Поставщик бренда ${user.brand} = ${user.vendor}`);

//                     }
//                 }
//                 return;

//             });

//         } catch (e) {
//             return bot.sendMessage(chatId, `Ошибка при чтении файла ${filePath}.`)
//         }
//     }
// };

//СТАРТ РАБОТЫ ПРОГРАММЫ=============================================================================================================

const start = async () => {
    console.log('Бот запщуен...')

    try {
        await sequelize.authenticate();
        await sequelize.sync();
        console.log('Подключение к базе данных установленно');
    } catch(err) {
        console.log('Подключение к базе данных сломалось', err);
    }

//слушатель команд======================================================================================

//старт
bot.onText(/\/start/, async msg => {
    const chatId = msg.chat.id;

    try {

        let user = await UserModel.findOne({
            where: {
                chatId: chatId
            }
        });

        //главное меню
        if (user) {
            lc = null;
            return bot.sendMessage(
                chatId, 
                `И снова здравствуйте, ${user.nickname}!\n\nНачать работу: /beginwork,\nПроверить введенные данные: /infowork,\n\nИзменить e-mail: /editEmail,\nИзменить обращение /editNickname`
            );

        } else if (password === 'true') {
            user = await UserModel.create({chatId});
            console.log(`Новый пользователь создан: ${msg.from.first_name} ${msg.from.last_name}`);
             await user.update({
                firstName: msg.from.first_name, 
                lastName: msg.from.last_name, 
            });
            lc = '/editNickname';
            return bot.sendMessage(
                chatId, 
                `Приветcтвую, ${msg.from.first_name}! Меня зовут бот Зак.\nПриятно познакомиться!\nЯ могу подсказать наличие каталогов текстиля и обоев в магазинах, показать остатки продукции ORAC на складах в МСК и СПБ, производить поиск остатков на сайте поставщика ОПУС, а так же отправлять запросы в виде е-мейла на наличие, сроки поставки и резерв по многим российским поставщикам.\nКак я могу к вам обращаться?`
            );
        } else if (password !== 'true') {
            password = false;
            return bot.sendMessage(
                chatId, 
                `Введите пароль:`
            );
        }
     } catch (e) {
    console.log('Ошибка при создании нового пользователя', e);
    }

},

bot.onText(/\/game/, async msg => {
    const chatId = msg.chat.id;

    lc = '/game';
    const randomNumber = Math.floor(Math.random() * 10)
    chats[chatId] = randomNumber;
    return bot.sendMessage(
        chatId, 
        `Отгадай число😏`, 
        gameOptions
    );
}),

bot.onText(/\/x/, async msg => {
    const chatId = msg.chat.id;
    lc = null; 

    })
);

//слушатель сообщений==========================================================================================
bot.on('message', async msg => {
    const text = msg.text;
    const chatId = msg.chat.id;

    console.log(msg)

    const user = await UserModel.findOne({
        where: {
            chatId: chatId
        }
    });

    try {

        //Проверка ввода пароля
        if (password === false) {
            if (text === '111QWER!!!') {
                password = 'true';
                return bot.emit('text', { text: '/start', chat: { id: chatId } });
            } else {
                return bot.sendMessage(
                    chatId, 
                    `В доступе отказанно.`
                );
            }
        };

        //главное меню
        if (text === '/mainmenu') {

            if (user) {
                lc = null;
                await bot.sendMessage(
                    chatId, 
                    `И снова здравствуйте, ${user.nickname}!\nВаш персональный id: ${chatId}\n\nНачать работу: /beginwork,\nПроверить введенные данные: /infowork,\n\nИзменить e-mail: /editEmail,\nИзменить обращение /editNickname`
                );
            }
            return;
        }

        //начало работы
        if (text === '/beginwork') {
            backLc = text;
            if (!user.email) {
                await editEmail(chatId);
            } else {
                await bot.sendMessage(
                    chatId, 
                    'Чем могу вам помочь?', 
                    workOptions
                );
            } 
            return; 
        }

        //изменить e-mail
        if (text === '/editEmail') {
            return editEmail(chatId);
        }

        //Записываем e-mail в ячейку БД
        if (lc === '/editEmail') {
            await user.update({email: text.toLowerCase()});
            return bot.sendMessage(
                chatId, 
                `Ваш e-mail "<b>${user.email}</b>" успешно сохранён\n<i>(для перезаписи введите e-mail повторно)</i>`, 
                beginWorkOptions
            );
        }            

        //изменить Nickname
        if (text === '/editNickname') {
            return editNickname(chatId);
        }

        //Записываем Nickname в ячейку БД
        if (lc === '/editNickname') {
            await user.update({nickname: text});
            return bot.sendMessage(
                chatId, 
                `Хорошо, "<b>${user.nickname}</b>", я запомню.\n<i>(для перезаписи введите никнейм повторно)</i>`, 
                mainMenuOptions
            );
        }

        //Записываем название бренда в ячейку БД
        if (lc === '/enterBrand') {
            await user.update({brand: text.toUpperCase()});
            return bot.sendMessage(
                chatId, 
                `Название бренда "<b>${text}</b>" успешно сохранено\n<i>(для перезаписи введите бренд повторно)</i>`, 
                VCOptions
            );
        }

        //Записываем артикул в ячейку БД и начинаем поиск на сайте\отправку емейла
        if (lc === '/enterVC') {
            await user.update({vendorCode: text.toUpperCase()});
            await bot.sendMessage(chatId, 'Идёт обработка вашего запроса . . .');
            const formatedUserVendor = user.vendor.replace(/[\s-]/g, '');
            botMsgIdx = msg.message_id += 1; 

            if (formatedUserVendor === 'ОПУС') {
                return startFind(chatId);
            } else {
                lc = '/enterNumberofVC';
                bot.deleteMessage(chatId, botMsgIdx);
                return bot.sendMessage(
                    chatId,
                    `Хорошо!\n<b>Искомые вами параметры:</b>\nБренд: ${user.brand}\nПоставщик: ${user.vendor}\nАртикул: ${user.vendorCode}\nТеперь введите колличество:\n<i>введите так же единицы измерения, например:\n11 <b>шт</b> или 3 <b>м.п.</b></i>`,
                    {parse_mode: 'HTML'}
                );
            }
        }

        //Вводится Партия и колличество для резерва по поставщику ОПУС
        if (lc === '/enterReserveNumber') {
            await user.update({reserveNumber: text});

            if ((user.reserveNumber) !== (user.reserveNumber.split(" ")[0])) {
                return bot.sendMessage(
                    chatId, 
                    `Вы желаете зарезервировать партию <b>${user.reserveNumber.split(" ")[0]}</b> в колличестве <b>${user.reserveNumber.split(" ")[1]}</b> шт?\n<i>(для перезаписи введите информацию повторно)</i>`, 
                    enterReserveNumberOptions
                );
            } else {
                return bot.sendMessage(
                    chatId, 
                    `Вы желаете зарезервировать  <b>${user.vendorCode}</b> в колличестве <b>${user.reserveNumber}</b> шт?\n<i>(для перезаписи введите информацию повторно)</i>`, 
                    enterReserveNumberOptions
                );
            }
        }

        if (lc === '/enterNumberofVC') {
            lc = null;
            await user.update({reserveNumber: text});
            return bot.sendMessage(
                chatId, 
                `Отлично!\n<b>Искомые вами параметры:</b>\nБренд: ${user.brand}\nПоставщик: ${user.vendor}\nАртикул: ${user.vendorCode}\nКолличество: ${user.reserveNumber}\n\nХорошо, теперь я могу запросить наличие и срок поставки.\nНужно поставить резерв?`, 
                startFind2Options);
            }
            
            //Записываем артикул каталога
            if (lc === '/catalogСheck') {
                await user.update(
                    {catalog: text}
                    );
                    await bot.sendMessage(chatId, 'Идёт поиск каталога . . .');
                    botMsgIdx = msg.message_id += 1; 
                    return findCatalogWallpaper(chatId);
                }
                
                if (lc === '/oracСheck') {
                    await user.update(
                        {vendorCode: text.toUpperCase()}
                        );
                        await bot.sendMessage(chatId, `Идёт поиск ${text} . . .`);
                        botMsgIdx = msg.message_id += 1; 
                        return findOrac(chatId);
                    }
                    
                    //вывод информации
        if (text === '/infowork') {
            return bot.sendMessage(
                chatId, 
                `${user.nickname} вот, что вы искали:\n\nКаталог: ${user.catalog}\nБренд: ${user.brand}\nПоставщик: ${user.vendor}\nАртикул: ${user.vendorCode}\nКолличество: ${user.reserveNumber}\n\nВаш email: ${user.email}`
            );
        }

        if (text === '/infogame') {
            lc = null;
            return bot.sendMessage(
                chatId, 
                `Правильных ответов: "${user.right}"\nНеправильных ответов: "${user.wrong}"`, resetOptions
            );
        }   

        if (text.toLowerCase().includes('привет')) {
            return bot.sendSticker(
                chatId, 
                'https://cdn.tlgrm.app/stickers/087/0cf/0870cf0d-ec03-41e5-b239-0eb164dca72e/192/1.webp'
            );
        }

        if ( (text !== '/game' && text !== '/start') || (lc ==='/catalogСheck') || (lc === '/oracСheck') ) {
            return bot.sendSticker(
                chatId, 
                'https://tlgrm.ru/_/stickers/ccd/a8d/ccda8d5d-d492-4393-8bb7-e33f77c24907/12.webp'
            );
        }

    } catch (e) {
        console.log('Сработал слушатель документов.', e)
    }


}) 
//СЛУШАТЕЛЬ ДОКУМЕНТОВ========================================================================================================================================

bot.on('message', async msg => {

    try {
        const file_name = msg.document.file_name;
        const chatId = msg.chat.id;

        if (msg.document) {
            if (file_name.toLowerCase().includes('каталоги') ||
                file_name.toLowerCase().includes('прайслистов')
                ) {
            
                await bot.getFile(msg.document.file_id).then((file) => {
                    let fileName = msg.document.file_name;
                    fileName = fileName.toLowerCase();
                    fileName = fileName.replace(/\s/g, '_');
                    const fileStream = bot.getFileStream(file.file_id);
                    
                    fileStream.pipe(fs.createWriteStream(`/root/zak/xl/${fileName}`));
                    
                    fileStream.on('end', () => {
                        bot.sendMessage(
                            chatId, 
                            `Файл <b>${fileName}</b>\nуспешно сохранен.`, 
                            {parse_mode: 'HTML'
                        });
                    });
                });
                return;

            } else if (file_name.toLowerCase().includes('поставщиков') || 
                        file_name.toLowerCase().includes('остатки')
                    ) {

                await bot.getFile(msg.document.file_id).then((file) => {
                    let fileName = msg.document.file_name;
                    fileName = fileName.toLowerCase();
                    fileName = fileName.replace(/\s\d+|\.\d+/g, '');
                    fileName = fileName.replace(/\s/g, '_');
                    const fileStream = bot.getFileStream(file.file_id);
                    
                    fileStream.pipe(fs.createWriteStream(`/root/zak/xl/${fileName}`));
                    
                    fileStream.on('end', () => {
                        bot.sendMessage(
                            chatId, 
                            `Файл <b>${fileName}</b>\nуспешно сохранен.`, 
                            {parse_mode: 'HTML'}
                        );
                    });
                });
                return;

            } else {
                return bot.sendMessage(
                    chatId, 
                    `В целях экономии памяти, я сохраняю лишь определённые эксель файлы\nЕсли желаете, чтобы я научился работать с вашим документом, то обратитесь к моему разработчику\nn_kharitonov@mander.ru`
                );
            }
        }
    } catch {
        console.log('Cработал слушатель сообщений.')
    }

});

//слушатель колбэков==========================================================================================================================================

bot.on('callback_query', async msg => {
    const data = msg.data;
    const chatId = msg.message.chat.id;

    console.log(msg)

    //функция перезапуска игры
    const startGame = async (chatId) => {
        const randomNumber = Math.floor(Math.random() * 10)
        chats[chatId] = randomNumber;
        return bot.sendMessage(
            chatId, 
            `Отгадывай:`, 
            gameOptions
        );
    }

    const user = await UserModel.findOne({
        where: {
            chatId: chatId
        }
    });

    try {

    //главное меню 
    if (data === '/mainmenu') {
        if (lc === '/game' || lc === '/again' || lc === '/reset') {
            await bot.deleteMessage(
                chatId, 
                msg.message.message_id
            );
        }
        lc = null;
        return bot.sendMessage(
            chatId, 
            `Главное меню, ${user.nickname}\n\nНачать работу: /beginwork,\nПроверить введенные данные: /infowork,\n\nИзменить e-mail: /editEmail,\nИзменить обращение /editNickname`); 
    }

    //Проверяем поставщика по бренду
    if (data === '/checkVendor') {
        lc = '/enterVC';
        const formatedUserVendor = user.vendor.replace(/[\s-]/g, '');

        if (formatedUserVendor.includes('БЛАГОДАТЬ') ||
            formatedUserVendor.includes('ДЕКОРТРЕЙД') ||
            formatedUserVendor.includes('HUGGE') ||
            formatedUserVendor.includes('MILASSA') ||
            formatedUserVendor.includes('RACH MARBURG') ||
            formatedUserVendor.includes('АВТ') ||
            formatedUserVendor.includes('БАУТЕКС') ||
            formatedUserVendor.includes('БЕКАРТТЕКСТИЛЬ') ||
            formatedUserVendor.includes('ГЛОБАЛТЕКС') ||
            formatedUserVendor.includes('ДЕКОРРУС') ||
            formatedUserVendor.includes('КОНТРАКТ ПЛЮС') ||
            formatedUserVendor.includes('ЛЕВАНТИН') ||
            formatedUserVendor.includes('ПРОТОС') ||
            formatedUserVendor.includes('ОДИЗАЙН') ||
            formatedUserVendor.includes('РОБЕРТС') ||
            formatedUserVendor.includes('РУАЛЬЯНС') ||
            formatedUserVendor.includes('ЛОЙМИНА') ||
            formatedUserVendor.includes('ЮГАРТ')
        ) {
            return bot.sendMessage(
                chatId, 
                `Так как поставщиком искомого вами бренда <b>${user.brand}</b> является <b>${user.vendor}</b>, то я могу запросить остатки, уточнить сроки поставки и при необходимости запросить резерв интересующей вас позиции.\nКакой артикул из каталога вам нужен?`,
                {parse_mode: 'HTML'}
            );
        } else if (formatedUserVendor.includes('ОПУС')) {
            return bot.sendMessage(
                chatId, 
                `Так как поставщиком искомого вами бренда <b>${user.brand}</b> является <b>${user.vendor}</b>, то я могу найти остатки на сайте поставщика и при необходимости запросить резерв интересующей вас позиции.\nКакой артикул из каталога вам нужен?`,
                {parse_mode: 'HTML'}
            );
        } else {
            return bot.sendMessage(
                chatId, 
                `К сожалению, я еще не знаю как работать с поставщиком <b>${user.vendor}</b>.\nНо я могу подсказать остатки с сайта поставщика ОПУС, а так же, могу отправить запрос многим российским поставщикам о наличии, сроках и резервах.`,
                {parse_mode: 'HTML'}
            );
        }
            
    }

    //ввод бренда 
    if(data === '/enterBrand') {
        lc = data;

        return bot.sendMessage(
            chatId, `Для начала работы введите бренд, по которому мы будем производить поиск:`, 
            {parse_mode: 'HTML'}
        );
    }

    //ввод артикула 
    if(data === '/enterVC') {
        lc = data;
        cValue = user.brand;
        let messagePrice =await findPricelistLink(chatId, cValue);
        return bot.sendMessage(
            chatId, `Понял, принял\n<b>Искомые вами параметры:</b>\nБренд: ${user.brand}\n${messagePrice}\n\nВведите искомый артикул:\n`, 
            {parse_mode: 'HTML'}
        );
    }
    
    //начало резервирования
    if (data === '/enterReserveNumber') {
        lc = data;
        return bot.sendMessage(
            chatId, `Введите номер партии и колличество, которое желаете зарезервировать:<i>например: 268А 3\nесли партия отсутствует, то введите только колличество</i>`,
            { parse_mode: "HTML" }
        );
    }

    //подтверждение резервирования
    if (data === '/preSendEmail') {
        lc = data;
        if ((user.reserveNumber) !== (user.reserveNumber.split(" ")[0])) {

            subject = `Резерв ${user.vendorCode}, партия: ${user.reserveNumber.split(" ")[0]}, ${user.reserveNumber.split(" ")[1]} шт по запросу ${chatId}`;
            textMail = `\n\nЗдравствуйте!\nПросьба поставить в резерв следующую позицию: \nартикул: ${user.vendorCode}, бренд: ${user.brand}, партия: ${user.reserveNumber.split(" ")[0]} в колличестве: ${user.reserveNumber.split(" ")[1]} шт.\nПожалуйста пришлите обратную связь ответным письмом на purchasing_internal@manders.ru.`;
        
        } else {

            subject = `Резерв ${user.vendorCode},  ${user.reserveNumber} шт, по запросу ${chatId}`;
            textMail = `\n\nЗдравствуйте!\nПросьба поставить в резерв следующую позицию: \nартикул: ${user.vendorCode}, бренд: ${user.brand}, в колличестве: ${user.reserveNumber} шт.\nПожалуйста пришлите обратную связь ответным письмом на purchasing_internal@manders.ru.`;
        
        }
        return bot.sendMessage(
            chatId, 
            `Сформирован емейл:\nТема сообщения: <strong>${subject}</strong>\nКому: <b>${user.vendorEmail}</b>\nКопия: <b>${user.email}</b>\nТекст сообщения:\n"${textMail}"\n\n<i>Это сообщение тестовое и будет отправленно только на ${user.email}.</i>`, sendReserveOptions);
    }

    if (data === '/preSendEmailReserveYes') {

        subject = `Наличие+сроки+резерв ${user.vendorCode},  ${user.reserveNumber}, по запросу ${chatId}`;
        textMail = `\n\nЗдравствуйте!\nУточните, пожалуйста, наличие и срок поставки:\nартикул: ${user.vendorCode}, бренд: ${user.brand}, в колличестве: ${user.reserveNumber} шт.\nПросьба поставить в резерв.\nПожалуйста пришлите обратную связь ответным письмом на purchasing_internal@manders.ru.`;
        
        return bot.sendMessage(
            chatId, 
            `Сформирован емейл:\nТема сообщения: <strong>${subject}</strong>\nКому: <b>${user.vendorEmail}</b>\nКопия: <b>${user.email}</b>\nТекст сообщения:\n${textMail}\n\n<i>Это сообщение тестовое и будет отправленно только на ${user.email}.</i>`,
            sendReserveOptions
        );
    }

    if (data === '/preSendEmailReserveNo') {

        subject = `Наличие+сроки ${user.vendorCode},  ${user.reserveNumber}, по запросу ${chatId}`;
        textMail = `\n\nЗдравствуйте!\nУточните, пожалуйста, наличие и срок поставки:\nартикул: ${user.vendorCode}, бренд: ${user.brand}, в колличестве: ${user.reserveNumber} шт.\nПожалуйста пришлите обратную связь ответным письмом на purchasing_internal@manders.ru.`;
        
        return bot.sendMessage(
            chatId, 
            `Сформирован емейл:\nТема сообщения: <strong>${subject}</strong>\nКому: <b>${user.vendorEmail}</b>\nКопия: <b>${user.email}</b>\nТекст сообщения:\n${textMail}\n\n<i>Это сообщение тестовое и будет отправленно только на ${user.email}.</i>`, 
            sendReserveOptions
        );

    }

    //отправка сообщения с запросом резервирования
    if (data === '/sendReserveEmail') {
        lc = data;
        return sendReserveEmail(chatId);
    }

    //проверка каталога в наличии в салоне
    if(data === '/catalogСheck') {
        lc = data;
        return bot.sendMessage(
            chatId, 
            'Введите <b>наименование каталога</b> содержащего искомый вами товар:\n<i>(после получения результата, вы можете отправить новое наименование для поиска следующего каталога)</i>', 
            {parse_mode: 'HTML'}
        );
    }

    //проверка наличия артикула ORAC в салоне
    if(data === '/oracСheck') {
        lc = data;
        return bot.sendMessage(
            chatId, 
            'Введите искомый вами <b>артикул</b> товара ORAC :\n<i>(после получения результата, вы можете отправить новое наименование для поиска следующего каталога)</i>', 
            {parse_mode: 'HTML'}
        );
    }

    //превью фото
    if(data === '/work2') {
        lc = null;
        return bot.sendMessage(
            chatId, 
            sorry, 
            mainMenuOptions
        );
    }

    //добавить в заказ
    if(data === '/work3') {
        lc = null;
        return bot.sendMessage(
            chatId, 
            sorry, 
            mainMenuOptions
        );
    }

    //добавить в заказ
    if(data === '/request1C') {
        lc = null;
        return bot.sendMessage(
            chatId, 
            startRequest1C(chatId), 
            mainMenuOptions
        );
    }


    //рестарт игры
    if (data === '/again') {
        lc = data;
        await bot.deleteMessage(
            chatId, 
            msg.message.message_id
        );
        return startGame(chatId);
    }

    //рестарт игры
    if (data === '/infogame') {
        lc = data;
        await bot.deleteMessage(
            chatId, 
            msg.message.message_id
        );
        return bot.sendMessage(
            chatId, 
            `Правильных ответов: "${user.right}"\nНеправильных ответов: "${user.wrong}"`, 
            resetOptions
        ); 
    }

    //сброс результатов игры
    if(data === '/reset') {
        lc = data;
        await bot.deleteMessage(
            chatId, 
            msg.message.message_id
        );
        if (user) {
            await user.update ({
                right: 0,
                wrong: 0,
            });
        }

        return bot.sendMessage(
            chatId, 
            `Результаты игры сброшенны:\nправильных ${user.right},\nнеправильных ${user.wrong}`, 
            againOptions
        );
    }

    //запись результата игры в БД
    if (lc === '/game' || lc === '/again') {
        if (data == chats[chatId]) {
            user.right += 1;
            await user.save(chatId);
            await bot.deleteMessage(
                chatId, 
                msg.message.message_id
            );
            return bot.sendMessage(
                chatId, 
                `Ты отгадал цифру "${chats[chatId]}"`, 
                againOptions
            );
        } else {
            user.wrong += 1;
            await user.save();
            await bot.deleteMessage(
                chatId, 
                msg.message.message_id
            );
            return bot.sendMessage(
                chatId, 
                `Нет, я загадал цифру "${chats[chatId]}"`, 
                againOptions
            );  
        }
    }

    } catch (err) {      
        return bot.sendMessage(
            chatId, 
            'Ошибка в исполнении кода прослушивателя колбэков', 
            err
        );
    }

})

}

start();