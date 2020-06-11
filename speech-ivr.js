//////////////////////////////////////////
// Imports
require('dotenv').config()
const fs = require('fs')
const freeclimbSDK = require('@freeclimb/sdk')
const express = require('express')
const bodyParser = require('body-parser')
const app = express()
app.use(bodyParser.json())
const configData = JSON.parse(fs.readFileSync('config.json', 'utf-8'))
// bodyParser middleware is required in order to interpret responses
//      from FreeClimb
//////////////////////////////////////////

//////////////////////////////////////////
// environment variables
const accountId = process.env.ACCOUNT_ID
const authToken = process.env.AUTH_TOKEN
const port = process.env.PORT || 80
const host = configData['publicURL']
//////////////////////////////////////////

// Initializing an instance of the SDK with our credentials
const freeclimb = freeclimbSDK(accountId, authToken)

// Starting the express API
app.listen(port, () => {
  console.log(`Listing on port ${port}`)
})

app.post('/incomingCall', (req, res) => {
  console.log('The main office phone was called, prompting the user.')
  const helloMsg = freeclimb.percl.say('Hello! Thanks for calling Vail Spa Management!')
  const promptForSpa = freeclimb.percl.say(configData['message'])
  const speechOptions = {
    grammarType: freeclimb.enums.grammarType.URL,
    prompts: [promptForSpa],
  }
  const getSpeech = freeclimb.percl.getSpeech(`${host}/spaSelected`, `${host}/grammarFile`, speechOptions)
  res.status(200).json([helloMsg, getSpeech])
})

app.post('/spaSelected', (req, res) => {
  console.log('Speech entry has been captured')
  const getSpeechActionResponse = req.body
  let numberToForwardTo
  let destination

  if (getSpeechActionResponse.reason === freeclimb.enums.getSpeechReason.RECOGNITION) {
    const spaSelection = getSpeechActionResponse.recognitionResult
    configData['phones'].forEach((phone) => {
      if (spaSelection === phone['location']) numberToForwardTo = phone['number']
    })
    const conferenceOptions = {
      playBeep: 'entryOnly',
    }
    const conferenceStart = freeclimb.percl.createConference(`${host}/conferenceCreated/${numberToForwardTo}`)
    res.status(200).json([conferenceStart])
  } else {
    console.log('speech was not recognized')
    const badChoice = freeclimb.percl.say(`Sorry, I didn't catch that, please try again.`)
    const startOver = freeclimb.percl.redirect(`${host}/incomingCall`)
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
    `${host}/outboundCallConnected/${conferenceId}`,
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

app.post('/outboundCallConnected/:conferenceId', (req, res) => {
  console.log('FreeClimb hit call connected')
  const callConnectedResponse = req.body
  const conferenceId = req.params.conferenceId
  if (callConnectedResponse.dialCallStatus != freeclimb.enums.callStatus.IN_PROGRESS) {
    // Terminate conference if agent does not answer the call.
    // Can't use a PerCL command since PerCL is ignored if the
    // call isn't answered.
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

app.get('/grammarFile', function (req, res) {
  const file = `${__dirname}/${configData['grammarFile']}`
  res.download(file)
})
