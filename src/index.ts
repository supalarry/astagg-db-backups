import { CronJob } from "cron";
import { backup } from "./backup.js";
import { env } from "./env.js";

console.log("NodeJS Version: " + process.version);

// For a dead man's switch (e.g. healthchecks.io), which also alerts when the pings stop. A ping that fails must never
// fail the backup, so it only logs.
const ping = async (suffix: "" | "/fail") => {
  if (!env.HEALTHCHECK_URL) return;

  try {
    const response = await fetch(env.HEALTHCHECK_URL + suffix, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) console.error(`Healthcheck ping got HTTP ${response.status}`);
  } catch (error) {
    console.error("Healthcheck ping failed:", error instanceof Error ? error.message : error);
  }
}

const tryBackup = async () => {
  try {
    await backup();
  } catch (error) {
    console.error("Error while running backup: ", error);
    await ping("/fail");
    process.exit(1);
  }

  await ping("");
}

if (env.RUN_ON_STARTUP || env.SINGLE_SHOT_MODE) {
  console.log("Running on start backup...");

  await tryBackup();

  if (env.SINGLE_SHOT_MODE) {
    console.log("Database backup complete, exiting...");
    process.exit(0);
  }
}

const job = new CronJob(env.BACKUP_CRON_SCHEDULE, async () => {
  await tryBackup();
});

job.start();

console.log("Backup cron scheduled...");