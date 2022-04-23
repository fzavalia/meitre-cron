import axios, { AxiosResponse } from "axios";
import { format, addDays } from "date-fns";
import { es } from "date-fns/locale";
import cron from "node-cron";
import dotenv from "dotenv";
import pino from "pino";
import restaurants from "./data/restaurants.json";

dotenv.config();

const logger = pino();

const MEITRE_API_URL = "https://api.meitre.com";
const TELEGRAM_BOT_KEY = process.env.TELEGRAM_BOT_KEY;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const TELEGRAM_API_URL = "https://api.telegram.org";
const CRON_SCHEDULE = process.env.CRON_SCHEDULE;
const DAYS_AHEAD = Number(process.env.DAYS_AHEAD);

logger.info(process.env);

async function main() {
  const now = new Date();

  const dates: Date[] = [];

  for (let i = 0; i < DAYS_AHEAD; i++) {
    if (i === 0) {
      dates.push(now);
    } else {
      dates.push(addDays(dates[dates.length - 1], 1));
    }
  }

  const availableRestaurants = [];

  for await (const restaurant of restaurants) {
    let meitreQueryResult: [Date, AxiosResponse][];

    try {
      meitreQueryResult = await queryMeitre(dates, restaurant);
    } catch (e: any) {
      logger.error({ restaurant, error: e.message }, "Meitre Query Failed");
      continue;
    }

    const availableDates = meitreQueryResult
      .filter(([_, response]) =>
        response.data.center.slots.some((slot: any) => slot.type !== "No")
      )
      .map(([date, response]) => ({
        date,
        hours: response.data.center.slots.map((slot: any) => slot.hour),
      }));

    if (availableDates.length === 0) {
      logger.info({ restaurant }, "Nothing available");
      continue;
    }

    availableRestaurants.push({ restaurant, dates: availableDates });

    logger.info({ restaurant, available: availableDates }, "Available");
  }

  if (availableRestaurants.length === 0) {
    logger.info("Nothing available");
    return;
  }

  const search = new URLSearchParams({
    chat_id: TELEGRAM_CHAT_ID!,
    text: availableRestaurants
      .map(
        ({ restaurant, dates }) =>
          `${restaurant.name}\n\n${dates
            .map(
              ({ date, hours }) =>
                `${format(date, "d 'de' MMMM", { locale: es })}:\n${hours.join(
                  ", "
                )}`
            )
            .join("\n\n")}\n\n${restaurant.url}`
      )
      .join("\n\n"),
  });

  try {
    await axios.get(
      `${TELEGRAM_API_URL}/bot${TELEGRAM_BOT_KEY}/sendMessage?${search.toString()}`
    );
  } catch (e: any) {
    logger.error({ error: e.message }, "Request to Telegram API failed");
  }
}

async function queryMeitre(dates: Date[], restaurant: typeof restaurants[0]) {
  return Promise.all(
    dates.map(async (date): Promise<[Date, AxiosResponse]> => {
      const urlDate = format(date, "yyyy-MM-dd");
      const url = `${MEITRE_API_URL}/api/search-all-hours/en/2/${urlDate}/dinner/${restaurant.id}`;
      logger.info({ restaurant, url }, "Request to Meitre API");
      return [date, await axios.get(url)];
    })
  );
}

cron.schedule(CRON_SCHEDULE!, () => {
  logger.info("Executing task");

  main().catch((e) => {
    logger.error(e.message);
  });
});
