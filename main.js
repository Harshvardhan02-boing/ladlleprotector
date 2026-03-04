const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs-extra');
const path = require('path');

const TOKEN = "8620466387:AAEuJFQSLm8KIvxaeVP8W6A9pA0BDyj7vXU";

const bot = new TelegramBot(TOKEN, { polling: true });

const vouchersDir = "./vouchers";
const usersDir = "./users";
const cookiesDir = "./cookies";

fs.ensureDirSync(vouchersDir);
fs.ensureDirSync(usersDir);
fs.ensureDirSync(cookiesDir);

function getVoucherFile(userId){
    return path.join(vouchersDir, `${userId}.json`);
}

function loadCoupons(userId){
    const file = getVoucherFile(userId);
    if(!fs.existsSync(file)) return [];
    return fs.readJsonSync(file).coupons || [];
}

function saveCoupons(userId,coupons){
    const file = getVoucherFile(userId);
    fs.writeJsonSync(file,{coupons});
}

bot.onText(/\/start/, (msg)=>{
    const chatId = msg.chat.id;

    bot.sendMessage(chatId,
`Coupon Bot Ready

Commands:
/add
/check
/mycoupons
/setcookies
/cookiestatus`);
});

bot.onText(/\/add/, msg=>{
    bot.sendMessage(msg.chat.id,"Send coupons separated by comma or newline.");
});

bot.on("message",(msg)=>{

    const text = msg.text;
    const userId = msg.from.id;

    if(!text) return;
    if(text.startsWith("/")) return;

    const coupons = text
        .split(/[\n,]/)
        .map(c=>c.trim())
        .filter(c=>c.length>4);

    if(coupons.length===0) return;

    let existing = loadCoupons(userId);

    let added=[];
    let duplicate=[];

    coupons.forEach(c=>{
        if(existing.includes(c)) duplicate.push(c);
        else{
            existing.push(c);
            added.push(c);
        }
    });

    saveCoupons(userId,existing);

    bot.sendMessage(msg.chat.id,
`Added: ${added.length}
Duplicates: ${duplicate.length}
Total stored: ${existing.length}`);
});

bot.onText(/\/mycoupons/,msg=>{
    const coupons = loadCoupons(msg.from.id);

    bot.sendMessage(msg.chat.id,
`You have ${coupons.length} coupons stored.`);
});
