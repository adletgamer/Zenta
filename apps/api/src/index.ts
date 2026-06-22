import app from './app';

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Zenta API running on http://localhost:${PORT}`);
  console.log(`Verification mode: ${process.env.VERIFICATION_MODE || 'SIMULATED'}`);
  console.log(`Environment: ${process.env.APP_ENV || 'development'}`);
});
