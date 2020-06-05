require('dotenv').config()
const freeclimbSDK = require('@freeclimb/sdk')
const express = require('express')
const bodyParser = require('body-parser')
const app = express()
// Why use bodyParser? Why can't this be done in the wrapper? How is the body
//     encapsulated from the API perspective? Do other wrappers need this?
app.use(bodyParser.json())

// From your .env file
const accountId = process.env.ACCOUNT_ID
const authToken = process.env.AUTH_TOKEN
const port = process.env.PORT || 80
// Where the api we're creating will be accessible for FreeClimb to reach
const host = process.env.HOST

const freeclimb = freeclimbSDK(accountId, authToken)

app.listen(port, () => {
  console.log(`Listing on port ${port}`)
})

app.post('/incomingMainOfficeCall', (req, res) => {
  console.log('The main office phone was called, playing message + creating conference.')
  const helloMsg = freeclimb.percl.say('Hello! Thanks for calling Vail Spa Management!')
  // const promptForSpa = freeclimb.percl.say(
  //   'Press 1 to contact Deerfield Spa. Press 2 to contact Persephone Spa and Resort. Press three to leave a message at our main office.',
  // )
  // const getDigitsOptions = {
  //   prompts: [promptForSpa],
  //   maxDigits: 1,
  //   minDigits: 1,
  //   flushBuffer: false,
  // }
  // const getDigits = freeclimb.percl.getDigits(`${host}/spaSelected`, getDigitsOptions)
  // res.status(200).json([helloMsg, getDigits])
  const promptForSpaResponse = freeclimb.percl.say(
    'Please say Deerfield to contact Deerfield spa, or Persephone, to contact Persephone Spa and Resort.',
  )
  const options = {
    grammarType: freeclimb.enums.grammarType.URL,
    prompts: [say],
  }
  const getDigitsOptions = {
    prompts: [promptForSpa],
    maxDigits: 1,
    minDigits: 1,
    flushBuffer: false,
  }
  const getDigits = freeclimb.percl.getDigits(`${host}/spaSelected`, getDigitsOptions)
  res.status(200).json([helloMsg, getDigits])
})

app.post('/spaSelected', (req, res) => {
  console.log('a spa was selected')
  const getDigitResponse = req.body
  const digit = getDigitResponse.digits

  let numberToForwardTo = ''
  switch (digit) {
    case '1':
      numberToForwardTo = '+19402206447' // Deerfield Spa
    case '2':
      numberToForwardTo = '+19402302667' // Persephone Spa + Resort
  }

  if (numberToForwardTo) {
    const conferenceStart = freeclimb.percl.createConference(`${host}/conferenceCreated/${numberToForwardTo}`)
    res.status(200).json([conferenceStart])
  } else {
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
  console.log('FreeClimb hit left conference')
  // Call terminateConference when the initial caller hangs up
  const leftConferenceResponse = req.body
  const conferenceId = leftConferenceResponse.conferenceId
  terminateConference(conferenceId)
  res.status(200).json([])
})

function terminateConference(conferenceId) {
  // Create the ConferenceUpdateOptions and set the status to terminated
  const options = {
    status: freeclimb.enums.conferenceStatus.TERMINATED,
  }
  freeclimb.api.conferences
    .update(conferenceId, options)
    .then(() => {
      console.log('The conference was terminated')
    })
    .catch((err) => {
      console.log('There was a problem terminating the conference')
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
