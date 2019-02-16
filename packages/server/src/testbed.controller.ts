import { Get, Controller, Inject } from '@nestjs/common';
import * as fs from 'fs';

import { DefaultWebSocketGateway, LayerService } from '@csnext/cs-layer-server';
import {
  TestBedAdapter,
  Logger,
  LogLevel,
  ITopicMetadataItem,
  IAdapterMessage
} from 'node-test-bed-adapter';

import {
  LayerSource,
  LayerDefinition
} from '@csnext/cs-layer-server/dist/classes';
import { ICAPAlert } from './classes/cap';
import { OffsetFetchRequest } from 'kafka-node';
import { TestBedConfig } from './classes/testbed-config';

const log = Logger.instance;

@Controller('testbed')
export class TestbedController {
  private adapter: TestBedAdapter;

  public config: TestBedConfig = {};

  public capObjects: ICAPAlert[] = [];
  public messageQueue: IAdapterMessage[] = [];
  public busy = false;

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
      Object.assign(this.config, c);
    }

    if (
      this.config.enabled !== undefined &&
      !this.config.enabled
    ) {
      return;
    }

    let consume: OffsetFetchRequest[] = [];
    this.config.topics.forEach(t => {
      consume.push({ topic: t.id, offset: t.offset });
    });

    this.adapter = new TestBedAdapter({
      // kafkaHost: 'localhost:3501',
      // schemaRegistry: 'localhost:3502',
      kafkaHost: this.config.kafkaHost,
      schemaRegistry: this.config.schemaRegistry,
      // kafkaHost: 'tb4.driver-testbed.eu:3501',
      // schemaRegistry: 'tb4.driver-testbed.eu:3502',
      consume: consume,
      fetchAllSchemas: false,
      fetchAllVersions: false,
      wrapUnions: false,
      // wrapUnions: 'auto',
      clientId: this.config.clientId,
      // Start from the latest message, not from the first
      fromOffset: this.config.fromOffset,
      logging: {
        logToConsole: LogLevel.Info,
        logToFile: LogLevel.Info,
        logToKafka: LogLevel.Warn,
        logFile: 'log.txt'
      }
    });
    this.adapter.on('ready', () => {
      this.adapter.on('message', message => this.addMessage(message));

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

  private async handleMessage() {
    if (this.messageQueue.length > 0 && !this.busy) {
      this.busy = true;
      let message = this.messageQueue.shift();
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
          const topic = this.config.topics.find(
            t => t.id === message.topic.toLowerCase()
          );
          if (topic) {
            switch (topic.type) {
              case 'cap':
                await this.parseCapObject(message.value as ICAPAlert);
                break;
              case 'geojson':
                await this.parseGeojson(topic.title, message);
                break;
              case 'geojson-external':
                console.log('Geojson external');
                console.log(JSON.stringify(message));
                break;
            }
          }

          // log.info(`Received ${message.topic} message with key ${stringify(message.key)}: ${stringify(message.value)}`);
          break;
      }

      this.busy = false;
      this.handleMessage();
    }
  }

  private async addMessage(message: IAdapterMessage) {
    this.messageQueue.push(message);
    this.handleMessage();
  }

  private getCapLayer(cap: ICAPAlert): Promise<LayerDefinition> {
    return new Promise(async (resolve, reject) => {
      if (cap.sender) {
        try {
          // try to get existing layer
          console.log('Trying to get ' + cap.sender);
          let layer = await this.layers.getLayerById(cap.sender);
          resolve(layer);
          return;
        } catch (e) {
          console.log(e);
          console.log('not found ' + cap.sender);
          // layer not found, create new one
          const def = new LayerDefinition();
          def.title = cap.sender;
          def.id = cap.sender;
          def.isLive = true;
          def.sourceType = 'geojson';
          def.tags = ['cap'];
          def.style = {
            types: ['point'],
            pointCircle: true
          };
          def._layerSource = {
            id: cap.sender,
            type: 'FeatureCollection',
            features: []
          } as LayerSource;

          // init layer
          this.layers
            .initLayer(def)
            .then(ld => {
              // add layer
              this.layers
                .addLayer(ld)
                .then(l => {
                  resolve(l);
                  return;
                })
                .catch(r => {
                  // could not add layer
                  reject(r);
                  return;
                });
            })
            .catch(r => {
              // could not init layer
              reject(r);
              return;
            });
        }
      } else {
        reject();
      }
    });
  }

  private async parseCapObject(cap: ICAPAlert) {
    console.log('Got cap object');
    this.capObjects.push(cap);
    if (cap.info && cap.info.area && cap.info.area.circle) {
      console.log('Got circle');
      try {
        let layer = await this.getCapLayer(cap);
        if (layer !== undefined) {
          this.layers
            .getLayerSourceById(cap.sender)
            .then(source => {
              let p: number[] = this.getCirclePoint(cap);
              source.features.push({
                type: 'Feature',
                id: cap.identifier,
                properties: cap.info,
                geometry: {
                  type: 'Point',
                  coordinates: p
                }
              });
              this.layers
                .putLayerSourceById(layer.id, source)
                .then(() => {
                  console.log('Layer saved');
                })
                .catch(() => {});
            })
            .catch(() => {});
        }
      } catch (e) {
        console.log('Really not found');
        console.log(e);
      }
    }
    if (this.socket && this.socket.server) {
      this.socket.server.emit('cap', cap);
    }
  }

  /** extract point from cap circle */
  private getCirclePoint(cap: ICAPAlert) {
    let p: number[] = [];
    let parts = (cap.info.area.circle as string).replace(' 0', '').split(',');
    if (parts.length === 2) {
      for (const partsp of parts) {
        p.push(parseFloat(partsp));
      }
    }
    return p;
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
  getCapObjects(): ICAPAlert[] {
    return this.capObjects;
  }

  @Get('version')
  version(): string {
    return 'v0.0.1';
  }
}
