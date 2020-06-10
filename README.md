# Node-Spa-Calls-Tutorial 💆📲

An example repo utilizing the Vail FreeClimb API to configure a
small franchise IVR.

---

- [Overview](https://github.com/bmitchinson/Node-Spa-Calls-Tutorial#overview)
- [Part 1](https://github.com/bmitchinson/Node-Spa-Calls-Tutorial#part-1---getting-started)
- [Part 2](https://github.com/bmitchinson/Node-Spa-Calls-Tutorial#part-2---redirecting-a-call)
- [Part 3](https://github.com/bmitchinson/Node-Spa-Calls-Tutorial#part-3---user-input-using-dial-tones)
- [Part 4](https://github.com/bmitchinson/Node-Spa-Calls-Tutorial#part-4---user-voice-input)

---

## Overview

This repository contains broken up examples on building a small scale
Interactive Voice Response system. It has been tested on both Node v12.17 and
14.4, and was heavily inspired by the existing
[Connect-Caller-To-Another-Party](https://github.com/FreeClimbAPI/Node-Connect-Caller-To-Another-Party) and
[Node-Speech-Recognition-Tutorial](https://github.com/FreeClimbAPI/Node-Speech-Recognition-Tutorial/blob/master/speechRecognition.js)
examples.

Other FreeClimb examples can be found here: https://github.com/FreeClimbAPI

---

In our scenario, the Vail Spa Management™ company is getting a lot of phone
calls that aren't intended for their main office, but are instead for their Spa
locations.

The Deerfield Spa is reachable at "+1 (940)-220-6447", and Persephone Spa and
Resort is reachable at "+1 (940)-230-2667". We'll be building an IVR that asks
the customer which of the two they'd like to reach. (Go ahead and try to call
each of them, they're live!)

An example of the final result (part4) is available live to try out at
"+1 (940)-230-2766"

- Deerfield Spa: +19402206447
- Persephone Spa: +19402302667
- Main Office Demo: +19402302766

## Part 1 - Getting Started

FreeClimb calls your API when events occur on it's phone lines. When creating a
free tier FreeClimb account, you are given a phone number with an assigned
application for managing events. You can create as many
applications and phone numbers as you'd like, so please begin by
dedicating an application, existing on your account or new, and an associated
phone number, to try out the example.

In order to make your API accessible to FreeClimb while developing locally,
we recommend using [ngrok](https://ngrok.com/download) to mirror your local
development API port to a publicly accessible route. After installing ngrok on
your machine and adding it to your system path, the command `ngrok http 80` will
make "localhost:80" accessible on the internet for FreeClimb to make
requests to. This free + no sign-up tier of `ngrok` will give you a URL like
"https://35f985da890f.ngrok.io" which is reserved for eight hours.
We'll refer to this assigned URL as the "host" going forward.

---

**Goal:** By the end of Part 1:

You'll be able to call your FreeClimb number, and hear a response read back to
you through Text to Speech (TTS), as instructed by your API.

**Prep:** Before completing Part 1 you should have:

- Node Version 12.17+ or 14.4+
- `ngrok` installed (Confirm with `ngrok -v`)
- This repository cloned
- A phone nearby for testing

---

In the root of the repository, start by creating a new file called `.env`.
We'll be using the npm library "dotenv" to pull in values from this `.env`
file, into our node script. There's an example of this file in [`template.env`](https://github.com/bmitchinson/Node-Spa-Calls-Tutorial/blob/master/template.env).
Values stored in your `.env` file are sensitive to your application, so be sure
to avoid committing it into any repository. As a precaution, this file is
included in the `.gitignore` by default.

Also at the root of your directory, run `npm install` to install all needed
dependencies necessary from your Express API.

Then copy your Auth Token and Account Id from the
[API Keys](https://freeclimb.com/dashboard/portal/account/authentication)
section of the FreeClimb dashboard, and place them in their respective variable
names inside your `.env` file.

The "HOST" value will be replaced by our public ngrok link, so run
`ngrok 80 http`, and copy your assigned ngrok link into the HOST placeholder.
We'll test that ngrok is functioning as intended in a moment.

In addition to your API needing to know where it is, FreeClimb must be given
your ngrok link in order to know where to direct webhook calls. Visit the
[Apps](https://freeclimb.com/dashboard/portal/applications) section of the
Dashboard, and choose Edit Config on your application. There, fill in the
Voice URL field with your HOST ngrok value with the added route
`/incomingMainOfficeCall`. Ex: `https://35f985da890f.ngrok.io/incomingMainOfficeCall`

![](https://i.imgur.com/qGExcAG.png)

Now that your application is configured to call your API, be sure that your
number has been assigned to application. In the [numbers section](https://freeclimb.com/dashboard/portal/numbers) of your dashboard, select view on an unregested number, and assign it
to your application in the App dropdown menu.

Now that all initial setup is complete, we can begin to look
at the `part1.js` file.

Each example starts with the same set of imports, which initialize our
Express API. Below these, the aforementioned environment variables from `.env`
are assigned for later reference.

An instance of the FreeClimb API wrapper for Node, the
[`Node SDK`](https://github.com/FreeClimbAPI/nodejs-sdk), in instantiated with
the line:

```javascript
// Initializing an instance of the SDK with our credentials
const freeclimb = freeclimbSDK(accountId, authToken)
```

Then, the Express app is configured to listen to it's port, (80 by default),
and our only route is created, a `POST` to "localhost/incomingMainOfficeCall":

```javascript
app.post('/incomingMainOfficeCall', (req, res) => {
  console.log('The main office phone was called, reading a greeting.')
  const helloMsg = freeclimb.percl.say('Hello! Thanks for calling Vail Spa Management!')
  res.status(200).json([helloMsg])
})
```

The `percl.say()` method generates a PerCL object that will be given to
FreeClimb so that it knows how to respond to an event. In this case, FreeClimb
will "say" "Hello! Thanks for calling Vail Spa Management!", when a user
calls their application assigned phone. This object is sent back as the
single element of an array, with a 200 response.

_Note:_ All responses can be seen in the [logs section](https://freeclimb.com/dashboard/portal/logs) of your dashboard. Try reviewing your logs to see a list of FreeClimb status after completing this part one example.

In the root of the repository, run `node part1.js`, to startup this simple API
for FreeClimb to access.

**Checkpoint:** By now, you should be able to visit [localhost/incomingMainOfficeCall](localhost/incomingMainOfficeCall) and see a PerCL response in your browser. This
is what FreeClimb sees when it contacts your API once your phone number is
called. Try calling your phone number, and you should hear the response seen
in your browser being read to you. If so, you're good to continue on to the
next step!

## Part 2 - Redirecting a Call

**Goal:** By the end of Part 2, calling your number will kickoff a series of
webhooks that redirect your call to a Spa by utilizing a
[conference](https://docs.freeclimb.com/reference/conferences). Your API
will have FreeClimb create a conference, attempt to call the Spa into the
conference, and take the appropriate action if they do or do not hang up.
Conferencing makes up the majority of the sample application.

**Prep:** Before completing Part 2 you should have:

- Been able to see your PerCL object in the browser at "localhost/incomingMainOfficeCall"
- Heard the response message being read back to you when calling the phone number assigned to your application

---

To begin, we'll alter the existing `/incomingMainOfficeCall` route. Previously,
we constructed one PerCL message to be read aloud, and now we'll add another
message as well as a PerCL object to tell FreeClimb we'd like to create a
conference. The PerCL objects are returned in order as an array, with a 200
status code so that FreeClimb knows the method was run successfully.

```javascript
app.post('/incomingMainOfficeCall', (req, res) => {
  console.log('The main office phone was called, reading a greeting.')
  const helloMsg = freeclimb.percl.say('Hello! Thanks for calling Vail Spa Management!')
  const redirectMsg = freeclimb.percl.say("We'll now redirect you to Deerfield spa")
  const conferenceStart = freeclimb.percl.createConference(`${host}/conferenceCreated`)
  res.status(200).json([helloMsg, redirectMsg, conferenceStart])
})
```

The `createConference()` method will give FreeClimb PerCL that instructs it to
create a conference, and then call a separate endpoint, with the ID of the newly
created conference in it's payload. Navigate to "localhost/incomingMainOfficeCall"
to see what FreeClimb receives from your endpoint.

`/conferenceCreated` takes the newly created conferenceId from the body of the
request FreeClimb makes to it, and builds an OutDial request to give back
to FreeClimb.

```javascript
app.post('/conferenceCreated', (req, res) => {
  console.log('Freeclimb created a conference')
  const createConferenceResponse = req.body
  const conferenceId = createConferenceResponse.conferenceId
  const agentPhoneNumber = '+19402302667'
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
```

`outDial()` takes as parameters:

- the spa phone number
- the conference it's calling from
- an endpoint to hit when the spa is called
- and endpoint to hit when the spa connects to the call
- and an object to define additional options. It's parameters are described in more detail [here](https://freeclimbapi.github.io/jsdocs/module-freeclimb-sdk_percl.html#~outDial).

Notice that we pass the conferenceId to the `/outboundCallMade` and
`/callConnected` routes as a request parameter (in the URL). These two endpoints
will be able to tell FreeClimb to alter the conference now that they have the
conferenceId.

`/outboundCallMade/:conferenceId` Is `POST`ed to by FreeClimb when the spa is
called, as previously instructed in the `outDial()`. Both the Spa,
and the original caller, need to be added to the conference room. This step adds
the original caller to the room, while waiting for the Spa to enter.

```javascript
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
```

The initial caller's information is pulled from the payload given by FreeClimb,
and FreeClimb is sent back an `addToConference` PerCL object, asking FreeClimb
to add the initial caller to the conference. Included in this object is an
option to tell FreeClimb to hit `/leftConference` when the initial caller
leaves. We'll explain how this route closes the conference later.

Unlike `outboundCallMade`, `/callConnected/:conferenceId` Is posted to by
FreeClimb when the spa **connects to the call**, since we asked FreeClimb to `POST`
to it in the original `outDial()`. If the dial status reflects that the Spa
hasn't picked up, it will terminate the conference. Otherwise, it will send
an `addToConference()` PerCL to FreeClimb, adding the Spa to the conference.

```javascript
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
```

The `terminateConference()` method takes a conferenceId, and makes an async
call to FreeClimb requesting to terminate the conferenceId. The API methods
of the freeclimb sdk instance return promises, so a console log is chained to
reflect the termination or reflect an error if failure occurs.

The sole purpose of `/leftConference` is to give FreeClimb a way to call this
`terminateConference()` method, as used in `/outboundCallMade`.

**Checkpoint:** By now, you should be able to call your FreeClimb number,
and be connected through a conference to the "Persephone Spa + Resort"!
Conference logic makes up a majority of the application, so by now, you're
mostly finished. As the call progresses, you'll see messages in your console
showing which API routes are called when. Try to align those to the progression
of the call, to further understand how a conference is created and altered in
FreeClimb.

## Part 3 - User Input using Dial Tones

**Goal:** By the end of Part 3:

You'll be able to call your FreeClimb number, and hear a dial tone prompt
asking you to call either of the two Spas. If no entry or an invalid entry
is entered, you'll be sent back to the original prompt for re-entry.

- We'll add a dial tone prompt to /incomingMainOfficeCall
- Add a `/spaSelected` step to handle the dial tone choice
- Update `/conferenceCreated` to `/conferenceCreated/:numberToForwardTo` so that
  a conference can be created with the chosen Spa in mind.

**Prep:** Before completing Part 3 you should have:

- Part 2 Completed

---

```javascript
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
```

```javascript
app.post('/spaSelected', (req, res) => {
  console.log('Digit entry has been captured')
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
```

`/conferenceCreated` is the same as it's part 2 implementation, but
`agentPhoneNumber` has been altered to equal `numberToForwardTo` from
the previously called `/spaSelection`

```javascript
app.post('/conferenceCreated/:numberToForwardTo', (req, res) => {
  ...
  const conferenceId = createConferenceResponse.conferenceId
  const agentPhoneNumber = req.params.numberToForwardTo
  ...
```

## Part 4 - User Voice Input

**Goal:** By the end of Part 4:

You'll be able to call your FreeClimb number, and hear a voice prompt
asking you to call either of the two Spas. If no entry was recognized,
you'll be sent back to the original prompt for re-entry.

- We'll add a voice prompt to /incomingMainOfficeCall
- Create a grammar.xml for FreeClimb to understand speech input
- Alter `/spaSelected` slightly to handle voice responses instead of dial tones.

**Prep:** Before completing Part 4 you should have:

- Part 3 Completed

---

```javascript
app.post('/incomingMainOfficeCall', (req, res) => {
  console.log('The main office phone was called, prompting the user.')
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
```

```javascript
app.post('/spaSelected', (req, res) => {
  console.log('Speech entry has been captured')
  const getSpeechActionResponse = req.body
  let numberToForwardTo
  let destination

  if (getSpeechActionResponse.reason === freeclimb.enums.getSpeechReason.RECOGNITION) {
    const spa = getSpeechActionResponse.recognitionResult
    switch (spa) {
      case 'DEERFIELD':
        numberToForwardTo = '+19402206447' // Deerfield Spa
        destination = freeclimb.percl.say('Calling Deerfield Spa')
        break
      case 'PERSEPHONE':
        numberToForwardTo = '+19402302667' // Persephone Spa + Resort
        destination = freeclimb.percl.say('Calling Persephone Spa + Resort')
        break
    }
    const conferenceOptions = {
      playBeep: 'entryOnly',
    }
    const conferenceStart = freeclimb.percl.createConference(`${host}/conferenceCreated/${numberToForwardTo}`)
    res.status(200).json([destination, conferenceStart])
  } else {
    console.log('speech was not recognized')
    const badChoice = freeclimb.percl.say(`Sorry, I didn't catch that, please try again.`)
    const startOver = freeclimb.percl.redirect(`${host}/incomingMainOfficeCall`)
    res.status(200).json([badChoice, startOver])
  }
})
```
