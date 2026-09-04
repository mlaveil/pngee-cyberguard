import { healthCheck, pool } from './postgres';

healthCheck()
  .then(ok => {
    console.log(ok ? 'PostgreSQL: HEALTHY' : 'PostgreSQL: UNHEALTHY');
    process.exitCode = ok ? 0 : 1;
  })
  .catch(error => {
    console.error('PostgreSQL: UNHEALTHY', error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
