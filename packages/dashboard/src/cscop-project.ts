import {IProject, ILayoutManagerConfig, IMenu, TimeDataSource} from '@csnext/cs-core';
import {LayoutManager, MdWidget, LogDataSource} from '@csnext/cs-client';
import {CsTimeline, TimelineWidgetOptions} from '@csnext/cs-timeline';
import {CsLogList, LogListOptions} from '@csnext/cs-log';
import './assets/example.css';
import './assets/copper.css';
import * as translations from './assets/locales.json';
import {SplitPanel} from '@csnext/cs-split-panel';
import {CsMap, MapOptions, LayerSelection, LayerSources, MapLayers, LayerSource, GeojsonLayer, ILayerExtensionType, IWmsTimeExtensionOptions, ILayerServiceOptions} from '@csnext/cs-map';
import {Project} from './';
import Vue from 'vue';
import {RasterPaint} from 'mapbox-gl';
import {ScenarioControl, ScenarioControlOptions} from './components/scenario-control/scenario-control';
import {CapDetails} from './components/cap-details/cap-details';
import {SimDetails} from './components/sim-details/sim-details';

Vue.component('cap-details', CapDetails);
Vue.component('sim-details', SimDetails);
const global = ((window as unknown) as CopperWindow) || {};

const LAYER_URL = global.VUE_APP_COPPER_LAYER_URL
  ? global.VUE_APP_COPPER_LAYER_URL
  : process.env.VUE_APP_COPPER_LAYER_URL
  ? process.env.VUE_APP_COPPER_LAYER_URL
  : process.env.NODE_ENV !== 'production'
  ? 'http://localhost:3007'
  : 'http://cool5.sensorlab.tno.nl:4022';
const LOG_URL = global.VUE_APP_COPPER_LOG_URL
  ? global.VUE_APP_COPPER_LOG_URL
  : process.env.VUE_APP_COPPER_LOG_URL
  ? process.env.VUE_APP_COPPER_LOG_URL
  : process.env.NODE_ENV !== 'production'
  ? 'http://localhost:3007/logs'
  : 'http://cool5.sensorlab.tno.nl:4022';
const SOCKET_SERVER_URL = global.VUE_APP_COPPER_SOCKET_SERVER_URL
  ? global.VUE_APP_COPPER_SOCKET_SERVER_URL
  : process.env.VUE_APP_COPPER_SOCKET_SERVER_URL
  ? process.env.VUE_APP_COPPER_SOCKET_SERVER_URL
  : process.env.NODE_ENV !== 'production'
  ? 'http://localhost:3007'
  : 'http://cool5.sensorlab.tno.nl:4022';

LayoutManager.add({
  id: 'split-panel',
  component: SplitPanel
} as ILayoutManagerConfig);

console.log(translations);

export const project: IProject = {
  server: {
    useSocket: true,
    socketServerUrl: SOCKET_SERVER_URL
  },
  header: {
    title: 'COPPER',
    logo: 'images/driver.png',
    breadcrumbs: false,
    dense: false,
    showNotifications: false
  },
  user: {
    // showUserIcon: true
  },
  navigation: {
    style: 'tabs',
    hideTitle: false,
    search: {
      enabled: false
    }
  },
  languages: {
    defaultLanguage: 'en',
    fallbackLanguage: 'en',
    localeMessages: translations.default
  },
  datasources: {
    caplog: new LogDataSource(`${LOG_URL}/`, 'cap'),
    simlog: new LogDataSource(`${LOG_URL}/`, 'sim'),
    layers: new LayerSources({
      buienradar: {
        title: 'Buienradar',
        type: 'raster',
        url: 'http://geoservices.knmi.nl/cgi-bin/RADNL_OPER_R___25PCPRR_L3.cgi?SERVICE=WMS&VERSION=1.3.0&bbox={bbox-epsg-3857}&REQUEST=GetMap&format=image/png&width=265&height=256&LAYERS=RADNL_OPER_R___25PCPRR_L3_COLOR&CRS=EPSG%3A3857&transparent=true',
        tileSize: 256
      } as LayerSource,
      luchtfoto: {
        title: "Lucht foto's actueel (25m)",
        type: 'raster',
        url: 'https://geodata.nationaalgeoregister.nl/luchtfoto/rgb/wms?SERVICE=WMS&VERSION=1.3.0&bbox={bbox-epsg-3857}&REQUEST=GetMap&format=image/png&width=265&height=256&LAYERS=Actueel_ortho25&CRS=EPSG%3A3857&transparent=true&styles=default',
        tileSize: 256
      } as LayerSource,
      hoogtekaart: {
        title: 'Hoogte Kaart (AHN3)',
        type: 'raster',
        url: 'https://geodata.nationaalgeoregister.nl/ahn3/wms?SERVICE=WMS&VERSION=1.3.0&bbox={bbox-epsg-3857}&REQUEST=GetMap&format=image/png&width=265&height=256&LAYERS=ahn3_5m_dsm&CRS=EPSG%3A3857&transparent=true&styles=default',
        tileSize: 256
      } as LayerSource,

      // https://geodata.nationaalgeoregister.nl/luchtfoto/rgb/wmts?layer=Actueel_ortho25&style=default&tilematrixset=EPSG%3A28992&Service=WMTS&Request=GetTile&Version=1.0.0&Format=image%2Fpng&TileMatrix=13&TileCol=3724&TileRow=3782
      gemeenten: {
        title: 'Gemeenten',
        url: '/layers/townships.json'
      } as LayerSource,
      wijken: {
        title: 'Wijken',
        url: '/layers/wijk_2017.json'
      } as LayerSource,
      buurten: {
        title: 'Buurten',
        url: '/layers/buurt_2017.json'
      } as LayerSource,
      provincie: {
        title: 'Provincie',
        url: '/layers/provincie_2017.json'
      } as LayerSource
    }),
    mainmap: new MapLayers(
      [
        {source: 'gemeenten', type: 'line'} as GeojsonLayer,
        // { source: 'sectoren', type: 'line', tags: ['evenement'] } as MapLayer,
        {
          source: 'buienradar',
          description: 'Huidige neerslag',
          color: 'blue',
          tags: ['weer'],
          type: 'raster',
          paint: {'raster-opacity': 0.5} as RasterPaint,
          extensions: [
            {
              id: 'wms-time',
              options: {
                timeProperty: 'time',
                historyDelayMinutes: 10
              } as IWmsTimeExtensionOptions
            }
          ] as ILayerExtensionType[]
        } as GeojsonLayer,
        {
          source: 'hoogtekaart',
          description: 'Hoogte kaart',
          color: 'darkblue',
          tags: ['basis kaarten'],
          type: 'raster'
        } as GeojsonLayer,
        {
          source: 'luchtfoto',
          description: 'Luchtfoto',
          color: 'green',
          tags: ['basis kaarten'],
          type: 'raster'
        } as GeojsonLayer
      ],
      'layers',
      [
        {
          id: 'event',
          type: 'layer-server-service',
          options: {
            url: `${LAYER_URL}/`,
            activeLayers: [],
            openFeatureDetails: true
          } as ILayerServiceOptions
        }
      ]
    ),
    time: new TimeDataSource(),
    project: new Project()
  },
  theme: {
    dark: false,
    colors: {
      primary: '#EBF0F5',
      secondary: '#e5e9ea',
      accent: '#82B1FF',
      error: '#FF5252',
      info: '#2196F3',
      success: '#4CAF50',
      warning: '#FFC107',
      menu: '#EBF0F5'
    }
  },
  rightSidebar: {
    open: false,
    clipped: true,
    width: 600,
    // floating: true,
    dashboard: {
      widgets: [{component: MdWidget, data: 'right sidebar'}]
    }
  },
  menus: [
    // <IMenu>{
    //   id: 'dashboard_settings',
    //   icon: 'build',
    //   title: 'settings',
    //   enabled: true,
    //   visible: true,
    //   action: (m => {
    //     switch (m.icon) {
    //       case 'build':
    //         m.icon = 'done';
    //         break;
    //       case 'done':
    //         m.icon = 'build';
    //         break;
    //     }
    //   })
    // }
  ],
  dashboards: [
    {
      title: 'COPPER',
      icon: 'assignment',
      path: '/',
      layout: 'split-panel',
      datasource: 'project',
      menus: [
        <IMenu>{
          id: 'filter',
          icon: 'filter_list',
          title: 'filter',
          component: MdWidget,
          data: 'test',
          enabled: false,
          visible: false
        },
        <IMenu>{
          id: 'color',
          icon: 'color_lens',
          title: 'person',
          component: MdWidget,
          data: 'test',
          enabled: true,
          visible: true
        }
      ],
      leftSidebar: {
        footer: {
          icon: 'info',
          tooltip: `Build date: ${process.env.VUE_APP_VERSION_TIME || '?'} <br>Git commit: ${process.env.VUE_APP_VERSION_SHA || '?'} <br>NPM-package: ${process.env.VUE_APP_PACKAGE_VERSION || '?'}`
        },
        open: true,
        clipped: true,
        width: 400,
        dashboard: {
          widgets: [
            {
              id: 'layerselection',
              component: LayerSelection,
              options: {
                class: 'layer-selection-widget',
                searchEnabled: true
              } as any,
              datasource: 'mainmap'
            }
          ]
        }
      },
      defaultWidgetOptions: {
        widgetBorder: 'widget-border-shadow'
        // height: 300
      },
      options: {
        defaultPreset: 'map',
        presets: {
          map: {
            icon: 'map',
            direction: 'vertical',
            elements: [
              {
                size: 82,
                splitpanel: {
                  direction: 'horizontal',
                  elements: [
                    {size: 66, widgetId: 'map'},
                    {
                      size: 33,
                      splitpanel: {
                        direction: 'vertical',
                        disableVerticalScroll: true,
                        elements: [
                          {size: 20, widgetId: 'scenario-control'},
                          {
                            size: 80,
                            widgetId: 'sim-viewer'
                          }
                        ]
                      }
                    }
                  ]
                }
              },
              {size: 18, widgetId: 'timeline'}
            ]
          }
        } as any
      } as any,
      widgets: [
        {
          id: 'cap-viewer',
          component: CsLogList,
          options: {
            showToolbar: true,
            title: 'Cap Messages',
            logSource: 'caplog',
            titleTemplate: '{{content.info.headline}}',
            subTitleTemplate: '{{content.sent}} - {{content.info.senderName}} - {{content.info.event}} - {{content.info.severity}} - {{content.info.category}}',
            openDetailsOnClick: true,
            detailsComponent: 'cap-details'
          } as LogListOptions
        },
        {
          id: 'sim-viewer',
          component: CsLogList,
          options: {
            showToolbar: true,
            title: 'SIMULATION_MESSAGES',
            logSource: 'simlog',
            titleTemplate: '{{content.headline}}',
            subTitleTemplate: '{{content.owner}} - {{content.destination}} - {{content.sent}}',
            openDetailsOnClick: true,
            reverseOrder: true,
            detailsComponent: 'sim-details'
          } as LogListOptions
        },
        {
          id: 'scenario-control',
          component: ScenarioControl,
          options: {
            timesource: 'time'
          } as ScenarioControlOptions
        },
        {
          id: 'map',
          component: CsMap,
          datasource: 'mainmap',
          options: {
            class: 'data-map-container',
            token: 'pk.eyJ1IjoiZGFteWxlbiIsImEiOiJfdUUzLVhNIn0.7-Ogdnc6voJfUXOMBE1VPA',
            mbOptions: {
              // style: 'test.json',
              style: 'mapbox://styles/mapbox/streets-v9', //"http://localhost:901/styles/klokantech-basic/style.json", //"mapbox://styles/mapbox/streets-v9",
              center: [4.999119, 52.478137],
              zoom: 11
            },
            showDraw: false,
            showRuler: true,
            showStyles: true,
            showGeocoder: true,
            showLegend: false,
            showGrid: false
          } as MapOptions
        },
        {
          id: 'timeline',
          component: CsTimeline,
          datasource: 'time',
          options: {
            class: 'timeline-window-container',
            widgetBorder: 'timeline-border',
            logSource: 'caplog',
            timelineOptions: {
              editable: false,
              height: '100%',
              type: 'point',
              start: new Date(Date.now() - 1000 * 60 * 60 * 12),
              end: new Date(Date.now() + 1000 * 60 * 60 * 12),
              moveable: true,
              verticalScroll: true,
              margin: {
                item: 2
              }
            }
          } as TimelineWidgetOptions,
          data: {smallView: false}
        }
      ]
    },
    {
      title: 'ABOUT',
      icon: 'assignment',
      path: '/about',
      layout: 'single',
      datasource: 'project',
      menus: [],
      leftSidebar: {
        footer: {
          icon: 'info',
          tooltip: `Build date: ${process.env.VUE_APP_VERSION_TIME || '?'} <br>Git commit: ${process.env.VUE_APP_VERSION_SHA || '?'} <br>NPM-package: ${process.env.VUE_APP_PACKAGE_VERSION || '?'}`
        },
        open: false,
        clipped: true,
        width: 400
      },
      defaultWidgetOptions: {
        widgetBorder: 'pa-4 widget-border-shadow'
        // height: 300
      },
      widgets: [
        {
          id: 'about-view',
          component: MdWidget,
          data: '## COPPER \n\n COPPER is a Common Operational Picture tool developed by TNO'
        }
      ]
    }
  ]
};
