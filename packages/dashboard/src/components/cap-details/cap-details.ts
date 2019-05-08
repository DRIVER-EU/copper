import { WidgetBase, AppState } from '@csnext/cs-client';
import './cap-details.css';
import Component from 'vue-class-component';
import Vue from 'vue';

@Component({
  name: 'cap-details',
  template: require('./cap-details.html')
} as any)
export class CapDetails extends WidgetBase {

  public tabs = 'params';

  private centerFeature(id: string) {
    console.log('this.$cs.zoomFeatureId is not implemented');
  }
  
  mounted() {
    console.log(this.widget.data);
  }
}


Vue.filter('json', (value: any) => {
  if (value !== undefined) {        
    return JSON.stringify(value,undefined, 2);
  }
});
