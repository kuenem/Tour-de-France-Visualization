export interface DataInterface {
  postCode: number;
  inhabitants: number;
  maleInhabitants: number;
  femaleInhabitants: number;
}

export interface LabeledValue {
  label: string;
  value: number;
}

export interface Department {
  NAME: string;
  CODE: string;
  REGION: string;
  CAPITAL: string;
  AREA_KM2: number;
  POPULATION: number;
  POPULATION_DENSITY_KM2: number;
  NUM_CLIMBS: number;
  TOTAL_LENGTH_KM: number;
  AVG_LENGTH_KM: number;
  AVG_GRADE_PERCENT: number;
  AVG_ALTITUDE_M: number;
  NUM_HC: number;
  NUM_CAT_1: number;
  NUM_CAT_2: number;
  NUM_CAT_3: number;
  NUM_CAT_4: number;
  NUM_STARTS: number;
  NUM_ENDS: number;
  NUM_YELLOW_JERSEY_WINNERS: number;
}