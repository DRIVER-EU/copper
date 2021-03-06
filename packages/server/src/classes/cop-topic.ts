/** Describes kafka topics */
export class Topics {
    /** topic id */
    id: string;
    /** title */
    title: string;
    public tags?: string[];
    /** describes type of messages published on topic */
    type: 'cap' | 'geojson' | 'geojson-external' | 'geojson-data' | 'request-unittransport' | 'request-startinject' | 'entity-item' | 'affected-area';
    /** offset id to receive older messages  */
    offset?: number;
  }