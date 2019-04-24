import {WidgetBase, AppState} from '@csnext/cs-client';
import './sim-details.css';
import Component from 'vue-class-component';
import Vue from 'vue';

@Component({
  name: 'sim-details',
  template: require('./sim-details.html')
} as any)
export class SimDetails extends WidgetBase {
  public tabs = 'params';
  public title = 'Feature';

  private centerFeature(id: string) {
    console.log('this.$cs.zoomFeatureId is not implemented');
  }

  mounted() {
    console.log(this.widget.data);
    if (this.widget.data && this.widget.data.item && this.widget.data.item.content) {
      this.title = this.widget.data.item.content.name;
    }
  }
}

Vue.filter('json', (value: any) => {
  if (value !== undefined) {
    return JSON.stringify(value, undefined, 2);
  }
});
