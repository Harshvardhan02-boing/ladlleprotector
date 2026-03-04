const fs = require("fs")
const axios = require("axios")

function loadCookie(userId){

 const file = `./cookies/${userId}.json`
 if(!fs.existsSync(file)) return null

 const raw = fs.readFileSync(file,"utf8")

 try{
  const data = JSON.parse(raw)
  if(data.cookie) return data.cookie
 }catch{}

 return raw.trim()

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

async function applyVoucher(code,cookie){

 try{

  const res = await axios.post(
   "https://www.sheinindia.in/api/cart/apply-voucher",
   {voucherId:code,device:{client_type:"web"}},
   {headers:headers(cookie),timeout:20000}
  )

  return res.data

 }catch(e){

  if(e.response) return e.response.data
  return null

 }

}

async function resetVoucher(code,cookie){

 try{

  await axios.post(
   "https://www.sheinindia.in/api/cart/reset-voucher",
   {voucherId:code,device:{client_type:"web"}},
   {headers:headers(cookie),timeout:15000}
  )

 }catch{}

}

function isApplicable(data){

 if(!data) return false

 if(data.errorMessage){

  const errors = data.errorMessage.errors || []

  for(const err of errors){

   if(err.type==="VoucherOperationError"){

    const msg = (err.message || "").toLowerCase()

    if(msg.includes("not applicable"))
     return false

   }

  }

 }

 return true

}

async function checkCoupon(code,userId){

 const cookie = loadCookie(userId)
 if(!cookie) return "NO_COOKIE"

 const res = await applyVoucher(code,cookie)

 const valid = isApplicable(res)

 await resetVoucher(code,cookie)

 return valid ? "VALID" : "INVALID"

}

module.exports = {checkCoupon}
