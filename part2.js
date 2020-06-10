/* part2: 
User calls their FreeClimb number, which kicks off a series of webhooks that:
- create a conference
- call the Spa from the conference
- if the spa picks up, add the user to the conference so they may be on the line
  with a spa.
- if the spa does not pick up, or the user leaves the conference, close the
  conference

- /incomingMainOfficeCall creates a conference in FreeClimb, FreeClimb delivers
information about that newly created conference to /conferenceCreated

- /conferenceCreated makes an OutDial request to the Deerfield Spa, calling the
spa's phone number so it can join the newly created conference.

- /outboundCallMade/{conferenceId} is called by FreeClimb once the spa is called
into the conference. It adds the original caller to this conference, and 
configures what endpoint should be called once that original caller leaves.

- /callConnected/{conferenceId} if the spa picks up, add the the caller to the
conference. Otherwise, terminate the conference if no one answers.

- /leftConference is called once the original inbound caller leaves, and it
asks FreeClimb to close the conference, since now no one will be in the call.

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
  console.log('The main office phone was called, reading a greeting.')
  const helloMsg = freeclimb.percl.say('Hello! Thanks for calling Vail Spa Management!')
  const redirectMsg = freeclimb.percl.say("We'll now redirect you to Deerfield spa")
  const conferenceStart = freeclimb.percl.createConference(`${host}/conferenceCreated`)
  res.status(200).json([helloMsg, redirectMsg, conferenceStart])
})

app.post('/conferenceCreated', (req, res) => {
  console.log('Freeclimb created a conference')
  const createConferenceResponse = req.body
  const conferenceId = createConferenceResponse.conferenceId
  const agentPhoneNumber = '+19402302667' // Persephone Spa
  // Hangup if we get a voicemail machine
  const options = {
    ifMachine: freeclimb.enums.ifMachine.hangup,
  }
  const outDial = freeclimb.percl.outDial(
    agentPhoneNumber,
    createConferenceResponse.from,
    `${host}/outboundCallMade/${conferenceId}`,
    `${host}/callConnected/${conferenceId}`,
    options,
  )
  res.status(200).json([outDial])
})

app.post('/outboundCallMade/:conferenceId', (req, res) => {
  console.log('FreeClimb made the outbound call, waiting for spa to pickup.')
  const outboundCallResponse = req.body
  const conferenceId = req.params.conferenceId
  // Telling FreeClimb to call this route when the inbound caller leaves
  //     so that we can terminate the conference.
  const options = {
    leaveConferenceUrl: `${host}/leftConference`,
  }
  // Add initial caller to conference
  const addToConference = freeclimb.percl.addToConference(conferenceId, outboundCallResponse.callId, options)
  res.status(200).json([addToConference])
})

app.post('/callConnected/:conferenceId', (req, res) => {
  console.log('FreeClimb outbound call connected')
  const callConnectedResponse = req.body
  const conferenceId = req.params.conferenceId
  if (callConnectedResponse.dialCallStatus != freeclimb.enums.callStatus.IN_PROGRESS) {
    // Terminate conference if agent does not answer the call.
    // Can't use a PerCL command since PerCL is ignored if the
    // call isn't answered.
    terminateConference(conferenceId)
    return res.status(200).send('Call not connected')
  }
  const addToConference = freeclimb.percl.addToConference(conferenceId, callConnectedResponse.callId)
  res.status(200).json([addToConference])
})

app.post('/leftConference', (req, res) => {
  console.log('FreeClimb initial caller hung up')
  const leftConferenceResponse = req.body
  const conferenceId = leftConferenceResponse.conferenceId
  terminateConference(conferenceId)
  res.status(200)
})

function terminateConference(conferenceId) {
  const options = {
    status: freeclimb.enums.conferenceStatus.TERMINATED,
  }
  freeclimb.api.conferences
    .update(conferenceId, options)
    .then(() => {
      console.log('Conference closed successfully')
    })
    .catch((err) => {
      console.log('Conference failed to close')
    })
}
