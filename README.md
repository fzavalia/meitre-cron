# Meitre Cron

Every x amount of time, a request to the [Meitre](https://www.meitre.com/en) api will be executed to check the availability of a restaurant for the following days.

When there is availability, a message is broadcasted to a telegram channel.

## Channels

[Turnos Don Julio](https://t.me/turnos_don_julio)


## Env

TELEGRAM_BOT_KEY - The key provided by telegram to be able to use a bot.

TELEGRAM_CHAT_ID - The telegram chat id were the message will be sent.

CRON_SCHEDULE - Pattern indicating the frequence the Meitre api is queried (https://github.com/node-cron/node-cron#cron-syntax).

DAYS_AHEAD - The amount of days ahead the Meitre api will be queried for availability.
