import { db } from "~/server/db";

export const GENERATE_DAILY_CRON_PAUSED_KEY = "generate-daily-cron-paused";

export async function isGenerateDailyCronPaused(): Promise<boolean> {
  const setting = await db.appSetting.findUnique({
    where: { key: GENERATE_DAILY_CRON_PAUSED_KEY },
  });
  return setting?.value === "true";
}

export async function setGenerateDailyCronPaused(paused: boolean): Promise<boolean> {
  const setting = await db.appSetting.upsert({
    where: { key: GENERATE_DAILY_CRON_PAUSED_KEY },
    create: {
      key: GENERATE_DAILY_CRON_PAUSED_KEY,
      value: paused ? "true" : "false",
    },
    update: {
      value: paused ? "true" : "false",
    },
  });
  return setting.value === "true";
}
