import { app } from "./app.js";
import { appEnv } from "./config/env.js";
import { logger } from "./config/logger.js";

app.listen(appEnv.port, () => {
  logger.info(`🚀 Inheritance backend listening on port ${appEnv.port}`);
});
