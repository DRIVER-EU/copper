import { IProject, ILayoutManagerConfig, IMenu, TimeDataSource } from '@csnext/cs-core';
import { LayoutManager, MdWidget, ImageWidget, Grid } from '@csnext/cs-client';
import { CsTimeline, TimelineWidgetOptions } from '@csnext/cs-timeline';
import './assets/example.css';
import './assets/sgbo.css';
import {
  SplitPanel,
  SplitPanelDashboardOptions,
  SplitPanelOptions
} from '@csnext/cs-split-panel';
import {
  CsMap,
  MapOptions,
  LayerSelection,
  LayerSources,
  MapLayers,
  LayerSource,
  GeojsonLayer,
  ITimeInterpolationExtensionOptions,
  ILayerExtensionType,
  IWmsTimeExtensionOptions,
  ILayerServiceOptions
} from '@csnext/cs-map';
import { Project } from './';
import { RasterPaint, MapboxOptions } from 'mapbox-gl';
import { CapViewer } from './components/cap-viewer/cap-viewer';
import { ScenarioControl } from './components/scenario-control/scenario-control';
import { CapMessage } from './components/cap-message/cap-message';
import { CapDatasource } from './shared/CapDatasource';

const LAYER_URL =
  process.env.NODE_ENV !== 'production'
    ? 'http://localhost:3007/'
    : 'http://cool5.sensorlab.tno.nl:4022/';

LayoutManager.add({
  id: 'split-panel',
  component: SplitPanel
} as ILayoutManagerConfig);

export const project: IProject = { 
  server: {
    useSocket: true,
    socketServerUrl: 'http://localhost:3007',
  }, 
  header: {
    title: '',
    logo: 'images/driver.png',
    breadcrumbs: false,
    dense: false
  },
  navigation: {
    style: 'tabs',
    search: {
      enabled: false
    }
  },
  datasources: {
    layers: new LayerSources({
      buienradar: {
        title: 'Buienradar',
        type: 'raster',
        url:
          'http://geoservices.knmi.nl/cgi-bin/RADNL_OPER_R___25PCPRR_L3.cgi?SERVICE=WMS&VERSION=1.3.0&bbox={bbox-epsg-3857}&REQUEST=GetMap&format=image/png&width=265&height=256&LAYERS=RADNL_OPER_R___25PCPRR_L3_COLOR&CRS=EPSG%3A3857&transparent=true',
        tileSize: 256
      } as LayerSource,
      luchtfoto: {
        title: "Lucht foto's actueel (25m)",
        type: 'raster',
        url:
          'https://geodata.nationaalgeoregister.nl/luchtfoto/rgb/wms?SERVICE=WMS&VERSION=1.3.0&bbox={bbox-epsg-3857}&REQUEST=GetMap&format=image/png&width=265&height=256&LAYERS=Actueel_ortho25&CRS=EPSG%3A3857&transparent=true&styles=default',
        tileSize: 256
      } as LayerSource,
      hoogtekaart: {
        title: 'Hoogte Kaart (AHN3)',
        type: 'raster',
        url:
          'https://geodata.nationaalgeoregister.nl/ahn3/wms?SERVICE=WMS&VERSION=1.3.0&bbox={bbox-epsg-3857}&REQUEST=GetMap&format=image/png&width=265&height=256&LAYERS=ahn3_5m_dsm&CRS=EPSG%3A3857&transparent=true&styles=default',
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
      } as LayerSource,
      evenement: {
        title: 'Evenement',
        url: '/layers/evenement.json'
      } as LayerSource,
      sintrouteland: {
        title: 'Locatie Sint (vasteland)',
        url: `${LAYER_URL}sources/sintrouteland`
      } as LayerSource,
      sintroutewater: {
        title: 'Locatie Sint (water)',
        url: `${LAYER_URL}sources/sintroutewater`
      } as LayerSource
    }),
    mainmap: new MapLayers(
      [
        { source: 'gemeenten', type: 'line' } as GeojsonLayer,
        // { source: 'sectoren', type: 'line', tags: ['evenement'] } as MapLayer,
        {
          source: 'buienradar',
          description: 'Huidige neerslag',
          color: 'blue',
          tags: ['weer'],
          type: 'raster',
          paint: { 'raster-opacity': 0.5 } as RasterPaint,
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
            url: LAYER_URL,
            activeLayers: ['buurt'],
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
    width: 500,
    // floating: true,
    dashboard: {
      widgets: [{ component: MdWidget, data: 'right sidebar' }]
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
    // },
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
                size: 80,
                splitpanel: {
                  direction: 'horizontal',
                  elements: [
                    { size: 66, widgetId: 'map' },
                    {
                      size: 33,
                      splitpanel: {
                        direction: 'vertical',
                        disableVerticalScroll: true,
                        elements: [
                          { size: 20, widgetId: 'scenario-control' },
                          {
                            size: 80,
                            widgetId: 'cap-viewer'
                          }
                        ]
                      }
                    },
                    
                  ]
                }
              },
              { size: 20, widgetId: 'timeline' }
            ]
          }
        } as any
      } as any,
      widgets: [
        {
          id: 'cap-viewer2',
          component: CapViewer,
          datasource: 'capdatasource'        
        },
        {
          id: 'cap-message',
          component: CapMessage          
        },
        {
          id: 'scenario-control',
          component: ScenarioControl          
        },
        {
          id: 'map',
          component: CsMap,
          datasource: 'mainmap',
          options: {
            class: 'data-map-container',
            token:
              'pk.eyJ1IjoiZGFteWxlbiIsImEiOiJfdUUzLVhNIn0.7-Ogdnc6voJfUXOMBE1VPA',
            mbOptions: {
              style: 'mapbox://styles/mapbox/streets-v9', //'http://localhost:901/styles/klokantech-basic/style.json',
              center: [4.294637, 52.056277],
              zoom: 9
            } as MapboxOptions,
            showDraw: true,
            showRuler: true,
            showStyles: false,
            showGeocoder: true,
            showLegend: true
          } as MapOptions
        },
        {
          id: 'timeline',
          component: CsTimeline,
          datasource: 'time',
          options: {
            class: 'timeline-window-container',
            widgetBorder: 'timeline-border',
            timelineOptions: {
              editable: false,
              height: '100%',
              start: new Date(Date.now() - 1000 * 60 * 60 * 12),
              end: new Date(Date.now() + 1000 * 60 * 60 * 12),
              moveable: true,
              verticalScroll: true,
              margin: {
                item: 2
              },
              tooltip: {
                followMouse: true
              }
            }
          } as TimelineWidgetOptions,
          data: { smallView: false }
        }
        // {
        //   component: RiskVariables,
        //   options: <any> { x: 0, y: 4, width: 4, height: 5 }
        // },
      ]
    },
    // {
    //   title: 'Risico Editor',
    //   icon: 'assignment',
    //   path: '/:eventid/risks',
    //   layout: 'single',
    //   datasource: 'project',
    //   leftSidebar: {
    //     open: false,
    //     clipped: true
    //   },
    //   widgets: [
    //     {
    //       id: 'riskeditor',
    //       component: AllRiskEditor,
    //       datasource: 'project',
    //       options: {
    //         class: 'data-map-container'
    //       }
    //     }
    //   ]
    // },

    // {
    //   title: 'Programma',
    //   icon: 'assignment',
    //   path: '/agenda',
    //   layout: 'single',
    //   datasource: 'project',
    //   leftSidebar: {
    //     open: false,
    //     clipped: true,
    //     dashboard: {
    //       widgets: []
    //     }
    //   },
    //   footer: { visible: false },
    //   widgets: [
    //     {
    //       id: 'timeline',
    //       component: CsTimeline,
    //       options: { class: 'timeline-widget' },
    //       datasource: 'project',
    //       data: { smallView: false, fullscreen: true, venues: true }
    //     }
    //   ]
    // }
  ]
};
