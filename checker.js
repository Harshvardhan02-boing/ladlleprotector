const axios = require('axios');
const fs = require('fs-extra');

async function checkCoupon(voucherCode, userId) {
    const cookiePath = `./cookies/${userId}.json`;
    if (!fs.existsSync(cookiePath)) return "nocookie";

    const cookieString = fs.readFileSync(cookiePath, "utf8").trim();
    
    const headers = {
        "accept": "application/json",
        "accept-language": "en-US,en;q=0.9",
        "content-type": "application/json",
        "origin": "https://www.sheinindia.in",
        "referer": "https://www.sheinindia.in/cart",
        // Updated User-Agent to match a standard modern Android device
        "user-agent": "Mozilla/5.0 (Linux; Android 13; SM-S901B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36",
        "x-tenant-id": "SHEIN",
        "cookie": cookieString
    };

    const payload = { "voucherId": voucherCode, "device": { "client_type": "web" } };

    try {
        const applyRes = await axios.post("https://www.sheinindia.in/api/cart/apply-voucher", payload, { 
            headers, 
            timeout: 20000 
        });

        // DEBUG: See exactly what Shein says in Railway logs
        console.log(`[DEBUG User ${userId}] Coupon ${voucherCode} Response:`, JSON.stringify(applyRes.data));

        if (applyRes.data.errorMessage) {
            const errorMsg = JSON.stringify(applyRes.data.errorMessage).toLowerCase();
            if (errorMsg.includes("used") || errorMsg.includes("redeemed")) return "REDEEMED";
            if (errorMsg.includes("risk") || errorMsg.includes("busy")) return "IP_BLOCKED/RISK";
            return "INVALID";
        }

        // Only Reset if it was successfully applied
        await axios.post("https://www.sheinindia.in/api/cart/reset-voucher", payload, { 
            headers, 
            timeout: 10000 
        });
        
        return "VALID";
    } catch (error) {
        // Detailed error logging for Railway
        if (error.response) {
            console.error(`[ERROR] Shein API rejected request. Status: ${error.response.status}`);
            console.error(`[ERROR DATA]:`, JSON.stringify(error.response.data));
            if (error.response.status === 403) return "SESSION_EXPIRED";
        } else {
            console.error(`[ERROR] Connection problem: ${error.message}`);
        }
        return "ERROR";
    }
}

module.exports = { checkCoupon };
