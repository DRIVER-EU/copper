export interface Location {
	latitude: number;
	longitude: number;
	altitude?: null | undefined | number;
}

export interface Orientation {
	yaw: number;
	pitch: number;
	roll: number;
}

export interface Velocity {
	yaw: number;
	pitch: number;
	magnitude: number;
}

export enum ObjectSubType { PROP = 'PROP', TOOL = 'TOOL' };

export interface ObjectType {
	subType: ObjectSubType;
}

export enum PersonSubType { MALE = 'MALE', FEMALE = 'FEMALE', UNKNOWN = 'UNKNOWN' };

export interface PersonType {
	gender: PersonSubType;
}

export enum VehicleSubType { CAR = 'CAR', VAN = 'VAN', TRUCK = 'TRUCK', BOAT = 'BOAT', PLANE = 'PLANE', HELICOPTER = 'HELICOPTER', MOTORCYCLE = 'MOTORCYCLE' };

export interface VehicleType {
	subType: VehicleSubType;
}

export enum EnvironmentSubLabel { FOLIAGE = 'FOLIAGE', ROAD = 'ROAD' };

export interface EnvironmentLabel {
	subLabel: EnvironmentSubLabel;
}

export enum IncidentSubLabel { FIRE = 'FIRE', CRASH = 'CRASH' };

export interface IncidentLabel {
	subLabel: IncidentSubLabel;
}

export enum RescueSubLabel { POLICE = 'POLICE', MEDICAL = 'MEDICAL', FIRE = 'FIRE', SECURITY = 'SECURITY', MILITARY = 'MILITARY' };

export interface RescueLabel {
	subLabel: RescueSubLabel;
}

export interface Item {
	guid: string;
	name: string;
	owner: string;
	location: Location;
	orientation: Orientation;
	velocity: Velocity;
	visibleForParticipant: boolean;
	movable: boolean;
	itemType?: null | undefined | ObjectType | PersonType | VehicleType;
	scenarioLabel?: null | undefined | EnvironmentLabel | IncidentLabel | RescueLabel;
	userTags?: null | undefined | string[];
	physicalConnections?: null | undefined | string[];
	group?: null | undefined | string;
	formation?: null | undefined | string;
	unit?: null | undefined | string;
}
