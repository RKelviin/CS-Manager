import * as Sentry from "@sentry/node";
import { createApp } from "./app.js";

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? "development",
    integrations: [Sentry.expressIntegration()],
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0
  });
}

const PORT = Number(process.env.PORT ?? 4000);
const app = createApp();

if (process.env.SENTRY_DSN) {
  Sentry.setupExpressErrorHandler(app);
}

app.listen(PORT, () => {
  console.log(`[server] running on http://localhost:${PORT}`);
});
