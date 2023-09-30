const TelegramApi = require('node-telegram-bot-api');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');
const xlsjs = require('xlsjs'); //
const XLSX = require('xlsx');
const { JSDOM } = require('jsdom'); //
const FormData = require('form-data');  //
const tough = require('tough-cookie');  //
const { axiosCookieJarSupport } = require('axios-cookiejar-support');   //
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
const {mainMenuOptions, gameOptions, againOptions, resetOptions, resetInfoWorkOptions,
     workOptions, work1Options, checkVendorOptions, startFindOptions, startFind1Options, startFind2Options, 
     beginWorkOptions, beginWork2Options, mainMenuReturnOptions, settingsOptions, 
     enterReserveNumberOptions, sendReserveOptions, beginWork3Options} = require('./options');
const sequelize = require('./db');
const UserModel = require('./models');
const {transporter} = require('./nodemailer');
const clientRDP = require('./rdp');
const nodemailer = require('./nodemailer');

//ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
password = {};
chats = {};

lc = {};    //последняя команда
findCatalogIndex = {};   //состояние: нужно ли зайдествовать функцию поиска каталога текстиля.
botMsgIdx = {};    //айди последнего сообщения от бота
sorry = 'Извините, я этому пока ещё учусь😅\nПрошу вас, обратитесь с данным запросом к\npurchasing_internal@manders.ru';
let subject = {};   //тема письма
let textMail = {};  //текст письма



//МЕНЮ КОМАНД
bot.setMyCommands([
    {command: '/mainmenu', description:'Главное меню'},
    {command: '/settings', description:'Настройки'},
    {command: '/infowork', description:'Проверка введенных параметров'},
])

//ФУНКЦИИ=========================================================================================

// Функция ввода email
const editEmail = async (chatId) => {
    lc = '/editEmail'
    return bot.sendMessage(chatId, `Можете ввести Ваш рабочий email:`)
}

// Функция ввода никнейма
const editNickname = async (chatId) => {
    lc = '/editNickname'
    return bot.sendMessage(chatId, `Можете ввести Ваш никнейм:`)
}

// Функция поиска в 1С
const startRequest1C = async (chatId, vendorCode) => {

    try {
        const searchUrl1C = `http://post.manders.ru:10001/QuantityProduct.php?VendorCode=${vendorCode}&submit=Получить`;
        const response = await axios.get(searchUrl1C);

        // Создание виртуального DOM
        const dom = new JSDOM(response.data);
        const document = dom.window.document;

        // Получение таблицы из DOM
        const tableElement = document.querySelector("body > table:nth-child(3)");

        // Получение строк таблицы
        const rows = tableElement.querySelectorAll('tr');
        // Проверка наличия данных в таблице

        if (rows.length > 0) {
            let warehouse, quantity, reserve;

            // Форматирование данных построчно
            const formatedData = Array.from(rows).map((row, index) => {
                
                if (!row.querySelector('td.R3C0')) {
                    const cells = row.querySelectorAll('td');
                    if (cells[0]) {
                        warehouse = cells[0].textContent.trim();  // склад
                    }
                    if (cells[1] !== '') {
                        quantity = cells[1].textContent.trim().split( "," )[0];   // колличество
                    } else {
                        quantity = '0';
                    }
                    if (cells[2] !== '') {
                        reserve = cells[2].textContent.trim().split( "," )[0];     // резерв
                    } else {
                        reserve = '0';
                    }
                }
                return {
                    warehouse,
                    quantity,
                    reserve
                };
                
            });

            // Вывод данных пользователю
            if (formatedData.length > 0 ) {
                if (botMsgIdx !== null) {
                    bot.deleteMessage(chatId, botMsgIdx);
                    botMsgIdx = null;
                }
                let message = '';
                let messageResult1C = formatedData.map(obj => {
                    if (obj.warehouse === undefined) {
                        return "";
                    } else {
                        message = '';
                        message += `<strong>${obj.warehouse}</strong>\n`

                        if (obj.quantity > 0) {
                            message += `Количество: ${obj.quantity}\n`
                        }
                        if (obj.reserve > 0) {
                            message += `Резерв: ${obj.reserve}\n`
                        }
                        message += `\n`
                        return message;
                    }
                }).join('');

                if (messageResult1C.length !== 0) {
                    return { messageResult1C };
                } else {
                    messageResult1C = `${vendorCode} нигде не числится\n\n`
                    return { messageResult1C };
                }
            } else {
                console.log('В таблице нет данных');
            }
        } else {
            console.log('Не найденны строки в таблице');
        }
    } catch (e) {
        console.log('Ошибка выполенния кода', e);
    }
}

// ======================================================================================================================================
// Функция html запроса по данным из БД на сайт поставщика ОПУС
// ======================================================================================================================================

const startFindOpus = async (chatId) => {
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
                    availabilityContent += `${$$(names[0]).text()}: <code>${$$(cells[0]).text()}</code>\n`;
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
                    expectedArrivalContent += `${$$(names[0]).text()}: <code>${$$(cells[0]).text()}</code>\n`;
                    expectedArrivalContent += `${$$(names[1]).text()}: ${$$(cells[1]).text()}\n`;
                    expectedArrivalContent += `${$$(names[2]).text()}: ${$$(cells[2]).text()}\n`;
                    expectedArrivalContent += `${$$(names[3]).text()}: ${$$(cells[3]).text()}\n\n`;
                });
            });

            if (botMsgIdx !== null) {
                bot.deleteMessage(chatId, botMsgIdx);
                botMsgIdx = null;
            }

            // Проверяем наличие таблицы
            if (availabilityTable.length === 0) {

                if (expectedArrivalTable.length === 1) {
                    // Отправляем информацию о поставках товара
                    bot.sendMessage(chatId, `${expectedArrivalContent}`, startFindOptions);
                    console.log('информация о поставках при отсутсвии наличия, успешно отправлена');
                    return;

                } else {

                    // Отправляем сообщение о отсутствии товара
                    bot.sendMessage(chatId, 'В данный момент товар отсутствует на складе поставщика', startFind1Options);
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
            if (botMsgIdx !== null) {
                bot.deleteMessage(chatId, botMsgIdx);
                botMsgIdx = null;
            }
            bot.sendMessage(chatId, 'Товары не найдены. Проверьте правильное написание артикула и бренда.', startFind1Options);
            return;
        }

    } catch (e) {
        console.log('Ошибка при выполнении запроса', e);
        if (botMsgIdx !== null) {
            bot.deleteMessage(chatId, botMsgIdx);
            botMsgIdx = null;
        }
        return bot.sendMessage(chatId, 'Произошла ошибка при выполнении запроса.', startFind1Options);
    }
   
}


// ======================================================================================================================================
// Функция html запроса по данным из БД на сайт поставщика ДЕКОР ТРЕЙД
// ======================================================================================================================================

const startFindDecaro = async (chatId, msg) => {
    lc = '/enterVC';

    const user = await UserModel.findOne({
        where: {
            chatId: chatId
        }
    });

    try {

        //Формируем URL для поиска
        const searchUrl = `https://dealer.decaro.ru/catalog/?q=${user.vendorCode}&s=Найти`;

        //Отправляем запрос на сайт
        const response = await axios.get(searchUrl);
        const $ = cheerio.load(response.data);

        const firstProductLink = $('div.item-title a').attr('href');

        if (firstProductLink) {
            
            const productResponse = await axios.get(`https://dealer.decaro.ru${firstProductLink}`);
            let $$ = cheerio.load(productResponse.data);
            const inner_props = $$('div.inner_props div.prop');
            const dataId = $$('div.availability-table').toString().trim();
            let chars = ''; 
            console.log(dataId);
            
            // создаем массив объектов с данными из каждого элемента prop
            const propsData = inner_props.map((index, element) => {
                const rowsNames = $$(element).find('span');
                const rowsValue = $$(element).find('div.char_value');
                return {
                    name: rowsNames.text().trim(),
                    value: rowsValue.text().trim()
                }
            }).get(); // преобразуем объект Cheerio в обычный массив

            propsData.forEach((item) => {
                chars += `${item.name}: ${item.value}\n`;
            });
            
            if (botMsgIdx !== null) {
                bot.deleteMessage(chatId, botMsgIdx);
                botMsgIdx = null;
            }
            
            await bot.sendMessage(
                chatId,
                chars,
                { parse_mode: "HTML" }
            );
            
            await bot.sendMessage(
                chatId,
                `Идёт запрос на получение остатков и сроков поставки . . .`,
                { parse_mode: "HTML" }
            );
            botMsgIdx = msg.message_id += 2;
            
            const responseQty = await axios.post("https://dealer.decaro.ru/local/components/whatasoft/product.quantity/ajax.php", {
                    "id": `439954`
                }, {
                    "headers": {
                    "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
                    }
                })

                console.log(responseQty.data); 
                let $ = cheerio.load(responseQty.data);
                const availabilityTable = $('div.availability-table-section');

                const availabilityTableValue = availabilityTable.map((index, element) => {

                    const rowsStatus = $(element).find('div.status');
                    const rowsDays = $(element).find('div.days');
                    const rowsArticul = $(element).find('div.articul');
                    const rowsQty = $(element).find('div.qty');
                    const rowsUnit = $(element).find('div.unit');
                    const rowsOther = $(element).find('small');
            
                    return {
                        status: rowsStatus.text().trim(),
                        days: rowsDays.text().trim(),
                        articul: rowsArticul.text().trim(),
                        qty: rowsQty.text().trim(),
                        unit: rowsUnit.text().trim(),
                        other: rowsOther.text().trim()
                    }
                }).get(); // преобразуем объект Cheerio в обычный массив
            
                chars = '';
            
                // выводим данные из каждого элемента массива propsData
                availabilityTableValue.forEach((item) => {
                    chars += `<b>${item.status}: </b>`;

                    if (item.days !== null && item.days !== undefined) {
                        chars += `${item.days}`;
                    }
                    if (item.articul !== null && item.articul !== undefined) {
                        chars += `${item.articul} `;
                    }
                    if (item.qty !== null && item.qty !== undefined) {
                        chars += `${item.qty} `;
                    }
                    if (item.unit !== null && item.unit !== undefined) {
                        chars += `${item.unit}\n`;
                    }
                    chars += `${item.other}\n`
                });

            if (botMsgIdx !== null) {
                bot.deleteMessage(chatId, botMsgIdx);
                botMsgIdx = null;
            }

            return bot.sendMessage(
                chatId,
                chars,
                { parse_mode: "HTML" }
            );

        } else {

            if (botMsgIdx !== null) {
                bot.deleteMessage(chatId, botMsgIdx);
                botMsgIdx = null;
            }
            return bot.sendMessage(
                chatId, 
                'Товары не найдены. Проверьте правильное написание артикула.', 
                startFind1Options
            );
        }

    } catch (e) {
        console.log('Ошибка при выполнении запроса', e);
        if (botMsgIdx !== null) {
            bot.deleteMessage(chatId, botMsgIdx);
            botMsgIdx = null;
        }
        return bot.sendMessage(chatId, 'Произошла ошибка при выполнении запроса.', startFind1Options);
    }
   
}

// ======================================================================================================================================
// Функция отправки email с запросом на резервирование
// ======================================================================================================================================

const sendReserveEmail = async (chatId) => {

    const user = await UserModel.findOne({
        where: {
            chatId: chatId
        }
    });
    
    const recipient = 'nick.of.darkwood@gmail.com';     // email поставщика
    const copy = `${user.email}`;   //ВАЖНО: Ставить в копию только     purchasing_internal@manders.ru

    try {
        if (user.vendor !== null) {
            const formatedUserVendor = user.vendor.replace(/[\s-]/g, '');

            if (formatedUserVendor.includes('ДЕКОРДЕЛЮКС')) {
                let result = transporter.sendMail({
                    from: 'zakupki_bot@manders.ru',
                    to: `${copy}`,
                    subject: subject,
                    text: textMail,
                });

            } else {
                let result = transporter.sendMail({
                    from: 'zakupki_bot@manders.ru',
                    to: `${recipient}, ${copy}`,
                    subject: subject,
                    text: textMail,
                });
            }
            return bot.sendMessage(
                chatId, 
                `Сообщение с темой: \n<pre>"${subject}"</pre>\nуспешно отправлено поставщику и в отдел закупок.\n\nЧтобы узнать о состоянии резерва напишите письмо с вышеупомянутой темой на <b>purchasing_internal@manders.ru</b>.`, 
                beginWork2Options
            );
        }
        

    } catch (e) {
        console.error(e);
        throw new Error('Ошибка при отправке email');
    }
}

// ======================================================================================================================================
// Функция для поиска эксель файла
// ======================================================================================================================================

async function findExcelFile(
    fileNameWallpaper = '', 
    fileNameTextile = '', 
    fileNamePricelist = '',
    fileNameOracMSK = '', 
    fileNameOracSPB = '',
    fileNameVendor = '',
    fileNameDecorDelux = '',
    fileNameDecorRus = '',
    fileNameBautex = '',
    fileNameLoymina = '',
    fileNameSirpi = '',

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
                fileNameVendor,
                fileNameDecorDelux,
                fileNameDecorRus,
                fileNameBautex,
                fileNameLoymina,
                fileNameSirpi,
                fileNameBrink
                );

            if (result.fileNameWallpaper) {
                fileNameWallpaper = result.fileNameWallpaper;

            } else if (result.fileNameTextile) {
                fileNameTextile = result.fileNameTextile;

            } else if (result.fileNamePricelist) {
                fileNamePricelist = result.fileNamePricelist;

            } else if (result.fileNameOracMSK) {
                fileNameOracMSK = result.fileNameOracMSK;

            } else if (result.fileNameOracSPB) {
                fileNameOracSPB = result.fileNameOracSPB;

            } else if (result.fileNameVendor) {
                fileNameVendor = result.fileNameVendor;

            } else if (result.fileNameDecorDelux) {
                fileNameDecorDelux = result.fileNameDecorDelux;

            } else if (result.fileNameDecorRus) {
                fileNameDecorRus = result.fileNameDecorRus;

            } else if (result.fileNameBautex) {
                fileNameBautex = result.fileNameBautex;

            } else if (result.fileNameLoymina) {
                fileNameLoymina = result.fileNameLoymina;

            } else if (result.fileNameSirpi) {
                fileNameSirpi = result.fileNameSirpi;

            } else if (result.fileNameBrink) {
                fileNameBrink = result.fileNameBrink;

            }

        } else if (path.extname(file) === '.xlsx') {
            
            if (file.toLowerCase().includes('каталоги_распределение_в_салоны_26_09_19')) {
                fileNameWallpaper = filePath;
            } else if (file.toLowerCase().includes('текстиль_каталоги_распределение_в_салоны')) {
                fileNameTextile = filePath;
            } else if (file.toLowerCase().includes('список_прайслистов')) {
                fileNamePricelist = filePath;
            } else if (file.toLowerCase().includes('orac_мск')) {
                fileNameOracMSK = filePath;
            } else if (file.toLowerCase().includes('orac_спб')) {
                fileNameOracSPB = filePath;
            } else if (file.toLowerCase().includes('список_поставщиков')) {
                fileNameVendor = filePath;
            } else if (file.toLowerCase().includes('баутекс')) {
                fileNameBautex = filePath;
            } else if (file.toLowerCase().includes('brink&campman')) {
                fileNameBrink = filePath;
            }
        } else if (path.extname(file) === '.xls') {

            if (file.toLowerCase().includes('декор_делюкс')) {
                fileNameDecorDelux = filePath;
            } else if (file.toLowerCase().includes('декор_рус')) {
                fileNameDecorRus = filePath;
            } else if (file.toLowerCase().includes('лоймина')) {
                fileNameLoymina = filePath;
            } else if (file.toLowerCase().includes('сирпи')) {
                fileNameSirpi = filePath;
            }
        }
        if (fileNameWallpaper && 
            fileNameTextile && 
            fileNamePricelist && 
            fileNameOracMSK &&
            fileNameOracSPB && 
            fileNameVendor &&
            fileNameDecorDelux && 
            fileNameDecorRus &&
            fileNameBautex &&
            fileNameLoymina &&
            fileNameSirpi &&
            fileNameBrink
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
        fileNameVendor,
        fileNameDecorDelux,
        fileNameDecorRus,
        fileNameBautex,
        fileNameLoymina,
        fileNameSirpi,
        fileNameBrink
    };
}

// ======================================================================================================================================
// Функция поиска артикула ORAC
// ======================================================================================================================================

async function findOrac(chatId) {
        
    const resultMSK = await findExcelFile('orac_мск');
    const resultSPB = await findExcelFile('orac_спб');
    
    const filePathMSK = resultMSK.fileNameOracMSK;
    const filePathSPB = resultSPB.fileNameOracSPB;
    
    let messageORAC = '';
    
    const user = await UserModel.findOne({
        where: {
            chatId: chatId
        }
    });

    let vendorCode = user.vendorCode;
    const findResult1C = await startRequest1C(chatId, vendorCode);
    messageORAC = `По данным 1С:\n${findResult1C.messageResult1C}\n\n`;
    
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
                    
                    messageORAC += `Артикул <b>${cellValue}</b> имеется на складе ОРАК "<b>${a3Value}</b>"\nв колличестве <b>${cValue}</b> <b>${bValue}</b>\n\n`;
                    
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

                messageORAC += `На складе ОРАК в Москве артикул <b>${user.vendorCode}</b> отсутсвует.\n\n`;
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
                    
                    messageORAC += `Артикул <b>${cellValue}</b> имеется на складе ОРАК <b>${a3Value}</b>\nв колличестве <b>${dValue}</b> <b>${cValue}</b>\n\n`;
                    
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
                
                messageORAC += `На складе ОРАК в Санкт-Петербурге артикул <b>${user.vendorCode}</b> отсутсвует.\n\n`;
            }
            
        } catch (error) {
            console.error(`Ошибка при чтении файла ${filePathSPB}:`, error); 
        }
    }
    messageORAC += `<strong><u>Если вы хотите заказать товар через 2 склада поставщика для 1ого клиента, то делайте 2 ЗАКАЗА ПОСТАВЩИКУ!!</u></strong>\n\n<strong>ВАЖНО</strong>: максимальный срок для возврата = НЕ более 5 месяцев (от даты доставки товара на наш склад)\n`;
    return bot.sendMessage(chatId, messageORAC, { parse_mode: "HTML" });
    
};

// ======================================================================================================================================
//Функция поиска каталога обоев
// ======================================================================================================================================

async function findCatalogWallpaper(chatId) {

    let fileNameWallpaper = 'Каталоги_распределение_в_салоны_26_09_19';
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
                        
                        const bValue = row.getCell('B').value;
                        let cValue = row.getCell('C').value.toString();
                        const hValue = row.getCell('H').value;
                        const iValue = row.getCell('I').value;
                        const jValue = row.getCell('J').value;
                        const kValue = row.getCell('K').value;
                        const mValue = row.getCell('M').value;
                        const nValue = row.getCell('N').value;
                        const oValue = row.getCell('O').value;
                        const pValue = row.getCell('P').value;
                        const vendorCode = bValue;

                        await user.update({brand: cValue.toUpperCase()});
                        let findResult1C = await startRequest1C(chatId, vendorCode);
                        let PricelistLink = await findPricelistLink(chatId, cValue);
                        
                        if (
                            hValue !== null ||
                            iValue !== null ||
                            jValue !== null ||
                            kValue !== null ||
                            mValue !== null || 
                            nValue !== null
                            ) {
                                // const h1Value = firstWorksheet.getCell('H1').value;
                                // const i1Value = firstWorksheet.getCell('I1').value;
                                // const j1Value = firstWorksheet.getCell('J1').value;
                                // const k1Value = firstWorksheet.getCell('K1').value;
                                // const m1Value = firstWorksheet.getCell('M1').value;
                                // const n1Value = firstWorksheet.getCell('N1').value;
                                const o1Value = firstWorksheet.getCell('O1').value;
                                const p1Value = firstWorksheet.getCell('P1').value;

                            message += `<b>${cellValue.trim()}</b> бренда <b>${cValue.toUpperCase()}</b> имеется в магазинах Manders!\n`;
                            // message += `<b>${cellValue.trim()}</b> бренда <b>${cValue.toUpperCase()}</b> имеется в следующих магазинах:\n`;

                            
                            // if (hValue !== null) {
                            //     message += `${h1Value}: ${hValue}\n`;
                            // }
                            // if (iValue !== null) {
                            //     message += `${i1Value}: ${iValue}\n`;
                            // }
                            // if (jValue !== null) {
                            //     message += `${j1Value}: ${jValue}\n`;
                            // }
                            // if (kValue !== null) {
                            //     message += `${k1Value}: ${kValue}\n`;
                            // }
                            // if (mValue !== null) {
                            //     message += `${m1Value}: ${mValue}\n`;
                            // }
                            // if (nValue !== null) {
                            //     message += `${n1Value}: ${nValue}\n`;
                            // }
                            if (oValue !== null) {
                                message += `${o1Value}: ${oValue}\n`;
                            }
                            if (pValue !== null) {
                                message += `${p1Value}: ${pValue}\n`;
                            }
                            message += `\nПо данным 1С:\n${findResult1C.messageResult1C}\n${PricelistLink.messagePrice}`
                            
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
                            return bot.sendMessage(
                                chatId, 
                                `Каталога в салонах нет.\nОбратитесь к Юлии Скрибника за уточнением возможности заказа данного артикула.\nskribnik@manders.ru\n+7 966 321-80-08\n\n${PricelistLink.messagePrice}`,
                                {parse_mode: 'HTML'}
                            );
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

// ======================================================================================================================================
//Функция поиска каталога текстиля
// ======================================================================================================================================

async function findCatalogTextile(chatId) {

    let fileNameTextile = 'Текстиль_Каталоги_распределение_в_салоны';
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

                        const bValue = row.getCell('B').value;
                        let cValue = row.getCell('C').value.toString();
                        const iValue = row.getCell('I').value;
                        const jValue = row.getCell('J').value;
                        const kValue = row.getCell('K').value;
                        const lValue = row.getCell('L').value;
                        const nValue = row.getCell('N').value;
                        const oValue = row.getCell('O').value;
                        const pValue = row.getCell('P').value;
                        const vendorCode = bValue;

                        await user.update({brand: cValue.toUpperCase()});
                        let findResult1C = await startRequest1C(chatId, vendorCode);
                        let PricelistLink = await findPricelistLink(chatId, cValue);

                        if (iValue !== null ||
                            jValue !== null ||
                            kValue !== null ||
                            lValue !== null ||
                            nValue !== null || 
                            oValue !== null
                            ) {

                                // const i1Value = firstWorksheet.getCell('I1').value;
                                // const j1Value = firstWorksheet.getCell('J1').value;
                                // const k1Value = firstWorksheet.getCell('K1').value;
                                // const l1Value = firstWorksheet.getCell('L1').value;
                                // const n1Value = firstWorksheet.getCell('N1').value;
                                // const o1Value = firstWorksheet.getCell('O1').value;
                                const p1Value = firstWorksheet.getCell(`P1`).value;

                            message += `<b>${cellValue.trim()}</b> бренда <b>${cValue.toUpperCase()}</b> имеется в магазинах Manders!\n`;
                            // message += `<b>${cellValue.trim()}</b> бренда <b>${cValue.toUpperCase()}</b> имеется в следующих магазинах:\n`;
                            // if (iValue !== null) {
                            //     message += `${i1Value}: ${iValue}\n`;
                            // }
                            // if (jValue !== null) {
                            //     message += `${j1Value}: ${jValue}\n`;
                            // }
                            // if (kValue !== null) {
                            //     message += `${k1Value}: ${kValue}\n`;
                            // }
                            // if (lValue !== null) {
                            //     message += `${l1Value}: ${lValue}\n`;
                            // }
                            // if (nValue !== null) {
                            //     message += `${n1Value}: ${nValue}\n`;
                            // }
                            // if (oValue !== null) {
                            //   message += `${o1Value}: ${oValue}\n`;
                            // }
                            if (pValue !== null) {
                                message += `${p1Value}: ${pValue}\n`;
                            }
                            message += `\nПо данным 1С:\n${findResult1C.messageResult1C}\n${PricelistLink.messagePrice}`
                            

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
                            return bot.sendMessage(chatId, `Каталога в салонах нет.\nОбратитесь к Юлии Скрибника за уточнением возможности заказа данного артикула.\nskribnik@manders.ru\n+7 966 321-80-08\n\n${PricelistLink.messagePrice}`, {parse_mode: 'HTML'});
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

// ======================================================================================================================================
//Функция поиска ссылки на прайслист
// ======================================================================================================================================

async function findPricelistLink(chatId, cValue) {

    let fileNamePricelist = 'cписок_прайслистов';

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
            let vendor = '';

            firstWorksheet.eachRow((row, rowNumber) => {
                const cellValue = row.getCell('B').value;
                if (cellValue !== null) {

                    const formatedCellValue = cellValue.toString().toUpperCase().replace(/[\s-&]/g, '');
                    const formaterdCValue = cValue.toString().toUpperCase().replace(/[\s-&]/g, '');
    
                    if (formatedCellValue.includes(formaterdCValue)) {
                        foundMatchPricelist = true;

                        const aValue = row.getCell('A').value;  // Поставщик
                        let bValue = row.getCell('B').value;  // Бренд
                        const cValue = row.getCell('C').value;  // Ссылка на прайслист
                        const dValue = row.getCell('D').value;  // почтовый ящик поставщика
                        user.update({vendor: aValue.toUpperCase()});
                        vendor = aValue.toUpperCase();
                        if (dValue !== null) {
                        user.update({vendorEmail: dValue.toLowerCase()});
                        }
                        if (isNaN(bValue)) {
                            bValue = bValue.toUpperCase();
                        }

                        if (cValue !== null ) {
                            user.update({brand: bValue});
                            const formattedCValue = cValue.toString().replace(/\\/g, '\\');
                            messagePrice += `Ссылка на папку с прайс-листом бренда <b>${bValue}</b>:\n<code>${formattedCValue}</code>\n\n`;
                        } else {
                            user.update({brand: bValue});
                            messagePrice += `Я пока не знаю в какой папке лежит прайс-лист бренда <b>${bValue}</b>.😢\nЗапросите прайсы в отделе закупок.\n\n`
                        }
                    }
                }
            });

            if (!foundMatchPricelist) {
                user.update({vendor: null});
                vendor = null;
                messagePrice += `Прайс-лист по бренду <b>${user.brand}</b> в локальных файлах не найден.\nЗапросите прайсы в отделе закупок.`;
            }

            return {messagePrice, vendor};
        } catch (error) {
            console.error('Ошибка при чтении файла Excel:', error);
        }
    }
};

// ======================================================================================================================================
// Функция поиска остатков по поставщику Декор Делюкс
// ======================================================================================================================================

async function findDecorDelux(chatId) {

    let fileNameDecorDelux = 'остатки_декор_делюкс';

    const result = await findExcelFile(fileNameDecorDelux);
    const filePath = result.fileNameDecorDelux;


    if (filePath) {

        const user = await UserModel.findOne({
            where: {
                chatId: chatId
            }
        });

        try {

            const workbook = XLSX.readFile(filePath);
            const firstWorksheet = workbook.Sheets[workbook.SheetNames[0]];

            let foundMatch = false;

            for (let cellAddress in firstWorksheet) {
                if (cellAddress[0] === '!') continue;
              
                const cellValue = firstWorksheet[cellAddress].v;

                console.log(cellAddress)

                if (cellValue !== null) {
                    let formatedCellValue = cellValue.toString().trim();
                    const formatedUserVC = user.vendorCode.toString().trim();
              
                    if (isNaN(formatedCellValue)) {
                      formatedCellValue = formatedCellValue.toUpperCase();
                    }

                    if (formatedCellValue.includes(formatedUserVC)) {
                        foundMatch = true;
                    
                        const gValue = firstWorksheet['G' + cellAddress.substring(1)].v; // Номенкулатура
                        const hValue = firstWorksheet['H' + cellAddress.substring(1)].v; // Серия\Партия
                        const iCell = firstWorksheet['I' + cellAddress.substring(1)];   // Ячейка: Свободный остаток
                        let iValue = {};
                    
                        if (iCell && iCell.v !== undefined) {
                          iValue = iCell.v; // Свободный остаток
                        } else {
                          iValue = '0';
                        }
                    
                        if (botMsgIdx !== null) {
                          bot.deleteMessage(chatId, botMsgIdx);
                          botMsgIdx = null;
                        }

                        return bot.sendMessage(
                            chatId, 
                            `<strong>${gValue}</strong>\nПартия: ${hValue}\n${iValue} шт в свободном остатке\n<i>можете ввести следующий артикул для поиска</i>`,
                            startFindOptions
                        );
                    }
                }
            }
            
            if (!foundMatch) {
                if (botMsgIdx !== null) {
                    bot.deleteMessage(chatId, botMsgIdx);
                    botMsgIdx = null;
                }
                return bot.sendMessage(
                    chatId,
                    `Совпадения с артикулом ${user.vendorCode} в файле "остатки_декор_делюкс" не найденны.\n<i>можете ввести следующий артикул для поиска</i>`,
                    {parse_mode: 'HTML'}
                );
            }

        } catch (e) {
            console.log(e);
            if (botMsgIdx !== null) {
                bot.deleteMessage(chatId, botMsgIdx);
                botMsgIdx = null;
            }
            return bot.sendMessage(chatId, `Ошибка при чтении файла ${filePath}.`);
        }
    }
};

// ======================================================================================================================================
// Функция поиска остатков по поставщику Декор Рус
// ======================================================================================================================================

async function findDecorRus(chatId) {

    let fileNameDecorRus = 'остатки_декор_рус';

    const result = await findExcelFile(fileNameDecorRus);
    const filePath = result.fileNameDecorRus;
    console.log(filePath);
    
    if (filePath) {

        const user = await UserModel.findOne({
            where: {
                chatId: chatId
            }
        });
        
        try { 
            
            const workbook = XLSX.readFile(filePath);
            const firstWorksheet = workbook.Sheets[workbook.SheetNames[0]];

            let foundMatch = false;

            for (let cellAddress in firstWorksheet) {

                if (cellAddress[0] === '!') continue;
        
                const cellValue = firstWorksheet[cellAddress].v;
        
                if (cellValue !== null) {
                    let formatedCellValue = cellValue.toString().trim();
                    const formatedUserVC = user.vendorCode.toString().trim();
        
                    if (isNaN(formatedCellValue)) {
                        formatedCellValue = formatedCellValue.toUpperCase();
                    }
        
                    if (formatedCellValue.includes(formatedUserVC)) {
                        foundMatch = true;
                        
                        const bValue = firstWorksheet['B' + cellAddress.substring(1)].v; // Характеристика номенклатуры
                        const cCell = firstWorksheet['C' + cellAddress.substring(1)]; // Ячейка: Свободный остаток в ед. хранения остатков
                        let cValue = {};
                        
                        if (cCell && cCell.v !== undefined && cCell.v !== null) {
                            cValue = `${cCell.v} ед.`; // Свободный остаток в ед. хранения остатков
                        } else {
                            cValue = '0';
                        }
                        
                        const dCell = firstWorksheet['D' + cellAddress.substring(1)]; // Ячейка: Цена (руб.)
                        let dValue = {};
                        
                        if (dCell && dCell.v !== undefined && dCell.v !== null) {
                            dValue = `${dCell.v} руб.`; // Цена (руб.)
                        } else {
                            dValue = 'неизвестно';
                        }
                        
                        let message = '';
                        message += `<strong>${bValue}</strong>\n<pre>Свободный остаток:\t${cValue}</pre>\n`;

                        // Проверяем каждую ячейку после bValue на наличие пробела
                        for (let i = parseInt(cellAddress.substring(1)) + 1; ; i++) {
                          const currentBCell = firstWorksheet['B' + i];

                            if (currentBCell && currentBCell.v && !currentBCell.v.toString().includes(' ')) {
                                let currentCCell = firstWorksheet['C' + i];
                                if (currentCCell === undefined || currentCCell === null) {
                                    currentCCell = 0;
                                }
                                const currentValue = `Партия: ${currentBCell.v}\t\t${currentCCell} ед.`;
                                message += `<code>${currentValue}</code>\n`;
                            } else {
                              break;
                            }
                        }
                        message += `Цена: ${dValue}\n<i>можете ввести следующий артикул для поиска</i>\n`;

                        if (botMsgIdx !== null) {
                            bot.deleteMessage(chatId, botMsgIdx);
                            botMsgIdx = null;
                        }
                        
                        return bot.sendMessage(
                          chatId, 
                          message,
                          startFindOptions
                        );
                    }

                }
            };

            if (!foundMatch) {
                if (botMsgIdx !== null) {
                    bot.deleteMessage(chatId, botMsgIdx);
                    botMsgIdx = null;
                };
                return bot.sendMessage(
                    chatId,
                    `Совпадения с артикулом ${formatedUserVC} в файле "остатки_декор_рус" не найденны.\n<i>можете ввести следующий артикул для поиска</i>`,
                    {parse_mode: 'HTML'}
                );
            }

        } catch (e) {
            console.log(e);
            if (botMsgIdx !== null) {
                bot.deleteMessage(chatId, botMsgIdx);
                botMsgIdx = null;
            }
            return bot.sendMessage(chatId, `Ошибка при чтении файла ${filePath}.`);
        }    
    }
        
};

// ======================================================================================================================================
// Функция поиска остатков по поставщику Баутекс
// ======================================================================================================================================

async function findBautex(chatId) {

    let fileNameBautex = 'остатки_баутекс';

    const result = await findExcelFile(fileNameBautex);
    const filePath = result.fileNameBautex;
    console.log(filePath);
    
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

            let foundMatch = false;
            
            firstWorksheet.eachRow( async (row, rowNumber) => {
                const cellValue = row.getCell('D').value;
                if (cellValue !== null) {
                    
                    const formatedCellValue = cellValue.toString().toUpperCase().replace(/[\s-&]/g, '');
                    const formatedUserVC = user.vendorCode.toString().toUpperCase().replace(/[\s-&]/g, '');
                    
                    if (formatedCellValue.includes(formatedUserVC)) {
                        foundMatch = true;
                        
                        let message = '';
                        const dValue = row.getCell('D').value;  // номенкулатура
                        
                        const j8Value = firstWorksheet.getCell('J8').value;  // Склад 1
                        let jValue = row.getCell('J').value;  // Значение
                        const lValue = row.getCell('L').value;  // ед. измерения

                        const m8Value = firstWorksheet.getCell('M8').value;  // Склад 2
                        let mValue = row.getCell('M').value;  // Значение
                        const nValue = row.getCell('N').value;  // ед. измерения

                        const o8Value = firstWorksheet.getCell('O8').value;  // Склад 3
                        let oValue = row.getCell('O').value;  // Значение
                        const qValue = row.getCell('Q').value;  // ед. измерения

                        const r8Value = firstWorksheet.getCell('R8').value;  // Склад 4
                        let rValue = row.getCell('R').value;  // Значение
                        const sValue = row.getCell('S').value;  // ед. измерения

                        message += `<b>${dValue}</b>\n\n`;

                        if (jValue !== null && jValue.formula) {
                            jValue = jValue.result;
                            message += `${j8Value}\n${jValue} ${lValue}\n\n`;

                        } else if (jValue !== null) {
                            message += `${j8Value}\n${jValue} ${lValue}\n\n`;
                        }

                        if (mValue !== null && mValue.formula) {
                            mValue = mValue.result;
                            message += `${m8Value}\n${mValue} ${nValue}\n\n`;

                        } else if (mValue !== null) {
                            message += `${m8Value}\n${mValue} ${lValue}\n\n`;
                        }

                        if (oValue !== null && oValue.formula) {
                            oValue = oValue.result;
                            message += `${o8Value}\n${oValue} ${qValue}\n\n`;

                        } else if (oValue !== null) {
                            message += `${o8Value}\n${oValue} ${lValue}\n\n`;
                        }

                        if (rValue !== null && rValue.formula) {
                            rValue = rValue.result;
                            message += `${r8Value}\n${rValue} ${sValue}\n\n`;

                        } else if (rValue !== null) {
                            message += `${r8Value}\n${rValue} ${lValue}\n\n`;
                        }

                        message += `<i>можете ввести следующий артикул для поиска</i>\n\n`;
                        
                        if (botMsgIdx !== null) {
                            bot.deleteMessage(chatId, botMsgIdx);
                            botMsgIdx = null;
                        }
                        await bot.sendMessage(
                            chatId, 
                            message,
                            startFindOptions
                        );
                    }
                }
            });

            if (!foundMatch) {
                if (botMsgIdx !== null) {
                    bot.deleteMessage(chatId, botMsgIdx);
                    botMsgIdx = null;
                }
                return bot.sendMessage(
                    chatId,
                    `Совпадения с артикулом ${user.vendorCode} в файле "остатки_баутекс" не найденны.\n<i>можете ввести следующий артикул для поиска</i>`,
                    {parse_mode: 'HTML'}
                );
            }

        } catch (error) {
            console.error('Ошибка при чтении файла Excel:', error);
        }
    }
};

// ======================================================================================================================================
// Функция поиска остатков по поставщику Лоймина
// ======================================================================================================================================

async function findLoymina(chatId) {

    let fileNameLoymina = 'остатки_лоймина';

    const result = await findExcelFile(fileNameLoymina);
    const filePath = result.fileNameLoymina;
    console.log(filePath);

    if (filePath) {

        const user = await UserModel.findOne({
            where: {
                chatId: chatId
            }
        });

        try {

            const workbook = XLSX.readFile(filePath);
            const firstWorksheet = workbook.Sheets[workbook.SheetNames[0]];

            let foundMatch = false;

            for (let cellAddress in firstWorksheet) {

                if (cellAddress[0] === '!') continue;
        
                const cellValue = firstWorksheet[cellAddress].v;

                if (cellValue !== null) {
                    let formatedCellValue = cellValue.toString().trim();
                    const formatedUserVC = user.vendorCode.toString().trim();
        
                    if (isNaN(formatedCellValue)) {
                        formatedCellValue = formatedCellValue.toUpperCase();
                    }
        
                    if (formatedCellValue.includes(formatedUserVC)) {
                        foundMatch = true;

                        const aValueCell = firstWorksheet['A' + cellAddress.substring(1)];

                        if (!aValueCell || !aValueCell.v) {
                            break; // Выходим из цикла, если aValue равно undefined или null
                        }

                        const aValue = aValueCell.v;    // дизайн

                        let message = '';
                        message += `<b>${aValue}</b>\n`;
                        
                        // Проверяем каждую ячейку после bValue на наличие пробела
                        for (let i = parseInt(cellAddress.substring(1)) + 1; ; i++) {

                            const currentDCell = firstWorksheet['D' + i];
                            
                                if (currentDCell && currentDCell.v) {
                                    const currentDCell = firstWorksheet['D' + i];   // Партия
                                    const currentKCell = firstWorksheet['K' + i];   // Колличество
                                    const currentJCell = firstWorksheet['J' + i];   // Ед. измерения

                                    const currentValue = `<code>${currentDCell.v}</code>\t\t<u><b>${currentKCell.v}</b> ${currentJCell.v}</u>`;
                                    message += `${currentValue}\n`;

                                    // Проверяем, является ли текущая итерация кратной 10
                                    if (i % 10 === 0) {

                                        // Отправляем сообщение пользователю
                                        await bot.sendMessage(
                                        chatId,
                                        message,
                                        { parse_mode: 'HTML' }
                                        );
                                    
                                        // Обнуляем переменную message
                                        message = '';
                                    }
                                } else {
                                    break;
                                }
                            }
                            
                            
                        if (botMsgIdx !== null) {
                            bot.deleteMessage(chatId, botMsgIdx);
                            botMsgIdx = null;
                        }

                        message += `\n<i>можете ввести следующий артикул для поиска</i>\n`;

                        await bot.sendMessage(
                            chatId, 
                            message,
                            startFindOptions
                        );
                    };
                }
            }

            if (!foundMatch) {
                if (botMsgIdx !== null) {
                    bot.deleteMessage(chatId, botMsgIdx);
                    botMsgIdx = null;
                }
                return bot.sendMessage(
                    chatId,
                    `Совпадения с артикулом ${user.vendorCode} в файле "остатки_лоймина" не найденны.\n<i>можете ввести следующий артикул для поиска</i>`,
                    {parse_mode: 'HTML'}
                );
            }

        } catch (e) {
            console.log(e);
            if (botMsgIdx !== null) {
                bot.deleteMessage(chatId, botMsgIdx);
                botMsgIdx = null;
            }
            return bot.sendMessage(
                chatId, 
                `Ошибка при чтении файла ${filePath}.`
            );
        }
    }
}

// ======================================================================================================================================
// Функция поиска остатков по поставщику Лоймина
// ======================================================================================================================================

async function findSirpi(chatId) {

    let fileNameSirpi = 'остатки_сирпи';

    const result = await findExcelFile(fileNameSirpi);
    const filePath = result.fileNameSirpi;
    console.log(filePath);

    if (filePath) {

        const user = await UserModel.findOne({
            where: {
                chatId: chatId
            }
        });

        try {

            const workbook = XLSX.readFile(filePath);
            const firstWorksheet = workbook.Sheets[workbook.SheetNames[0]];

            let foundMatch = false;

            for (let cellAddress in firstWorksheet) {
                
                if (cellAddress[0] === '!') continue;

                const cellValue = firstWorksheet[cellAddress].v;
        
                if (cellValue !== null) {
                    let formatedCellValue = cellValue.toString().trim().replace(/[\s]/g, '');
                    const formatedUserVC = user.vendorCode.toString().trim().replace(/[\s]/g, '');
        
                    if (isNaN(formatedCellValue)) {
                        formatedCellValue = formatedCellValue.toUpperCase();
                    }

                    if (formatedCellValue.includes(formatedUserVC)) {
                        foundMatch = true;

                        const aValue = firstWorksheet['A' + cellAddress.substring(1)].v; // Номенкулатура
                        const bValue = firstWorksheet['B' + cellAddress.substring(1)].v; // Артикул
                        const cValue = firstWorksheet['C' + cellAddress.substring(1)].v; // В коробе 
                        const dValue = firstWorksheet['D' + cellAddress.substring(1)].v; // Продается не кратно коробкам
                        let iValue = firstWorksheet['I' + cellAddress.substring(1)].v; // Цена базовая
                        const jValue = firstWorksheet['J' + cellAddress.substring(1)].v; // Валюта
                        const kValue = firstWorksheet['K' + cellAddress.substring(1)].v; // Цена РРЦ
                        const lValue = firstWorksheet['L' + cellAddress.substring(1)].v; // Валюта РРЦ

        
                        if (botMsgIdx !== null) {
                            bot.deleteMessage(chatId, botMsgIdx);
                            botMsgIdx = null;
                        }
                        return bot.sendMessage(
                            chatId, 
                            `<b>${aValue}</b>\nВ коробе: ${cValue}\nПродается ли кратно коробкам: ${dValue}\nБазовая цена: ${iValue} ${jValue}\nЦена РРЦ: ${kValue} ${lValue}\n\n<i>можете ввести следующий артикул для поиска</i>`,
                            startFindOptions
                        );
                    }
                }
            }

        if (!foundMatch) {
            if (botMsgIdx !== null) {
                bot.deleteMessage(chatId, botMsgIdx);
                botMsgIdx = null;
            }
            return bot.sendMessage(
                chatId,
                `Совпадения с артикулом ${user.vendorCode} в файле "остатки_сирпи" не найденны.\n<i>можете ввести следующий артикул для поиска</i>`,
                {parse_mode: 'HTML'}
            );
        }

        } catch (e) {
            console.log(e);
            if (botMsgIdx !== null) {
                bot.deleteMessage(chatId, botMsgIdx);
                botMsgIdx = null;
            }
            return bot.sendMessage(chatId, `Ошибка при чтении файла ${filePath}.`);
        }
    }
}

// ======================================================================================================================================
// Функция поиска остатков по поставщику Brink&Campman
// ======================================================================================================================================


async function findBrink(chatId) {

    let fileNameBrink = 'остатки_brink&campman';

    const result = await findExcelFile(fileNameBrink);
    const filePath = result.fileNameBrink;

    if (filePath) {

        const user = await UserModel.findOne({
            where: {
                chatId: chatId
            }
        });

        try {

            const workbook = XLSX.readFile(filePath);
            const firstWorksheet = workbook.Sheets[workbook.SheetNames[0]];

            let foundMatch = false;
            let message = '';

            for (let cellAddress in firstWorksheet) {
                
                if (cellAddress[0] === '!') continue;

                const cellValue = firstWorksheet[cellAddress].v;
        
                if (cellValue !== null) {
                    let formatedCellValue = cellValue.toString().trim().replace(/[\s]/g, '');
                    const formatedUserVC = user.vendorCode.toString().trim().replace(/[\s]/g, '');
        
                    if (isNaN(formatedCellValue)) {
                        formatedCellValue = formatedCellValue.toUpperCase();
                    }

                    if (formatedCellValue.includes(formatedUserVC)) {
                        foundMatch = true;

                        const bValue = firstWorksheet['B' + cellAddress.substring(1)].v;    // Номенкулатура
                        const cCell = firstWorksheet['C' + cellAddress.substring(1)];   // Ячейка EAN штрихкода 
                            let cValue = {};    // EAN штрихкод 

                            if (cCell && cCell.v !== undefined) {
                                cValue = cCell.v.toString();    // EAN штрихкод 
                            } else {
                                cValue = 'нет';
                            }

                        const fValue = firstWorksheet['F' + cellAddress.substring(1)].v;    // Свободный остаток в наличии на складе
                        let fDate = firstWorksheet['F1'].v.split(" ")[3];   // Дата свободного остатка

                            if ( !isNaN(fDate) ) {
                                const year = fDate.substring(0, 4);
                                const month = fDate.substring(4, 6);
                                const day = fDate.substring(6, 8);
                                fDate = `${day}.${month}.${year}`;
                            }

                        message += `Остаток <b>${bValue}</b> на <b>${fDate}</b>:\nEAN: ${cValue}\n\nСвободный остаток на складе: ${fValue}\n\n`;

                        const gCell = firstWorksheet['G' + cellAddress.substring(1)];   // Дата следующей поставки
                            let gValue = {};

                            if (gCell && gCell.v !== undefined) {
                                gValue = gCell.v.toString();                                   
                            } else {
                                gValue = 'неизвестна';
                            }

                            if ( !isNaN(gValue) ) {
                                const year = gValue.substring(0, 4);
                                const month = gValue.substring(4, 6);
                                const day = gValue.substring(6, 8);
                                gValue = `${day}.${month}.${year}`;
                            }
                            
                        message += `Дата следующей поставки: ${gValue}\n`;

                        const hCell = firstWorksheet['H' + cellAddress.substring(1)];   // Ячейка свободного остатка товара в пути
                            let hValue = {};

                            if (hCell !== undefined) {
                                hValue = hCell.v.toString();    // Свободный остаток товаров в пути 
                                message += `Свободный остаток товара в пути: ${hValue} ед.\n`;
                            }
                        
                        message += `\n<i>можете ввести следующий артикул для поиска</i>`
                        
                        if (botMsgIdx !== null) {
                            bot.deleteMessage(chatId, botMsgIdx);
                            botMsgIdx = null;
                        }
                        return bot.sendMessage(
                            chatId, 
                            message,
                            startFindOptions
                        );
                    }
                }
            }

        if (!foundMatch) {
            if (botMsgIdx !== null) {
                bot.deleteMessage(chatId, botMsgIdx);
                botMsgIdx = null;
            }
            return bot.sendMessage(
                chatId,
                `Совпадения с артикулом ${user.vendorCode} в файле "остатки_сирпи" не найденны.\n<i>можете ввести следующий артикул для поиска</i>`,
                {parse_mode: 'HTML'}
            );
        }

        } catch (e) {
            console.log(e);
            if (botMsgIdx !== null) {
                bot.deleteMessage(chatId, botMsgIdx);
                botMsgIdx = null;
            }
            return bot.sendMessage(chatId, `Ошибка при чтении файла ${filePath}.`);
        }
    }
}

// ======================================================================================================================================
//СТАРТ РАБОТЫ ПРОГРАММЫ=================================================================================================================
// ======================================================================================================================================

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
                `И снова здравствуйте, ${user.nickname}!\nВы в главном меню:`,
                mainMenuOptions
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
                `Приветcтвую, ${msg.from.first_name}! Меня зовут бот Зак.\nПриятно познакомиться!\nЯ могу подсказать наличие каталогов текстиля и обоев в магазинах, показать остатки продукции ORAC на складах в МСК и СПБ, производить поиск остатков на сайте поставщика ОПУС, а так же отправлять запросы в виде email на наличие, сроки поставки и резерв по многим российским поставщикам.\nКак я могу к вам обращаться?`
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

});

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
});

bot.onText(/\/x/, async msg => {
    const chatId = msg.chat.id;
    lc = null; 

    const response = await axios.post("https://dealer.decaro.ru/local/components/whatasoft/product.quantity/ajax.php", {
        "id": 439954
        }, {
            "headers": {
            "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
            }
        })

        const data = JSON.parse(response.data);

        console.log(data.status); // Выводит 'ok'
        console.log(data.exec_time); // Выводит 3.8805179595947266
        console.log(data.data); // Выводит HTML-код таблицы доступности товара
        
        // const $ = cheerio.load(response.data);


    // const $ = cheerio.load(response.html);
    // console.log($); 
    // const message = $('.availability-table').text().trim();
    // await bot.sendMessage(chatId, formatedData);

    // $(".availability-table-section").each((i, element) => {
    //     let status = $(element).find(".status").text();
    //     let days = $(element).find(".days").text();
    //     let small = $(element).find("small").text();
    //     message += `${status} ${days}\n${small}\n`;
    // });
    // console.log(message);
});


bot.onText(/\/settings/, async msg => {
    const chatId = msg.chat.id;
    lc = null; 

    return bot.sendMessage(
        chatId, 
        `Настройки:`, 
        settingsOptions
    );
});

bot.onText(/\/files/, (msg) => {
    const chatId = msg.chat.id;
    const folderPath = '/root/zak/xl';
  
    // Получение списка файлов в папке
    fs.readdir(folderPath, async (err, files) => {
        if (err) {
            console.log(err);
            return bot.sendMessage(chatId, 'Произошла ошибка при получении списка файлов.');
        }
  
        // Отправка списка файлов
        await bot.sendMessage(chatId, 'Список файлов:');
        files.forEach((file) => {
            return bot.sendMessage(chatId, `<code>${file}</code>`, {parse_mode: 'HTML'} );
        });
    });
});

bot.onText(/\/getfile (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const fileName = match[1];
    const filePath = path.join('/root/zak/xl', fileName);
  
    // Проверка существования файла
    fs.access(filePath, fs.constants.F_OK, (err) => {
        if (err) {
            return bot.sendMessage(chatId, 'Файл не найден.');
        }
  
        // Отправка файла
        bot.sendDocument(chatId, filePath);
    });
  });

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
        
        if (msg.document) {
            let file_name = msg.document.file_name;

            if (file_name.toLowerCase().includes('каталоги') ||
                file_name.toLowerCase().includes('прайслистов')
                ) {

                let fileName = {};
                if (file_name.toLowerCase().includes('26') && 
                    file_name.toLowerCase().includes('каталоги')
                    ) {
                    fileName = `каталоги_распределение_в_салоны_26_09_19.xlsx`;
                }
                if (file_name.toLowerCase().includes('текстиль') &&
                    file_name.toLowerCase().includes('каталоги')
                    ) {
                    fileName = `текстиль_каталоги_распределение_в_салоны.xlsx`;
                }
                if (file_name.toLowerCase().includes('прайслистов')) {
                    fileName = `список_прайслистов.xlsx`;
                }

                await bot.getFile(msg.document.file_id).then((file) => {

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

            // Сохранение файлов остатков. Обрезка дат, нижний регистр, замена пробелов на "_"
            } else if (file_name.toLowerCase().includes('orac') || 
                        file_name.toLowerCase().includes('brink') ||
                        file_name.toLowerCase().includes('орак') ||
                        file_name.toLowerCase().includes('делюкс') ||
                        file_name.toLowerCase().includes('рус') ||
                        file_name.toLowerCase().includes('баутекс') ||
                        file_name.toLowerCase().includes('лоймина') ||
                        file_name.toLowerCase().includes('сирпи') ||
                        file_name.toLowerCase().includes('delux') ||
                        file_name.toLowerCase().includes('rus') ||
                        file_name.toLowerCase().includes('bautex') || 
                        file_name.toLowerCase().includes('loymina') ||
                        file_name.toLowerCase().includes('sirpi') ||
                        file_name.toLowerCase().includes('campman') 
                    ) {

                    let fileName = {};
                    file_name = file_name.replace(/\s\d+|\.\d+/g, '');  // удаление дат
                    let file_format = file_name.split(".")[1];  // определение формата файла
                    
                    if ( (file_name.toLowerCase().includes('orac') || 
                            file_name.toLowerCase().includes('орак')) &&
                        (file_name.toLowerCase().includes('msk') || 
                            file_name.toLowerCase().includes('мск')) 
                    ) {
                        fileName = `orac_мск.${file_format}`;

                    } else if ( (file_name.toLowerCase().includes('orac') || 
                                    file_name.toLowerCase().includes('орак')) &&
                                (file_name.toLowerCase().includes('spb') || 
                                    file_name.toLowerCase().includes('спб')) 
                    ) {
                        fileName = `orac_спб.${file_format}`;

                    } else if ( (file_name.toLowerCase().includes('decor') || 
                                    file_name.toLowerCase().includes('декор')) &&
                                (file_name.toLowerCase().includes('delux') || 
                                    file_name.toLowerCase().includes('делюкс')) 
                    ) {
                        fileName = `остатки_декор_делюкс.${file_format}`;

                    } else if ( (file_name.toLowerCase().includes('декор') || 
                                    file_name.toLowerCase().includes('decor')) &&
                                (file_name.toLowerCase().includes('рус') || 
                                    file_name.toLowerCase().includes('rus')) 
                    ) {
                        fileName = `остатки_декор_рус.${file_format}`;

                    } else if (file_name.toLowerCase().includes( 'баутекс' ) || 
                                file_name.toLowerCase().includes( 'bautex' ) 
                    ) {
                        fileName = `остатки_баутекс.${file_format}`;

                    } else if (file_name.toLowerCase().includes( 'лоймина' ) || 
                                file_name.toLowerCase().includes( 'loymina' ) 
                    ) {
                        fileName = `остатки_лоймина.${file_format}`;

                    } else if (file_name.toLowerCase().includes( 'brink' ) || 
                                file_name.toLowerCase().includes( 'campman' ) 
                    ) {
                        fileName = `остатки_brink&campman.${file_format}`;

                    } else if (file_name.toLowerCase().includes( 'sirpi' ) || 
                                file_name.toLowerCase().includes( 'сирпи' ) 
                    ) {
                        fileName = `остатки_сирпи.${file_format}`;

                    }

                    await bot.getFile(msg.document.file_id).then((file) => {

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
                    `В целях экономии памяти, я сохраняю лишь определённые эксель файлы\nЕсли желаете, чтобы я научился работать с вашим документом, то обратитесь к моему разработчику\nn_kharitonov@manders.ru`
                );
            }
            
        } else if (password === false) {

            if (text === '111QWER!!!') {
                password = 'true';

                let createNewUser = await UserModel.create({chatId});
                console.log(`Новый пользователь создан: ${msg.from.first_name} ${msg.from.last_name}`);
                 await createNewUser.update({
                    firstName: msg.from.first_name, 
                    lastName: msg.from.last_name, 
                });
                lc = '/editNickname';
                return bot.sendMessage(
                    chatId, 
                    `Приветcтвую, ${msg.from.first_name}! Меня зовут бот Зак.\nПриятно познакомиться!\nЯ могу подсказать наличие каталогов текстиля и обоев в магазинах, показать остатки продукции ORAC на складах в МСК и СПБ, производить поиск остатков на сайте поставщика ОПУС, а так же отправлять запросы в виде email на наличие, сроки поставки и резерв по многим российским поставщикам.\nКак я могу к вам обращаться?`
                );

            } else {
                return bot.sendMessage(
                    chatId, 
                    `В доступе отказано.`
                );
            }

        } else if (text === '/mainmenu') {

            lc = null;
            return bot.sendMessage(
                chatId, 
                `Вы в главном меню, ${user.nickname}\nВаш персональный id: <code>${chatId}</code>`,
                mainMenuOptions
            ); 

        } else if (lc === '/editEmail') {

            await user.update({email: text.toLowerCase()});
            return bot.sendMessage(
                chatId, 
                `Ваш email "<b>${user.email}</b>" успешно сохранён\n<i>(для перезаписи введите email повторно)</i>`, 
                beginWorkOptions
            );

        } else if (lc === '/editNickname') {

            await user.update({nickname: text});
            return bot.sendMessage(
                chatId, 
                `Хорошо, "<b>${user.nickname}</b>", я запомню.\n<i>(для перезаписи введите никнейм повторно)</i>`, 
                mainMenuReturnOptions
            );

        } else if (lc === '/enterBrand') {

            await user.update({brand: text.toUpperCase()});

            let cValue = text;
            let PricelistLink = await findPricelistLink(chatId, cValue);

            if (PricelistLink.vendor === null) {
                return bot.sendMessage(
                    chatId, 
                    `Такой бренд не найден, проверьте написание бренда.`
                );
            } else if (user.brand === 'RASCH') {
                return bot.sendMessage(
                    chatId,
                    `Возможность продажи бренда Rasch нужно уточнить у Юлии Скрибник!`
                )
            } else {
                return bot.sendMessage(
                    chatId, 
                    `<b>Бренд найден</b>\n<b>ВАЖНО:</b> <u>Уточняйте наличие каталога.\nБез каталога в наличии, продажа запрещена!\nВозможность продажи уточнить у Юлии Скрибник!</u>\n\n${PricelistLink.messagePrice}`,
                    checkVendorOptions
                );
            }

        } else if (lc === '/enterVC') {
            if (isNaN(user.vendorCode)) {
                await user.update({vendorCode: text.toUpperCase()});
            } else {
                await user.update({vendorCode: text});
            }
            await bot.sendMessage(chatId, 'Идёт обработка вашего запроса . . .');
            const formatedUserVendor = user.vendor.replace(/[\s-]/g, '');
            botMsgIdx = msg.message_id += 1; 

            if (formatedUserVendor === 'ОПУС') {

                if (user.vendorCode.length < 4) {

                    if (botMsgIdx !== null) {
                        bot.deleteMessage(chatId, botMsgIdx);
                        botMsgIdx = null;
                    }
                    return bot.sendMessage(
                        chatId,
                        `Наименование искомого объекта не может быть короче 4х символов\nвведите артикул заново:`
                    );
                } else {
                    return startFindOpus(chatId);
                }

            } else if (formatedUserVendor === 'ДЕКОРТРЕЙД') {

                if (user.vendorCode.length < 4) {

                    if (botMsgIdx !== null) {
                        bot.deleteMessage(chatId, botMsgIdx);
                        botMsgIdx = null;
                    }
                    return bot.sendMessage(
                        chatId,
                        `Наименование искомого объекта не может быть короче 4х символов\nвведите артикул заново:`
                    );
                } else {
                    return startFindDecaro(chatId, msg);
                }

            } else if (formatedUserVendor.includes('ДЕКОРДЕЛЮКС')) {

                if (user.vendorCode.length < 4) {
                    if (botMsgIdx !== null) {
                        bot.deleteMessage(chatId, botMsgIdx);
                        botMsgIdx = null;
                    }
                    return bot.sendMessage(
                        chatId,
                        `Наименование искомого объекта не может быть короче 4х символов\nвведите артикул заново:`
                    );
                } else {
                    return findDecorDelux(chatId);
                }

            } else if (formatedUserVendor.includes('ДЕКОРРУС')) {

                if (user.vendorCode.length < 4) {
                    if (botMsgIdx !== null) {
                        bot.deleteMessage(chatId, botMsgIdx);
                        botMsgIdx = null;
                    }
                    return bot.sendMessage(
                        chatId,
                        `Наименование искомого объекта не может быть короче 4х символов\nвведите артикул заново:`
                    );
                } else {
                    return findDecorRus(chatId);
                }

            } else if (formatedUserVendor.includes('БАУТЕКС')) {

                if (user.vendorCode.length < 4) {
                    if (botMsgIdx !== null) {
                        bot.deleteMessage(chatId, botMsgIdx);
                        botMsgIdx = null;
                    }
                    return bot.sendMessage(
                        chatId,
                        `Наименование искомого объекта не может быть короче 4х символов\nвведите артикул заново:`
                    );
                } else {
                    return findBautex(chatId);
                }

            } else if (formatedUserVendor.includes('ЛОЙМИНА')) {

                if (user.vendorCode.length < 4) {
                    if (botMsgIdx !== null) {
                        bot.deleteMessage(chatId, botMsgIdx);
                        botMsgIdx = null;
                    }
                    return bot.sendMessage(
                        chatId,
                        `Наименование искомого объекта не может быть короче 4х символов\nвведите артикул заново:`
                    );
                } else {
                    return findLoymina(chatId);
                }

            } else if (formatedUserVendor.includes('ОРАК')) {

                lc === '/oracСheck';
                return findOrac(chatId);

            } else if (formatedUserVendor.includes('СИРПИ')) {

                if (user.vendorCode.length < 4) {
                    if (botMsgIdx !== null) {
                        bot.deleteMessage(chatId, botMsgIdx);
                        botMsgIdx = null;
                    }
                    return bot.sendMessage(
                        chatId,
                        `Наименование искомого объекта не может быть короче 4х символов\nвведите артикул заново:`
                    );

                } else {
                    return findSirpi(chatId);
                }

            }
            
            if (formatedUserVendor.includes('BRINK&CAMPMAN')) {

                if (user.vendorCode.length < 4) {
                    if (botMsgIdx !== null) {
                        bot.deleteMessage(chatId, botMsgIdx);
                        botMsgIdx = null;
                    }
                    return bot.sendMessage(
                        chatId,
                        `Наименование искомого объекта не может быть короче 4х символов\nвведите артикул заново:`
                    );

                } else {
                    return findBrink(chatId);
                }

            } else {

                lc = '/enterNumberofVC';
                if (botMsgIdx !== null) {
                    bot.deleteMessage(chatId, botMsgIdx);
                    botMsgIdx = null;
                }
                return bot.sendMessage(
                    chatId,
                    `Хорошо!\n<b>Запрашиваемые вами параметры:</b>\nБренд: ${user.brand}\nАртикул: ${user.vendorCode}\nТеперь введите колличество:\n<i>а так же введите единицы измерения через пробел</i>`,
                    { parse_mode: 'HTML' }
                );
            }

        } else if (lc === '/request1C') {
            await user.update({vendorCode: text});
            await bot.sendMessage(chatId, 'Идёт обработка вашего запроса . . .');
            const vendorCode = user.vendorCode;
            botMsgIdx = msg.message_id += 1; 
            let findResult1C = await startRequest1C(chatId, vendorCode); 
            return bot.sendMessage(
                chatId, 
                `${findResult1C.messageResult1C}`,
                { parse_mode: 'HTML'}
            );

        } else if (lc === '/enterReserveNumber') {
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

        } else if (lc === '/enterNumberofVC') {

            lc = null;
            await user.update({reserveNumber: text});
            return bot.sendMessage(
                chatId, 
                `Отлично!\n<b>Запрашиваемые вами параметры:</b>\nБренд: ${user.brand}\nАртикул: ${user.vendorCode}\nКолличество: ${user.reserveNumber}\n\nХорошо, теперь я могу запросить наличие и срок поставки.\nНужно поставить резерв?`, 
                startFind2Options
            );

        } else if (lc === '/catalogСheck') {

            await user.update({catalog: text});

            await bot.sendMessage(chatId, 'Идёт поиск каталога . . .');
            botMsgIdx = msg.message_id += 1; 
            return findCatalogWallpaper(chatId);

        } else if (lc === '/oracСheck') {

            await user.update({vendorCode: text.toUpperCase()});
            await bot.sendMessage(chatId, `Идёт поиск ${text} . . .`);
            botMsgIdx = msg.message_id += 1; 
            return findOrac(chatId);

        } else if (text === '/infowork') {

            return bot.sendMessage(
                chatId, 
                `${user.nickname} вот, что вы искали:\n\nКаталог: ${user.catalog}\nБренд: ${user.brand}\nАртикул: ${user.vendorCode}\nКолличество: ${user.reserveNumber}\n\nВаш email: ${user.email}`,
                resetInfoWorkOptions
            );

        } else if (text === '/infogame') {

            lc = null;
            return bot.sendMessage(
                chatId, 
                `Правильных ответов: "${user.right}"\nНеправильных ответов: "${user.wrong}"`, resetOptions
            );

        } else if (text.toLowerCase().includes('привет')) {

            return bot.sendSticker(
                chatId, 
                'https://cdn.tlgrm.app/stickers/087/0cf/0870cf0d-ec03-41e5-b239-0eb164dca72e/192/1.webp'
            );

        } else if ( (text !== '/game' && 
                        text !== '/start' && 
                        text !== '/settings' && 
                        text !== '/files' && 
                        text !== '/x' &&
                        !text.startsWith('/getfile'))  
                    ) {
            
            return bot.sendMessage(
                chatId,
                `Для начала работы перейдите в Главное меню: <b>/mainmenu</b>\nи нажмите кнопку <b>"Запрос: остатки+сроки+резерв"</b>.`,
                { parse_mode: 'HTML' }
            );
        }

    } catch (e) {
        console.log('Сработал слушатель документов.', e)
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
            `Вы в главном меню, ${user.nickname}\nВаш персональный id: <code>${chatId}</code>`,
            mainMenuOptions
        ); 

    } else if (data === '/beginwork') {

        if (!user.email) {
            await editEmail(chatId);
        } else {
            await bot.sendMessage(
                chatId, 
                'Для начала формирования запроса по остаткам и срокам есть два пути:\n\n<b>Поиск по каталогу:</b> - для тех случаев, когда вы не знаете из какого каталога искомый вами артикул и неизвеста возможность закупки данного артикула у поставщика.\n\n<b>Поиск по бренду:</b> - для случаев когда вы уверенны, что искомый вами артикул возможно заказать у поставщика.', 
                workOptions
            );
        } 
        return; 

    } else if (data === '/beginwork1') {

        if (!user.email) {
            await editEmail(chatId);
        } else {
            await bot.sendMessage(
                chatId, 
                'Чем могу вам помочь?', 
                work1Options
            );
        } 
        return; 

    } else if (data === '/editNickname') {

        return editNickname(chatId);

    } else if (data === '/editEmail') {

        return editEmail(chatId);

    } else if (data === '/resetInfoWork') {

        await user.update({catalog: null});
        await user.update({brand: null});
        await user.update({vendorCode: null});
        await user.update({reserveNumber: null});
        return bot.sendMessage(
            chatId,
            `Искомые параметры сброшенны.`
        );

    } else if (data === '/checkVendor') {

        lc = '/enterVC';
        if (user.vendor !== null) {

            const formatedUserVendor = user.vendor.replace(/[\s-]/g, '');

            if (formatedUserVendor.includes('РИКСОР') ||
                formatedUserVendor.includes('ЛЕВАНТИН') ||
                formatedUserVendor.includes('ИНТЕРДЕКОР') ||
                formatedUserVendor.includes('ОРАК')
                // formatedUserVendor.includes('КАДО') ||
                // formatedUserVendor.includes('АКУРА') ||
                // formatedUserVendor.includes('КОНТРАКТПЛЮС') ||
                // formatedUserVendor.includes('ГАЙДАРЬ') ||
                // formatedUserVendor.includes('ГЛОБАЛТЕКС') ||
                // formatedUserVendor.includes('БЕРНИНГХЭДС') ||
                // formatedUserVendor.includes('БЕКАРТТЕКСТИЛЬ') ||
                // formatedUserVendor.includes('АВТ') ||
                // formatedUserVendor.includes('МЕРКЬЮРИФОРДЖ') ||
                // formatedUserVendor.includes('ФАБРИКДЕКО') ||
                // formatedUserVendor.includes('ШИЛИН') ||
                // formatedUserVendor.includes('ENGLISCHDECOR') ||
                // formatedUserVendor.includes('ПОЛУНИЧЕВА') ||
                // formatedUserVendor.includes('ШЕВЧЕНКО') ||
                // formatedUserVendor.includes('ФОРПОСТ') ||
                // formatedUserVendor.includes('HOUSEOFJAB') ||
                // formatedUserVendor.includes('ЕВРОПЕЙСКИЕ') ||
                // formatedUserVendor.includes('БУНТИНА') ||
                // formatedUserVendor.includes('RUBELLI') ||
                // formatedUserVendor.includes('ОКНАРОСТА') ||
                // formatedUserVendor.includes('ЛОЙМИНА') ||
                // formatedUserVendor.includes('ЛИСОХМАРА') ||
                // formatedUserVendor.includes('ПОДРЕЗ') ||
                // formatedUserVendor.includes('РОБЕРТС') ||
                // formatedUserVendor.includes('ЮГАРТ') ||
                // formatedUserVendor.includes('ПРОТОС') ||
                // formatedUserVendor.includes('РУАЛЬЯНС') 
            ) {
                return bot.sendMessage(
                    chatId, 
                    `Чтобы <b>отправить email\n</b> с запросом: остатков, срока поставки,\nа так же резервирования интересующей вас позиции бренда <b>${user.brand}</b>\n<b>Введите артикул искомого вами объекта:</b>`,
                    {parse_mode: 'HTML'}
                );
            } else if (formatedUserVendor.includes('ОПУС')) {
                return bot.sendMessage(
                    chatId, 
                    `Чтобы <b>посмотреть остатки</b> на сайте "https://opusdeco.ru"\n<b>Введите артикул искомого вами объекта:</b>`,
                    {parse_mode: 'HTML'}
                );
            } else if (formatedUserVendor.includes('ДЕКОРТРЕЙД')) {
                return bot.sendMessage(
                    chatId, 
                    `Чтобы <b>посмотреть остатки</b> на сайте "https://dealer.decaro.ru"\n<b>Введите артикул искомого вами объекта:</b>`,
                    {parse_mode: 'HTML'}
                );
            } else if  (formatedUserVendor.includes('ДЕКОРДЕЛЮКС') ||
                        formatedUserVendor.includes('ОРАК') ||
                        formatedUserVendor.includes('ДЕКОРРУС') ||
                        formatedUserVendor.includes('БАУТЕКС') ||
                        formatedUserVendor.includes('ЛОЙМИНА') ||
                        formatedUserVendor.includes('СИРПИ') ||
                        formatedUserVendor.includes('BRINK&CAMPMAN')
                    ) {

                await bot.sendMessage(
                    chatId,
                    `Введите <b>артикул</b> или <b>наименование</b> искомого вами объекта:`,
                    { parse_mode: 'HTML' }
                );
                botMsgIdx = msg.message.message_id += 1;
                return;
            } else {
                return bot.sendMessage(
                    chatId, 
                    `К сожалению, мне ещё не разрешили работать с поставщиком бренда <b>${user.brand}</b>.`,
                    {parse_mode: 'HTML'}
                );
            }
        } else {
            return bot.sendMessage(
                chatId, `Бренд не найден, проверьте соответсвие брендов в эксель файлах:\n<b>"Каталоги  распределение в салоны 26.09.19"</b>\n<b>"Текстиль Каталоги  распределение в салоны"</b>\nc эксель файлом <b>"Список прайслистов"</b>.`,
                { parse_mode: 'HTML' }
            );
        }
            
    } else if(data === '/enterBrand') {

        lc = data;

        return bot.sendMessage(
            chatId, `Для начала работы введите бренд, по которому мы будем производить поиск:`, 
            {parse_mode: 'HTML'}
        );

    } else if (data === '/enterReserveNumber') {

        lc = data;
        return bot.sendMessage(
            chatId, `Введите номер партии и колличество, которое желаете зарезервировать:<i>например: <b>268А 3</b>\nесли партия отсутствует, то введите только колличество</i>`,
            { parse_mode: "HTML" }
        );

    } else if (data === '/preSendEmail') {

        lc = data;
        if ((user.reserveNumber) !== (user.reserveNumber.split(" ")[0])) {

            subject = `Резерв ${user.vendorCode}, партия: ${user.reserveNumber.split(" ")[0]}, ${user.reserveNumber.split(" ")[1]} шт, по запросу ${chatId}`;
            textMail = `\n\nЗдравствуйте!\nПросьба поставить в резерв следующую позицию: \nартикул: ${user.vendorCode}, бренд: ${user.brand}, партия: ${user.reserveNumber.split(" ")[0]} в колличестве: ${user.reserveNumber.split(" ")[1]} шт.\nПожалуйста пришлите обратную связь ответным письмом на purchasing_internal@manders.ru.`;
        
        } else {

            subject = `Резерв ${user.vendorCode},  ${user.reserveNumber} шт, по запросу ${chatId}`;
            textMail = `\n\nЗдравствуйте!\nПросьба поставить в резерв следующую позицию: \nартикул: ${user.vendorCode}, бренд: ${user.brand}, в колличестве: ${user.reserveNumber} шт.\nПожалуйста пришлите обратную связь ответным письмом на purchasing_internal@manders.ru.`;
        
        }
        return bot.sendMessage(
            chatId, 
            `Сформирован email:\nТема сообщения: <strong>${subject}</strong>\nКому: <b>${user.vendorEmail}</b>\nКопия: <b>${user.email}</b>\nТекст сообщения:\n${textMail}\n\n<i>Это сообщение тестовое и будет отправленно только на ${user.email}.</i>`, 
            sendReserveOptions
        );

    } else if (data === '/preSendEmailReserveYes') {

        subject = `Наличие+сроки+резерв ${user.vendorCode},  ${user.reserveNumber}, по запросу ${chatId}`;
        textMail = `\n\nЗдравствуйте!\nУточните, пожалуйста, наличие и срок поставки:\nартикул: ${user.vendorCode}, бренд: ${user.brand}, в колличестве: ${user.reserveNumber}.\nПросьба поставить в резерв.\nПожалуйста пришлите обратную связь ответным письмом на purchasing_internal@manders.ru.`;
        
        return bot.sendMessage(
            chatId, 
            `Сформирован email:\nТема сообщения: <strong>${subject}</strong>\nКому: <b>${user.vendorEmail}</b>\nКопия: <b>${user.email}</b>\nТекст сообщения:\n${textMail}\n\n<i>Это сообщение тестовое и будет отправленно только на ${user.email}.</i>`,
            sendReserveOptions
        );

    } else if (data === '/preSendEmailReserveNo') {

        subject = `Наличие+сроки ${user.vendorCode},  ${user.reserveNumber}, по запросу ${chatId}`;
        textMail = `\n\nЗдравствуйте!\nУточните, пожалуйста, наличие и срок поставки:\nартикул: ${user.vendorCode}, бренд: ${user.brand}, в колличестве: ${user.reserveNumber}.\nПожалуйста пришлите обратную связь ответным письмом на purchasing_internal@manders.ru.`;
        
        return bot.sendMessage(
            chatId, 
            `Сформирован email:\nТема сообщения: <strong>${subject}</strong>\nКому: <b>${user.vendorEmail}</b>\nКопия: <b>${user.email}</b>\nТекст сообщения:\n${textMail}\n\n<i>Это сообщение тестовое и будет отправленно только на ${user.email}.</i>`, 
            sendReserveOptions
        );

    } else if (data === '/sendReserveEmail') {

        lc = data;
        return sendReserveEmail(chatId);

    } else if (data === '/catalogСheck') {

        lc = data;
        return bot.sendMessage(
            chatId, 
            'Введите <b>наименование каталога</b> содержащего искомый вами товар:\n<i>(после получения результата, вы можете отправить новое наименование для поиска следующего каталога)</i>', 
            {parse_mode: 'HTML'}
        );

    } else if (data === '/oracСheck') {

        lc = data;
        return bot.sendMessage(
            chatId, 
            'Введите искомый вами <b>артикул</b> товара ORAC :\n<i>(после получения результата, вы можете отправить другой артикул для поиска)</i>', 
            {parse_mode: 'HTML'}
        );

    } else if (data === '/request1C') {

        lc = '/request1C';
        return bot.sendMessage(
            chatId, 
            'Введите искомый вами <b>артикул</b>:\n<i>(после получения результата, вы можете отправить другой артикул для поиска)</i>', 
            {parse_mode: 'HTML'}
        );

    } else if (data === '/work2') {

        lc = null;
        return bot.sendMessage(
            chatId, 
            sorry, 
            mainMenuReturnOptions
        );

    } else if (data === '/work3') {

        lc = null;
        return bot.sendMessage(
            chatId, 
            sorry, 
            mainMenuReturnOptions
        );

    } else if (data === '/again') {

        lc = data;
        await bot.deleteMessage(
            chatId, 
            msg.message.message_id
        );
        return startGame(chatId);

    } else if (data === '/infogame') {

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

    } else if(data === '/reset') {

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

    } else if (lc === '/game' || lc === '/again') {

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
        console.log(err);  
        return bot.sendMessage(
            chatId, 
            'Ошибка в исполнении кода прослушивателя колбэков',
        );
    }

});

}

start();