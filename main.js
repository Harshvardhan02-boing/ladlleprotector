process.env.NTBA_FIX_319 = 1;
const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs-extra");
const express = require('express');
const { checkCoupon } = require("./checker");

// --- 1. HEALTH CHECK SERVER FOR RAILWAY ---
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Bot Status: Active'));
app.listen(PORT, () => console.log(`Railway Health Check listening on port ${PORT}`));

// --- 2. BOT CONFIGURATION ---
// Note: In Railway, use process.env.BOT_TOKEN for better security
const TOKEN = process.env.BOT_TOKEN || "8620466387:AAEuJFQSLm8KIvxaeVP8W6A9pA0BDyj7vXU"; 
const bot = new TelegramBot(TOKEN, { polling: true });

// Ensure directories exist
fs.ensureDirSync("./vouchers");
fs.ensureDirSync("./cookies");
if (!fs.existsSync("users.json")) fs.writeJsonSync("users.json", []);

let mode = {};
const indiaTime = () => new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" });

// --- 3. BOT LOGIC ---
bot.onText(/\/start/, (msg) => {
    const id = msg.from.id;
    const menu = {
        reply_markup: {
            inline_keyboard: [
                [{ text: "🍪 Set Cookies", callback_data: "cookie" }],
                [{ text: "🔎 Check Coupons", callback_data: "check" }],
                [{ text: "📊 Stats", callback_data: "stats" }]
            ]
        }
    };
    bot.sendMessage(id, "💳 *Shein India Coupon Manager*\n\nSet your cookies first, then send coupons to check against your live cart.", { parse_mode: "Markdown", ...menu });
});

bot.on("callback_query", async (query) => {
    const id = query.from.id;
    if (query.data === "cookie") {
        mode[id] = "cookie";
        bot.sendMessage(id, "🍪 Please paste your Shein India cookie string now.");
    }
    if (query.data === "check") {
        if (!fs.existsSync(`./cookies/${id}.json`)) return bot.sendMessage(id, "❌ Set cookies first!");
        mode[id] = "check";
        bot.sendMessage(id, "🔎 Send coupons (one per line) to test on your cart:");
    }
    if (query.data === "stats") {
        const d = fs.existsSync(`./vouchers/${id}.json`) ? fs.readJsonSync(`./vouchers/${id}.json`) : {};
        bot.sendMessage(id, `📊 Check records are currently stored locally.`);
    }
});

bot.on("message", async (msg) => {
    const id = msg.from.id;
    const text = msg.text;
    if (!text || text.startsWith("/")) return;

    if (mode[id] === "cookie") {
        fs.writeJsonSync(`./cookies/${id}.json`, { cookie: text.trim() });
        mode[id] = null;
        return bot.sendMessage(id, "✅ Cookies saved and active.");
    }

    if (mode[id] === "check") {
        const codes = text.split("\n").map(c => c.trim()).filter(c => c).slice(0, 30);
        bot.sendMessage(id, `🔄 Testing ${codes.length} coupons...`);

        let results = [];
        for (const code of codes) {
            const status = await checkCoupon(code, id);
            let icon = (status === "VALID") ? "🟢" : (status === "REDEEMED" ? "🟡" : "🔴");
            results.push(`${icon} \`${code}\`: ${status}`);
            
            // Delay to prevent IP blocks (Shein is strict)
            await new Promise(r => setTimeout(r, 4000));
        }

        bot.sendMessage(id, `📊 *Results (${indiaTime()})*\n\n${results.join("\n")}`, { parse_mode: "Markdown" });
        mode[id] = null;
    }
});

console.log("Bot process started.");
