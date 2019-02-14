import { WidgetBase, AppState } from '@csnext/cs-client';
import './cap-viewer.css';
import Component from 'vue-class-component';
import { CAPObject } from '@/classes/cap';
import axios from 'axios';
import VuePerfectScrollbar from 'vue-perfect-scrollbar';
import { CapMessage } from '../cap-message/cap-message';

@Component({
  name: 'cap-viewer',
  template: require('./cap-viewer.html'),
  components: { VuePerfectScrollbar}
} as any)
export class CapViewer extends WidgetBase {
  public sortOptions = [];

  public capObjects: CAPObject[] = [];

  public capSelect(object: CAPObject) {
    // this.$cs.TriggerNotification()
    this.$cs.OpenRightSidebarWidget({ component: CapMessage, data: object});
    // console.log(object);
  }

  private fetchCapMessages() {
    axios
      .get('http://localhost:3007/testbed/cap')
      .then(response => {
        // handle success
        if (response.data) {
          (response.data as CAPObject[]).forEach(co => {
            this.capObjects.push(co);
          });
        }        
      })
      .catch(error => {
        // handle error
        console.log(error);
      });
  }

  mounted() {
    // get all cap messages
    this.fetchCapMessages();
    // subscribe
    if (this.$cs.socket) {
      this.$cs.socket.on('cap', (d: CAPObject) => {
        this.capObjects.push(d);
        console.log(d);
      });
    }
  }
}
