import axios, { AxiosResponse } from "axios";
import { format, addDays } from "date-fns";
import { es } from "date-fns/locale";
import cron from "node-cron";
import dotenv from "dotenv";
import pino from "pino";

dotenv.config();

const logger = pino();

const MEITRE_API_URL = "https://api.meitre.com";
const MEITRE_RESTAURANT_URL = process.env.MEITRE_RESTAURANT_URL;
const MEITRE_RESTAURANT_ID = process.env.MEITRE_RESTAURANT_ID;
const TELEGRAM_BOT_KEY = process.env.TELEGRAM_BOT_KEY;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const TELEGRAM_API_URL = "https://api.telegram.org";
const CRON_SCHEDULE = process.env.CRON_SCHEDULE;
const DAYS_AHEAD = Number(process.env.DAYS_AHEAD);

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

  let results: [Date, AxiosResponse][];

  try {
    results = await Promise.all(
      dates.map(async (date): Promise<[Date, AxiosResponse]> => {
        const urlDate = format(date, "yyyy-MM-dd");
        const url = `${MEITRE_API_URL}/api/search-all-hours/en/2/${urlDate}/dinner/${MEITRE_RESTAURANT_ID}`;

        logger.info({ url }, "Request to Meitre API");

        return [date, await axios.get(url)];
      })
    );
  } catch (e: any) {
    logger.error({ error: e.message }, "Request to Meitre API failed");
    return;
  }

  const available = results
    .filter(([_, res]) =>
      res.data.center.slots.some((slot: any) => slot.type !== "No")
    )
    .map(([date, res]) => ({
      date,
      hours: res.data.center.slots.map((s: any) => s.hour),
    }));

  if (available.length === 0) {
    logger.info("Nothing available");
    return;
  }

  logger.info({ available }, "Available");

  const search = new URLSearchParams({
    chat_id: TELEGRAM_CHAT_ID!,
    text: `${available
      .map((a) => {
        const date = format(a.date, "d 'de' MMMM", { locale: es });
        const hours = a.hours.join(", ");

        return `${date}:\n${hours}`;
      })
      .join("\n\n")}\n\n${MEITRE_RESTAURANT_URL}`,
  });

  try {
    await axios.get(
      `${TELEGRAM_API_URL}/bot${TELEGRAM_BOT_KEY}/sendMessage?${search.toString()}`
    );
  } catch (e: any) {
    logger.error({ error: e.message }, "Request to Telegram API failed");
  }
}

cron.schedule(CRON_SCHEDULE!, () => {
  main().catch((e) => {
    logger.error(e.message);
  });
});
