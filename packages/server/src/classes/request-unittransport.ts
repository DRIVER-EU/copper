export interface Location {
	latitude: number;
	longitude: number;
	altitude?: null | undefined | number;
}

export interface RequestUnitTransport {
	guid: string;
	owner: string;
	unit: string;
	destination: string;
	route?: null | undefined | Location[];
}
