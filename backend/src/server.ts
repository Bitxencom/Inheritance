import { app } from "./app.js";
import { appEnv } from "./config/env.js";

app.listen(appEnv.port, () => {
  console.log(`🚀 Inheritance backend listening on port ${appEnv.port}`);
});
