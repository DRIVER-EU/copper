
/** Describes kafka topics */
export class Topics {
    /** topic id */
    id: string;
    /** title */
    title: string;
    public tags?: string[];
    /** describes type of messages published on topic */
    type: 'cap' | 'geojson' | 'geojson-external' | 'request-unittransport' | 'entity-item';
    /** offset id to receive older messages  */
    offset?: number;
  }