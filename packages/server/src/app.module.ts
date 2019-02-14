import {Module} from '@nestjs/common';
import {LayerController, DefaultWebSocketGateway, LayerService, SourceController, FeatureController } from '@csnext/cs-layer-server';
import * as path from 'path';
import { TestbedController } from './testbed.controller';
import { GraphqlConfigService } from './graphql/graph.controller';
import { GraphQLModule } from '@nestjs/graphql';


@Module({  
  controllers: [LayerController, FeatureController, SourceController, TestbedController],
  providers: [LayerService, DefaultWebSocketGateway]
})
export class ApplicationModule {

  readonly configFolder: string = process.env.LAYER_SERVER_CONFIG_FOLDER || './../../../configs/tests/';

  constructor(private readonly layerService: LayerService) {
    const folder = path.join(__dirname, this.configFolder);
    console.log(`Initializing layer-server with configuration folder: ${folder}`);
    this.layerService.init('server.config.json', folder);
  }

}
