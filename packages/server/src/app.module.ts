import {Module} from '@nestjs/common';
import {LogController, LogItemsController, LogService, LayerController, DefaultWebSocketGateway, LayerService, SourceController, FeatureController } from '@csnext/cs-layer-server';
import * as path from 'path';
import { TestbedController } from './testbed.controller';

@Module({  
  controllers: [LogItemsController, LogController, LayerController, FeatureController, SourceController, TestbedController],
  providers: [LogService, LayerService, DefaultWebSocketGateway]
})
export class ApplicationModule {

  readonly configFolder: string = process.env.LAYER_SERVER_CONFIG_FOLDER || './../../../configs/layers/';

  constructor(private readonly layerService: LayerService) {
    const folder = path.join(__dirname, this.configFolder);
    console.log(`Initializing layer-server with configuration folder: ${folder}`);
    this.layerService.init('server.config.json', folder);
  }

}
