import { Get, Controller, Inject, Logger as NestLogger, Post, Body } from '@nestjs/common';
import * as fs from 'fs';

import { DefaultWebSocketGateway, LayerService, ILogItem } from '@csnext/cs-layer-server';
import {
  TestBedAdapter,
  Logger,
  LogLevel,
  ITopicMetadataItem,
  IAdapterMessage,
  IDefaultKey
} from 'node-test-bed-adapter';

import {
  LogService,
  LayerSource,
  LayerDefinition
} from '@csnext/cs-layer-server';
import { ICAPAlert } from './classes/cap';
import { OffsetFetchRequest } from 'kafka-node';
import { TestBedConfig } from './classes/testbed-config';
import _ from 'lodash';
import { RequestUnitTransport } from './classes/request-unittransport';
import { Item } from './classes/entity_item';
import { AffectedArea } from './classes/sumo_affected_area';

const log = Logger.instance;

@Controller('testbed')
export class TestbedController {
  private adapter: TestBedAdapter;

  public config: TestBedConfig = {};

  public capObjects: ICAPAlert[] = [];
  public messageQueue: IAdapterMessage[] = [];
  public busy = false;
  private unitUpdateCount = 0;

  handleConnection(d: any) {
    // this.server.emit('buttonCount',AppService.buttonCount);
    console.log(`Timer connection received from ${d.id}`);
  }

  constructor(
    @Inject('DefaultWebSocketGateway')
    private readonly socket: DefaultWebSocketGateway,
    public layers: LayerService,
    public logs: LogService,
  ) {
    NestLogger.log('Init testbed');
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
      setInterval(() => {
        if (this.socket && this.socket.server) {
          this.socket.server.emit('time', this.getAdapterState());
        };
      }, 2000);
    });
    this.adapter.on('error', err =>
      log.error(`Consumer received an error: ${err}`)
    );
    this.adapter.connect();
    //Init logs
    this.logs.getLogById('sim');
    this.logs.getLogById('cap');
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
      switch (message.topic) {
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
            t => t.id === message.topic
          );
          if (topic) {
            switch (topic.type) {
              case 'cap':
                await this.parseCapObject(message.value as ICAPAlert);
                break;
              case 'geojson':
                await this.parseGeojson(topic.title, message, topic.tags);
                break;
              case 'geojson-external':
                await this.parseGeojsonExternal(topic.title, message, topic.tags);
                break;
              case 'request-unittransport':
                await this.parseRequestUnittransport(topic.title, message, topic.tags);
                break;
              case 'entity-item':
                await this.parseEntityItem(topic.title, message, topic.tags);
                break;
              case 'affected-area':
                await this.parseAffectedArea(topic.title, message, topic.tags);
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

  private getExternalLayer(id: string): Promise<LayerDefinition> {
    return new Promise(async (resolve, reject) => {

      try {
        // try to get existing layer
        console.log('Trying to get ' + id);
        let layer = await this.layers.getLayerById(id);
        resolve(layer);
        return;
      } catch (e) {
        console.log(e);
        console.log('not found ' + id);
        // layer not found, create new one
        const def = new LayerDefinition();
        def.title = id;
        def.id = id;
        def.isLive = false;

        def.sourceType = 'geojson';
        def.style = {
          types: ['point'],
          pointCircle: true
        };
        def._layerSource = {
          id: id,
          type: 'FeatureCollection',
          features: []
        } as any; // LayerSource;

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
    });
  }

  private getCapLayer(id: string): Promise<LayerDefinition> {
    return new Promise(async (resolve, reject) => {

      try {
        // try to get existing layer
        console.log('Trying to get ' + id);
        let layer = await this.layers.getLayerById(id);
        resolve(layer);
        return;
      } catch (e) {
        console.log(e);
        console.log('not found ' + id);
        // layer not found, create new one
        const def = new LayerDefinition();
        def.title = id;
        def.id = id;
        def.isLive = true;
        def.sourceType = 'geojson';
        def.tags = ['cap'];
        def.style = {
          types: ['point'],
          pointCircle: true
        };
        def._layerSource = {
          id: id,
          type: 'FeatureCollection',
          features: []
        } as any; // LayerSource;

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
    });
  }

  private getRouteRequestLayer(id: string): Promise<LayerDefinition> {
    return new Promise(async (resolve, reject) => {
      try {
        // try to get existing layer
        console.log('Trying to get ' + id);
        let layer = await this.layers.getLayerById(id);
        resolve(layer);
        return;
      } catch (e) {
        console.log(e);
        console.log('not found ' + id);
        // layer not found, create new one
        const def = new LayerDefinition();
        def.title = id;
        def.id = id;
        def.isLive = true;
        def.sourceType = 'geojson';
        def.tags = ['request-unittransport'];
        def.style = {
          types: ['line'],
          pointCircle: false
        };
        def._layerSource = {
          id: id,
          type: 'FeatureCollection',
          features: []
        } as any; // LayerSource;

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
    });
  }

  private getEntityItemLayer(id: string): Promise<LayerDefinition> {
    return new Promise(async (resolve, reject) => {
      try {
        // try to get existing layer
        console.log('Trying to get ' + id);
        let layer = await this.layers.getLayerById(id);
        resolve(layer);
        return;
      } catch (e) {
        console.log(e);
        console.log('not found ' + id);
        // layer not found, create new one
        const def = new LayerDefinition();
        def.title = id;
        def.id = id;
        def.isLive = true;
        def.sourceType = 'geojson';
        def.tags = ['entity-item'];
        def.style = {
          types: ['point'],
          pointCircle: true
        };
        def._layerSource = {
          id: id,
          type: 'FeatureCollection',
          features: []
        } as any; // LayerSource;

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
    });
  }

  private getAffectedAreaLayer(id: string): Promise<LayerDefinition> {
    return new Promise(async (resolve, reject) => {
      try {
        // try to get existing layer
        console.log('Trying to get ' + id);
        let layer = await this.layers.getLayerById(id);
        resolve(layer);
        return;
      } catch (e) {
        console.log(e);
        console.log('not found ' + id);
        // layer not found, create new one
        const def = new LayerDefinition();
        def.title = id;
        def.id = id;
        def.isLive = true;
        def.sourceType = 'geojson';
        def.tags = ['affected-area'];
        def.style = {
          types: ['polygon']
        };
        def._layerSource = {
          id: id,
          type: 'FeatureCollection',
          features: []
        } as any; // LayerSource;

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
    });
  }

  private async parseRequestUnittransport(id: string, message: IAdapterMessage, tags: string[] | undefined) {
    if (!message || !message.value) return;
    var value: RequestUnitTransport = message.value as RequestUnitTransport;
    value['sent'] = new Date((message.key as IDefaultKey).dateTimeSent);
    value['headline'] = 'Request Unittransport';

    // add to sim log
    const logdef = this.logs.getLogById('sim');
    const logItem: ILogItem = {
      id: (message.key as IDefaultKey).distributionID,
      start: new Date((message.key as IDefaultKey).dateTimeSent),
      content: value
    }
    this.logs.addLogItem('sim', logItem);
    
    // add to RequestUnitTransport layer
    if (value.route && value.route.length > 0) {
      try {
        let layer = await this.getRouteRequestLayer('unittransportrequest');
        if (layer !== undefined) {
          this.layers
            .getLayerSourceById('unittransportrequest')
            .then(source => {
              const f = {
                type: 'Feature',
                id: value.guid,
                properties: value,
                geometry: {
                  type: 'LineString',
                  coordinates: value.route.map(a => {return [a.longitude, a.latitude]})
                }
              };
              source.features.push(f);
              console.log(JSON.stringify(f));

              this.layers
                .putLayerSourceById(layer.id, source)
                .then(() => {
                  console.log(`Saved layer ${layer.id}`);
                })
                .catch(() => { });
            })
            .catch(() => { });
        }
      } catch (e) {
        console.log('Really not found');
        console.log(e);
      }
    }
    
    if (this.socket && this.socket.server) {
      this.socket.server.emit('sim', value);
    }
  }

  private async parseEntityItem(id: string, message: IAdapterMessage, tags: string[] | undefined) {
    if (!message || !message.value) return;
    var unit: Item = message.value as Item;
    unit['headline'] = 'Unit update';
    unit['sent'] = new Date((message.key as IDefaultKey).dateTimeSent);

    // add to sim log
    if (this.unitUpdateCount++ % 5 === 0) {
      const logdef = this.logs.getLogById('sim');
      const logItem: ILogItem = {
        id: `${unit.guid}-${(message.key as IDefaultKey).dateTimeSent}`,
        start: new Date((message.key as IDefaultKey).dateTimeSent),
        content: unit
      }
      this.logs.addLogItem('sim', logItem);
    }
    
    // add to EntityItem layer
    if (unit.location) {
      try {
        let layer = await this.getEntityItemLayer('entityupdate');
        if (layer !== undefined) {
          this.layers
            .getLayerSourceById('entityupdate')
            .then(source => {
              const f = {
                type: 'Feature',
                id: unit.guid,
                properties: unit,
                geometry: {
                  type: 'Point',
                  coordinates: [unit.location.longitude, unit.location.latitude]
                }
              };
              source.features.push(f);
              console.log(JSON.stringify(f));

              this.layers
                .putLayerSourceById(layer.id, source)
                .then(() => {
                  console.log(`Saved layer ${layer.id}`);
                })
                .catch(() => { });
            })
            .catch(() => { });
        }
      } catch (e) {
        console.log('Really not found');
        console.log(e);
      }
    }
    
    if (this.socket && this.socket.server) {
      this.socket.server.emit('unit', unit);
    }
  }

  private async parseAffectedArea(id: string, message: IAdapterMessage, tags: string[] | undefined) {
    console.log(`Parsing affected area`);
    if (!message || !message.value) return;
    var area: AffectedArea = message.value as AffectedArea;
    area['headline'] = 'Affected area';
    area['sent'] = new Date((message.key as IDefaultKey).dateTimeSent);

    // add to sim log
    const logdef = this.logs.getLogById('sim');
    const logItem: ILogItem = {
      id: `${area.id}-${(message.key as IDefaultKey).dateTimeSent}`,
      start: new Date((message.key as IDefaultKey).dateTimeSent),
      content: area
    }
    this.logs.addLogItem('sim', logItem);
    
    // add to AffectedArea layer
    if (area.area) {
      try {
        let layer = await this.getAffectedAreaLayer('affectedarea');
        if (layer !== undefined) {
          this.layers
            .getLayerSourceById('affectedarea')
            .then(source => {
              const f = {
                type: 'Feature',
                id: area.id,
                properties: area,
                geometry: {
                  type: 'MultiPolygon',
                  coordinates: area.area.coordinates
                }
              };
              source.features.push(f);
              console.log(JSON.stringify(f));

              this.layers
                .putLayerSourceById(layer.id, source)
                .then(() => {
                  console.log(`Saved layer ${layer.id}`);
                })
                .catch(() => { });
            })
            .catch(() => { });
        }
      } catch (e) {
        console.log('Really not found');
        console.log(e);
      }
    }
    
    if (this.socket && this.socket.server) {
      this.socket.server.emit('area', area);
    }
  }


  private async parseCapObject(cap: ICAPAlert) {
    if (cap === undefined) { return; }
    console.log('Got cap object');

    // make sure parameter is always an array
    if (cap.info && cap.info.hasOwnProperty('parameter') && !_.isArray(cap.info['parameter'])) {
      cap.info['parameter'] = [cap.info['parameter']];
    }
    this.capObjects.push(cap);

    // add to cap log
    const logdef = this.logs.getLogById('cap');
    const logItem: ILogItem = {
      id: cap.identifier,
      start: new Date(cap.sent),
      content: cap
    }
    this.logs.addLogItem('cap', logItem);

    // add to cap layer
    if (cap.info && cap.info.area && cap.info.area.circle) {
      try {
        let layer = await this.getCapLayer(cap.sender);
        if (layer !== undefined) {
          this.layers
            .getLayerSourceById(cap.sender)
            .then(source => {
              let p: number[] = this.getCirclePoint(cap);
              let res = {};

              source.features.push({
                type: 'Feature',
                id: cap.identifier,
                properties: cap.info,
                geometry: {
                  type: 'Point',
                  coordinates: [p[1], p[0]]
                }
              });


              this.layers
                .putLayerSourceById(layer.id, source)
                .then(() => {
                  console.log(`Saved layer ${layer.id}`);
                })
                .catch(() => { });
            })
            .catch(() => { });
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

  private async parseGeojsonExternal(id: string, message: IAdapterMessage, tags: string[] | undefined) {
    console.log('Geojson external');
    console.log(JSON.stringify(message));
    this.getExternalLayer(id).then(l => {
      if (tags) {
        l.tags = tags;
      }
      l.title = message.value['title'];
      l.externalUrl = message.value['url'];
      this.layers.triggerLayerRefresh(id);
    }).catch(e => {

    })
  }

  private async parseGeojson(id: string, message: IAdapterMessage, tags: string[] | undefined) {
    if (
      message.value &&
      message.value.hasOwnProperty('geojson') &&
      message.value['geojson']['features'].length > 0
    ) {
      let layerId = id;

      if (message.value.hasOwnProperty('properties') && message.value['properties'].hasOwnProperty('map') && message.value['properties']['map'].hasOwnProperty('name')) {
        layerId = message.value['properties']['map']['name']['string'];
      }

      if (message.value.hasOwnProperty('properties') && message.value['properties'].hasOwnProperty('name')) {
        layerId = message.value['properties']['name']['string'];
      }

      console.log(message.value['properties']);
      console.log(`LayerID = ${layerId}`);

      let layer = await this.getCapLayer(layerId);
      if (layerId !== id && layer.tags.indexOf(id) === -1) {
        layer.tags.push(id);
      }
      console.log(layer);
      let geojson = message.value['geojson'] as GeoJSON.FeatureCollection;
      // console.log(geojson);
      for (const feature of geojson.features) {
        // fix geometry object
        if (
          feature.geometry &&
          feature.geometry.hasOwnProperty('eu.driver.model.geojson.Point')
        ) {
          feature.geometry = feature.geometry['eu.driver.model.geojson.Point'];
        }

        if (
          feature.geometry &&
          feature.geometry.hasOwnProperty('eu.driver.model.geojson.Polygon')
        ) {
          feature.geometry = feature.geometry['eu.driver.model.geojson.Polygon'];
        }

        if (
          feature.geometry &&
          feature.geometry.hasOwnProperty('eu.driver.model.geojson.LineString')
        ) {
          feature.geometry = feature.geometry['eu.driver.model.geojson.LineString'];
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

      this.layers.putLayerSourceById(layerId, geojson as any);
    }
  }

  private getAdapterState(): any {
    if (this.adapter.isConnected) {
      return {
        time: this.adapter.trialTime.getTime(),
        speed: this.adapter.trialTimeSpeed,
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

  @Post('cap')
  addCapObject(@Body() capObject: ICAPAlert): void {
    this.parseCapObject(capObject).then(() => {
      log.info(`Added cap object`);
    }).catch((err) => {
      log.warn(`Error adding capObject: ${err}`);
    });
    return;
  }

  @Get('version')
  version(): string {
    return 'v0.0.1';
  }
}
