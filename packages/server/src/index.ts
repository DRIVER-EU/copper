
import { NestServer } from '@csnext/cs-layer-server';
import { ApplicationModule } from './app.module';

const server = new NestServer();
server.bootstrap(ApplicationModule, 'driver-cop-server', 'localhost', 3007).then(async ()=>{
  console.log('Started');
});