process.env.NTBA_FIX_319 = 1;
const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs-extra");
const express = require('express');
const { checkCoupon } = require("./checker");

// --- RAILWAY HEALTH CHECK (Prevents SIGTERM) ---
const app = express();
app.get('/', (req, res) => res.send('Vault Online'));
app.listen(process.env.PORT || 3000);

const TOKEN = process.env.BOT_TOKEN || "8620466387Dyj7vXU";
const ADMIN_ID = 2090180877;
const bot = new TelegramBot(TOKEN, { polling: true });

// Ensure directories
fs.ensureDirSync("./vouchers");
fs.ensureDirSync("./cookies");
if (!fs.existsSync("users.json")) fs.writeJsonSync("users.json", []);

let mode = {};
let valueMap = {};

// --- HELPER FUNCTIONS (Preserving your UI structure) ---
const users = () => fs.readJsonSync("users.json");
const register = (id) => {
    let u = users();
    if (!u.includes(id)) { u.push(id); fs.writeJsonSync("users.json", u); }
};
const cookieExists = (id) => fs.existsSync(`./cookies/${id}.json`);
const voucherFile = (id) => {
    const path = `./vouchers/${id}.json`;
    if (!fs.existsSync(path)) fs.writeJsonSync(path, { "500": [], "1000": [], "2000": [], "4000": [] });
    return path;
};
const load = (id) => fs.readJsonSync(voucherFile(id));
const save = (id, data) => fs.writeJsonSync(voucherFile(id), data);
const indiaTime = () => new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" });

function mainMenu(userId) {
    let buttons = [
        [{ text: "➕ Add Coupon", callback_data: "add" }],
        [{ text: "📤 Retrieve Coupon", callback_data: "retrieve" }],
        [{ text: "📊 My Coupons", callback_data: "stats" }],
        [{ text: "🔎 Check Coupons", callback_data: "check" }],
        [{ text: "🍪 Set Cookies", callback_data: "cookie" }],
        [{ text: "🔍 Cookie Status", callback_data: "status" }]
    ];
    if (userId === ADMIN_ID) buttons.push([{ text: "📢 Announcement", callback_data: "announce" }]);
    return { reply_markup: { inline_keyboard: buttons } };
}

function categoryMenu() {
    return { reply_markup: { inline_keyboard: [
        [{ text: "₹500", callback_data: "val_500" }], [{ text: "₹1000", callback_data: "val_1000" }],
        [{ text: "₹2000", callback_data: "val_2000" }], [{ text: "₹4000", callback_data: "val_4000" }],
        [{ text: "⬅ Back", callback_data: "menu" }]
    ] } };
}

// --- BOT HANDLERS ---
bot.onText(/\/start/, msg => {
    register(msg.from.id);
    bot.sendMessage(msg.from.id, `💳 Coupon Manager\n\nChoose an option below`, mainMenu(msg.from.id));
});

bot.on("callback_query", async q => {
    const id = q.from.id;
    const data = q.data;
    if (data === "menu") return bot.sendMessage(id, "Main Menu", mainMenu(id));
    if (data === "cookie") { mode[id] = "cookie"; return bot.sendMessage(id, `🍪 Set Cookies\n\nPaste cookie here.`); }
    if (data === "add") { if (!cookieExists(id)) return bot.sendMessage(id, "🍪 Please set cookies first"); mode[id] = "add"; return bot.sendMessage(id, "Select value", categoryMenu()); }
    if (data === "check") { if (!cookieExists(id)) return bot.sendMessage(id, "🍪 Cookies required"); mode[id] = "check"; return bot.sendMessage(id, `Send coupons to check\nMax 50`); }
    if (data === "stats") {
        const d = load(id);
        return bot.sendMessage(id, `📊 Coupons\n\n500: ${d["500"].length}\n1000: ${d["1000"].length}\n2000: ${d["2000"].length}\n4000: ${d["4000"].length}`);
    }
    if (data.startsWith("val_")) {
        valueMap[id] = data.split("_")[1];
        if (mode[id] === "add") return bot.sendMessage(id, "Send coupon code");
        if (mode[id] === "retrieve") {
            const d = load(id), val = valueMap[id];
            if (d[val].length === 0) return bot.sendMessage(id, "No coupons");
            const code = d[val].shift(); save(id, d);
            return bot.sendMessage(id, `Coupon:\n${code}`);
        }
    }
});

bot.on("message", async msg => {
    const id = msg.from.id, text = msg.text;
    if (!text || text.startsWith("/")) return;

    if (mode[id] === "cookie") {
        fs.writeFileSync(`./cookies/${id}.json`, text.trim());
        mode[id] = null;
        return bot.sendMessage(id, "🍪 Cookies saved");
    }

    if (mode[id] === "add") {
        const val = valueMap[id], d = load(id), code = text.trim();
        if (d[val].includes(code)) return bot.sendMessage(id, "Already stored");
        d[val].push(code); save(id, d);
        mode[id] = null;
        return bot.sendMessage(id, "✅ Coupon added to Vault");
    }

    if (mode[id] === "check") {
        const coupons = text.replace(/,/g, "\n").split("\n").map(x => x.trim()).filter(x => x).slice(0, 50);
        bot.sendMessage(id, `🔍 Checking ${coupons.length} coupons on your live cart...`);
        let out = [];
        for (const code of coupons) {
            const res = await checkCoupon(code, id);
            let emoji = res === "VALID" ? "🟢" : (res === "REDEEMED" ? "🟡" : "🔴");
            out.push(`${emoji} ${code}\nStatus: ${res}\nTime: ${indiaTime()}\n──────`);
            await new Promise(r => setTimeout(r, 4000)); // Replicating Python delay
        }
        bot.sendMessage(id, out.join("\n"));
        mode[id] = null;
    }
});

// --- THE PROTECTOR LOOP (Replicating the Auto-Check mode) ---
async function protectCoupons(userId) {
    if (!cookieExists(userId)) return;
    const data = load(userId);
    const all = [...data["500"], ...data["1000"], ...data["2000"], ...data["4000"]];
    
    console.log(`🛡️ Protecting ${all.length} coupons for User ${userId}`);
    for (const code of all) {
        // This automatically applies and resets via the checker logic
        await checkCoupon(code, userId);
        // Wait 5 seconds between each coupon to avoid blocking
        await new Promise(r => setTimeout(r, 5000)); 
    }
}

// Runs every 220 seconds as per ashu.py
setInterval(async () => {
    const u = users();
    for (const user of u) {
        await protectCoupons(user);
    }
}, 220000);

console.log("Vault Bot Running...");
