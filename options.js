module.exports = {
//ИГРОВЫЕ КНОПКИ=============================================================================================================================================
    gameOptions: {
        parse_mode: 'HTML',
        reply_markup: JSON.stringify( {
            inline_keyboard: [
                [{text: 1, callback_data: '1'},{text: 2, callback_data: '2'},{text: 3, callback_data: '3'}],
                [{text: 4, callback_data: '4'},{text: 5, callback_data: '5'},{text: 6, callback_data: '6'}],
                [{text: 7, callback_data: '7'},{text: 8, callback_data: '8'},{text: 9, callback_data: '9'}],
                [{text: 0, callback_data: '0'}],
            ]
        })
    },
    
    againOptions: {
        parse_mode: 'HTML',
        reply_markup: JSON.stringify( {
            inline_keyboard: [
                [{text: 'Играть ещё раз?', callback_data: '/again'},{text: 'Показать результаты', callback_data: '/infogame'}],
                [{text: 'Закончить игру', callback_data: '/mainmenu'}],
            ]
        })
    },

    resetOptions: {
        parse_mode: 'HTML',
        reply_markup: JSON.stringify( {
            inline_keyboard: [
                [{text: 'Сбросить результаты', callback_data: '/reset'}],
            ]
        })
    },
//НАВИГАЦИОННЫЕ КНОПКИ=============================================================================================================================================
    mainMenuReturnOptions: {
        parse_mode: 'HTML',
        reply_markup: JSON.stringify( {
            inline_keyboard: [
                [{text: 'В главное меню 📋', callback_data: '/mainmenu'}],
            ]
        })
    },
//РАБОЧИЕ КНОПКИ=============================================================================================================================================
    mainMenuOptions: {
        parse_mode: 'HTML',
        reply_markup: JSON.stringify( {
            inline_keyboard: [
                [{text: 'Запрос: остатки+сроки+резерв 🔎', callback_data: '/beginwork'}],
                [{text: 'Проверка наличия в 1С ✅', callback_data: '/request1C'}],
                [{text: 'Статус заказа поставщику ⌛', callback_data: '/supplierOrderStatus'}],
                // [{text: 'Функции в разработке', callback_data: '/beginwork1'}],
            ]
        })
    },

    settingsOptions: {
        parse_mode: 'HTML',
        reply_markup: JSON.stringify( {
            inline_keyboard: [
                [{text: 'Изменить никнейм 🔃', callback_data: '/editNickname'}],
                [{text: 'Изменить емейл 📭', callback_data: '/editEmail'}]
            ]
        })
    },

    beginWorkOptions: {
        parse_mode: 'HTML',
        reply_markup: JSON.stringify( {
            inline_keyboard: [
                [{text: 'Продолжить ➡', callback_data: '/beginwork'}],
                [{text: 'В главное меню 📋', callback_data: '/mainmenu'}],
            ]
        })
    },

    beginWork2Options: {
        parse_mode: 'HTML',
        reply_markup: JSON.stringify( {
            inline_keyboard: [
                [{text: 'Искать другой каталог 🔎', callback_data: '/catalogСheck'}],
                [{text: 'В главное меню 📋', callback_data: '/mainmenu'}],
            ]
        })
    },

    beginWork3Options: {
        parse_mode: 'HTML',
        reply_markup: JSON.stringify( {
            inline_keyboard: [
                [{text: 'К следующей ступени поиска ➡', callback_data: '/checkVendor'}],
                [{text: 'В главное меню 📋', callback_data: '/mainmenu'}],
            ]
        })
    },

    workOptions: {
        parse_mode: 'HTML',
        reply_markup: JSON.stringify( {
            inline_keyboard: [
                [{text: 'Поиск по каталогу 🔎', callback_data: '/catalogСheck'}, {text: 'Поиск по бренду 🔎', callback_data: '/enterBrand'}],
                [{text: 'Остатки ORAC 🅾', callback_data: '/oracCheck'}],
                [{text: 'Остатки Ultra Wood 📋', callback_data: '/UWCheck'}],
            ]
        })
    },

    choiseOption: {
        parse_mode: 'HTML',
        reply_markup: JSON.stringify( {
            inline_keyboard: [
                [{text: 'Ткани Morris', callback_data: '/MorrisTextile'}],
                [{text: 'Обои Morris', callback_data: '/MorrisWallpapper'}],
            ]
        })
    },

    work1Options: {
        parse_mode: 'HTML',
        reply_markup: JSON.stringify( {
            inline_keyboard: [
                [{text: 'Превью изображений', callback_data: '/work2'}],
                [{text: 'Добавить в заказ', callback_data: '/work3'}],
            ]
        })
    },

    startFindOptions: {
        parse_mode: 'HTML',
        reply_markup: JSON.stringify( {
            inline_keyboard: [
                [{text: 'Зарезервировать у поставщика 📧', callback_data: '/enterReserveNumber'}],
                [{text: 'Искать другой бренд 🔎', callback_data: '/enterBrand'}],
                [{text: 'В главное меню 📋', callback_data: '/mainmenu'}],
            ]
        })
    },

    startFind1Options: {
        parse_mode: 'HTML',
        reply_markup: JSON.stringify( {
            inline_keyboard: [
                [{text: 'Искать другой бренд 🔎', callback_data: '/enterBrand'}],
                [{text: 'В главное меню 📋', callback_data: '/mainmenu'}],
            ]
        })
    },

    startFind2Options: {
        parse_mode: 'HTML',
        reply_markup: JSON.stringify( {
            inline_keyboard: [
                [{text: 'Да ✅', callback_data: '/preSendEmailReserveYes'},{text: 'Нет ❌', callback_data: '/preSendEmailReserveNo'}],
                [{text: 'Искать другой каталог 🔎', callback_data: '/catalogСheck'}],
                [{text: 'В главное меню 📋', callback_data: '/mainmenu'}],
            ]
        })
    },

    checkVendorOptions: {
        parse_mode: 'HTML',
        reply_markup: JSON.stringify( {
            inline_keyboard: [
                [{text: 'Продолжить ➡', callback_data: '/checkVendor'}],
            ]
        })
    },

    enterReserveNumberOptions: {
        parse_mode: 'HTML',
        reply_markup: JSON.stringify( {
            inline_keyboard: [
                [{text: 'Сохранить и продолжить 💾➡', callback_data: '/preSendEmail'}],
            ]
        })
    }, 

    sendReserveOptions: {
        parse_mode: 'HTML',
        reply_markup: JSON.stringify( {
            inline_keyboard: [
                [{text: 'Отправить email 📨', callback_data: '/sendReserveEmail'}],
                [{text: 'Искать другой каталог 🔎', callback_data: '/catalogСheck'}],
                [{text: 'В главное меню 📋', callback_data: '/mainmenu'}],
            ]
        })
    },

    resetInfoWorkOptions: {
        reply_markup: JSON.stringify( {
            inline_keyboard: [
                [{text: 'Сбросить параметры 📝', callback_data: '/resetInfoWork'}],
            ]
        })
    },
}