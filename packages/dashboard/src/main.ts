import Vue from 'vue';
import { CsPlugin, CsApp } from '@csnext/cs-client';
import { project } from './cscop-project';

// load cs plugin
Vue.use(CsPlugin);

// initialize CsApp component as main app component
let app = new Vue({
  render: h => h(CsApp as any)
}).$mount('#app');

// init cs with driver project definition
app.$cs.init(project);

// for console debugging purposes
(<any>window).cs = app.$cs;

// app.$cs.loadDatasource<MapLayers>('mainmap').then(ml => {
//   if (ml && ml.events) {
//     ml.events.subscribe('drawlayer', (a: string, type: any) => {
//       if (a === 'drawlayer.startdrawing' && type.notification) {
//         AppState.Instance.TriggerNotification({ title: type.notification });
//       }    
//     });
//   }
// });
