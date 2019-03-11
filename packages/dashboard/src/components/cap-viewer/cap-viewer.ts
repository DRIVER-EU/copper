import {WidgetBase, AppState} from '@csnext/cs-client';
import './cap-viewer.css';
import Component from 'vue-class-component';
import {ICAPAlert} from '../../classes/cap';
import {CapMessage} from '../cap-message/cap-message';

import simplebar from 'simplebar-vue';
import {CapDatasource} from '../../shared/CapDatasource';
import {Watch} from 'vue-property-decorator';

@Component({
  name: 'cap-viewer',
  components: {simplebar},
  template: require('./cap-viewer.html')
} as any)
export class CapViewer extends WidgetBase {
  private subscribed?: boolean = false;
  public sortOptions = [];
  public capSource?: CapDatasource;
  public capObjects: ICAPAlert[] = [];

  @Watch('widget.content', {deep: false})
  public contentChanged() {
    this.capSource = this.widget.content as CapDatasource;
    this.subscribeSocket();
    this.getCapItems();
  }
  public capSelect(object: ICAPAlert) {
    // this.$cs.TriggerNotification()
    this.$cs.OpenRightSidebarWidget({component: CapMessage, data: object});
    // console.log(object);
  }

  private subscribeSocket() {
    if (!this.subscribed && this.$cs.socket) {
      this.$cs.socket.on('cap', (d: ICAPAlert) => {
        this.capSource!.addICAPAlert(d);
        console.log(d);
      });
      this.subscribed = true;
    }
  }

  private async getCapItems() {
    if (!this.capSource) return;
    try {
      this.capObjects = await this.capSource.getCAPAlerts();
    } catch (e) {
      console.warn(`Error getting CapObjects: ${e}`);
    }
  }

  mounted() {}
}
