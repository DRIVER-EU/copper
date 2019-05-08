export interface areaPoly {
	type: string;
	coordinates: number[][][][];
}

export interface AffectedArea {
	id: string;
	area: areaPoly;
	begin: number;
	end: number;
	trafficLightsBroken: boolean;
	restriction: string;
}
