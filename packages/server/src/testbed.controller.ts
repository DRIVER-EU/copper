import { Get, Controller, Param, Post, Body, Inject } from '@nestjs/common';
import * as fs from 'fs';

import {
  DefaultWebSocketGateway,
  LayerController,
  LayerService
} from '@csnext/cs-layer-server';
import {
  TestBedAdapter,
  Logger,
  LogLevel,
  ITopicMetadataItem,
  IAdapterMessage
} from 'node-test-bed-adapter';

import { WebSocketServer, WebSocketGateway } from '@nestjs/websockets';
import { roots } from 'protobufjs';
import { LayerSource } from '@csnext/cs-layer-server/dist/classes';
import { CAPObject } from './classes/cap';
import { OffsetFetchRequest } from 'kafka-node';

const log = Logger.instance;

export class Topics {
  id: string;
  title: string;
  type: 'cap' | 'geojson';
  offset?: number;
}

export class CopServerConfig {
  public topics?: Topics[];
  public clientId?: string;
  public fromOffset?: boolean;
  public kafkaHost?: string;
  public schemaRegistry?: string;
}

@Controller('testbed')
export class TestbedController {
  private adapter: TestBedAdapter;

  public defaultConfig: CopServerConfig = {}

  public capObjects: CAPObject[] = [];

  handleConnection(d: any) {
    // this.server.emit('buttonCount',AppService.buttonCount);
    console.log(`Timer connection received from ${d.id}`);
  }

  constructor(
    @Inject('DefaultWebSocketGateway')
    private readonly socket: DefaultWebSocketGateway,
    public layers: LayerService
  ) {
    console.log('Init testbed');
    // load config
    const c = JSON.parse(
      fs.readFileSync('configs/testbed/config.json', 'utf8')
    );
    if (c !== undefined) {
      Object.assign(this.defaultConfig, c);
    }

    let consume: OffsetFetchRequest[] = [];
    this.defaultConfig.topics.forEach(t => {
      consume.push({ topic: t.id, offset: t.offset });
    });

    this.adapter = new TestBedAdapter({
      // kafkaHost: 'localhost:3501',
      // schemaRegistry: 'localhost:3502',
      kafkaHost: this.defaultConfig.kafkaHost,
      schemaRegistry: this.defaultConfig.schemaRegistry,
      // kafkaHost: 'tb4.driver-testbed.eu:3501',
      // schemaRegistry: 'tb4.driver-testbed.eu:3502',
      consume: consume,
      fetchAllSchemas: false,
      fetchAllVersions: false,
      wrapUnions: false,
      // wrapUnions: 'auto',
      clientId: this.defaultConfig.clientId,
      // Start from the latest message, not from the first
      fromOffset: this.defaultConfig.fromOffset,
      logging: {
        logToConsole: LogLevel.Info,
        logToFile: LogLevel.Info,
        logToKafka: LogLevel.Warn,
        logFile: 'log.txt'
      }
    });
    this.adapter.on('ready', () => {
      this.adapter.on('message', message => this.handleMessage(message));

      log.info('Consumer is connected');
      this.getTopics();
      // this.adapter.addConsumerTopics({ topic: 'lcms_plots', offset: 0 }, true, (err, msg) => {
      //   if (err) {
      //     return log.error(err);
      //   }
      //   this.handleMessage(msg as IAdapterMessage);
      // });
      setInterval(() => {
        if (this.socket && this.socket.server) {
          this.socket.server.emit('time', this.getAdapterState());
        }
        // process.stdout.write(
        //   `Time: ${time.toUTCString()}; Speed: ${speed}; State: ${state}    \r`
        // );
      }, 2000);
    });
    this.adapter.on('error', err =>
      log.error(`Consumer received an error: ${err}`)
    );
    this.adapter.connect();
  }

  private getTopics() {
    this.adapter.loadMetadataForTopics([], (error, results) => {
      if (error) {
        return log.error(error);
      }
      if (results && results.length > 0) {
        results.forEach(result => {
          if (result.hasOwnProperty('metadata')) {
            console.log('TOPICS');
            const metadata = (result as {
              [metadata: string]: { [topic: string]: ITopicMetadataItem };
            }).metadata;
            for (let key in metadata) {
              const md = metadata[key];
              console.log(
                `Topic: ${key}, partitions: ${Object.keys(md).length}`
              );
            }
          } else {
            console.log('NODE');
            console.log(result);
          }
        });
      }
    });
  }

  private async handleMessage(message: IAdapterMessage) {
    const stringify = (m: string | Object) =>
      typeof m === 'string' ? m : JSON.stringify(m, null, 2);
    switch (message.topic.toLowerCase()) {
      case 'system_heartbeat':
        log.info(
          `Received heartbeat message with key ${stringify(
            message.key
          )}: ${stringify(message.value)}`
        );
        if (this.socket && this.socket.server) {
          this.socket.server.emit('time', this.getAdapterState());
        }
        break;
      case 'system_timing':
        log.info(
          `Received timing message with key ${stringify(
            message.key
          )}: ${stringify(message.value)}`
        );
        if (this.socket && this.socket.server) {
          this.socket.server.emit('time', this.getAdapterState());
        }
        break;
      case 'system_configuration':
        log.info(
          `Received configuration message with key ${stringify(
            message.key
          )}: ${stringify(message.value)}`
        );
        break;
      default:
        // find topic
        const topic = this.defaultConfig.topics.find(
          t => t.id === message.topic.toLowerCase()
        );
        if (topic) {
          switch (topic.type) {
            case 'cap':
              this.parseCapObject(message.value as CAPObject);
              break;
            case 'geojson':
              this.parseGeojson(topic.title, message);
              break;
          }
        }

        // log.info(`Received ${message.topic} message with key ${stringify(message.key)}: ${stringify(message.value)}`);
        break;
    }
  }

  private parseCapObject(cap: CAPObject) {
    console.log('Got cap object');
    this.capObjects.push(cap);
    if (this.socket && this.socket.server) {
      this.socket.server.emit('cap', cap);
    }
  }

  private parseGeojson(layerId: string, message: IAdapterMessage) {
    console.log(JSON.stringify(message.key));
    if (
      message.value &&
      message.value.hasOwnProperty('features') &&
      message.value['features'].length > 0
    ) {
      let geojson = message.value as GeoJSON.FeatureCollection;
      for (const feature of geojson.features) {
        // fix geometry object
        if (
          feature.geometry &&
          feature.geometry.hasOwnProperty('eu.driver.model.geojson.Point')
        ) {
          feature.geometry = feature.geometry['eu.driver.model.geojson.Point'];
        }
        // fix properties
        if (feature.properties) {
          for (const key in feature.properties) {
            if (feature.properties.hasOwnProperty(key)) {
              const prop = feature.properties[key];
              if (prop.hasOwnProperty('string')) {
                feature.properties[key] = prop['string'];
              }
            }
          }
        }
      }

      this.layers.putLayerSourceById(layerId, geojson as LayerSource);
    }
  }

  private getAdapterState(): any {
    if (this.adapter.isConnected) {
      return {
        time: this.adapter.trialTime.getTime(),
        speed: this.adapter.trialSpeed,
        state: this.adapter.state,
        elapsed: this.adapter.timeElapsed
      };
    } else {
      return {
        state: 'offline'
      };
    }
  }

  @Get('state')
  root(): any {
    return this.getAdapterState();
  }

  @Get('cap')
  getCapObjects(): CAPObject[] {
    return this.capObjects;
  }

  @Get('version')
  version(): string {
    return 'v0.0.1';
  }
}
