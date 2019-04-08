
import { NestServer } from '@csnext/cs-layer-server';
import { ApplicationModule } from './app.module';
import { Logger } from '@nestjs/common';

const server = new NestServer();
server.bootstrap(ApplicationModule, 'driver-cop-server', 'localhost', 3007, 'localhost:3007').then(async ()=>{
  Logger.log('COPPER Server Started');
});