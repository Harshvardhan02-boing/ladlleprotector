const axios = require('axios');
const fs = require('fs-extra');

/**
 * Replicates the check_voucher_session logic from ashu.py
 */
async function checkCoupon(voucherCode, userId) {
    const cookiePath = `./cookies/${userId}.json`;
    if (!fs.existsSync(cookiePath)) return "nocookie";

    const cookieString = fs.readFileSync(cookiePath, "utf8").trim();
    
    // Exact headers from ashu.py to ensure Shein treats us as a mobile browser
    const headers = {
        "accept": "application/json",
        "accept-language": "en-US,en;q=0.9",
        "content-type": "application/json",
        "origin": "https://www.sheinindia.in",
        "referer": "https://www.sheinindia.in/cart",
        "user-agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36",
        "x-tenant-id": "SHEIN",
        "cookie": cookieString
    };

    const payload = { "voucherId": voucherCode, "device": { "client_type": "web" } };

    try {
        // Step 1: Apply (Replicating check_voucher_session)
        const applyRes = await axios.post("https://www.sheinindia.in/api/cart/apply-voucher", payload, { 
            headers, 
            timeout: 30000 
        });

        const data = applyRes.data;

        // Step 2: Handle VoucherOperationError (Replicating is_voucher_applicable)
        if (data.errorMessage) {
            const errorMsg = JSON.stringify(data.errorMessage).toLowerCase();
            if (errorMsg.includes("used") || errorMsg.includes("redeemed")) return "REDEEMED";
            if (errorMsg.includes("not applicable") || errorMsg.includes("not meet")) return "INVALID";
            return "INVALID";
        }

        // Step 3: Reset (Replicating reset_voucher_session)
        // This 'locks' the voucher for 10-15 mins but keeps it active for you
        await axios.post("https://www.sheinindia.in/api/cart/reset-voucher", payload, { 
            headers, 
            timeout: 15000 
        });
        
        return "VALID";

    } catch (error) {
        if (error.response && error.response.status === 403) return "BLOCKED";
        return "ERROR";
    }
}

module.exports = { checkCoupon };
