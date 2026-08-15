import dotenv from 'dotenv';
import { buildApp } from './app.js';
import { loadEnvironment } from './config/environment.js';

dotenv.config({ quiet: true });
const environment = loadEnvironment();
const app = await buildApp({ environment });

try {
  await app.listen({
    host: environment.HOST,
    port: environment.PORT,
  });
} catch (error) {
  app.log.fatal(error);
  process.exit(1);
}
