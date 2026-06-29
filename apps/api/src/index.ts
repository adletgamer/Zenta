import app from './app';
import { readEnv } from './lib/stellar-env';

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Zenta API running on http://localhost:${PORT}`);
  console.log(`Verification mode: ${readEnv('VERIFICATION_MODE', 'SIMULATED')}`);
  console.log(`Environment: ${process.env.APP_ENV || 'development'}`);
});
