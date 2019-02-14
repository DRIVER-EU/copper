import { WidgetBase, AppState } from '@csnext/cs-client';
import './scenario-control.css';
import Component from 'vue-class-component';
import Vue from 'vue';

@Component({
  name: 'scenario-control',
  template: require('./scenario-control.html')
} as any)
export class ScenarioControl extends WidgetBase {

  public adapterState: any = {};

  mounted() {
    if (this.$cs.socket) {

      this.$cs.socket.on('time', (d:any) => {
        this.adapterState = d;        
      });
    }
  }
}

Vue.filter('formatTime', (value: number) => {
  if (value !== undefined) {    
    const date = new Date(value);
    return ("0" + date.getHours()).slice(-2) + ":" + ("0" + date.getMinutes()).slice(-2) + ":" + ("0" + date.getSeconds()).slice(-2);
  }
});

Vue.filter('formatDay', (value: number) => {
  if (value !== undefined) {    
    const date = new Date(value);
    return date.getDay() + '/' + date.getMonth() + '/' + date.getFullYear();
  }
});


