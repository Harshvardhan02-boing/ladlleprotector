const fs = require("fs")
const axios = require("axios")

function getCookie(userId){

 const file = `./cookies/${userId}.json`

 if(!fs.existsSync(file)) return null

 try{

  const raw = fs.readFileSync(file,"utf8")
  const data = JSON.parse(raw)

  if(data.cookie) return data.cookie

  return raw

 }catch{

  return fs.readFileSync(file,"utf8").trim()

 }

}

function headers(cookie){

 return {
  "accept":"application/json",
  "content-type":"application/json",
  "origin":"https://www.sheinindia.in",
  "referer":"https://www.sheinindia.in/cart",
  "user-agent":"Mozilla/5.0",
  "x-tenant-id":"SHEIN",
  "cookie":cookie
 }

}

async function applyVoucher(code,headers){

 try{

  const res = await axios.post(
   "https://www.sheinindia.in/api/cart/apply-voucher",
   {
    voucherId:code,
    device:{client_type:"web"}
   },
   {
    headers:headers,
    timeout:12000
   }
  )

  return res.data

 }catch(e){

  if(e.response) return e.response.data

  return {networkError:true}

 }

}

async function resetVoucher(code,headers){

 try{

  await axios.post(
   "https://www.sheinindia.in/api/cart/reset-voucher",
   {
    voucherId:code,
    device:{client_type:"web"}
   },
   {
    headers:headers,
    timeout:10000
   }
  )

 }catch{}

}

function analyzeResponse(data){

 if(!data) return "ERROR"

 if(data.networkError) return "ERROR"

 if(data.errorCode === "RX1") return "COOKIE_EXPIRED"

 if(data.success === true) return "VALID"

 if(data.voucherInfo) return "VALID"

 if(data.errorMessage){

  const errors = data.errorMessage.errors || []

  for(const err of errors){

   const msg = (err.message || "").toLowerCase()

   if(msg.includes("already") || msg.includes("redeemed"))
    return "REDEEMED"

   if(msg.includes("not applicable"))
    return "INVALID"

   if(msg.includes("expired"))
    return "INVALID"

  }

 }

 return "INVALID"

}

async function checkCoupon(code,userId){

 const cookie = getCookie(userId)

 if(!cookie) return "NO_COOKIE"

 const h = headers(cookie)

 const response = await applyVoucher(code,h)

 const result = analyzeResponse(response)

 if(result === "VALID")
  await resetVoucher(code,h)

 return result

}

module.exports = {checkCoupon}
