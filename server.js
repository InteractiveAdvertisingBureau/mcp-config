import app from './app.js';
import { port, env } from './config/config.js';


app.listen(port, () => {
  console.log(`Server running in ${env} mode on port ${port}`);
  console.log(`http://127.0.0.1:${port}`);
});
