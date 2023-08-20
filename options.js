module.exports = {
//ИГРОВЫЕ КНОПКИ=============================================================================================================================================
    gameOptions: {
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
        reply_markup: JSON.stringify( {
            inline_keyboard: [
                [{text: 'Играть ещё раз?', callback_data: '/again'},{text: 'Показать результаты', callback_data: '/infogame'}],
                [{text: 'Закончить игру', callback_data: '/mainmenu'}],
            ]
        })
    },

    resetOptions: {
        reply_markup: JSON.stringify( {
            inline_keyboard: [
                [{text: 'Сбросить результаты', callback_data: '/reset'}],
            ]
        })
    },
//НАВИГАЦИОННЫЕ КНОПКИ=============================================================================================================================================
    mainMenuOptions: {
        parse_mode: 'HTML',
        reply_markup: JSON.stringify( {
            inline_keyboard: [
                [{text: 'В главное меню', callback_data: '/mainmenu'}],
            ]
        })
    },
//РАБОЧИЕ КНОПКИ=============================================================================================================================================
    beginWorkOptions: {
        parse_mode: 'HTML',
        reply_markup: JSON.stringify( {
            inline_keyboard: [
                [{text: 'Продолжить', callback_data: '/beginwork'}],
                [{text: 'В главное меню', callback_data: '/mainmenu'}],
            ]
        })
    },

    beginWork2Options: {
        parse_mode: 'HTML',
        reply_markup: JSON.stringify( {
            inline_keyboard: [
                [{text: 'Искать другой бренд', callback_data: '/enterBrand'}],
                [{text: 'В главное меню', callback_data: '/mainmenu'}],
            ]
        })
    },

    beginWork3Options: {
        parse_mode: 'HTML',
        reply_markup: JSON.stringify( {
            inline_keyboard: [
                [{text: 'Продолжить: поиск по бренду', callback_data: '/enterBrand'}],
                [{text: 'Найти другой каталог', callback_data: '/catalogСheck'}],
                [{text: 'В главное меню', callback_data: '/mainmenu'}],
            ]
        })
    },

    workOptions: {
        reply_markup: JSON.stringify( {
            inline_keyboard: [
                [{text: 'Остатки/сроки/резерв', callback_data: '/catalogСheck'}],
                [{text: 'Превью изображений', callback_data: '/work2'}],
                [{text: 'Добавить в заказ', callback_data: '/work3'}],
            ]
        })
    },

    startFindOptions: {
        parse_mode: 'HTML',
        reply_markup: JSON.stringify( {
            inline_keyboard: [
                [{text: 'Искать другой бренд', callback_data: '/enterBrand'}],
                [{text: 'Зарезервировать', callback_data: '/enterReserveNumber'}],
                [{text: 'В главное меню', callback_data: '/mainmenu'}],
            ]
        })
    },

    VCOptions: {
        parse_mode: 'HTML',
        reply_markup: JSON.stringify( {
            inline_keyboard: [
                [{text: 'Продолжить', callback_data: '/enterVC'}],
            ]
        })
    },

    enterReserveNumberOptions: {
        parse_mode: 'HTML',
        reply_markup: JSON.stringify( {
            inline_keyboard: [
                [{text: 'Сохранить и продолжить', callback_data: '/preSendEmail'}],
            ]
        })
    }, 

    sendReserveOptions: {
        parse_mode: 'HTML',
        reply_markup: JSON.stringify( {
            inline_keyboard: [
                [{text: 'Отправить е-мейл', callback_data: '/sendReserveEmail'}],
                [{text: 'Искать другой бренд', callback_data: '/enterBrand'}],
                [{text: 'В главное меню', callback_data: '/mainmenu'}],
            ]
        })
    }

}