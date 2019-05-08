import {MessageBusService, Topics} from '@csnext/cs-core';
import {ITimelineDataSource, DataItem} from '@csnext/cs-timeline';
import http from 'axios';
import {ICAPAlert} from '../classes/cap';

const BASE_URL = process.env.COPPER_LAYER_URL ? process.env.COPPER_LAYER_URL : process.env.NODE_ENV !== 'production' ? 'http://localhost:3007' : 'http://cool5.sensorlab.tno.nl:4022';
const CAP_ROUTE = '/testbed/cap';
export const CAP_TOPIC = 'cap';

export class CapDatasource implements ITimelineDataSource {
  // Attributes
  public socket?: SocketIOClient.Socket;
  events: MessageBusService = new MessageBusService();
  capItems: ICAPAlert[] = [];
  timelineItems: DataItem[] = [];
  groupColors: {[key: string]: string} = {};

  constructor() {}

  private async init(): Promise<CapDatasource> {
    return new Promise<CapDatasource>((resolve, reject) => {
      http
        .get<ICAPAlert[]>(`${BASE_URL}${CAP_ROUTE}`)
        .then(response => {
          this.capItems = response.data;
          this.convertCAPAlerts();
          resolve(this);
        })
        .catch(err => reject(err));
    });
  }

  private convertCAPAlerts() {
    this.timelineItems.length = 0;
    this.capItems.forEach(cal => {
      let timelineItem: DataItem = this.convertICAPAlertToTimelineItem(cal);
      this.timelineItems.push(timelineItem);
    });
  }

  private convertICAPAlertToTimelineItem(cap: ICAPAlert): DataItem {
    const color = this.getGroupColor(cap.sender);
    return {
      id: `${cap.identifier}`,
      start: new Date(),
      end: new Date(Date.now() + 1000 * 5 * 60),
      style: `color: white; background-color: ${color};height: 30px; font-size: 16px`,
      group: cap.sender || 'unknown',
      title: cap.info.headline || 'No title',
      content: cap.info.description || ''
    };
  }

  private getGroupColor(sender?: string): string {
      //TODO
    if (!sender) return '#888888';
    return '#cc9999';
  }

  public async getCAPAlerts() {
    return new Promise<ICAPAlert[]>((resolve, reject) => {
      http
        .get<ICAPAlert[]>(`${BASE_URL}${CAP_ROUTE}`)
        .then(response => {
          this.capItems = response.data;
          this.convertCAPAlerts();
          this.events.publish(Topics.TIME_TOPIC, 'update');
          resolve(this.capItems);
        })
        .catch(err => reject(err));
    });
  }

  public addItem(item: DataItem) {
    this.timelineItems.push(item);
    this.events.publish(Topics.TIME_TOPIC, 'added-item', item);
  }

  public removeItem(item: DataItem) {
    const removedItem = this.timelineItems.find(ti => ti.id === item.id);
    if (removedItem) {
      this.timelineItems = this.timelineItems.filter(ti => ti.id != removedItem.id);
      this.events.publish(Topics.TIME_TOPIC, 'deleted', item);
    }
  }

  public async addICAPAlert(cap: ICAPAlert) {
    this.addItem(this.convertICAPAlertToTimelineItem(cap));
    return http.post<ICAPAlert>(`${BASE_URL}${CAP_ROUTE}`, cap);
  }

  public async editICAPAlert(cap: ICAPAlert) {
    return http.put<ICAPAlert>(`${BASE_URL}${CAP_ROUTE}`, cap);
  }

  public async deleteICAPAlert(cap: ICAPAlert) {
    return http.delete(`${BASE_URL}${CAP_ROUTE}/${cap.identifier}`);
  }

  private handleCapEvent(action: string, data: any) {
    switch (action) {
      case 'update':
        this.getCAPAlerts().then(() => {
          this.events.publish(Topics.TIME_TOPIC, 'update');
        });
        break;
      default:
        console.log(`Unknown cap-event: ${action}`);
        break;
    }
  }

  // Operations
  public async execute(): Promise<CapDatasource> {
    return this.init();
  }
}
