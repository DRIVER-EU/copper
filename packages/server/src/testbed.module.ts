import {Module} from '@nestjs/common';
import {TestbedController} from './testbed.controller';

@Module({
  imports: [
    
  ],
  controllers: [TestbedController],
})
export class TimeModule {

  constructor() {
    console.log(`Initializing test-bed`);    
  }

}
