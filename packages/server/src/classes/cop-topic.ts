
/** Describes kafka topics */
export class Topics {
    /** topic id */
    id: string;
    /** title */
    title: string;
    /** describes type of messages published on topic */
    type: 'cap' | 'geojson' | 'geojson-external';
    /** offset id to receive older messages  */
    offset?: number;
  }