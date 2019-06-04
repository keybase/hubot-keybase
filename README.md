# hubot-keybase

Hubot adapter for Keybase Chat.

## Building a bot

```bash
mkdir mybot
cd mybot
yo hubot # choose the "keybase" adapter
# Set the desired environment variables
./bin/hubot -a keybase
```

## Configuration

All of `hubot-keybase` configuration is done using environment variables.

In local development, the following can be set in an `.env` file. Using
that approach in production is not recommended, as paper keys should be
kept a secret.

| Env variable     | Description |
|------------------|-------------|
| `KB_USERNAME`*   | If passed, a new Keybase service will be spawned using the passed username. |
| `KB_PAPERKEY`*   | If passed, a new Keybase service will be spawned using the passed paper key. |
| 
| `KB_UNFURL_MODE` | If set, [unfurling mode](#unfurling) will be changed to the passed value. |

\* If you don't either `KB_USERNAME` or `KB_PAPERKEY` the adapter will
try to attach to an already running Keybase service. This might be
desirable if you require support for features such as exploding messages.

## Unfurling

In Keybase, unfurling means generating previews for links that you're
sending in chat messages. If the mode is set to `always` or the domain in
the URL is present on the whitelist (which is not configurable using
`hubot-keybase`), the Keybase service will automatically send a preview
to the message recipient in a background chat channel.

This is incredibly useful for all sorts of Hubot plugins, as nearly every
single script expects the chat software to automatically unfurl links.
That being said, this feature also has quite a few caveats, most
importantly it might leak the IP address of the server running Hubot.
