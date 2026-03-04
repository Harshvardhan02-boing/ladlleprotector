const axios = require('axios');
const fs = require('fs-extra');

async function checkCoupon(voucherCode, userId) {
    const cookiePath = `./cookies/${userId}.json`;
    if (!fs.existsSync(cookiePath)) return "nocookie";

    const { cookie } = fs.readJsonSync(cookiePath);
    
    const headers = {
        "accept": "application/json",
        "accept-language": "en-US,en;q=0.9",
        "content-type": "application/json",
        "origin": "https://www.sheinindia.in",
        "referer": "https://www.sheinindia.in/cart",
        "user-agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36",
        "x-tenant-id": "SHEIN",
        "cookie": cookie
    };

    const payload = { 
        "voucherId": voucherCode, 
        "device": { "client_type": "web" } 
    };

    try {
        // 1. Try to Apply to real cart
        const response = await axios.post("https://www.sheinindia.in/api/cart/apply-voucher", payload, { 
            headers, 
            timeout: 15000 
        });

        if (response.data.errorMessage) {
            const msg = JSON.stringify(response.data.errorMessage).toLowerCase();
            if (msg.includes("used") || msg.includes("redeemed")) return "REDEEMED";
            return "INVALID";
        }

        // 2. If valid, Reset immediately to "save" the coupon
        await axios.post("https://www.sheinindia.in/api/cart/reset-voucher", payload, { 
            headers, 
            timeout: 10000 
        });
        
        return "VALID";

    } catch (error) {
        if (error.response && error.response.status === 403) return "BLOCKED";
        return "ERROR";
    }
}

module.exports = { checkCoupon };
