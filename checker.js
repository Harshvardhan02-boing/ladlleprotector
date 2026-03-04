const fs = require("fs")
const axios = require("axios")

function getCookie(userId){

    const file = `./cookies/${userId}.json`

    if(!fs.existsSync(file)) return null

    return fs.readFileSync(file,"utf8")
}

async function checkCoupon(code,userId){

    const cookie = getCookie(userId)

    if(!cookie) return "nocookie"

    try{

        const res = await axios.post(
            "https://example.com/api/check-coupon",
            { coupon: code },
            {
                headers:{
                    "cookie": cookie,
                    "content-type":"application/json"
                },
                timeout:10000
            }
        )

        const data = res.data

        if(data.valid) return "valid"
        if(data.used) return "used"
        if(data.expired) return "expired"

        return "invalid"

    }catch(e){

        if(e.response && e.response.status==401)
            return "cookie_expired"

        return "error"
    }
}

module.exports = { checkCoupon }
