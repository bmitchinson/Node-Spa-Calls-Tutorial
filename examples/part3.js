/* part3: 
User calls their FreeClimb number and is asked to enter a 1 to reach 
Deerfield spa, or 2 to reach Persephone spa and resort. If no entry was 
received, or an invalid number is chosen, the user is sent back to 
/incomingMainOffice through a redirect

- /incomingMainOffice call now uses "getDigits", to receive an entered number
  input from the caller. Once a number is entered, FreeClimb forwards the
  selection to /spaSelected

- /spaSelected creates a conference using the received number selection to
  determine the outbound number it should dial (Deerfield if 1 was chosen, 
  Persephone if 2.) 
  
- All conference logic is reused from Part 2.

*/

//////////////////////////////////////////
// Imports
require('dotenv').config()
const freeclimbSDK = require('@freeclimb/sdk')
const express = require('express')
const bodyParser = require('body-parser')
const browser = require('./browser')
const app = express()
app.use(bodyParser.json())
app.use(browser)
// bodyParser middleware is required in order to interpret responses
//      from FreeClimb
//////////////////////////////////////////

//////////////////////////////////////////
// environment variables
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
  console.log('The main office phone was called, prompting the user.')
  const helloMsg = freeclimb.percl.say('Hello! Thanks for calling Vail Spa Management!')
  const promptForSpa = freeclimb.percl.say(
    'Press 1 to contact Deerfield Spa. Press 2 to contact Persephone Spa and Resort.',
  )
  const getDigitsOptions = {
    prompts: [promptForSpa],
    maxDigits: 1,
    minDigits: 1,
    flushBuffer: true,
  }
  const getDigits = freeclimb.percl.getDigits(`${host}/spaSelected`, getDigitsOptions)
  res.status(200).json([helloMsg, getDigits])
})

app.post('/spaSelected', (req, res) => {
  console.log('a spa was selected')
  const getDigitResponse = req.body
  const digit = getDigitResponse.digits

  let numberToForwardTo
  let destination
  switch (digit) {
    case '1':
      numberToForwardTo = '+19402206447' // Deerfield Spa
      destination = freeclimb.percl.say('Calling Deerfield Spa')
      break
    case '2':
      numberToForwardTo = '+19402302667' // Persephone Spa + Resort
      destination = freeclimb.percl.say('Calling Persephone Spa + Resort')
      break
  }

  if (numberToForwardTo) {
    const conferenceOptions = {
      playBeep: 'entryOnly',
      statusCallbackUrl: `${host}/gotConferenceStatus`,
    }
    const conferenceStart = freeclimb.percl.createConference(`${host}/conferenceCreated/${numberToForwardTo}`)
    res.status(200).json([destination, conferenceStart])
  } else if (!digit) {
    console.log('No number was selected')
    const startOver = freeclimb.percl.redirect(`${host}/incomingMainOfficeCall`)
    res.status(200).json([startOver])
  } else {
    console.log("Number entered wasn't an option")
    const badChoice = freeclimb.percl.say(`Sorry, ${digit} isn't an option.`)
    const startOver = freeclimb.percl.redirect(`${host}/incomingMainOfficeCall`)
    res.status(200).json([badChoice, startOver])
  }
})

app.post('/conferenceCreated/:numberToForwardTo', (req, res) => {
  console.log('FreeClimb created a conference')
  const say = freeclimb.percl.say('Forwarding your call now.')
  const createConferenceResponse = req.body
  const conferenceId = createConferenceResponse.conferenceId
  const agentPhoneNumber = req.params.numberToForwardTo
  const options = {
    // Hangup if we get a voicemail machine
    ifMachine: freeclimb.enums.ifMachine.hangup,
  }
  const outDial = freeclimb.percl.outDial(
    agentPhoneNumber,
    createConferenceResponse.from,
    `${host}/outboundCallMade/${conferenceId}`,
    `${host}/callConnected/${conferenceId}`,
    options,
  )
  const percl = freeclimb.percl.build(say, outDial)
  res.status(200).json(percl)
})

app.post('/outboundCallMade/:conferenceId', (req, res) => {
  console.log('FreeClimb hit outbound call made')
  const outboundCallResponse = req.body
  const conferenceId = req.params.conferenceId
  // set the leaveConferenceUrl for the inbound caller, so that we can terminate the conference when they hang up
  const options = {
    leaveConferenceUrl: `${host}/leftConference`,
  }
  // Add initial caller to conference
  const addToConference = freeclimb.percl.addToConference(conferenceId, outboundCallResponse.callId, options)
  const percl = freeclimb.percl.build(addToConference)
  res.status(200).json(percl)
})

app.post('/callConnected/:conferenceId', (req, res) => {
  console.log('FreeClimb hit call connected')
  const callConnectedResponse = req.body
  const conferenceId = req.params.conferenceId
  if (callConnectedResponse.dialCallStatus != freeclimb.enums.callStatus.IN_PROGRESS) {
    // Terminate conference if agent does not answer the call. Can't use PerCL command since PerCL is ignored if the call was not answered.
    terminateConference(conferenceId)
    return res.status(200).json([])
  }
  const addToConference = freeclimb.percl.addToConference(conferenceId, callConnectedResponse.callId)
  const percl = freeclimb.percl.build(addToConference)
  res.status(200).json(percl)
})

app.post('/leftConference', (req, res) => {
  console.log('FreeClimb: hit left conference')
  // Call terminateConference when the initial caller hangs up
  const leftConferenceResponse = req.body
  const conferenceId = leftConferenceResponse.conferenceId
  terminateConference(conferenceId)
  res.status(200).json([])
})

function terminateConference(conferenceId) {
  const options = {
    status: freeclimb.enums.conferenceStatus.TERMINATED,
  }
  freeclimb.api.conferences
    .update(conferenceId, options)
    .then(() => {
      console.log('The conference was terminated')
    })
    .catch((err) => {
      console.log('There was a problem terminating the conference:', err)
    })
}

app.post('/gotSMS', (req, res) => {
  console.log('received a text:', req.body)
  res.status(200).send()
})

app.post('/gotStatus', (req, res) => {
  console.log('received a status:', req.body)
  res.status(200).send()
})

app.post('/gotConferenceStatus', (req, res) => {
  console.log('received a conference status:', req.body)
  res.status(200).send()
})
