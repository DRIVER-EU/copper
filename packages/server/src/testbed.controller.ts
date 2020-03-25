import { Get, Controller, Inject, Logger as NestLogger, Post, Body } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { DefaultWebSocketGateway, LayerService, ILogItem } from '@csnext/cs-layer-server';
import { TestBedAdapter, Logger, LogLevel, ITopicMetadataItem, IAdapterMessage, IDefaultKey, ITestBedOptions } from 'node-test-bed-adapter';
import { Feature, Point } from 'geojson';
import { LogService, LayerDefinition } from '@csnext/cs-layer-server';
import { ICAPAlert } from './classes/cap';
import { OffsetFetchRequest } from 'kafka-node';
import _ from 'lodash';
import { RequestUnitTransport } from './classes/request-unittransport';
import { Item } from './classes/entity_item';
import { AffectedArea } from './classes/sumo_affected_area';
import { IExtendedTestBedOptions } from './classes/testbed-config';

const log = Logger.instance;

@Controller('testbed')
export class TestbedController {
  private adapter: TestBedAdapter;
  public config: IExtendedTestBedOptions = {} as IExtendedTestBedOptions;
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
    public layers: LayerService,
    public logs: LogService
  ) {
    NestLogger.log('Init testbed');
    // load config
    const c = this.loadConfig(path.join(__dirname, '..', '..', '..', 'configs', 'testbed', 'config.json'));
    if (c !== undefined) {
      Object.assign(this.config, c);
    }

    if (this.config.enabled !== undefined && !this.config.enabled) {
      return;
    }

    this.config.clientId = process.env.COPPER_CLIENT_ID ? process.env.COPPER_CLIENT_ID : this.config.clientId;
    this.config.kafkaHost = process.env.KAFKA_HOST ? process.env.KAFKA_HOST : this.config.kafkaHost;
    this.config.schemaRegistry = process.env.SCHEMA_REGISTRY ? process.env.SCHEMA_REGISTRY : this.config.schemaRegistry;

    let consume: OffsetFetchRequest[] = [];
    this.config.topics.forEach(t => {
      consume.push({ topic: t.id, offset: t.offset });
    });

    const tbOptions: ITestBedOptions = {
      ...this.config,
      kafkaHost: this.config.kafkaHost,
      schemaRegistry: this.config.schemaRegistry,
      consume: (this.config.consume || []).concat(consume),
      fetchAllSchemas: false,
      fetchAllVersions: false,
      wrapUnions: false,
      clientId: this.config.clientId,
      // sslOptions: {
      //   pfx: fs.readFileSync('./configs/testbed/Copper.p12'),
      //   passphrase: 'changeit',
      //   ca: fs.readFileSync('./configs/testbed/test-ca.pem'),
      //   rejectUnauthorized: true
      // },
      // Start from the latest message, not from the first
      fromOffset: this.config.fromOffset,
      autoRegisterSchemas: this.config.autoRegisterSchemas,
      autoRegisterDefaultSchemas: this.config.autoRegisterDefaultSchemas,
      logging: {
        logToConsole: LogLevel.Info,
        logToFile: LogLevel.Info,
        logToKafka: LogLevel.Warn,
        logFile: 'log.txt'
      }
    };

    this.adapter = new TestBedAdapter(tbOptions);
    this.adapter.on('ready', () => {
      this.adapter.on('message', message => this.addMessage(message));

      log.info('Consumer is connected');
      this.getTopics();
      setInterval(() => {
        if (this.socket && this.socket.server) {
          this.socket.server.emit('time', this.getAdapterState());
        }
      }, 2000);
    });
    this.adapter.on('error', err => log.error(`Consumer received an error: ${err}`));
    this.adapter.connect();
    //Init logs
    this.logs.getLogById('sim');
    this.logs.getLogById('cap');
  }

  private loadConfig(file: string) {
    if (fs.existsSync(file)) {
      const data = fs.readFileSync(file, 'utf8');
      if (data && data.length > 0) {
        return JSON.parse(data);
      }
    } else {
      NestLogger.log(`Could not find file: '${file}'`);
    }
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
              console.log(`Topic: ${key}, partitions: ${Object.keys(md).length}`);
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
      const stringify = (m: string | Object) => (typeof m === 'string' ? m : JSON.stringify(m, null, 2));
      switch (message.topic) {
        case 'system_heartbeat':
          log.info(`Received heartbeat message with key ${stringify(message.key)}: ${stringify(message.value)}`);
          if (this.socket && this.socket.server) {
            this.socket.server.emit('time', this.getAdapterState());
          }
          break;
        case 'simulation_time_mgmt':
          log.info(`Received timing message with key ${stringify(message.key)}: ${stringify(message.value)}`);
          if (this.socket && this.socket.server) {
            this.socket.server.emit('time', this.getAdapterState());
          }
          break;
        case 'system_configuration':
          log.info(`Received configuration message with key ${stringify(message.key)}: ${stringify(message.value)}`);
          break;
        default:
          // find topic
          const topic = this.config.topics.find(t => t.id === message.topic);
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
              case 'geojson-data':
                await this.parseGeojsonData(topic.title, message, topic.tags);
                break;
              case 'request-unittransport':
                await this.parseRequestUnittransport(topic.title, message, topic.tags);
                break;
              case 'request-startinject':
                await this.parseRequestStartinject(topic.title, message, topic.tags);
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
          pointCircle: true,
          mapbox: {
            circlePaint: {
              'circle-radius': 15,
              'circle-color': 'blue',
              'circle-opacity': 0.6
            }
          }
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
        // console.log('Trying to get ' + id);
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
          types: ['polygon'],
          mapbox: {
            fillPaint: { 'fill-color': 'orange', 'fill-opacity': 0.5 }
          }
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

  private async parseRequestStartinject(id: string, message: IAdapterMessage, tags: string[] | undefined) {
    if (!message || !message.value) return;
    var value: RequestUnitTransport = message.value as RequestUnitTransport;
    value['sent'] = new Date((message.key as IDefaultKey).dateTimeSent);
    value['headline'] = `Simulation inject: ${value['inject']}`;

    console.log('Add: ' + value['headline']);

    // add to sim log
    const logdef = this.logs.getLogById('sim');
    const logItem: ILogItem = {
      id: (message.key as IDefaultKey).distributionID,
      start: new Date((message.key as IDefaultKey).dateTimeSent),
      content: value
    };
    this.logs.addLogItem('sim', logItem);
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
    };
    this.logs.addLogItem('sim', logItem);

    // add to RequestUnitTransport layer
    if (value.route && value.route.length > 0) {
      try {
        let layer = await this.getRouteRequestLayer('unittransportrequest');
        if (layer !== undefined) {
          const f = {
            type: 'Feature',
            id: value.guid,
            properties: value,
            geometry: {
              type: 'LineString',
              coordinates: value.route.map(a => {
                return [a.longitude, a.latitude];
              })
            }
          };
          if (this.layers) {
            this.layers
              .updateFeature(layer.id, f as any, value.guid)
              .then(f => {
                // console.log('Feature saved');
              })
              .catch(e => {
                console.log('Error saving feature');
                console.log(e);
              });
          }
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
    // if (this.unitUpdateCount++ % 100 === 0) {
    //   const logdef = this.logs.getLogById('sim');
    //   const logItem: ILogItem = {
    //     id: `${unit.guid}-${(message.key as IDefaultKey).dateTimeSent}`,
    //     start: new Date((message.key as IDefaultKey).dateTimeSent),
    //     content: unit
    //   }
    //   this.logs.addLogItem('sim', logItem);
    // }

    // add to EntityItem layer
    if (unit.location) {
      try {
        let layer = await this.getEntityItemLayer('entityupdate');
        if (layer !== undefined) {
          const f: Feature = {
            type: 'Feature',
            id: unit.id,
            properties: {...unit, updatedAt: (message.key as IDefaultKey).dateTimeSent},
            geometry: {
              type: 'Point',
              coordinates: [unit.location.longitude, unit.location.latitude]
            } as Point
          };
          console.log(JSON.stringify(unit));
          if (this.layers) {
            this.layers
              .updateFeature(layer.id, f, unit.id)
              .then(f => {
                // console.log('Feature saved');
              })
              .catch(e => {
                console.log('Error saving feature');
                console.log(e);
              });
          }
          // this.layers.updateFeature()
          // this.layers
          //   .getLayerSourceById('entityupdate')
          //   .then(source => {

          //     source.features.push(f);
          //     console.log(JSON.stringify(f));

          //     // this.layers
          //     //   .putLayerSourceById(layer.id, source)
          //     //   .then(() => {
          //     //     console.log(`Saved layer ${layer.id}`);
          //     //   })
          //     //   .catch(() => { });
          //   })
          //   .catch(() => { });
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
    };
    this.logs.addLogItem('sim', logItem);

    // add to AffectedArea layer
    if (area.area) {
      try {
        let layer = await this.getAffectedAreaLayer('affectedarea');
        if (layer !== undefined) {
          const af = {
            type: 'Feature',
            id: area.id,
            properties: area,
            geometry: {
              type: 'MultiPolygon',
              coordinates: area.area.coordinates
            }
          } as any;
          this.layers
            .updateFeature(layer.id, af, area.id)
            .then(f => {
              // console.log('Feature saved');
            })
            .catch(e => {
              console.log('Error saving feature');
              console.log(e);
            });

          // this.layers
          //   .getLayerSourceById('affectedarea')
          //   .then(source => {
          //     const f = {
          //       type: 'Feature',
          //       id: area.id,
          //       properties: area,
          //       geometry: {
          //         type: 'MultiPolygon',
          //         coordinates: area.area.coordinates
          //       }
          //     };
          //     source.features.push(f);
          //     // console.log(JSON.stringify(f));

          //     this.layers
          //       .putLayerSourceById(layer.id, source)
          //       .then(() => {
          //         console.log(`Saved layer ${layer.id}`);
          //       })
          //       .catch(() => { });
          //   })
          //   .catch(() => { });
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
    if (cap === undefined) {
      return;
    }

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
    };
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

  private async parseGeojsonData(id: string, message: IAdapterMessage, tags: string[] | undefined) {
    console.log(`Geojson data id ${id}`);
    if (message.value && message.value.hasOwnProperty('data')) {
      if ((message.value['data'] as string).trim().startsWith('{')) {
        message.value['geojson'] = JSON.parse(message.value['data']);
        return this.parseGeojson(id, message, tags);
      }
    }
  }

  private async parseGeojsonExternal(id: string, message: IAdapterMessage, tags: string[] | undefined) {
    console.log('Geojson external');
    console.log(JSON.stringify(message));
    this.getExternalLayer(id)
      .then(l => {
        if (tags) {
          l.tags = tags;
        }
        l.title = message.value['title'];
        l.externalUrl = message.value['url'];
        this.layers.triggerLayerRefresh(id);
      })
      .catch(e => { });
  }

  private async parseGeojson(id: string, message: IAdapterMessage, tags: string[] | undefined) {
    if (message.value && message.value.hasOwnProperty('geojson') && message.value['geojson']['features']) {
      let layerId = id;

      if (message.value.hasOwnProperty('properties') && message.value['properties'].hasOwnProperty('map') && message.value['properties']['map'].hasOwnProperty('name')) {
        layerId = message.value['properties']['map']['name']['string'];
      }

      if (message.value.hasOwnProperty('properties') && message.value['properties'].hasOwnProperty('name')) {
        layerId = message.value['properties']['name']['string'];
      }

      console.log(`Properties: ${message.value['properties']}`);
      console.log(`LayerID = ${layerId}`);

      let layer = await this.getCapLayer(layerId);
      if (layerId !== id && layer.tags.indexOf(id) === -1) {
        layer.tags.push(id);
      }
      console.log(`Layer = ${layer}`);
      let geojson = message.value['geojson'] as GeoJSON.FeatureCollection;
      // console.log(geojson);
      for (const feature of geojson.features) {
        // fix geometry object
        if (feature.geometry && feature.geometry.hasOwnProperty('eu.driver.model.geojson.Point')) {
          feature.geometry = feature.geometry['eu.driver.model.geojson.Point'];
        }

        if (feature.geometry && feature.geometry.hasOwnProperty('eu.driver.model.geojson.Polygon')) {
          feature.geometry = feature.geometry['eu.driver.model.geojson.Polygon'];
        }

        if (feature.geometry && feature.geometry.hasOwnProperty('eu.driver.model.geojson.LineString')) {
          feature.geometry = feature.geometry['eu.driver.model.geojson.LineString'];
        }

        // fix properties
        if (feature.properties) {
          for (const key in feature.properties) {
            if (feature.properties.hasOwnProperty(key)) {
              const prop = feature.properties[key];
              if (prop && prop.hasOwnProperty('string')) {
                feature.properties[key] = prop['string'];
              }
            }
          }
        }
      }

      if (message.value['timestamp'] && message.value['timestamp'] === -1) {
        console.log(`Timestamp is -1, restart with the ${geojson.features.length} features of the msg`);
        this.layers.putLayerSourceById(layerId, geojson as any);
      } else {
        // Update existing features
        console.log("Update existing features");
        const origSource = await this.layers.getLayerSourceById(layerId);
        console.log(`Orig features: ${origSource.features.length}`);
        if (layer && origSource && origSource.features) {
          const updatedIds = [];
          geojson.features.forEach(f => {
            const origF = origSource.features.find(ff => ff.id === f.id);
            if (origF) {
              origF.properties = { ...origF.properties, ...f.properties };
              origF.geometry = f.geometry;
            } else {
              origSource.features.push(f);
            }
          });
          this.layers.putLayerSourceById(layerId, origSource as any);
        } else {
          console.log(`Zero orig features, use all ${geojson.features.length} features of the msg`);
          this.layers.putLayerSourceById(layerId, geojson as any);
        }
      }
    } else {
      console.log(`No GeoJSON features to parse in message ${id}`);
    }
  }

  private getAdapterState(): any {
    if (this.adapter.isConnected) {
      return {
        time: this.adapter.simulationTime.getTime(),
        speed: this.adapter.simulationSpeed,
        state: this.adapter.timeState,
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
    this.parseCapObject(capObject)
      .then(() => {
        log.info(`Added cap object`);
      })
      .catch(err => {
        log.warn(`Error adding capObject: ${err}`);
      });
    return;
  }

  @Get('version')
  version(): string {
    return 'v0.0.2';
  }
}
