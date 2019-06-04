'use strict'

const Adapter = require.main.require('hubot/src/adapter')
const Response = require.main.require('hubot/src/response')
const msgs = require.main.require('hubot/src/message')
const Bot = require('keybase-bot')

const convertChannelToRoom = (x) => {
  if (!x.topicName) {
    return x.name
  }
  return x.name + '#' + x.topicName
}

const composeMessageID = (room, id) => {
  return room + '@' + id
}

const membersCount = (name) => {
  return name.split(',').length
}

const convertRoomToChannel = (name) => {
  if (membersCount(name) > 1) {
    // We're dealing with an impteamnative
    return {
      name:        name,
      public:      false,
      membersType: 'impteamnative',
      topicType:   'chat',
    }
  }

  // Otherwise it should be a team channel
  const parts = name.split('#')
  return {
    name:        parts[0],
    public:      false,
    membersType: 'team',
    topicType:   'chat',
    topicName:   parts[1],
  }
}

/** Main API for Hubot on Keybase */
class KeybaseAdapter extends Adapter {
  async run () {
    // Overwrite Robot's response class with Keybase custom one
    // this.robot.Response = RocketChatResponse

    try {
      this.robot.logger.info(`[startup] Keybase adapter in use`)
      this.keybase = new Bot()

      await this.keybase.init(
        process.env.KB_USERNAME,
        process.env.KB_PAPERKEY,
        {verbose: false}
      )

      if (process.env.KB_UNFURL_MODE) {
        await this.keybase.chat.setUnfurlSettings({
          mode: process.env.KB_UNFURL_MODE,
        })
        this.robot.logger.info(`Changed unfurl settings: ${JSON.stringify(await this.keybase.chat.getUnfurlSettings())}`)
      }

      // Print logs with current configs
      this.robot.logger.info(`[startup] Respond to name: ${this.robot.name}`)
      if (this.robot.alias) {
        this.robot.logger.info(`[startup] Respond to alias: ${this.robot.alias}`)
      }

      this.keybase.chat.watchAllChannelsForNewMessages(this.process.bind(this), (err) => {
        throw err
      })
      this.emit('connected') // tells hubot to load scripts
    } catch(err) {
      this.robot.logger.error(`Unable to start ${JSON.stringify(err)}`)
      throw err
    }
  }

  /** Process every incoming message in subscription */
  process (msg) {
    const roomName = convertChannelToRoom(msg.channel)
    const messageID = composeMessageID(roomName, msg.id)
    const user = this.robot.brain.userForId(msg.sender.uid, {
      name: msg.sender.username,
    })
    const isDM = (msg.channel.membersType === 'impteamnative' && membersCount(msg.channel.name) === 2)
    user.roomID = roomName
    user.roomType = msg.channel.membersType
    user.room = roomName

    if (msg.content.type === 'system') {
      // "User Bob was added by Alice" messages are not supported because
      // system messages don't include UIDs.
      return
    }

    if (msg.content.type === 'join') {
      this.robot.logger.debug('Received an EnterMessage')
      return this.robot.receive(new msgs.EnterMessage(user, null, messageID))
    }

    if (msg.content.type === 'leave') {
      this.robot.logger.debug('Received an LeaveMessage')
      return this.robot.receive(new msgs.LeaveMessage(user, null, messageID))
    }

    // Direct messages prepend bot's name so Hubot can `.respond`
    if (msg.content.type === 'text') {
      let text = msg.content.text.body
      const startOfText = (text.indexOf('@') === 0) ? 1 : 0
      const robotIsNamed = text.indexOf(this.robot.name) === startOfText ||
        text.indexOf(this.robot.alias) === startOfText

      if (isDM && !robotIsNamed) {
        text = `${this.robot.name} ${text}`
      }

      const textMessage = new msgs.TextMessage(user, text, messageID)
      this.robot.logger.debug(`TextMessage: ${textMessage.toString()}`)
      return this.robot.receive(textMessage)
    }
  }

  /** Send messages to user addressed in envelope */
  async send (envelope, ...strings) {
    return await Promise.all(strings.map((text) => {
      return this.keybase.chat.send(convertRoomToChannel(envelope.room), {
        body: text,
      })
    }))
  }

  /** Reply to a user's message (mention them if not a DM) */
  reply (envelope, ...strings) {
    if (membersCount(envelope.room) === 2) {
      strings = strings.map((s) => `@${envelope.user.name} ${s}`)
    }
    return this.send(envelope, ...strings)
  }
}

exports.use = (robot) => new KeybaseAdapter(robot)
