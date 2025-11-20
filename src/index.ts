import { createDistributionCharts } from "./featureChart";
import { createParallelCoordinates } from "./parallelCoordinates";
import { createMapVisualization } from "./mapVisualization";
import { createInteractiveMap } from "./interactiveMap";  
import { DataInterface, Department } from "./types";

let data: DataInterface[];
let departmentData: Department[];

startUp();

const sharedState = {
  highlightedDepartments: new Set<string>(),
  onHighlightChange: (departmentCodes: string[]) => {}
};

async function startUp(): Promise<void> {
  // Wait for the data to be loaded
  departmentData = await loadDepartmentData();
  
  // Create parallel coordinates plot
  createParallelCoordinates(departmentData, "#multivariateVis", sharedState);

  // Create map visualization
  // createMapVisualization(departmentData, "#geoVis");
  createInteractiveMap(departmentData, "#geoVis", sharedState);
}

// Loads the Tour de France department data
async function loadDepartmentData(): Promise<Department[]> {
  try {
    const response: Response = await fetch('./data/departments.csv');
    if (!response.ok) throw new Error('Could not load the data.');
    
    const csvText: string = await response.text();
    const lines: string[] = csvText.trim().split('\n');
    const values: Department[] = [];

    // Start at 1 to skip header row
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      // Handle CSV with commas in values - split carefully
      const cells: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (let char of line) {
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          cells.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      cells.push(current.trim());
      
      // Helper function to parse numbers with spaces (French format)
      const parseNumber = (str: string): number => {
        if (!str || str === '') return 0;
        return parseFloat(str.replace(/\s/g, '').replace(',', '.'));
      };

      const department: Department = {
        NAME: cells[0]?.trim() || '',
        CODE: cells[1]?.trim() || '',
        REGION: cells[2]?.trim() || '',
        CAPITAL: cells[3]?.trim() || '',
        AREA_KM2: parseNumber(cells[4] || '0'),
        POPULATION: parseNumber(cells[5] || '0'),
        POPULATION_DENSITY_KM2: parseNumber(cells[6] || '0'),
        NUM_CLIMBS: parseNumber(cells[7] || '0'),
        TOTAL_LENGTH_KM: parseNumber(cells[8] || '0'),
        AVG_LENGTH_KM: parseNumber(cells[9] || '0'),
        AVG_GRADE_PERCENT: parseNumber(cells[10] || '0'),
        AVG_ALTITUDE_M: parseNumber(cells[11] || '0'),
        NUM_HC: parseNumber(cells[12] || '0'),
        NUM_CAT_1: parseNumber(cells[13] || '0'),
        NUM_CAT_2: parseNumber(cells[14] || '0'),
        NUM_CAT_3: parseNumber(cells[15] || '0'),
        NUM_CAT_4: parseNumber(cells[16] || '0'),
        NUM_STARTS: parseNumber(cells[17] || '0'),
        NUM_ENDS: parseNumber(cells[18] || '0'),
        NUM_YELLOW_JERSEY_WINNERS: parseNumber(cells[19] || '0')
      };

      values.push(department);
    }
    
    return values;
  } catch (error) {
    console.error('Error loading CSV:', error);
    return [];
  }
}