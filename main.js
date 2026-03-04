process.env.NTBA_FIX_319 = 1;
const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs-extra");
const { checkCoupon } = require("./checker");

// Configuration - Replace with your actual token
const TOKEN = "8620466387:AAEuJFQSLm8KIvxaeVP8W6A9pA0BDyj7vXU"; 
const bot = new TelegramBot(TOKEN, { polling: true });

// Setup storage
fs.ensureDirSync("./vouchers");
fs.ensureDirSync("./cookies");
if (!fs.existsSync("users.json")) fs.writeJsonSync("users.json", []);

let mode = {}; // Tracks user state (adding, checking, etc.)

const indiaTime = () => new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" });

bot.on("callback_query", async (query) => {
    const id = query.from.id;
    if (query.data === "check") {
        if (!fs.existsSync(`./cookies/${id}.json`)) {
            return bot.sendMessage(id, "⚠️ No cookies found. Please set cookies first.");
        }
        mode[id] = "check";
        bot.sendMessage(id, "🔎 *Send coupons to verify against your cart (one per line):*", { parse_mode: "Markdown" });
    }
    // ... logic for other buttons like "stats" or "add"
});

bot.on("message", async (msg) => {
    const id = msg.from.id;
    const text = msg.text;
    if (!text || text.startsWith("/")) return;

    // Handle Cookie Submission
    if (mode[id] === "cookie") {
        fs.writeJsonSync(`./cookies/${id}.json`, { cookie: text.trim() });
        mode[id] = null;
        return bot.sendMessage(id, "✅ Cookies updated successfully.");
    }

    // Handle Coupon Checking Logic
    if (mode[id] === "check") {
        const codes = text.split("\n").map(c => c.trim()).filter(c => c).slice(0, 30);
        bot.sendMessage(id, `🔄 Testing ${codes.length} coupons on your live cart...`);

        let results = [];

        for (const code of codes) {
            const status = await checkCoupon(code, id);
            let responseLine = "";

            switch (status) {
                case "VALID":
                    responseLine = `🟢 \`${code}\`: **VALID** (Applied & Saved)`;
                    break;
                case "REDEEMED":
                    responseLine = `🟡 \`${code}\`: **USED/REDEEMED**`;
                    break;
                case "NOT_APPLICABLE":
                    responseLine = `🟠 \`${code}\`: **NOT APPLICABLE** (Check cart items)`;
                    break;
                case "BLOCKED":
                    responseLine = `🚫 \`${code}\`: **IP BLOCKED** (Stop checking)`;
                    break;
                case "nocookie":
                    return bot.sendMessage(id, "❌ Session expired. Please re-set cookies.");
                default:
                    responseLine = `🔴 \`${code}\`: **INVALID**`;
            }

            results.push(responseLine);
            
            // Random delay between 3-5 seconds to mimic human behavior
            await new Promise(r => setTimeout(r, 3000 + Math.random() * 2000));
        }

        bot.sendMessage(id, `📊 *Check Results (${indiaTime()})*\n\n${results.join("\n")}`, { parse_mode: "Markdown" });
        mode[id] = null;
    }
});

console.log("Bot is online and ready.");
