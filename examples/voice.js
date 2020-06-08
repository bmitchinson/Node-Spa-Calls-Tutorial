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
  console.log('The main office phone was called.')
  const helloMsg = freeclimb.percl.say('Hello! Thanks for calling Vail Spa Management!')
  const promptForSpa = freeclimb.percl.say(
    'Please say Deerfield to contact the Deerfield Spa, or say Persephone to contact Persephone Spa and Resort.',
  )
  const speechOptions = {
    grammarType: freeclimb.enums.grammarType.URL,
    prompts: [promptForSpa],
  }
  const getSpeech = freeclimb.percl.getSpeech(`${host}/spaSelected`, `${host}/grammarFile`, speechOptions)
  res.status(200).json([helloMsg, getSpeech])
})

app.post('/spaSelected', (req, res) => {
  console.log('a spa was selected')
  const getSpeechActionResponse = req.body
  let numberToForwardTo = ''

  if (getSpeechActionResponse.reason === freeclimb.enums.getSpeechReason.RECOGNITION) {
    const spa = getSpeechActionResponse.recognitionResult
    console.log('spa: ', spa)
    switch (spa) {
      case 'DEERFIELD':
        numberToForwardTo = '+19402206447' // Deerfield Spa
        break
      case 'PERSEPHONE':
        numberToForwardTo = '+19402302667' // Persephone Spa + Resort
        break
    }
    const conferenceOptions = {
      playBeep: 'entryOnly',
      statusCallbackUrl: `${host}/gotConferenceStatus`,
    }
    const conferenceStart = freeclimb.percl.createConference(`${host}/conferenceCreated/${numberToForwardTo}`)
    res.status(200).json([conferenceStart])
  } else {
    console.log('speech was not recognized')
    const badChoice = freeclimb.percl.say(`Sorry, I didn't catch that, please try again.`)
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
  console.log('conferenceId:', conferenceId)
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
    console.log("Agent didn't answer call")
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

app.get('/grammarFile', function (req, res) {
  const file = `${__dirname}/spaGrammar.xml`
  res.download(file)
})
