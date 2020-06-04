/* part1: 
User calls their phone number and the FreeClimb webhook submits a POST request
to the /incomingOfficeCall endpoint. The endpoint returns PerCL instructions 
telling FreeClimb say a given message with Text To Speech (TTS)

*/

//////////////////////////////////////////
// Imports
require('dotenv').config()
const freeclimbSDK = require('@freeclimb/sdk')
const express = require('express')
const bodyParser = require('body-parser')
const app = express()
app.use(bodyParser.json())
// bodyParser middleware is required in order to interpret responses
//      from FreeClimb
//////////////////////////////////////////

//////////////////////////////////////////
// environment variables
// TODO: describe each in docs
const accountId = process.env.ACCOUNT_ID
const authToken = process.env.AUTH_TOKEN
const port = process.env.PORT || 80
const host = process.env.HOST
//////////////////////////////////////////

// Initializing an instance of the SDK with our credentials
const freeclimb = freeclimbSDK(accountId, authToken)

// Starting the express API
app.listen(port, () => {
  console.log(`Listing on port ${port}`)
})

app.post('/incomingMainOfficeCall', (req, res) => {
  console.log('The main office phone was called, playing message + creating conference.')
  const helloMsg = freeclimb.percl.say('Hello! Thanks for calling Vail Spa Management!')
  res.status(200).json([helloMsg])
})
