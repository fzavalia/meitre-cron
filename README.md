# Meitre Cron

Every x amount of time, requests to the [Meitre](https://www.meitre.com/en) api will be executed to check the availability of different restaurants for the following days.

When there is availability, a message is broadcasted to a telegram channel.

## Channels

[Turnos Meitre](https://t.me/turnos_meitre)

## Data

Add a `restaurants.json` inside the `data` folder.

This json should contain an array of `Restaurant` objects.

```ts
export type Restaurant = {
  // Meitre restaurant id
  id: string;
  // Restaurant name that will be sent in the telegram message
  name: string;
  // Meitre url where reservations can be made for the restaurant
  url: string;
};
```

For example:

```json
[
  {
    "id": "25",
    "name": "Don Julio",
    "url": "https://donjulio.meitre.com"
  },
  {
    "id": "60",
    "name": "La Cabrera",
    "url": "https://lacabrera.meitre.com/"
  }
]
```

## Env

TELEGRAM_BOT_KEY - The key provided by telegram to be able to use a bot.

TELEGRAM_CHAT_ID - The telegram chat id were the message will be sent.

CRON_SCHEDULE - Pattern indicating the frequence the Meitre api is queried (https://github.com/node-cron/node-cron#cron-syntax).

DAYS_AHEAD - The amount of days ahead the Meitre api will be queried for availability.
