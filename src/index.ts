import axios, { AxiosResponse } from "axios";
import { format, addDays } from "date-fns";
import { es } from "date-fns/locale";
import cron from "node-cron";
import dotenv from "dotenv";
import pino from "pino";
import fs from "fs";
import { AvailableDate, AvailableRestaurant, Restaurant, Slot } from "./types";

dotenv.config();

const logger = pino();

const MEITRE_API_URL = "https://api.meitre.com";
const TELEGRAM_BOT_KEY = process.env.TELEGRAM_BOT_KEY;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const TELEGRAM_API_URL = "https://api.telegram.org";
const CRON_SCHEDULE = process.env.CRON_SCHEDULE;
const DAYS_AHEAD = Number(process.env.DAYS_AHEAD);
const RESTAURANTS_PATH = process.env.RESTAURANTS_PATH;

logger.info(process.env);

async function main() {
  const restaurants = getRestaurants();

  const dates = getDates();

  const availableRestaurants: AvailableRestaurant[] =
    await getAvailableRestaurants(dates, restaurants);

  if (availableRestaurants.length === 0) {
    logger.info("Nothing available");
    return;
  }

  const search = new URLSearchParams({
    chat_id: TELEGRAM_CHAT_ID!,
    text: getText(availableRestaurants),
  });

  try {
    await axios.get(
      `${TELEGRAM_API_URL}/bot${TELEGRAM_BOT_KEY}/sendMessage?${search.toString()}`
    );
  } catch (e: any) {
    logger.error({ error: e.message }, "Request to Telegram API failed");
  }
}

function getRestaurants(): Restaurant[] {
  const restaurantsData = fs.readFileSync(RESTAURANTS_PATH!, {
    encoding: "utf-8",
  });

  return JSON.parse(restaurantsData);
}

function getDates() {
  const now = new Date();

  const dates: Date[] = [];

  for (let i = 0; i < DAYS_AHEAD; i++) {
    if (i === 0) {
      dates.push(now);
    } else {
      dates.push(addDays(dates[dates.length - 1], 1));
    }
  }

  return dates;
}

async function getAvailableRestaurants(
  dates: Date[],
  restaurants: Restaurant[]
) {
  const availableRestaurants: AvailableRestaurant[] = [];

  for await (const restaurant of restaurants) {
    let availableDates: AvailableDate[];

    try {
      availableDates = await getAvailableDates(dates, restaurant);
    } catch (e: any) {
      logger.error(
        { restaurant: restaurant.name, error: e.message },
        "Failed to get available dates"
      );
      continue;
    }

    if (availableDates.length === 0) {
      logger.info({ restaurant: restaurant.name }, "Nothing available");
      continue;
    }

    availableRestaurants.push({ restaurant, dates: availableDates });

    logger.info(
      { restaurant: restaurant.name, available: availableDates },
      "Available"
    );
  }

  return availableRestaurants;
}

async function getAvailableDates(dates: Date[], restaurant: Restaurant) {
  let meitreResults: [Date, Slot[]][];

  try {
    meitreResults = await fetchAvailabilityInMeitre(dates, restaurant);
  } catch (e: any) {
    logger.error(
      { restaurant: restaurant.name, error: e.message },
      "Meitre Query Failed"
    );
    throw e;
  }

  return meitreResults
    .map(([date, slots]): [Date, Slot[]] => [
      date,
      slots.filter((slot) => slot.type !== "No"),
    ])
    .filter(([_, slots]) => slots.length > 0)
    .map(([date, slots]) => ({
      date,
      hours: slots.map((slot) => slot.hour),
    }));
}

async function fetchAvailabilityInMeitre(
  dates: Date[],
  restaurant: Restaurant
) {
  return Promise.all(
    dates.map(async (date): Promise<[Date, Slot[]]> => {
      const urlDate = format(date, "yyyy-MM-dd");
      const url = `${MEITRE_API_URL}/api/search-all-hours/en/2/${urlDate}/dinner/${restaurant.id}`;
      logger.info(
        { restaurant: restaurant.name, url },
        "Request to Meitre API"
      );
      const res = await axios.get(url);
      return [date, res.data.center.slots];
    })
  );
}

function getText(restaurant: AvailableRestaurant[]) {
  return restaurant
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
    .join("\n\n");
}

cron.schedule(CRON_SCHEDULE!, () => {
  logger.info("Executing task");

  main().catch((e) => {
    logger.error(e.message);
  });
});
