import Vue from 'vue';
import {CsPlugin, CsApp, AppState} from '@csnext/cs-client';
import {project} from './cscop-project';

// load cs plugin
Vue.use(CsPlugin);

Vue.config.productionTip = false;

let app = AppState.Instance;

new Vue({
  render: h => h(CsApp as any)
}).$mount('#app');

app.init(project);

(<any>window).app = AppState.Instance;
