import { WidgetBase, AppState } from '@csnext/cs-client';
import './cap-message.css';
import Component from 'vue-class-component';
import Vue from 'vue';

@Component({
  name: 'cap-message',
  template: require('./cap-message.html')
} as any)
export class CapMessage extends WidgetBase {

  
  mounted() {
  
  }
}


Vue.filter('json', (value: any) => {
  if (value !== undefined) {        
    return JSON.stringify(value,undefined, 2);
  }
});
