'use strict'

const Adapter = require.main.require('hubot/src/adapter')
const Response = require.main.require('hubot/src/response')
const msgs = require.main.require('hubot/src/message')
const Bot = require('keybase-bot')

const composeRoomName = (x) => {
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

const convertToRoom = (name) => {
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
    console.log(msg)

    const roomName = composeRoomName(msg.channel)
    const messageID = composeMessageID(roomName, msg.id)
    const user = this.robot.brain.userForId(msg.sender.uid, {
      name: msg.sender.username,
    })
    const isDM = (msg.channel.membersType === 'impteamnative' && membersCount(msg.channel.name) === 2)
    user.roomID = roomName
    user.roomType = msg.channel.membersType
    user.room = roomName

    if (msg.content.type === 'system') {
      switch (msg.content.system.systemType) {
        case 0:
          this.robot.logger.debug('Received an EnterMessage')
          return this.robot.receive(new msgs.EnterMessage(user, null, messageID))      
        default:
          console.log(msg.content.system.systemType)
          break
      }
    }

    if (msg.content.type === 'unfurl') {
      console.log(msg.content.unfurl)
      console.log(JSON.stringify(msg.content.unfurl))
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
  
      // Standard text messages, receive as is
      const textMessage = new msgs.TextMessage(user, text, messageID)
      this.robot.logger.debug(`TextMessage: ${textMessage.toString()}`)
      return this.robot.receive(textMessage)  
    }

    /*

    // Room exit, receive without further detail
    if (message.t === 'ul') {
      this.robot.logger.debug('Message type LeaveMessage')
      return this.robot.receive(new msgs.LeaveMessage(user, null, message._id))
    }


    // Attachments, format properties for Hubot
    if (Array.isArray(message.attachments) && message.attachments.length) {
      let attachment = message.attachments[0]
      if (attachment.image_url) {
        attachment.link = `${settings.host}${attachment.image_url}`
        attachment.type = 'image'
      } else if (attachment.audio_url) {
        attachment.link = `${settings.host}${attachment.audio_url}`
        attachment.type = 'audio'
      } else if (attachment.video_url) {
        attachment.link = `${settings.host}${attachment.video_url}`
        attachment.type = 'video'
      }
      this.robot.logger.debug('Message type AttachmentMessage')
      return this.robot.receive(new msgs.AttachmentMessage(user, attachment, message.msg, message._id))
    }
    */
  }

  /** Send messages to user addressed in envelope */
  async send (envelope, ...strings) {
    return await Promise.all(strings.map((text) => {
      return this.keybase.chat.send(convertToRoom(envelope.room), {
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
