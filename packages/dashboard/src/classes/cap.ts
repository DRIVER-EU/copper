export interface CAPObject {
  properties: any;
  area: any;
}

export interface ICAPAlert {
  identifier: string;
  sender: string;
  sent: string;
  status: string;
  msgType: string;
  scope: string;
  addresses?: string;
  references?: string[];
  info: ICAPInfo;
}

export interface ICAPInfo {
  senderName?: string;
  event: string;
  description?: string;
  category: string;
  severity: string;
  certainty: string;
  urgency: string;
  onset?: string;
  eventCode?: string;
  headline?: string;
  expires?: string;
  responseType?: string;
  instruction?: string;
  area: ICAPArea;
}

export interface ICAPArea {
  areaDesc: string;
  polygon?: Object;
  point?: Object;
}

export function createDefaultCAPMessage(senderId: string): ICAPAlert {
  var alertMsg: ICAPAlert = {
    identifier: senderId,
    sender: senderId,
    sent: convertDateToCAPDate(new Date()), //'2016-03-31T11:33:00+02:00',//(new Date().toISOString()).replace('Z','+02:00'),
    status: 'Test',
    msgType: 'Alert',
    scope: 'Public',
    addresses: '',
    info: {
      category: 'Met',
      event: 'Monitor',
      urgency: 'Immediate',
      severity: 'Severe',
      certainty: 'Observed',
      headline: 'Headline',
      area: {
        areaDesc: 'Testarea'
      }
    }
  };
  return alertMsg;
}

/**
 * Takes a date object, outputs a CAP date string
 */
export function convertDateToCAPDate(date: Date): string {
  if (!date) return 'unknown date';
  var tdiff = date.getTimezoneOffset();
  var tdiffh = Math.floor(Math.abs(tdiff / 60));
  var tdiffm = tdiff % 60;
  var tdiffpm = tdiff <= 0 ? '-' : '+';
  var iso = date
    .toISOString()
    .split('.')
    .shift();
  iso = ''.concat(
    iso || '',
    tdiffpm,
    tdiffh < 10 ? '0' : '',
    tdiffh.toFixed(0),
    ':',
    tdiffm < 10 ? '0' : '',
    tdiffm.toFixed(0)
  );
  console.log(`Converted date to ${iso}`);
  return iso;
}
