const fs = require("fs")
const axios = require("axios")

function loadCookies(userId){

 const file = `./cookies/${userId}.json`

 if(!fs.existsSync(file)) return null

 try{

  const raw = fs.readFileSync(file,"utf8").trim()

  try{
   const obj = JSON.parse(raw)
   return Object.entries(obj).map(([k,v])=>`${k}=${v}`).join("; ")
  }catch{
   return raw
  }

 }catch{
  return null
 }

}

function getHeaders(cookie){

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
    timeout:45000
   }
  )

  return res.data

 }catch(e){

  if(e.response) return e.response.data

  return null

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
    timeout:20000
   }
  )

 }catch{}

}

function isApplicable(data){

 if(!data) return false

 if(data.errorMessage){

  const errors = data.errorMessage.errors || []

  for(const err of errors){

   const msg = (err.message || "").toLowerCase()

   if(msg.includes("not applicable"))
    return false

  }

 }

 return !data.errorMessage

}

async function checkCoupon(code,userId){

 const cookie = loadCookies(userId)

 if(!cookie) return "nocookie"

 const headers = getHeaders(cookie)

 const response = await applyVoucher(code,headers)

 const valid = isApplicable(response)

 await resetVoucher(code,headers)

 return valid ? "VALID" : "invalid"

}

module.exports = {checkCoupon}
