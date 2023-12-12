const TelegramApi = require('node-telegram-bot-api');
const axios = require('axios');
const { SocksProxyAgent } = require('socks-proxy-agent');
const cheerio = require('cheerio');
const XLSX = require('xlsx');
const { JSDOM } = require('jsdom');
const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');
const util = require('util');

const readFile = util.promisify(fs.readFile);
const XlsxPopulate = require('xlsx-populate');
const tough = require('tough-cookie');  //
const { axiosCookieJarSupport } = require('axios-cookiejar-support');   //

//ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
chats = {};
             
botMsgIdx = {};    //айди последнего сообщения от бота
sorry = 'Извините, я этому пока ещё учусь😅\nПрошу вас, обратитесь с данным запросом к\npurchasing_internal@manders.ru';

//ИМПОРТЫ
// импорт кнопок
const {
    mainMenuOptions, 
    gameOptions, 
    againOptions, 
    resetOptions, 
    resetInfoWorkOptions,
    workOptions, 
    work1Options, 
    checkVendorOptions, 
    startFindOptions, 
    startFind1Options, 
    startFind2Options, 
    beginWorkOptions, 
    beginWork2Options, 
    mainMenuReturnOptions, 
    settingsOptions, 
    enterReserveNumberOptions, 
    sendReserveOptions, 
    beginWork3Options 
} = require('./options');

// ИМПОРТЫ
const sequelize = require('./db');
const UserModel = require('./models');
const { transporter, nodemailer } = require('./nodemailer');

// ======================================================================================================================================
// функции ==============================================================================================================================
// ======================================================================================================================================
// функция создания нового пользователя
// ======================================================================================================================================

const createNewUser = async (chatId, msg) => {
    
    const newUser = await UserModel.create({chatId});
    console.log(`Новый пользователь создан: ${msg.from.first_name} ${msg.from.last_name}`);

    const user = await UserModel.findOne({
        where: {
            chatId: chatId
        },
        attributes: [
            'id', 
            'chatId', 
            'lastCommand', 
            'firstName', 
            'lastName', 
            'email', 
            'nickname'
        ]
    });

    return user.update({
        firstName: msg.from.first_name, 
        nickname: msg.from.first_name,
        lastName: msg.from.last_name, 
        email: '/passwordcheck',
    });
}

// ======================================================================================================================================
// функция проверки пароля
// ======================================================================================================================================

const chekPassword = async (chatId, msg) => {
    let text = msg.text;

    const user = await UserModel.findOne({
        where: {
            chatId: chatId
        }, 
        attributes: ['id', 'chatId', 'lastCommand', 'email']
    });

    if (text === bot_password) {

        // lc = '/editNickname';
        await user.update({lastCommand: '/editEmail', email: '/editEmail'}, {
            where: {
                chatId: chatId,
            }
        })

        return bot.sendMessage(
            chatId, 
            `Приветcтвую, ${msg.from.first_name}! Приятно познакомиться!\n<b>Напишите Ваш рабочий email</b>?`,
            { parse_mode: 'HTML' }
        );

    } else {

        return bot.sendMessage(
            chatId, 
            `В доступе отказано.\nВведите пароль:`
        );
    }
}

// ======================================================================================================================================
// функция ввода email
// ======================================================================================================================================

const editEmail = async (chatId) => {

    const user = await UserModel.findOne({
        where: {
            chatId: chatId
        },
        attributes: ['id', 'chatId', 'lastCommand']
    });
    
    // lc = /editEmail
    await user.update({lastCommand: '/editEmail'}, {
        where: {
            chatId: chatId
        }
    })
    return bot.sendMessage(chatId,
        `<b>Напишите Ваш рабочий email</b>`,
        { parse_mode: 'HTML' }
    );
}

// ======================================================================================================================================
// функция ввода никнейма
// ======================================================================================================================================

const editNickname = async (chatId) => {

    const user = await UserModel.findOne({
        where: {
            chatId: chatId
        },
        attributes: [
            'id', 
            'chatId', 
            'lastCommand'
        ]
    });
    
    // lc = '/editNickname'
    await user.update({
        lastCommand: '/editNickname'
    }, {
        where: {
            chatId: chatId
        }
    });

    return bot.sendMessage(
        chatId, 
        `Введите пожалуйста Ваш никнейм\n<i>то как я буду к вам обращаться</i>:`,
        { parse_mode: 'HTML' }
    );
}

// ======================================================================================================================================
// функция поиска в 1C
// ======================================================================================================================================

const startRequest1C = async (chatId, vendorCode) => {

    try {
// PLGUM5&submit=Получить
        const searchUrl1C = `${url_manders_1C}=${vendorCode}&submit=Получить`;
        const response = await axios.get(searchUrl1C,  { timeout: 5000 });

        if (!response) {

            // let messageResult1C = `Подключение к 1С временно недоступно\n<i>это норма во внерабочее время магазинов</i>`
            // return { messageResult1C };

        } else {

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
                            quantity = cells[1].textContent.trim().split( "," )[0];   // количество
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
                            const balance = obj.quantity-obj.reserve;

                            if (balance) {
                                message += `Свободно: ${balance}\n`
                            }
                            if (obj.reserve > 0) {
                                message += `Резерв: ${obj.reserve}\n`
                            }
                            if (obj.quantity > 0) {
                                message += `Общий: ${obj.quantity}\n`
                            }
                            message += `\n`
                            return message;
                        }
                    }).join('');
    
                    if (messageResult1C.length !== 0) {
    
                        return { messageResult1C };
    
                    } else {
    
                        messageResult1C = `${vendorCode} по данным 1C не числится\n\n` // привязка к !findResult1C.toLowerCase().includes('не числится') 
                        return { messageResult1C };
                    }
    
                } else {
    
                    console.log('В таблице нет данных');
                }
            } else {
    
                console.log('Не найденны строки в таблице');
            }
        }

    } catch (e) {
        console.log('Ошибка выполенния кода', e);
    }
}

// ======================================================================================================================================
// функция проверки поставщика
// ======================================================================================================================================

const startCheckVendor = async (chatId, msg) => {
    // lc = '/enterVC';
    const user = await UserModel.findOne({
        where: {
            chatId: chatId
        },
        attributes: ['id', 'chatId', 'lastCommand', 'brand', 'vendor']
    });

    await user.update({lastCommand: '/enterVC'}, {
        where: {
            chatId: chatId
        }
    })

    if (user.vendor !== null) {

        const formatedUserVendor = user.vendor.replace(/[\s-]/g, '');

        if (formatedUserVendor.includes('ОПУС')) {
            return bot.sendMessage(
                chatId, 
                `Чтобы <b>посмотреть остатки</b> на сайте\n<code>https://opusdeco.ru</code>\n<b>Введите артикул искомого вами объекта:</b>`,
                { parse_mode: 'HTML' }
            );
        } else if (formatedUserVendor.includes('ДЕКОРТРЕЙД')) {
            return bot.sendMessage(
                chatId, 
                `Чтобы <b>посмотреть остатки</b> на сайте\n<code>https://dealer.decaro.ru</code>\n<b>Введите артикул искомого вами объекта:</b>`,
                { parse_mode: 'HTML' }
            );
        } else if (formatedUserVendor.includes('ЛЕВАНТИН')) {
            return bot.sendMessage(
                chatId, 
                `Чтобы <b>посмотреть остатки</b> на сайте\n<code>http://www.galleriaarben.ru</code>\n<b>Введите артикул искомого вами объекта:</b>`,
                { parse_mode: 'HTML' }
            );

        } else if (formatedUserVendor.includes('DESIGNERSGUILD')) {
            return bot.sendMessage(
                chatId, 
                `Чтобы <b>посмотреть остатки</b> на сайте\n<code>https://www.designersguild.com</code>\n<b>Введите артикул искомого вами объекта:</b>`,
                { parse_mode: 'HTML' }
            );

        } else if  (formatedUserVendor.includes('ДЕКОРДЕЛЮКС') ||
                    formatedUserVendor.includes('ОРАК') ||
                    formatedUserVendor.includes('ОРАК') ||
                    formatedUserVendor.includes('ДЕКОРРУС') ||
                    formatedUserVendor.includes('БАУТЕКС') ||
                    formatedUserVendor.includes('ЛОЙМИНА') ||
                    formatedUserVendor.includes('СИРПИ') ||
                    formatedUserVendor.includes('BRINK&CAMPMAN') ||
                    formatedUserVendor.includes('LITTLEGREENE')
                ) {

            await bot.sendMessage(
                chatId,
                `Введите <b>артикул</b> или <b>наименование</b> искомого вами объекта:`,
                { parse_mode: 'HTML' }
            );
            botMsgIdx = msg.message_id += 1;
            return;  

        } else {

            await user.update({lastCommand: '/enterBrand'}, {
                where: {
                    chatId: chatId
                }
            })

            return bot.sendMessage(
                chatId, 
                `К сожалению, мне ещё не разрешили работать с поставщиком бренда <b>${user.brand}</b>.`,
                { parse_mode: 'HTML' }
            );
        }
    } else {

        await user.update({lastCommand: '/enterBrand'}, {
            where: {
                chatId: chatId
            }
        })

        return bot.sendMessage(
            chatId, `Бренд не найден❌\nпроверьте соответсвие брендов в эксель файлах:\n<b>"Каталоги  распределение в салоны 26.09.19"</b>\n<b>"Текстиль Каталоги  распределение в салоны"</b>\nc эксель файлом <b>"Список прайслистов"</b>.`,
            { parse_mode: 'HTML' }
        );
    }
        
}

// ======================================================================================================================================
// функция html запроса по данным из БД на сайт поставщика ОПУС
// ======================================================================================================================================

const startFindOpus = async (chatId) => {
    // lc = '/enterVC';
    const user = await UserModel.findOne({
        where: {
            chatId: chatId
        },
        attributes: ['id', 'chatId', 'lastCommand', 'brand', 'vendorCode']
    });

    await user.update({lastCommand: '/enterVC'}, {
        where: {
            chatId: chatId
        }
    })

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
// функция html запроса по данным из БД на сайт поставщика ДЕКОР ТРЕЙД
// ======================================================================================================================================

const startFindDecaro = async (chatId, msg) => {
    // lc = '/enterVC';
    const user = await UserModel.findOne({
        where: {
            chatId: chatId
        },
        attributes: ['id', 'chatId', 'lastCommand', 'vendorCode']
    });

    await user.update({lastCommand: '/enterVC'}, {
        where: {
            chatId: chatId
        }
    })

    try {

        //Формируем URL для поиска
        const searchUrl = `https://dealer.decaro.ru/catalog/?tab=1&SECTION_ID=&ARTICLE=${user.vendorCode}&set_filter=y`;

        //Отправляем запрос на сайт
        const response = await axios.get(searchUrl);
        const $ = cheerio.load(response.data);

        const firstProductLink = $('div.item-title a').attr('href');

        if (firstProductLink) {
            
            const productResponse = await axios.get(`https://dealer.decaro.ru${firstProductLink}`);

            let $$ = cheerio.load(productResponse.data);
            const inner_props = $$('div.inner_props div.prop');
            const dataId = $$('div.availability-table').toString().trim().split('"')[3];
            let chars = ''; 

            
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
                if (item.name.includes('Розничная цена') && item.name !== 'Розничная цена') {
                    const rows = item.name.split('\n'); // разделение строки на подстроки по пробелу
                    const row1 = rows[0].trim(); // "Разничная цена"
                    const row2 = rows[1].trim(); // старая цена
                    const row3 = rows[2].trim(); // валюта старой цены
                    const row5 = rows[4].trim(); // новая цена
                    const row6 = rows[5].trim(); // валюта новой цены
                    chars += `${row1}: <s>${row2} ${row3}/рул</s> ${row5} ${row6}/рул\n`;
                    return;
                  }

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
                    "id": `${dataId}`
                }, {
                    "headers": {
                    "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
                    }
                })

            let $ = cheerio.load(responseQty.data.data);
            const availabilityTable = $('div.availability-table-section .item');

            if (availabilityTable.length > 0) {

                const availabilityTableValue = availabilityTable.map((index, element) => {

                    const rowsStatus = $(element).find('div.status');
                    const rowsDays = $(element).find('div.days');
                    const rowsDate = $(element).find('div.date');
                    const rowsArticul = $(element).find('div.articul');
                    const rowsQty = $(element).find('div.qty');
                    const rowsUnit = $(element).find('div.unit');
                    const rowsOther = $(element).find('small');

                    return {
                        status: rowsStatus.text().trim(),
                        days: rowsDays.text().trim(),
                        date: rowsDate.text().trim(),
                        articul: rowsArticul.text().trim(),
                        qty: rowsQty.text().trim(),
                        unit: rowsUnit.text().trim(),
                        other: rowsOther.text().trim()
                    }
                }).get(); // преобразуем объект Cheerio в обычный массив
            
                chars = '';

                // выводим данные из каждого элемента массива propsData
                availabilityTableValue.forEach((item) => {

                    chars += `<b>${item.status}:</b> `;

                    if (item.days !== null && item.days !== undefined) {
                        chars += `${item.days}`;
                    }                    
                    if (item.date !== null && item.date !== undefined) {
                        chars += `${item.date}`;
                    }
                    if (item.articul !== null && item.articul !== undefined) {
                        chars += `<code>${item.articul}</code> `;
                    }
                    if (item.qty !== null && item.qty !== undefined) {
                        chars += ` ${item.qty} `;
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
                    startFindOptions
                );

            } else {

                if (botMsgIdx !== null) {
                    bot.deleteMessage(chatId, botMsgIdx);
                    botMsgIdx = null;
                }
                return bot.sendMessage(
                    chatId, 
                    `Ответ сайта: не удалось получить количество.`, 
                    startFind1Options
                );
                
            }

        } else {

            if (botMsgIdx !== null) {
                bot.deleteMessage(chatId, botMsgIdx);
                botMsgIdx = null;
            }
            return bot.sendMessage(
                chatId, 
                `${user.vendorcode} на сайте не найден. Проверьте написание артикула`, 
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
// функция html запроса по данным из БД на сайт поставщика ЛЕВАНТИН
// ======================================================================================================================================

const startFindLevantin = async (chatId, msg) => {
    // lc = '/enterVC';
    const user = await UserModel.findOne({
        where: {
            chatId: chatId
        },
        attributes: [
            'id', 
            'chatId', 
            'lastCommand', 
            'vendorCode'
        ]
    });

    await user.update({
        lastCommand: '/enterVC'
    }, {
        where: {
            chatId: chatId
        }
    })

    let formatedVendorCode = user.vendorCode.replace(/,/g, '').replace(/galleria|arben/gi, '');
    let counter = 0;

    while (formatedVendorCode.includes("  ") && counter < 3) {
      formatedVendorCode = formatedVendorCode.replace(/\s\s/g, ' ');
      counter++;
    }

    try {

        const responseProduct = await axios.get(`http://www.galleriaarben.ru/catalog/exists/all/?arrFilterName=${formatedVendorCode.trim()}&set_filter=Y`);
        const $ = cheerio.load(responseProduct.data);

        const firstProductLink = $('div.row.catalog a').attr('href');

        if (firstProductLink) { 

            const responseAuth = await axios.post(`http://www.galleriaarben.ru/ajax/auth.php`, {
                backurl: `/ajax/auth.php`,
                AUTH_FORM: `Y`,
                TYPE: `AUTH`,
                Login: `Войти`,
                USER_LOGIN: levantin_login,
                USER_PASSWORD: levantin_password
            },{
                "headers": {
                    "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
                }
            });

            const cookies = responseAuth.headers['set-cookie'];
            
            const responseProductPage = await await axios.get(`http://www.galleriaarben.ru${firstProductLink}`, {
                headers: {
                  Cookie: cookies.join('; ') // передаем cookies в заголовке запроса
                }
            });

            const $$ = cheerio.load(responseProductPage.data);
            const availability = $$('.catalog-detail__available').text().trim();
            let message = '';

            // Извлекаем нужные строки
            const collection =  $$('.catalog-detail__header').text().trim();
            const title =  $$('.catalog-detail__title').eq(0).text().trim();
            const price =  $$('.catalog-detail__title').eq(1).text().trim();

            if (collection !== null) {
                message += `${collection}\n`;
            }
            if (title !== null) {
                message += `<b>${title}</b>\n`;
            }
            if (price !== null) {
                message += `${price}\n\n`;
            }

            // Извлекаем нужные строки из Блока характеристик
            const charsBlock = $$('.small-12.medium-6.large-8.columns.catalog-detail__text');

            const charsBlock1 = charsBlock.find('.row').eq(1);
            const charsBlock2 = charsBlock.find('.row').eq(2);

            charsBlock1.each((index, element) => {
                const everyRow = $(element).text().trim().replace(/\s+/g, ' ').replace(/\n+/g, '\n'); // Получаем текст строки и удаляем лишние пробелы
                message += `${everyRow}\n`;
            });

            message += `\n`;

            charsBlock2.each((row, index, element) => {
                const everyRow = $(index).text().trim().replace(/\s+/g, ' ').replace(/\n+/g, '\n'); // Получаем текст строки и удаляем лишние пробелы
                message += `${everyRow}\n`;
            });

            message += `\n`;
            message += `<b>В наличии:</b> ${availability.replace(/\s+/g, '')}\n\n`;
            message += ``;
            message += `<i>можете ввести следующий артикул для поиска</i>`;

            if (botMsgIdx !== null) {
                bot.deleteMessage(chatId, botMsgIdx);
                botMsgIdx = null;
            }

            return bot.sendMessage(
                chatId, 
                message, 
                startFindOptions
            );

        } else {
        
            if (botMsgIdx !== null) {
                bot.deleteMessage(chatId, botMsgIdx);
                botMsgIdx = null;
            }
            return bot.sendMessage(
                chatId, 
                'Товары не найдены. Попробуйте ввести бренд вместе с артикулом, через пробел.\nИли введите полное наименование из карточки товара в 1С.', 
                startFind1Options
            );
        }

    } catch (e) {

        console.log('Ошибка при выполнении запроса', e);

        if (botMsgIdx !== null) {
            bot.deleteMessage(chatId, botMsgIdx);
            botMsgIdx = null;
        }

        return bot.sendMessage(chatId, 'Произошла ошибка при выполнении запроса.', startFindOptions);
    }
}

// ======================================================================================================================================
// функция html запроса по данным из БД на сайт поставщика UltraWood
// ======================================================================================================================================

async function findUW(chatId) {

    const user = await UserModel.findOne({
        where: {
            chatId: chatId
        },
        attributes: [
            'id', 
            'chatId', 
            'lastCommand',
            'vendorCode'
        ]
    });

    try {
    
        const responseProduct = await axios.get(`https://ultrawood.ru/bitrix/components/dresscode/search.line/templates/version2/ajax.php?IBLOCK_ID=15ELEMENT_SORT_ORDER=asc&SEARCH_QUERY=${user.vendorCode}`);
        const $ = cheerio.load(responseProduct.data);
        const productLink = $('.name').attr('href');
    
        if (productLink) {

            const responseProductFull = await axios.get(`https://ultrawood.ru${productLink}`);
            const $$ = cheerio.load(responseProductFull.data);
            const dataMaxQuantity = $$('.qtyBlock .qty').attr('data-max-quantity');
        
            if (botMsgIdx !== null) {
                bot.deleteMessage(chatId, botMsgIdx);
                botMsgIdx = null;
            }
    
            return bot.sendMessage(
                chatId,
                `Остаток ${user.vendorCode}: ${dataMaxQuantity} шт`
            );

        } else {

            if (botMsgIdx !== null) {
                bot.deleteMessage(chatId, botMsgIdx);
                botMsgIdx = null;
            }
            
            return bot.sendMessage(
                chatId,
                `Артикул ${user.vendorCode} не найден на сайте поставщика.`
            );

        }
    
    } catch (e) {
        
        console.log(e);
        return bot.sendMessage(
            chatId,
            `Возникла ошибка в исполнении кода поиска Ultrawood:\n${e}`
        )
    }

}

// ======================================================================================================================================
// функция html запроса по данным из БД на сайт поставщика Designers Guild
// ======================================================================================================================================

const startFindDesignersGuild = async (chatId, msg) => {

    const user = await UserModel.findOne({
        where: {
            chatId: chatId
        },
        attributes: [
            'id', 
            'chatId', 
            'lastCommand',
            'vendorCode'
        ]
    });

    await user.update({
        lastCommand: '/enterVC'
    }, {
        where: {
            chatId: chatId
        }
    });

    try {

        const securityLink = `https://trade.designersguild.com/b2b2/Content/Security/Default.aspx/callbackVerifyLogin`;
        const getProductsLink = `https://trade.designersguild.com/b2b2/Content/ViewProductDetails/Default.aspx/callbackGetProductDetails`;
        const getProductQuantityLink = `https://trade.designersguild.com/b2b2/Content/StockEnquiryItemBreakdown/Default.aspx/callbackGetProductDetails`;
        let units = ''; // еденицы измерения

        if ( user.vendorCode.toUpperCase().includes('P') ) {
            units = 'рул.'
        } else if ( user.vendorCode.toUpperCase().includes('F') ) {
            units = 'м.п.'
        } else if ( user.vendorCode.toUpperCase().includes('CC') ) {
            units = 'шт.'
        } else if ( 
            user.vendorCode.toUpperCase().includes('CC') ||
            user.vendorCode.toUpperCase().includes('BL') ||
            user.vendorCode.toUpperCase().includes('RUG')
        ) {
            units = 'шт.'
        } else {
            units = 'ед.'
        }

        const securityDG = await axios.post(
            securityLink, 
            {
                l_stPassUserName: loginDG,
                l_stPassPassword: passwordDG,
                blnRememberMe: true,
                ignore_browser: true
            },
            {
                proxy: false,
                httpsAgent: agent,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.150 Safari/537.36',
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log(securityDG.data.toString());
        const cookies = securityDG.headers['set-cookie'];
            

        const getProducts = await axios.post(
            getProductsLink, 
            {
                l_stPassTag : user.vendorCode,
                l_stPassProdCode: user.vendorCode,
                l_stPassFromOrder: 'N'
            },
            {
                proxy: false,
                httpsAgent: agent,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.150 Safari/537.36',
                    'Content-Type': 'application/json',
                    Cookie: cookies.join('; ') // передаем cookies в заголовке запроса
                }
            }
        );

        const $ = cheerio.load(getProducts.data);
        const FREESTOCK = $('fd[id="FREESTOCK"]').attr('value');

        const getProductQuantity = await axios.post(
            getProductQuantityLink,
            {
                l_stPassTag:"",
                l_stPassProdCode: user.vendorCode
            }, {
                proxy: false,
                httpsAgent: agent,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.150 Safari/537.36',
                    'Content-Type': 'application/json',
                    Cookie: cookies.join('; ') // передаем cookies в заголовке запроса
                }
            }
        );

        const $$ = cheerio.load(getProductQuantity.data);
        const BATCHNOS = $$('BATCHNOS').text();
        const NOPIECES = $$('NOPIECES').text();
        const PIECELENGTHS = $$('PIECELENGTHS').text();
        const PODUEDATES = $$('PODUEDATES').text();
        const PONOS = $$('PONOS').text();
        const POQTYS = $$('POQTYS').text();

        let message = 'Партия:\n';
        const batchNosArr = BATCHNOS.split('|');
        const noPiecesArr = NOPIECES.split('|');
        const pieceLengthsArr = PIECELENGTHS.split('|');

        for (let i = 0; i < batchNosArr.length; i++) {

            let space = ''; // количество пробелов для выравнивания столбцов

            if (
                batchNosArr[i].length < 15 &&
                batchNosArr[i].length > 5 
                ) {
                const diff = 15 - batchNosArr[i].length;
                space = ' '.repeat(diff);
            } else {
                space = ' '.repeat(5);
            }

            message += `<code>${batchNosArr[i]}</code><code>${space}</code>`;

            if (noPiecesArr[i]) {
              message += `${noPiecesArr[i]} шт          `;
            }

            message += `${pieceLengthsArr[i]} ${units}\n`;
        }

        const podueDatesArr = PODUEDATES.split('|');
        const poNosArr = PONOS.split('|');
        const poQtysArr = POQTYS.split('|');
        message += '\nПоступление:\n'

        for (let i = 0; i < podueDatesArr.length; i++) {
            if (podueDatesArr[i]) {
                message += `${podueDatesArr[i]}     <code>${poNosArr[i]}</code>     ${poQtysArr[i]} ${units}`;
            } else {
                message += 'не ожидается.'
            }
        }
    
        if (botMsgIdx !== null) {
            bot.deleteMessage(chatId, botMsgIdx);
            botMsgIdx = null;
        }

        return bot.sendMessage(
            chatId,
            `Свободный остаток <b>${user.vendorCode}</b> у поставщика <b>${FREESTOCK} ${units}</b> из которых:\n${message}`,
            { parse_mode: 'HTML' }
        );
            
        

    } catch (e) {
        
        console.log( 'Что-то пошло не так', e);
    }

}

// ======================================================================================================================================
// функция отправки email с запросом на резервирование
// ======================================================================================================================================

const sendReserveEmail = async (chatId) => {

    const user = await UserModel.findOne({
        where: {
            chatId: chatId
        },
        attributes: ['id', 'chatId', 'subject', 'textMail', 'email', 'vendorEmail']
    });
    
    const recipient = `${user.vendorEmail}`;     // email поставщика
    const copy = `purchasing@manders.ru`;   //ВАЖНО: Ставить в копию только     purchasing@manders.ru

    try {
        if (user.vendor !== null) {
            // const formatedUserVendor = user.vendor.replace(/[\s-]/g, '');  На случай определения действий по поставщику

            let result = transporter.sendMail({
                from: 'zakupki_bot@manders.ru',
                to: `${recipient}, ${copy}, nick.of.darkwood@gmail.com`,
                subject: user.subject,
                text: user.textMail,
            });
            
            return bot.sendMessage(
                chatId, 
                `Сообщение с темой: \n<pre>"${user.subject}"</pre>\nуспешно отправлено поставщику и в отдел закупок.\n\nЧтобы узнать о состоянии резерва напишите письмо с вышеупомянутой темой на <b>purchasing_internal@manders.ru</b>.`, 
                beginWork2Options
            );
        }
        
    } catch (e) {
        console.error(e);
        throw new Error('Ошибка при отправке email');
    }
}

// ======================================================================================================================================
// функция для поиска эксель файла
// ======================================================================================================================================

async function findExcelFile(
    fileNameWallpaper = '', 
    fileNameTextile = '', 
    fileNamePricelist = '',
    fileNameOracMSK = '', 
    fileNameOracSPB = '',
    fileNameDecorDelux = '',
    fileNameDecorRus = '',
    fileNameBautex = '',
    fileNameLoymina = '',
    fileNameSirpi = '',
    fileNameBrink = '',
    fileNameLg = '',
    ) {

    const folderPath = '/root/zak/xl';
    // const folderPath = 'C:\\node.js\\zak\\xl';   //Dev
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
                fileNameDecorDelux,
                fileNameDecorRus,
                fileNameBautex,
                fileNameLoymina,
                fileNameSirpi,
                fileNameBrink,
                fileNameLg
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

            } else if (result.fileNameLg) {
                fileNameLg = result.fileNameLg;

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
            } else if (file.toLowerCase().includes('баутекс')) {
                fileNameBautex = filePath;
            } else if (file.toLowerCase().includes('brink&campman')) {
                fileNameBrink = filePath;
            } else if (file.toLowerCase().includes('lg_ppl_wallpaper')) {
                fileNameLg = filePath;
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
            fileNameDecorDelux && 
            fileNameDecorRus &&
            fileNameBautex &&
            fileNameLoymina &&
            fileNameSirpi &&
            fileNameBrink &&
            fileNameLg
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
        fileNameDecorDelux,
        fileNameDecorRus,
        fileNameBautex,
        fileNameLoymina,
        fileNameSirpi,
        fileNameBrink,
        fileNameLg
    };
}

// ======================================================================================================================================
// функция поиска артикула ORAC
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

    if (findResult1C) {

        messageORAC = `По данным 1С:\n${findResult1C.messageResult1C}\n\n`;
    } else {

        messageORAC += `Подключение к 1С временно недоступно\n<i>это норма во внерабочее время магазинов</i>\n\n`
    }

    if (filePathMSK) {

        try {
            
            const workbookMSK = new ExcelJS.Workbook();
            const streamMSK = fs.createReadStream(filePathMSK);
            const worksheetMSK = await workbookMSK.xlsx.read(streamMSK);
            const firstWorksheetMSK = worksheetMSK.worksheets[0];

            let foundMatchOracMSK = false;
            
            firstWorksheetMSK.eachRow( async (row, rowNumber) => {

                const cellValue = row.getCell('A').value; //Артикул
                const formatedCellValue = cellValue.toString().trim().replace(/[\u00A0]/g, ' ');
                const formatedUserVC = user.vendorCode.toString().trim().replace(/с/gi, 'c');
                
                if (formatedCellValue === formatedUserVC) {
                    foundMatchOracMSK = true;
            
                    const headerRow = firstWorksheetMSK.getRow(2);
                    let bValue, cValue;
            
                    headerRow.eachCell((cell, colNumber) => {
                        const headerCellValue = cell.value.toString().trim();
                        
                        if (headerCellValue === 'Ед. изм.') {
                            bValue = row.getCell(colNumber).value;
                        } else if (headerCellValue === 'Доступно') {
                            cValue = row.getCell(colNumber).value;
                        }
                    });
            
                    let a3Value = firstWorksheetMSK.getCell('A3').value; //Название склада
                    a3Value = a3Value.toString().split( "(" )[0];
            
                    messageORAC += `Артикул <b>${cellValue}</b> имеется на складе ОРАК "<b>${a3Value}</b>"\n`;
            
                    if (bValue && cValue) {
                        messageORAC += `в количестве <b>${cValue}</b> <b>${bValue}</b>\n\n`;
                    }
            
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

            // const workbookSPB = XLSX.readFile(filePathSPB);
            // const worksheetSPB = workbookSPB.Sheets[workbookSPB.SheetNames[0]];

            // let foundMatchOracSPB = false;

            // for (let i = 2; i <= worksheetSPB['!range'].e.r; i++) {

            //     const cellValue = worksheetSPB[`A${i}`]?.v;
            //     const formatedCellValue = cellValue?.toString().trim().replace(/[\u00A0]/g, ' ');
            //     const formatedUserVC = user.vendorCode.toString().trim();

            //     if (formatedCellValue === formatedUserVC) {
            //         foundMatchOracSPB = true;
            //         let bValue, cValue;
            //         for (let j = 1; j <= worksheetSPB['!range'].e.c; j++) {

            //             const headerCellValue = worksheetSPB[`${XLSX.utils.encode_col(j)}2`]?.v?.toString().trim();

            //             if (headerCellValue === 'Ед. изм.') {

            //                 bValue = worksheetSPB[`${XLSX.utils.encode_col(j)}${i}`]?.v;
            //             } else if (headerCellValue === 'Доступно') {
            //                 cValue = worksheetSPB[`${XLSX.utils.encode_col(j)}${i}`]?.v;
            //             }
            //         }

            //         let a3Value = worksheetSPB['A3']?.v; //Название склада
            //         a3Value = a3Value?.toString().split( "(" )[0];
            //         messageORAC += `Артикул <b>${cellValue}</b> имеется на складе ОРАК "<b>${a3Value}</b>"\n`;

            //         if (cValue && bValue) {
            //             messageORAC += `в количестве <b>${cValue}</b> <b>${bValue}</b>\n\n`;
            //         }

            //         if (botMsgIdx !== null) {
            //             bot.deleteMessage(chatId, botMsgIdx);
            //             botMsgIdx = null;
            //         }
            //     }
            // }
            
            const workbookSPB = new ExcelJS.Workbook();
            const streamSPB = fs.createReadStream(filePathSPB);
            const worksheetSPB = await workbookSPB.xlsx.read(streamSPB);
            const firstWorksheetSPB = worksheetSPB.worksheets[0];

            let foundMatchOracSPB = false;

            firstWorksheetSPB.eachRow( async (row, rowNumber) => {

                const cellValue = row.getCell('A').value; //Артикул
                const formatedCellValue = cellValue.toString().trim().replace(/[\u00A0]/g, ' ');
                const formatedUserVC = user.vendorCode.toString().trim().replace(/с/gi, 'c');
                
                if (formatedCellValue === formatedUserVC) {
                    foundMatchOracSPB = true;
            
                    const headerRow = firstWorksheetSPB.getRow(2);
                    let bValue, cValue;
            
                    headerRow.eachCell((cell, colNumber) => {
                        const headerCellValue = cell.value.toString().trim();
                        
                        if (headerCellValue === 'Ед. изм.') {
                            bValue = row.getCell(colNumber).value;
                        } else if (headerCellValue === 'Доступно') {
                            cValue = row.getCell(colNumber).value;
                        }
                    });
            
                    let a3Value = firstWorksheetSPB.getCell('A3').value; //Название склада
                    a3Value = a3Value.toString().split( "(" )[0];
            
                    messageORAC += `Артикул <b>${cellValue}</b> имеется на складе ОРАК "<b>${a3Value}</b>"\n`;
            
                    if (cValue && bValue) {
                        messageORAC += `в количестве <b>${cValue}</b> <b>${bValue}</b>\n\n`;
                    }
            
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
    
}

// ======================================================================================================================================
//функция поиска каталога обоев
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

                    const formatedCellValue = cellValue.toString().replace(/[\s\u00A0]/g, '').toLowerCase();
                    const formatedUserCatalog = user.catalog.toString().replace(/[\s\u00A0]/g, '').toLowerCase();
                    
                    if (formatedCellValue.includes(formatedUserCatalog)) {
                        foundMatchWallpaper = true;
                        let message = '';
                        
                        const bValue = row.getCell('B').value;
                        let cValue = row.getCell('C').value.toString();
                        const oValue = row.getCell('O').value;
                        const pValue = row.getCell('P').value;
                        const vendorCode = bValue;

                        await user.update({
                            brand: cValue.toUpperCase()
                        });

                        let findResult1C = await startRequest1C(chatId, vendorCode);
                        let PricelistLink = await findPricelistLink(chatId, cValue);


                        if (findResult1C) {
                            
                            let formatedMessageResult1C = findResult1C.messageResult1C.toLowerCase().includes('не числится');
                            
                            if (!formatedMessageResult1C) {
    
                                const o1Value = firstWorksheet.getCell('O1').value;
                                const p1Value = firstWorksheet.getCell('P1').value;
    
                                message += `<b>${cellValue.trim()}</b> бренда <b>${cValue.toUpperCase()}</b> имеется в Manders:\n\n`;
    
                                if (findResult1C.messageResult1C) {
    
                                    message += `По данным 1С:\n${findResult1C.messageResult1C}\n`
                                }
    
                                if (oValue !== null) {
                                    message += `${o1Value}: ${oValue}\n`;
                                }
    
                                if (pValue !== null) {
                                    message += `${p1Value}: ${pValue}\n`;
                                }
    
                                message += `\n${PricelistLink.messagePrice}`;
                                message += `<i>при получении нескольких результатов скопируйте полное наименование НУЖНОГО ВАМ каталога и отправьте боту снова</i>`;
    
                                if (botMsgIdx !== null) {
                                    bot.deleteMessage(chatId, botMsgIdx);
                                    botMsgIdx = null;
                                }
    
                                return bot.sendMessage(
                                    chatId, 
                                    message, 
                                    {
                                        parse_mode: 'HTML',
                                        reply_markup: JSON.stringify( {
                                            inline_keyboard: [
                                                [{text: 'К следующей ступени поиска ➡', callback_data: `checkVendor=${cValue}`}],
                                                [{text: 'В главное меню 📋', callback_data: '/mainmenu'}],
                                            ]
                                        })
                                    }
                                );
    
                            } else {
    
                                if (botMsgIdx !== null) {
                                    bot.deleteMessage(chatId, botMsgIdx);
                                    botMsgIdx = null;
                                }
    
                                return bot.sendMessage(
                                    chatId, 
                                    `Каталога в салонах нет.\nОбратитесь к Юлии Скрибник за уточнением возможности заказа данного артикула.\nskribnik@manders.ru\n<code>+7 966 321-80-08</code>\n\n${PricelistLink.messagePrice}`,
                                    { parse_mode: 'HTML' }
                                );
                            }

                        } else {
                            
                            if (botMsgIdx !== null) {
                                bot.deleteMessage(chatId, botMsgIdx);
                                botMsgIdx = null;
                            }

                            return bot.sendMessage(
                                chatId, 
                                `Подключение к 1С временно недоступно\n<i>это норма во внерабочее время магазинов</i>`, 
                                { parse_mode: 'HTML' }
                            );
                        }

                    }
                }
            });

            if (!foundMatchWallpaper) {
                return null;
            }

        } catch (error) {
            console.error('Ошибка при чтении файла Excel:', error);
        }
    }
}

// ======================================================================================================================================
//функция поиска каталога текстиля
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

            firstWorksheet.eachRow( async (row, rowNumber) => {
                const cellValue = row.getCell('D').value;

                if (cellValue !== null) {

                    const formatedCellValue = cellValue.toString().replace(/[\s\u00A0]/g, '').toLowerCase();
                    const formatedUserCatalog = user.catalog.toString().replace(/[\s\u00A0]/g, '').toLowerCase();
                
                    if (formatedCellValue.includes(formatedUserCatalog)) {
                        foundMatchTextile = true;
                        let message = '';

                        const bValue = row.getCell('B').value;
                        let cValue = row.getCell('C').value.toString();
                        const pValue = row.getCell('P').value;
                        const vendorCode = bValue;

                        await user.update({brand: cValue.toUpperCase()});
                        let findResult1C = await startRequest1C(chatId, vendorCode);
                        let PricelistLink = await findPricelistLink(chatId, cValue);

                        if (findResult1C) {
                            
                            let formatedMessageResult1C = findResult1C.messageResult1C.toLowerCase().includes('не числится');

                            if (!formatedMessageResult1C) {
    
                                const p1Value = firstWorksheet.getCell(`P1`).value;
    
                                message += `<b>${cellValue.trim()}</b> бренда <b>${cValue.toUpperCase()}</b> имеется в Manders:\n`;
    
                                if (findResult1C.messageResult1C) {
    
                                    message += `По данным 1С:\n${findResult1C.messageResult1C}\n`
                                }
    
                                if (pValue !== null) {
                                    message += `${p1Value}: ${pValue}\n`;
                                }
                                
                                message += `\n${PricelistLink.messagePrice}`;
                                message += `<i>при получении нескольких результатов скопируйте полное наименование НУЖНОГО ВАМ каталога и отправьте боту снова</i>`;
                                
                                if (botMsgIdx !== null) {
                                    bot.deleteMessage(chatId, botMsgIdx);
                                    botMsgIdx = null;
                                }
                                
                                await bot.sendMessage(
                                    chatId, 
                                    message, 
                                    {
                                        parse_mode: 'HTML',
                                        reply_markup: JSON.stringify( {
                                            inline_keyboard: [
                                                [{text: 'К следующей ступени поиска ➡', callback_data: `checkVendor=${cValue}`}],
                                                [{text: 'В главное меню 📋', callback_data: '/mainmenu'}],
                                            ]
                                        })
                                    }
                                );

                            } else {

                                if (botMsgIdx !== null) {
                                    bot.deleteMessage(chatId, botMsgIdx);
                                    botMsgIdx = null;
                                }

                                return bot.sendMessage(
                                chatId, 
                                `Каталога в салонах нет.\nОбратитесь к Юлии Скрибник за уточнением возможности заказа данного артикула.\nskribnik@manders.ru\n<code>+7 966 321-80-08</code>\n\n${PricelistLink.messagePrice}`, 
                                { parse_mode: 'HTML' }
                                );
                            }

                        } else {

                            if (botMsgIdx !== null) {
                                bot.deleteMessage(chatId, botMsgIdx);
                                botMsgIdx = null;
                            }

                            return bot.sendMessage(
                                chatId, 
                                `Подключение к 1С временно недоступно\n<i>это норма во внерабочее время магазинов</i>`, 
                                { parse_mode: 'HTML' }
                            );
                        }
                    }
                }
            });

            if (!foundMatchTextile) {
                return null;
            }

        } catch (error) {
            console.error('Ошибка при чтении файла Excel:', error);
        }
    }
}

// ======================================================================================================================================
//функция поиска ссылки на прайслист
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

                    const formatedCellValue = cellValue.toString().toUpperCase().replace(/[\s&-]/g, '');
                    const formaterdCValue = cValue.toString().toUpperCase().replace(/[\s&-]/g, '');

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
}

// ======================================================================================================================================
// функция поиска остатков по поставщику ДЕКОРДЕЛЮКС
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
                    { parse_mode: 'HTML' }
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
// функция поиска остатков по поставщику ДЕКОРРУС
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
                            let currentCCell = firstWorksheet['C' + i];

                            if (currentBCell && currentBCell.v && !currentBCell.v.toString().includes(' ')) {

                                if (currentCCell === undefined || currentCCell === null) {
                                    currentCCell = `0`;
                                }
                                const currentValue = `Партия: ${currentBCell.v}\t\t${currentCCell.v} ед.`;
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
                    `Совпадения с артикулом ${user.vendorCode} в файле "остатки_декор_рус" не найденны.\n<i>можете ввести следующий артикул для поиска</i>`,
                    { parse_mode: 'HTML' }
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
// функция поиска остатков по поставщику БАУТЕКС
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
                    
                    const formatedCellValue = cellValue.toString().toUpperCase().replace(/[\s&-]/g, '');
                    const formatedUserVC = user.vendorCode.toString().toUpperCase().replace(/[\s&-]/g, '');
                    
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
                    { parse_mode: 'HTML' }
                );
            }

        } catch (error) {
            console.error('Ошибка при чтении файла Excel:', error);
        }
    }
}

// ======================================================================================================================================
// функция поиска остатков по поставщику ЛОЙМИНА
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
                    let formatedCellValue = cellValue.toString().trim().replace(/[\s\u00A0,]/g, '');
                    const formatedUserVC = user.vendorCode.toString().trim().replace(/[\s\u00A0,]/g, '');
        
                    if (isNaN(formatedCellValue)) {
                        formatedCellValue = formatedCellValue.toUpperCase();
                    }

                    if (formatedCellValue.includes(formatedUserVC)) {
                        foundMatch = true;

                        const dValueCell = firstWorksheet['D' + cellAddress.substring(1)];
                        let dValue = '';
                        const kValueCell = firstWorksheet['K' + cellAddress.substring(1)];
                        let kValue = '';
                        const jValueCell = firstWorksheet['J' + cellAddress.substring(1)];
                        let jValue = '';

                        if (dValueCell !== null && dValueCell !== undefined) {
                            dValue = dValueCell.v;    // Партия
                        }
                        if (kValueCell !== null && kValueCell !== undefined) {
                            kValue = kValueCell.v     // Количество
                        }
                        if (jValueCell !== null && jValueCell !== undefined) {
                            jValue = jValueCell.v     // Ед. измерения
                        }

                        let message = '';
                        message += `<b>${dValue}</b>\n`;
                        message += `В наличии: <b>${kValue}</b> `;
                        message += `<b>${jValue}</b>\n`;
                            
                        if (botMsgIdx !== null) {
                            bot.deleteMessage(chatId, botMsgIdx);
                            botMsgIdx = null;
                        }

                        message += `\n<i>можете ввести следующий артикул для поиска</i>\n`;

                        await bot.sendMessage(
                            chatId, 
                            message,
                            startFind1Options
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
                    { parse_mode: 'HTML' }
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
// функция поиска остатков по поставщику СИРПИ
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
                        let message = '';

                        const aValue = firstWorksheet['A' + cellAddress.substring(1)].v; // Номенкулатура
                        message += `<b>${aValue}</b>\n\n`;

                        const cCell = firstWorksheet['C' + cellAddress.substring(1)]; // Доступно
                        if (cCell && cCell.v !== null && cCell.v !== undefined) {
                            message += `Доступно сейчас: ${cCell.v}\n`
                        }

                        const d1Value = firstWorksheet['D1'].v; // Дата поставки 1
                        const dCell = firstWorksheet['D' + cellAddress.substring(1)]; // количество в поставке 1
                        if (dCell && dCell.v !== null && dCell.v !== undefined) {
                            message += `Дата след. поставки:\n${d1Value}\n\nБудет доступно ${dCell.v}\n`
                        }

                        let e1Value = firstWorksheet['E1'].v; // Дата поставки 2
                        const eCell = firstWorksheet['E' + cellAddress.substring(1)]; // количество в поставке 2
                        if (eCell && eCell.v !== null && eCell.v !== undefined) {
                            message += `Дата след. поставки:\n${e1Value}\nБудет доступно ${eCell.v}\n`
                        }

                        const f1Value = firstWorksheet['F1'].v; // Дата поставки 2
                        const fCell = firstWorksheet['F' + cellAddress.substring(1)]; // количество в поставке 3
                        if (fCell && fCell.v !== null && fCell.v !== undefined) {
                            message += `Дата след. поставки:\n${f1Value}\nБудет доступно ${fCell.v}\n`
                        }

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
                { parse_mode: 'HTML' }
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
// функция поиска остатков по поставщику BRINK
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

                        message = '';

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
                        
                        message += `<i>можете ввести следующий артикул для поиска</i>`
                        
                        if (botMsgIdx !== null) {
                            bot.deleteMessage(chatId, botMsgIdx);
                            botMsgIdx = null;
                        }

                        await bot.sendMessage(
                            chatId, 
                            message,
                            startFind1Options
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
                `Совпадения с артикулом ${user.vendorCode} в файле "остатки_brink&campman" не найденны.\n<i>можете ввести следующий артикул для поиска</i>`,
                { parse_mode: 'HTML' }
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

async function findLittleGreenePPL(chatId) {

    let fileNameLg = 'остатки_lg_ppl_wallpaper';

    const result = await findExcelFile(fileNameLg);
    const filePath = result.fileNameLg;

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

                        const aCell = firstWorksheet['A' + cellAddress.substring(1)];    // Артикул
                        let aValue = {};
                        const bCell = firstWorksheet['B' + cellAddress.substring(1)];    // Номенкулатура
                        let bValue = {};
                        const cCell = firstWorksheet['C' + cellAddress.substring(1)];   // Колличество 
                        let cValue = {};

                            if (aCell && aCell.v !== undefined) {
                                aValue = aCell.v.toString();    
                            } else {
                                aValue = 'неизвестно';
                            }

                            if (bCell && bCell.v !== undefined) {
                                bValue = bCell.v.toString();    
                            } else {
                                bValue = 'неизвестно';
                            }

                            if (cCell && cCell.v !== undefined) {
                                cValue = cCell.v.toString();    
                            } else {
                                cValue = 'неизвестно';
                            }

                        message = `<b>${bValue}</b>\nАртикул: ${aValue}\nОстаток: ${cValue} рул.\n\n<i>можете ввести следующий артикул/наименование для поиска</i>`

                        if (botMsgIdx !== null) {
                            bot.deleteMessage(chatId, botMsgIdx);
                            botMsgIdx = null;
                        }

                        return bot.sendMessage(
                            chatId, 
                            message,
                            startFind1Options
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
                    `Совпадения с ${user.vendorCode} в файле "остатки_lg_ppl_wallpaper" не найденны.\n<i>можете ввести следующий артикул для поиска</i>`,
                    { parse_mode: 'HTML' }
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
// старт работы программы =================================================================================================================
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

    // команды======================================================================================

    //старт
    bot.onText(/\/start/, async msg => {
        const chatId = msg.chat.id;
        var user = null;

        try {

            user = await UserModel.findOne({
                where: {
                    chatId: chatId
                }
            });

            if (user) {

                if (user.email !== '/passwordcheck') {

                    // lc = null
                    await user.update({lastCommand: null}, {
                        where: {
                            chatId: chatId
                        }
                    })
                
                    return bot.sendMessage(
                        chatId, 
                        `Ты ${user.firstName}, Я - Зак, мы уже знакомы 😅`
                    );
                }

            } else {

                await createNewUser(chatId, msg);

                return bot.sendMessage(
                    chatId, 
                    `Введите пароль:`
                );
            }
        
        } catch (e) {
            console.log('Ошибка при создании нового пользователя', e);
        }

    });

    // начать игру
    bot.onText(/\/game/, async msg => {
        const chatId = msg.chat.id;

        const user = await UserModel.findOne({
            where: {
                chatId: chatId
            },
            attributes: ['id', 'chatId', 'lastCommand', 'email']
        });

        if (user.email !== '/passwordcheck') {

            // lc = '/game';
            await user.update({lastCommand: '/game'}, {
                where: {
                    chatId: chatId
                }
            })

            const randomNumber = Math.floor(Math.random() * 10)
            chats[chatId] = randomNumber;
            return bot.sendMessage(
                chatId, 
                `Отгадай число😏`, 
                gameOptions
            );
        }
    });

    // для тестирования
    bot.onText(/\/x/, async msg => {
        const chatId = msg.chat.id;

        // lc = null; 
        const user = await UserModel.findOne({
            where: {
                chatId: chatId
            },
            attributes: [
                'id', 
                'chatId', 
                'lastCommand',
                'vendorCode'
            ]
        });

        await user.update({lastCommand: null}, {
            where: {
                chatId: chatId
            }
        })

        try {

            const vendorCode = `FDG3114/03`
            const formatedVendorCode = vendorCode.replace(/\//g, '%2F');
            const responseLink = `https://www.designersguild.com/nl/search-results/l76?search-term=${formatedVendorCode}&pagesize=48&sort=default&page=1`;
            console.log(responseLink);

            const responseDG = await axios.get(
                responseLink, 
                {
                    proxy: false,
                    httpsAgent: agent,
                }
            );

            const $ = cheerio.load(responseDG.data);
            
            console.log(responseDG.data);



        } catch (e) {
            
            console.log( 'Что-то пошло не так', e);
        }

    });

    // настройки пользователя
    bot.onText(/\/settings/, async msg => {
        const chatId = msg.chat.id;

        const user = await UserModel.findOne({
            where: {
                chatId: chatId
            },
            attributes: [
                'id', 
                'chatId', 
                'lastCommand', 
                'email'
            ]
        });

        if (user.email !== '/passwordcheck') {

            // lc = null; 
            await user.update({
                lastCommand: null
            }, {
                where: {
                    chatId: chatId
                }
            })
        
            return bot.sendMessage(
                chatId, 
                `Настройки:`, 
                settingsOptions
            );
        }
    });

    // получение имена файлов 
    bot.onText(/\/files/, async msg => {
        const chatId = msg.chat.id;
        const folderPath = '/root/zak/xl';
        // const folderPath = 'C:\\node.js\\zak\\xl';   //Dev

        const user = await UserModel.findOne({
            where: {
                chatId: chatId
            },
            attributes: ['id', 'chatId', 'lastCommand', 'email']
        });

        if (user.email !== '/passwordcheck') {

            // Получение списка файлов в папке
            fs.readdir(folderPath, async (err, files) => {
                if (err) {
                    console.log(err);
                    return bot.sendMessage(chatId, 'Произошла ошибка при получении списка файлов.');
                }
            
                // Отправка списка файлов
                await bot.sendMessage(chatId, 'Список файлов:');
                files.forEach((file) => {
                    return bot.sendMessage(chatId, `<code>${file}</code>`, { parse_mode: 'HTML' } );
                });
            });
        }
    });

    // получение конкретного файла
    bot.onText(/\/getfile (.+)/, async (msg, match) => {
        const chatId = msg.chat.id;

        const user = await UserModel.findOne({
            where: {
                chatId: chatId
            },
            attributes: ['id', 'chatId', 'lastCommand', 'email']
        });

        if (user.email !== '/passwordcheck') {

            const fileName = match[1];
            const filePath = path.join('/root/zak/xl', fileName); 
            // const filePath = path.join('C:\\node.js\\zak\\xl', fileName);    //Dev

            // Проверка существования файла
            fs.access(filePath, fs.constants.F_OK, (err) => {
                if (err) {
                    return bot.sendMessage(chatId, 'Файл не найден.');
                }
            
                // Отправка файла
                bot.sendDocument(chatId, filePath);
            })
        }
    });

    // получение конкретного файла
    bot.onText(/\/get (.+)/, async (msg, match) => {
        const chatId = msg.chat.id;

        const user = await UserModel.findOne({
            where: {
                chatId: chatId
            },
            attributes: ['id', 'chatId', 'lastCommand', 'email']
        });

        if (user.email !== '/passwordcheck') {

            const fileName = match[1];
            const filePath = path.join('/root/zak/', fileName);

            // Проверка существования файла
            fs.access(filePath, fs.constants.F_OK, (err) => {
                if (err) {
                    return bot.sendMessage(chatId, 'Файл не найден.');
                }
            
                // Отправка файла
                bot.sendDocument(chatId, filePath);
            })
        }
    });

    // получение списка пользователей
    bot.onText(/\/whoiswho/, async (msg) => {
        const chatId = msg.chat.id;

        const user = await UserModel.findOne({
            where: {
                chatId: chatId
            },
            attributes: ['id', 'chatId', 'lastCommand', 'email']
        });

        if (user.email !== '/passwordcheck') {

            UserModel.findAll().then((users) => {

                users.forEach((user) => {
                    
                    const message = `ID: <code>${user.chatId}</code>\nUser: <code>${user.firstName} ${user.lastName}</code>\nEmail: <code>${user.email}</code>`;
                    
                    bot.sendMessage(msg.chat.id,
                        message,
                        { parse_mode: 'HTML' }
                    );
                });
            }).catch((error) => {
              console.error('Ошибка при получении пользователей.:', error);
            });
        }
    });

    // получение конкретного пользователя
    bot.onText(/\/whois (.+)/, async (msg, match) => {
        const chatId = msg.chat.id;
        
        const userId = msg.text.split(" ")[1];
        const user = await UserModel.findOne({
            where: {
                chatId: userId
            },
            attributes: 
            [
                'id', 
                'chatId',
                'firstName', 
                'lastName', 
                'lastCommand', 
                'email'
            ]
        });

        if ( user ) {

            const message = `ID: <code>${user.chatId}</code>\nUser: <code>${user.firstName} ${user.lastName}</code>\nEmail: <code>${user.email}</code>`;
            return bot.sendMessage(msg.chat.id,
                message,
                { parse_mode: 'HTML' }
            );

        } else {
           
            return bot.sendMessage(msg.chat.id,
                `Пользователь с таким id не найден.`,
                { parse_mode: 'HTML' }
            );

        }
        
    });

    // получение списка пользователей
    bot.onText(/\/abilitys/, (msg) => {
        const chatId = msg.chat.id;

    bot.sendMessage(chatId,
    `<b>Что умеет бот сейчас:</b>

    Производить поиск 🔎 остатков на сайтах:
    <strong>opusdeco.ru</strong>
        ✅<code>1838</code>
        ✅<code>Arlin</code>
        ✅<code>Arthouse</code>
        ✅<code>Atelier</code>
        ✅<code>Aura</code>
        ✅<code>Lincrusta</code>
        ✅<code>Print 4</code>
        ✅<code>Sangiorgio</code>
        ✅<code>Sem - Murale</code>
        ✅<code>Ultra Wood</code>
        ✅<code>York</code>

    <strong>dealer.decaro.ru</strong> 
        ✅<code>Architector</code>
        ✅<code>Casa Mia</code>
        ✅<code>Coordonne</code>
        ✅<code>Emil & Hugo</code>
        ✅<code>Epoca</code>
        ✅<code>Etten</code>
        ✅<code>Heritage House</code>
        ✅<code>Jaima Brown</code>
        ✅<code>KT-Exclusive</code>
        ✅<code>Mayflower</code>
        ✅<code>NLXL</code>
        ✅<code>Paper & Ink</code>
        ✅<code>Seabrook</code>
        ✅<code>Texam</code>
        ✅<code>Tiffany Design</code>
        ✅<code>Trendsetter</code>
        ✅<code>Vatos</code>
        ✅<code>Wallquest</code>

    <strong>galleriaarben.ru</strong>
        ✅<code>Galleria Arben</code>

    <strong>designersguild.com</strong>
        ✅<code>Designers Guild</code>

    <b>Производить поиск 🔎 по файлам остатков следующих брендов:</b>
        ✅<code>Architects Papers</code>
        ✅<code>ARTE</code>
        ✅<code>Bautex</code>
        ✅<code>Bluebellgray</code>
        ✅<code>BN International</code>
        ✅<code>Brink</code>
        ✅<code>Collins & Company</code>
        ✅<code>Eijffinger</code>
        ✅<code>Holden</code>
        ✅<code>Hookedonwalls</code>
        ✅<code>Jannelli & Volpi</code>
        ✅<code>Khroma Zoom</code>
        ✅<code>Loymina</code>
        ✅<code>Milassa</code>
        ✅<code>Missoni</code>
        ✅<code>Nina Hancock</code>
        ✅<code>ORAC</code>
        ✅<code>Swiss Lake</code>
        ✅<code>Ted Beker</code>
        ✅<code>Wedgwood</code>
        ✅<code>Little Greene</code> <code>(обои)</code>
        ✅<code>Paint Paper Library</code> <code>(обои)</code>   

    <b>Отправлять емейлы поставщику</b> 📨
    <b>Подсказывать путь к папке с прайслистами</b> 👓
    <b>Искать каталоги обоев и текстиля</b> 🔎
    <b>Искать остатки в 1С*</b> ✅
    `,
            { parse_mode: 'HTML' }
        );
    });

    // обновления
    bot.onText(/\/updatelist/, (msg) => {
        const chatId = msg.chat.id;

    bot.sendMessage(chatId,
    `<b>Версия 1.1.0.0
    Что нового:</b>

    Теперь бот при просмотре остатков по 1С
    ------------------------------------
    <b>Версия 1.1.0.0
    Что нового:</b>

    Добавлен поиск остатков на сайте поставщика Designers Guld.
    ------------------------------------
    <b>Версия 1.0.9.0
    Что нового:</b>

    Добавлен поиск остатков на сайте поставщика ULTRA WOOD.
    Скорректировано список вызываемый по команде /abilitys,
    теперь на смартфонах список отображается корректно.

    `,
            { parse_mode: 'HTML' }
        );
    });

    //слушатель сообщений==========================================================================================

    bot.on('message', async msg => {
        let text = msg.text;
        const chatId = msg.chat.id;

        console.log(msg)

        const user = await UserModel.findOne({
            where: {
                chatId: chatId
            }
        });

        try {

            if (user) {

                if (msg.document) {
                    let file_name = msg.document.file_name;

                    if (file_name === 'config.cfg') {

                        let fileName = `config.cfg`;

                        await bot.getFile(msg.document.file_id).then((file) => {
                            const fileStream = bot.getFileStream(file.file_id);
                            fileStream.pipe(fs.createWriteStream(`/root/zak/${fileName}`));
                            fileStream.on('end', () => {
                                bot.sendMessage(
                                    chatId, 
                                    `Файл <b>${fileName}</b>\nуспешно сохранен.`, 
                                    { parse_mode: 'HTML' }
                                );
                            });
                        });
                        return;

                    } else if (file_name.toLowerCase().includes('каталоги') ||
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
                            // fileStream.pipe(fs.createWriteStream(`C:\\node.js\\zak\\xl\\${fileName}`));  //Dev
                            fileStream.on('end', () => {
                                bot.sendMessage(
                                    chatId, 
                                    `Файл <b>${fileName}</b>\nуспешно сохранен.`, 
                                    { parse_mode: 'HTML' }
                                );
                            });
                        });
                        return;
                        
                    // Сохранение файлов остатков. Обрезка дат, нижний регистр, замена пробелов на "_"
                    } else if (
                        file_name.toLowerCase().includes('orac') || 
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
                        file_name.toLowerCase().includes('lg') || 
                        file_name.toLowerCase().includes('loymina') ||
                        file_name.toLowerCase().includes('sirpi') ||
                        file_name.toLowerCase().includes('campman') 
                    ) {

                        let fileName = {};
                        file_name = file_name.replace(/\s\d+|\.\d+/g, '');  // удаление дат
                        let file_format = file_name.split(".")[1];  // определение формата файла

                        if (
                            (file_name.toLowerCase().includes('orac') || 
                            file_name.toLowerCase().includes('орак')) &&
                            (file_name.toLowerCase().includes('msk') || 
                            file_name.toLowerCase().includes('мск')) 
                        ) {
                            fileName = `orac_мск.${file_format}`;

                        } else if ( 
                            (file_name.toLowerCase().includes('orac') || 
                            file_name.toLowerCase().includes('орак')) &&
                            (file_name.toLowerCase().includes('spb') || 
                            file_name.toLowerCase().includes('спб')) 
                        ) {
                            fileName = `orac_спб.${file_format}`;

                        } else if ( 
                            (file_name.toLowerCase().includes('decor') || 
                                file_name.toLowerCase().includes('декор')) &&
                                (file_name.toLowerCase().includes('delux') || 
                                file_name.toLowerCase().includes('делюкс')) 
                        ) {
                            fileName = `остатки_декор_делюкс.${file_format}`;

                        } else if ( 
                            (file_name.toLowerCase().includes('декор') || 
                            file_name.toLowerCase().includes('decor')) &&
                            (file_name.toLowerCase().includes('рус') || 
                            file_name.toLowerCase().includes('rus')) 
                        ) {
                            fileName = `остатки_декор_рус.${file_format}`;

                        } else if (
                            file_name.toLowerCase().includes( 'баутекс' ) || 
                            file_name.toLowerCase().includes( 'bautex' ) 
                        ) {
                            fileName = `остатки_баутекс.${file_format}`;
                        } else if (
                            file_name.toLowerCase().includes( 'лоймина' ) || 
                            file_name.toLowerCase().includes( 'loymina' ) 
                        ) {
                                fileName = `остатки_лоймина.${file_format}`;

                        } else if (
                            file_name.toLowerCase().includes( 'brink' ) || 
                            file_name.toLowerCase().includes( 'campman' ) 
                        ) {
                            fileName = `остатки_brink&campman.${file_format}`;

                        } else if (
                            file_name.toLowerCase().includes( 'sirpi' ) || 
                            file_name.toLowerCase().includes( 'сирпи' ) 
                        ) {
                            fileName = `остатки_сирпи.${file_format}`;

                        } else if (
                            file_name.toLowerCase().includes( 'lg' )
                        ) {
                            fileName = `остатки_lg_ppl_wallpaper.${file_format}`;
                        
                        }

                        await bot.getFile(msg.document.file_id).then((file) => {
                            
                            const fileStream = bot.getFileStream(file.file_id);
                            fileStream.pipe(fs.createWriteStream(`/root/zak/xl/${fileName}`));
                            // fileStream.pipe(fs.createWriteStream(`C:\\node.js\\zak\\xl\\${fileName}`));  //Dev
                            fileStream.on('end', () => {
                                bot.sendMessage(
                                    chatId, 
                                    `Файл <b>${fileName}</b>\nуспешно сохранен.`, 
                                    { parse_mode: 'HTML' }
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

                } else if (user.email === '/passwordcheck') {

                    return chekPassword(chatId, msg);

                } else if (text === '/mainmenu') {

                    // lc = null;
                    await user.update({lastCommand: text}, {
                        where: {
                            chatId: chatId
                        }
                    })

                    return bot.sendMessage(
                        chatId, 
                        `Вы в главном меню, ${user.nickname}\nВаш персональный id: <code>${chatId}</code>`,
                        mainMenuOptions
                    ); 

                } else if (
                    user.lastCommand === '/editEmail' &&
                    !ignoreCommands.includes(text)
                    ) {

                    await user.update({
                        email: text.toLowerCase(),
                        lastCommand: null
                    });

                    return bot.sendMessage(
                        chatId, 
                        `Ваш email "<b>${user.email}</b>" успешно сохранён.`, 
                        mainMenuReturnOptions
                    );

                } else if (
                    user.lastCommand === '/editNickname' &&
                    !ignoreCommands.includes(text)
                    ) {

                    await user.update({nickname: text, lastCommand: null});
                    return bot.sendMessage(
                        chatId, 
                        `Теперь я буду называть вас "<b>${user.nickname}</b>".`, 
                        mainMenuReturnOptions
                    );

                } else if (
                    user.lastCommand === '/enterBrand' &&
                    !ignoreCommands.includes(text)
                ) {

                    await user.update({brand: text.toUpperCase()});

                    let cValue = text;
                    let PricelistLink = await findPricelistLink(chatId, cValue);

                    if (text.length < 4) {

                        if (botMsgIdx !== null) {
                            bot.deleteMessage(chatId, botMsgIdx);
                            botMsgIdx = null;
                        }

                        return bot.sendMessage(
                            chatId,
                            `Наименование искомого бренда не может быть короче 4х символов\nвведите бренд заново:`
                            );

                        } else {

                            if (PricelistLink.vendor === null) {
                                return bot.sendMessage(
                                    chatId, 
                                    `Бренд не найден❌\nпроверьте написание бренда.`
                                );
                            } else if (user.brand === 'RASCH') {
                                return bot.sendMessage(
                                    chatId,
                                    `Возможность продажи бренда Rasch нужно уточнить у Юлии Скрибник!`
                                )
                            } else {
                                await bot.sendMessage(
                                    chatId,
                                    `<b>Бренд найден</b>✅\nВАЖНО: <u>Уточняйте наличие каталога.\nБез каталога в наличии, продажа запрещена! Возможность продажи уточнить у Юлии Скрибник!</u>\n\n${PricelistLink.messagePrice}`,
                                    { parse_mode: 'HTML' }
                                )
                                return startCheckVendor(chatId, msg);
                            }
                        }

                } else if (
                    user.lastCommand === '/enterVC' &&
                    !ignoreCommands.includes(text)
                    ) {

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

                    } else if (formatedUserVendor === 'DESIGNERSGUILD') {

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
                            return startFindDesignersGuild(chatId, msg);
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

                    } else if (formatedUserVendor === 'ЛЕВАНТИН') {

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
                            return startFindLevantin(chatId);
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

                        // lc === '/oracCheck';
                        const user = await UserModel.findOne({
                            where: {
                                chatId: chatId
                            },
                            attributes: ['id', 'chatId', 'lastCommand']
                        });
                    
                        await user.update({lastCommand: '/oracCheck'}, {
                            where: {
                                chatId: chatId
                            }
                        })
                        return findOrac(chatId);

                    } else if (formatedUserVendor.includes('LITTLEGREENE')) {

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
                            return findLittleGreenePPL(chatId);
                        }
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

                        // lc = '/enterNumberofVC';
                        await user.update({lastCommand: '/enterNumberofVC'}, {
                            where: {
                                chatId: chatId
                            }
                        })

                        if (botMsgIdx !== null) {
                            bot.deleteMessage(chatId, botMsgIdx);
                            botMsgIdx = null;
                        }
                        return bot.sendMessage(
                            chatId,
                            `Хорошо!\n<b>Запрашиваемые вами параметры:</b>\nБренд: ${user.brand}\nАртикул: ${user.vendorCode}\nТеперь введите количество:\n<i>а так же введите единицы измерения через пробел</i>`,
                            { parse_mode: 'HTML' }
                        );
                    }

                } else if (
                    user.lastCommand === '/request1C' &&
                    !ignoreCommands.includes(text)
                ) {

                    if (isNaN(text)) {
                        await user.update({vendorCode: text.toUpperCase()});
                    } else {
                        await user.update({vendorCode: text});
                    }
                    await bot.sendMessage(chatId, 'Идёт обработка вашего запроса . . .');
                    const vendorCode = user.vendorCode;
                    botMsgIdx = msg.message_id += 1; 
                    let findResult1C = await startRequest1C(chatId, vendorCode); 

                    if (findResult1C) {
                    
                        if (botMsgIdx !== null) {
                            bot.deleteMessage(chatId, botMsgIdx);
                            botMsgIdx = null;
                        }

                        return bot.sendMessage(
                            chatId, 
                            `<b><i>Пока функция в тестовом режиме сверяйте остатки с базой 1С, иногда встречаются неточности</i></b>\n\n${findResult1C.messageResult1C}\n<b><i>Пока функция в тестовом режиме сверяйте остатки с базой 1С, иногда встречаются неточности</i></b>`,
                            { parse_mode: 'HTML' }
                        );

                    } else {

                        if (botMsgIdx !== null) {
                            bot.deleteMessage(chatId, botMsgIdx);
                            botMsgIdx = null;
                        }

                        return bot.sendMessage(
                            chatId, 
                            `Подключение к 1С временно недоступно\n<i>это норма во внерабочее время магазинов</i>`,
                            { parse_mode: 'HTML' }
                        );

                    }

                } else if (
                    user.lastCommand === '/enterReserveNumber' &&
                    !ignoreCommands.includes(text)
                    ) {

                    let counter = 0;
                    while (text.includes("  ") && counter < 3) {
                        text = text.replace(/\s\s/g, ' ');
                        counter++;
                    }
                    await user.update({reserveNumber: text});

                    if ((user.reserveNumber) !== (user.reserveNumber.split(" ")[0])) {
                        return bot.sendMessage(
                            chatId, 
                            `Вы желаете зарезервировать партию <b>${user.reserveNumber.split(" ")[0]}</b> в количестве <b>${user.reserveNumber.split(" ")[1]}</b> ед.изм?\n\n<i>если данные введены корректно, нажмите "<b>Cохранить и продолжить</b>"\nдля перезаписи введите информацию повторно</i>`, 
                            enterReserveNumberOptions
                        );
                    } else {
                        return bot.sendMessage(
                            chatId, 
                            `Вы желаете зарезервировать  <b>${user.vendorCode}</b> в количестве <b>${user.reserveNumber}</b> ед.изм?\n\n<i>если данные введены корректно, нажмите "<b>Cохранить и продолжить</b>"\nдля перезаписи введите информацию повторно</i>`, 
                            enterReserveNumberOptions
                        );
                    }

                } else if (
                    user.lastCommand === '/enterNumberofVC' &&
                    !ignoreCommands.includes(text)
                    ) {

                    // lc = null;
                    await user.update({lastCommand: null}, {
                        where: {
                            chatId: chatId
                        }
                    })
                    await user.update({reserveNumber: text});
                    return bot.sendMessage(
                        chatId, 
                        `Отлично!\n<b>Запрашиваемые вами параметры:</b>\nБренд: ${user.brand}\nАртикул: ${user.vendorCode}\nКоличество: ${user.reserveNumber}\n\nХорошо, теперь я могу запросить наличие и срок поставки.\nНужно поставить резерв?`, 
                        startFind2Options
                    );

                } else if (
                    user.lastCommand === '/catalogСheck' &&
                    !ignoreCommands.includes(text)
                    ) {

                    await user.update({catalog: text});

                    await bot.sendMessage(chatId, 'Идёт поиск каталога . . .');
                    botMsgIdx = msg.message_id += 1; 

                    const [Textile, Wallpaper] = await Promise.all([findCatalogTextile(chatId), findCatalogWallpaper(chatId)]);

                    if (Textile === null && Wallpaper === null) {

                        if (botMsgIdx !== null) {
                            bot.deleteMessage(chatId, botMsgIdx);
                            botMsgIdx = null;
                        }
                            return bot.sendMessage(
                            chatId, 
                            `Такого каталога у нас нет\nОбратитесь к Юлии Скрибник за уточнением возможности заказа данного артикула.\nskribnik@manders.ru\n<code>+7 966 321-80-08</code>\n\n`, 
                            {parse_mode: 'HTML'}
                        );
                    }
                    return {Textile, Wallpaper};

                } else if (
                    user.lastCommand === '/oracCheck' &&
                    !ignoreCommands.includes(text)
                    ) {

                    await user.update({
                        vendorCode: text.toUpperCase()
                    });
                    await bot.sendMessage(
                        chatId, 
                        `Идёт поиск ${text} . . .`
                    );
                    botMsgIdx = msg.message_id += 1;

                    return findOrac(chatId);

                } else if (
                    user.lastCommand === '/UWCheck' &&
                    !ignoreCommands.includes(text)
                    ) {

                    await user.update({
                        vendorCode: text.toUpperCase()
                    });

                    await bot.sendMessage(
                        chatId, 
                        `Идёт поиск ${text} . . .`
                    );

                    botMsgIdx = msg.message_id += 1; 

                    return findUW(chatId);

                } else if (text === '/infowork') {

                    return bot.sendMessage(
                        chatId, 
                        `${user.nickname} вот, что вы искали:\n\nКаталог: ${user.catalog}\nБренд: ${user.brand}\nАртикул: ${user.vendorCode}\nКоличество: ${user.reserveNumber}\n\nВаш email: ${user.email}`,
                        resetInfoWorkOptions
                    );

                } else if (text === '/infogame') {

                    // lc = null;
                    await user.update({lastCommand: null}, {
                        where: {
                            chatId: chatId
                        }
                    })

                    return bot.sendMessage(
                        chatId, 
                        `Правильных ответов: "${user.right}"\nНеправильных ответов: "${user.wrong}"`, resetOptions
                    );

                } else if (text.toLowerCase().includes('привет')) {

                    return bot.sendSticker(
                        chatId, 
                        'https://cdn.tlgrm.app/stickers/087/0cf/0870cf0d-ec03-41e5-b239-0eb164dca72e/192/1.webp'
                    );

                } else if ( 
                    text !== '/game' && 
                    text !== '/start' && 
                    text !== '/settings' && 
                    text !== '/files' && 
                    text !== '/x' &&
                    text !== '/abilitys' &&
                    text !== '/updatelist' &&
                    !text.startsWith('/get') &&
                    !text.startsWith('/whois')  
                ) {
                            
                    return bot.sendMessage(
                        chatId,
                        `Для начала работы перейдите в Главное меню: <b>/mainmenu</b>\nи нажмите кнопку <b>"Запрос: остатки+сроки+резерв"</b>.`,
                        { parse_mode: 'HTML' }
                    );
                }

            } else {

                await createNewUser(chatId, msg);

                return chekPassword(chatId, msg);
            }
        } catch (e) {
            console.log('Ошибка в слушателе сообщений.', e)
        }
    }); 

    //слушатель колбэков==========================================================================================================================================

    bot.on('callback_query', async msg => {
        const data = msg.data;
        const chatId = msg.message.chat.id;

        console.log(msg);

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

                if (user.lastCommand === '/game' || user.lastCommand === '/again' || user.lastCommand === '/reset') {
                    await bot.deleteMessage(
                        chatId, 
                        msg.message.message_id
                    );
                }
                // lc = null;
                await user.update({
                    lastCommand: data
                }, {
                    where: {
                        chatId: chatId
                    }
                });

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
                        'Для начала формирования запроса по остаткам и срокам есть два пути:\n\n<b>Поиск по каталогу:</b> - для тех случаев, когда вы не знаете из какого каталога искомый вами артикул и неизвестна возможность закупки данного артикула у поставщика.\n\n<b>Поиск по бренду:</b> - для случаев, когда вы уверенны, что искомый вами артикул возможно заказать у поставщика.', 
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
                await user.update({
                    catalog: null, 
                    brand: null, 
                    vendorCode: null, 
                    reserveNumber: null
                }, {
                    where: {
                        chatId: chatId,
                    }
                })

                return bot.sendMessage(
                    chatId,
                    `Искомые параметры сброшенны.`
                );

            } else if (data.includes('checkVendor')) {

                const cValue = data.split('=')[1];
                
                await findPricelistLink(chatId, cValue);    // нужно написать функцию записи данных поставщика

                return startCheckVendor(chatId, msg);

            } else if (data === '/enterBrand') {
                // lc = data;
                await user.update({lastCommand: data}, {
                    where: {
                        chatId: chatId
                    }
                })

                return bot.sendMessage(
                    chatId, `Для начала работы введите бренд, по которому мы будем производить поиск:`, 
                    { parse_mode: 'HTML' }
                );

            } else if (data === '/enterReserveNumber') {
                // lc = data;
                await user.update({lastCommand: data}, {
                    where: {
                        chatId: chatId
                    }
                })

                return bot.sendMessage(
                    chatId, `Введите номер партии и количество, которое желаете зарезервировать:<i>например: <b>268А 3</b>\nесли партия отсутствует, то введите только количество</i>`,
                    { parse_mode: "HTML" }
                );

            } else if (data === '/preSendEmail') {

                // lc = data;
                await user.update({lastCommand: data}, {
                    where: {
                        chatId: chatId
                    }
                })

                if ((user.reserveNumber) !== (user.reserveNumber.split(" ")[0])) {

                    const subject = `Резерв ${user.vendorCode}, партия: ${user.reserveNumber.split(" ")[0]}, ${user.reserveNumber.split(" ")[1]} ед.изм, по запросу ${chatId}`;
                    const textMail = `\nЗдравствуйте!\nПросьба поставить в резерв следующую позицию:\nартикул: ${user.vendorCode}, бренд: ${user.brand}, партия: ${user.reserveNumber.split(" ")[0]} в количестве: ${user.reserveNumber.split(" ")[1]} ед.изм\nПожалуйста пришлите обратную связь ответным письмом на purchasing@manders.ru.`;
                
                    await user.update({subject: subject, textMail: textMail}, {
                        where: {
                            chatId: chatId
                        }
                    })

                } else {

                    const subject = `Резерв ${user.vendorCode}, ${user.reserveNumber} ед.изм, по запросу ${chatId}`;
                    const textMail = `\nЗдравствуйте!\nПросьба поставить в резерв следующую позицию:\nартикул: ${user.vendorCode}, бренд: ${user.brand}, в количестве: ${user.reserveNumber} ед.изм\nПожалуйста пришлите обратную связь ответным письмом на purchasing@manders.ru.`;

                    await user.update({subject: subject, textMail: textMail}, {
                        where: {
                            chatId: chatId
                        }
                    })
                }

                return bot.sendMessage(
                    chatId, 
                    `Сформирован email:\nТема сообщения: <strong>${user.subject}</strong>\nКому: <b>поставщику ${user.brand}</b>\nКопия: <b>purchasing_internal@manders.ru</b>\nТекст сообщения:\n${user.textMail}\n`, 
                    sendReserveOptions
                );

            } else if (data === '/preSendEmailReserveYes') {

                const subject = `Наличие+сроки+резерв ${user.vendorCode},  ${user.reserveNumber}, по запросу ${chatId}`;
                const textMail = `\nЗдравствуйте!\nУточните, пожалуйста, наличие и срок поставки:\nартикул: ${user.vendorCode}, бренд: ${user.brand}, в количестве: ${user.reserveNumber}.\nПросьба поставить в резерв.\nПожалуйста пришлите обратную связь ответным письмом на purchasing@manders.ru.`;

                await user.update({subject: subject, textMail: textMail}, {
                    where: {
                        chatId: chatId
                    }
                })
            
                const user = await UserModel.findOne({
                    where: {
                        chatId: chatId
                    },
                    attributes: ['id', 'chatId', 'brand', 'subject', 'textMail']
                });

                return bot.sendMessage(
                    chatId, 
                    `Сформирован email:\nТема сообщения: <strong>${user.subject}</strong>\nКому: <b>поставщику ${user.brand}</b>\nКопия: <b>purchasing_internal@manders.ru</b>\nТекст сообщения:\n${user.textMail}\n`,
                    sendReserveOptions
                );

            } else if (data === '/preSendEmailReserveNo') {

                const subject = `Наличие+сроки ${user.vendorCode},  ${user.reserveNumber}, по запросу ${chatId}`;
                const textMail = `\nЗдравствуйте!\nУточните, пожалуйста, наличие и срок поставки:\nартикул: ${user.vendorCode}, бренд: ${user.brand}, в количестве: ${user.reserveNumber}.\nПожалуйста пришлите обратную связь ответным письмом на purchasing@manders.ru.`;

                await user.update({subject: subject, textMail: textMail}, {
                    where: {
                        chatId: chatId
                    }
                })
            
                const user = await UserModel.findOne({
                    where: {
                        chatId: chatId
                    },
                    attributes: ['id', 'chatId', 'brand', 'subject', 'textMail']
                });

                return bot.sendMessage(
                    chatId, 
                    `Сформирован email:\nТема сообщения: <strong>${user.subject}</strong>\nКому: <b>поставщику ${user.brand}</b>\nКопия: <b>purchasing_internal@manders.ru</b>\nТекст сообщения:\n${user.textMail}\n`, 
                    sendReserveOptions
                );

            } else if (data === '/sendReserveEmail') {
                // lc = data;
                await user.update({lastCommand: data}, {
                    where: {
                        chatId: chatId
                    }
                })

                return sendReserveEmail(chatId);

            } else if (data === '/catalogСheck') {
                // lc = data;
                await user.update({lastCommand: data}, {
                    where: {
                        chatId: chatId
                    }
                })

                return bot.sendMessage(
                    chatId, 
                    'Введите <b>наименование каталога</b> содержащего искомый вами товар:\n<i>(после получения результата, вы можете отправить новое наименование для поиска следующего каталога)</i>', 
                    { parse_mode: 'HTML' }
                );

            } else if (data === '/oracCheck') {
                // lc = data;
                await user.update({lastCommand: data}, {
                    where: {
                        chatId: chatId
                    }
                })

                return bot.sendMessage(
                    chatId, 
                    'Введите искомый вами <b>артикул</b> товара ORAC :\n<i>(после получения результата, вы можете отправить другой артикул для поиска)</i>', 
                    { parse_mode: 'HTML' }
                );

            } else if (data.includes('UWCheck')) {

                if ( data === '/UWCheck' ) {

                    await user.update({lastCommand: data}, {
                        where: {
                            chatId: chatId
                        }
                    });
    
                    return bot.sendMessage(
                        chatId, 
                        'Введите искомый вами <b>артикул</b> товара <b>ULTRA WOOD</b> :\n<i>(после получения результата, вы можете отправить другой артикул для поиска)</i>', 
                        { parse_mode: 'HTML' }
                    );

                }

            } else if (data === '/request1C') {
                // lc = '/request1C';
                await user.update({lastCommand: data}, {
                    where: {
                        chatId: chatId
                    }
                })

                return bot.sendMessage(
                    chatId, 
                    'Введите искомый вами <b>артикул</b>:\n<i>(после получения результата, вы можете отправить другой артикул для поиска)</i>', 
                    { parse_mode: 'HTML' }
                );

            } else if (data === '/work2') {
                // lc = null;
                await user.update({lastCommand: null}, {
                    where: {
                        chatId: chatId
                    }
                })

                return bot.sendMessage(
                    chatId, 
                    sorry, 
                    mainMenuReturnOptions
                );

            } else if (data === '/work3') {
                // lc = null;
                await user.update({lastCommand: null}, {
                    where: {
                        chatId: chatId
                    }
                })

                return bot.sendMessage(
                    chatId, 
                    sorry, 
                    mainMenuReturnOptions
                );

            } else if (data === '/again') {
                // lc = data;
                await user.update({lastCommand: data}, {
                    where: {
                        chatId: chatId
                    }
                })

                await bot.deleteMessage(
                    chatId, 
                    msg.message.message_id
                );
                return startGame(chatId);

            } else if (data === '/infogame') {
                // lc = data;
                await user.update({lastCommand: data}, {
                    where: {
                        chatId: chatId
                    }
                })

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
                // lc = data;
                await user.update({lastCommand: data}, {
                    where: {
                        chatId: chatId
                    }
                })

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

            } else if (user.lastCommand === '/game' || user.lastCommand === '/again') {

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

// ======================================================================================================================================
// конец блока функций ====================================================================================================================
// ======================================================================================================================================
// инициализация бота =====================================================================================================================
// ======================================================================================================================================

function readConfigSync() {
    const data = fs.readFileSync('/root/zak/config.cfg', 'utf-8');
    // const data = fs.readFileSync('C:\\node.js\\zak\\config.cfg', 'utf-8');
    const lines = data.split('\n');
    const config = {};
  
    lines.forEach(line => {
        const [key, value] = line.trim().split('=');
        config[key] = value;
    });
  
    return config;
}
// прочтение файла config.cfg
const config = readConfigSync();

const bot_password = config.bot_password;
const url_manders_1C = config.url_manders_1C;
const levantin_login = config.levantin_login;
const levantin_password = config.levantin_password;
const ProxyAgent = config.ProxyAgent;
const loginDG = config.loginDG;
const passwordDG = config.passwordDG;

const agent = new SocksProxyAgent(ProxyAgent);

const bot = new TelegramApi(config.bot_token, {
    polling: {
        interval: 1000, //между запросами с клиента на сервер тг "млсек"
        autoStart: true, //обработка всех команд отправленных до запуска программы
        params: {
            timeout:10 //таймаут между запросами "млсек"
        }
    }
});

//МЕНЮ КОМАНД
bot.setMyCommands([
    {command: '/mainmenu', description:'Главное меню'},
    {command: '/abilitys', description:'Актуальные функции бота'},
    {command: '/updatelist', description:'Список обновлений'},
    {command: '/settings', description:'Настройки'},
]);
const ignoreCommands =  '/mainmenu/mymovements/abilitys/updatelist/settings';

start();