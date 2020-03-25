import { WidgetBase } from '@csnext/cs-client';
import './scenario-control.css';
import Component from 'vue-class-component';
import Vue from 'vue';
import { WidgetOptions, TimeDataSource, Topics} from '@csnext/cs-core';

export class ScenarioControlOptions extends WidgetOptions {
  public timesource?: string;
}
@Component({
  name: 'scenario-control',
  template: require('./scenario-control.html')
} as any)
export class ScenarioControl extends WidgetBase {
  public adapterState: any = {};
  public time: TimeDataSource = new TimeDataSource();
  public focus = '';

  mounted() {
    if (
      this.widget.options &&
      this.widget.options.hasOwnProperty('timesource')
    ) {
      this.$cs
        .loadDatasource<TimeDataSource>(
          (this.widget.options as ScenarioControlOptions).timesource!
        )
        .then(t => {
          Vue.set(this, 'time', t);
          this.time.events.subscribe(Topics.TIME_TOPIC, (a: string, d: any) => {
            Vue.nextTick(() => {
              Vue.set(this, 'time', this.time);
              if (this.time.focusTime) {
                this.focus = this.time.focusTime.toString();
              }
            });
          });
        })
        .catch(r => {
          this.time = new TimeDataSource();
        });
    } else {
      this.time = new TimeDataSource();
    }

    if (this.$cs.socket) {
      this.$cs.socket.on('time', (d: any) => {
        this.adapterState = d;
      });
    }
  }
}

Vue.filter('formatTime', (value: number) => {
  if (value !== undefined) {
    const date = new Date(value);
    return (
      ('0' + date.getHours()).slice(-2) +
      ':' +
      ('0' + date.getMinutes()).slice(-2) +
      ':' +
      ('0' + date.getSeconds()).slice(-2)
    );
  }
});

Vue.filter('formatDay', (value: number) => {
  if (value !== undefined) {
    const date = new Date(value);
    return `${date.getDate()} / ${date.getMonth() + 1} / ${date.getFullYear()}`;
  }
});
