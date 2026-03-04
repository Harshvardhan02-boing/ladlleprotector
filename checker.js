const axios = require('axios');
const fs = require('fs-extra');

/**
 * Applies a coupon to the user's actual cart, checks validity, and resets it.
 */
async function checkCoupon(voucherCode, userId) {
    const cookiePath = `./cookies/${userId}.json`;
    if (!fs.existsSync(cookiePath)) return "nocookie";

    const { cookie } = fs.readJsonSync(cookiePath);
    
    // Exact headers from the Python source for consistency
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
        // Step 1: Attempt to Apply the coupon to the real cart
        const applyRes = await axios.post("https://www.sheinindia.in/api/cart/apply-voucher", payload, { 
            headers, 
            timeout: 20000 
        });

        const data = applyRes.data;

        // Step 2: Check for error messages in the response
        if (data.errorMessage) {
            const errorMsg = JSON.stringify(data.errorMessage).toLowerCase();
            
            // Checking for specific invalidation reasons
            if (errorMsg.includes("used") || errorMsg.includes("redeemed")) return "REDEEMED";
            if (errorMsg.includes("not applicable")) return "NOT_APPLICABLE"; // e.g., cart value too low
            return "INVALID";
        }

        // Step 3: If valid, Reset the voucher immediately to "save" it
        await axios.post("https://www.sheinindia.in/api/cart/reset-voucher", payload, { 
            headers, 
            timeout: 10000 
        });
        
        return "VALID";

    } catch (error) {
        // Handle IP blocks or network timeouts
        if (error.response && error.response.status === 403) return "BLOCKED";
        return "ERROR";
    }
}

module.exports = { checkCoupon };
