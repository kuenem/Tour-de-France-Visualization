import * as d3 from 'd3';
import { Department } from './types';

// ============================================================================
// 1. TYPE DEFINITIONS
// ============================================================================

/**
 * Interface for GeoJSON feature properties
 * Matches the structure of FranceDepartments.json and FranceRegions.json
 */
interface GeoJsonFeature {
  type: string;
  properties: {
    id: string;
    name: string;
    source?: string;
    [key: string]: any;
  };
  geometry: any;
  id?: number;
}

interface GeoJson {
  type: string;
  features: GeoJsonFeature[];
}

// ============================================================================
// 2. MAIN FUNCTION DEFINITION
// ============================================================================

export function createInteractiveMap(
  departmentData: Department[], 
  containerSelector: string, 
  sharedState?: any
): {
  highlightedDepartments: (codes: string[]) => void;
  clearHighlights: () => void;
} {
  const container = d3.select(containerSelector);
  container.html("");

  // ============================================================================
  // 3. SETUP DIMENSIONS AND BASIC ELEMENTS
  // ============================================================================

  const containerNode = container.node() as HTMLElement;
  const width = containerNode ? containerNode.clientWidth : 800;
  const height = 600;
  const margin = { top: 20, right: 20, bottom: 30, left: 40 };

  // Create SVG with zoom capability
  const svg = container.append("svg")
    .attr("width", width)
    .attr("height", height);

  // ============================================================================
  // 4. STATE MANAGEMENT AND CONFIGURATION
  // ============================================================================

  /**
   * Available data fields for visualization with user-friendly labels
   * Only include fields that exist in the Department interface
   */
  const dataFields: { value: keyof Department; label: string }[] = [
    { value: 'POPULATION_DENSITY_KM2', label: 'Population Density' },
    { value: 'POPULATION', label: 'Total Population' },
    { value: 'NUM_CLIMBS', label: 'Number of Climbs' },
    { value: 'TOTAL_LENGTH_KM', label: 'Total Climb Length' },
    { value: 'AVG_GRADE_PERCENT', label: 'Average Grade %' },
    { value: 'AVG_ALTITUDE_M', label: 'Average Altitude' },
    { value: 'NUM_HC', label: 'HC Climbs' },
    { value: 'NUM_CAT_1', label: 'Category 1 Climbs' },
    { value: 'NUM_STARTS', label: 'Tour Starts' },
    { value: 'NUM_ENDS', label: 'Tour Ends' },
    { value: 'NUM_YELLOW_JERSEY_WINNERS', label: 'Yellow Jersey Wins' }
    // Removed TOTAL_APPEARANCES as it's not in the Department interface
  ];

  // Application state
  let currentDataField: keyof Department = 'POPULATION_DENSITY_KM2';
  let useLogScale: boolean = true;
  let currentView: 'regions' | 'departments' = 'regions';
  let selectedRegion: string | null = null;
  let departmentsGeoJson: any = null;
  let regionsGeoJson: any = null;
  let showAllDepartments: boolean = false;
  let showRelativeDistribution: boolean = false;
  let highlightedDepartments = new Set<string>();

  // ============================================================================
  // 5. CONTROL PANEL SETUP
  // ============================================================================

  /**
   * Create interactive controls for data field selection, scaling, and view toggling
   */
  const controls = container.append("div")
    .attr("class", "map-controls")
    .style("margin-bottom", "10px")
    .style("display", "flex")
    .style("flex-wrap", "wrap")
    .style("gap", "15px")
    .style("align-items", "center");

  // Data field selection dropdown
  controls.append("label")
    .style("font-size", "14px")
    .text("Color by: ");

  const dataFieldSelect = controls.append("select")
    .style("padding", "5px")
    .on("change", function() {
      currentDataField = (this as HTMLSelectElement).value as keyof Department;
      if (currentDataField === 'POPULATION' || currentDataField === 'POPULATION_DENSITY_KM2') {
        useLogScale = true;
        d3.select("#logScaleToggle").property("checked", true);
      } else {
        useLogScale = false;
        d3.select("#logScaleToggle").property("checked", false);
      }
      // Update relative distribution checkbox state
      const supportsRelative = supportsRelativeDistribution(currentDataField);
      d3.select("#relativeToggle")
        .property("disabled", !supportsRelative)
        .property("checked", false);
      showRelativeDistribution = false;

      updateVisualization();
    });

  // Populate dropdown with available data fields
  dataFieldSelect.selectAll("option")
    .data(dataFields)
    .enter()
    .append("option")
    .attr("value", d => d.value)
    .text(d => d.label)
    .property("selected", d => d.value === currentDataField);

  // Logarithmic scale toggle - fixed event handler
  const logScaleLabel = controls.append("label")
    .style("display", "flex")
    .style("align-items", "center")
    .style("font-size", "14px");

  logScaleLabel.append("input")
    .attr("type", "checkbox")
    .attr("id", "logScaleToggle")
    .property("checked", useLogScale)
    .style("margin-right", "5px")
    .on("change", function() {
      useLogScale = (this as HTMLInputElement).checked;
      updateVisualization();
    });

  logScaleLabel.append("span")
    .text("Use Logarithmic Scale");

  // Department view toggle - fixed event handler
  const departmentToggleLabel = controls.append("label")
    .style("display", "flex")
    .style("align-items", "center")
    .style("font-size", "14px");

  departmentToggleLabel.append("input")
    .attr("type", "checkbox")
    .attr("id", "departmentToggle")
    .on("change", function() {
      showAllDepartments = (this as HTMLInputElement).checked;
      updateVisualization();
      if (!showAllDepartments) {
        currentView = 'regions';
        renderRegionsView();
      }
    });

  departmentToggleLabel.append("span")
    .text("Show All Departments")
    .style("margin-left", "5px");

  // Relative distribution toggle
  const relativeToggleLabel = controls.append("label")
    .style("display", "flex")
    .style("align-items", "center")
    .style("font-size", "14px");

  const relativeCheckbox = relativeToggleLabel.append("input")
    .attr("type", "checkbox")
    .attr("id", "relativeToggle")
    .property("disabled", false) // Will be updated based on field
    .on("change", function() {
      showRelativeDistribution = (this as HTMLInputElement).checked;
      updateVisualization();
    });

  relativeToggleLabel.append("span")
    .text("Show Relative Distribution")
    .style("margin-left", "5px");

  // ============================================================================
  // 6. DATA STRUCTURES AND TOOLTIP
  // ============================================================================

  const tooltip = d3.select("#tooltip");
  const departmentMap = new Map();
  const regionToDepartmentsMap = new Map<string, Department[]>();

  /**
   * Organize department data by region and create lookup maps
   */
  departmentData.forEach(dept => {
    const cleanCode = dept.CODE.replace('-', '');
    departmentMap.set(cleanCode, dept);
    
    const normalizedRegionName = normalizeRegionName(dept.REGION.trim());
    if (!regionToDepartmentsMap.has(normalizedRegionName)) {
      regionToDepartmentsMap.set(normalizedRegionName, []);
    }
    regionToDepartmentsMap.get(normalizedRegionName)!.push(dept);
  });

  // ============================================================================
  // 7. HELPER FUNCTIONS
  // ============================================================================

  /**
   * Normalizes region names between CSV and GeoJSON formats
   */
  function normalizeRegionName(regionName: string): string {
    const normalizationMap: { [key: string]: string } = {
      'Provence - Alpes - Côte d\'Azur': 'Provence Alpes Côte d\'Azur',
      'Île-de-France': 'Île de France', 
      'Nouvelle-Aquitaine': 'Nouvelle Aquitaine',
      'Auvergne - Rhône - Alpes': 'Auvergne Rhône Alpes',
      'Bourgogne - Franche-Comté [Burgund]': 'Bourgogne Franche Comté',
      'Hauts-de-France': 'Hauts de France',
      'Centre - Val de Loire': 'Centre Val de Loire',
      'Grand Est': 'Grand Est',
      'Occitanie': 'Occitanie',
      'Bretagne': 'Bretagne',
      'Normandie': 'Normandie',
      'Pays de la Loire': 'Pays de la Loire',
      'Corse [Korsika]': 'Corse'
    };
    return normalizationMap[regionName] || regionName;
  }

  /**
   * Calculates relative values (percentages) for the current data field
   */
  function calculateRelativeValues(depts: Department[], field: keyof Department): Map<string, number> {
    const total = depts.reduce((sum, dept) => sum + getNumericValue(dept, field), 0);
    const relativeMap = new Map<string, number>();
    
    depts.forEach(dept => {
      const value = getNumericValue(dept, field);
      const relativeValue = total > 0 ? (value / total) * 100 : 0;
      relativeMap.set(dept.CODE.replace('-', ''), relativeValue);
    });
    
    return relativeMap;
  }

  /**
   * Gets the appropriate value (absolute or relative) for visualization
   */
  function getVisualizationValue(dept: Department, field: keyof Department, useRelative: boolean): number {
    if (useRelative && supportsRelativeDistribution(field)) {
      // For region view, we need to handle this differently - see updated region view code
      return getNumericValue(dept, field); // This will be overridden in region view
    } else {
      return getNumericValue(dept, field);
    }
  }

  /**
   * Determines which fields can show relative distribution
   */
  function supportsRelativeDistribution(field: keyof Department): boolean {
    const relativeFields: (keyof Department)[] = [
      'POPULATION',                   
      'NUM_CLIMBS',           
      'TOTAL_LENGTH_KM',      
      'NUM_HC',               
      'NUM_CAT_1',            
      'NUM_STARTS',           
      'NUM_ENDS',             
      'NUM_YELLOW_JERSEY_WINNERS'
    ];
    return relativeFields.includes(field);
  }

  /**
   * Determines which fields benefit from logarithmic scaling
   * Hardcoded based on data distribution characteristics
   */
  function shouldUseLogScale(field: keyof Department): boolean {
    const logScaleFields: (keyof Department)[] = [
      'POPULATION',           // Large range, exponential distribution
      'POPULATION_DENSITY_KM2', // Often has extreme outliers
      'NUM_CLIMBS',           // Count data with wide variance
      'TOTAL_LENGTH_KM',      // Distance data with large range
      'NUM_HC',               // Rare events benefit from log scale
      'NUM_CAT_1',            // Count data
      'NUM_STARTS',           // Event counts
      'NUM_ENDS',             // Event counts
      'NUM_YELLOW_JERSEY_WINNERS' // Rare achievements
      // Removed TOTAL_APPEARANCES as it's not in the Department interface
    ];
    return logScaleFields.includes(field);
  }

  /**
   * Formats values appropriately based on field type
   */
    function formatValue(value: number, field: keyof Department): string {
      if (isNaN(value) || value <= 0) return 'N/A';
      
      if (showRelativeDistribution && supportsRelativeDistribution(currentDataField)) {
        return value.toFixed(2) + '%';
      } else if (field === 'POPULATION_DENSITY_KM2') {
        return value.toFixed(1) + '/km²';
      } else if (field === 'AVG_GRADE_PERCENT') {
        return value.toFixed(1) + '%';
      } else if (field === 'AVG_ALTITUDE_M') {
        return Math.round(value).toLocaleString() + 'm';
      } else if (field === 'POPULATION') {
        return value.toLocaleString();
      } else {
        return value.toLocaleString();
      }
    }
  // function formatValue(value: number, field: keyof Department): string {
  //   if (isNaN(value) || value <= 0) return 'N/A';
    
  //   if (field === 'POPULATION_DENSITY_KM2') {
  //     return value.toFixed(1) + '/km²';
  //   } else if (field === 'AVG_GRADE_PERCENT') {
  //     return value.toFixed(1) + '%';
  //   } else if (field === 'AVG_ALTITUDE_M') {
  //     return Math.round(value).toLocaleString() + 'm';
  //   } else if (field === 'POPULATION') {
  //     return value.toLocaleString();
  //   } else {
  //     return value.toLocaleString();
  //   }
  // }

  function getFieldLabel(field: keyof Department): string {
    return dataFields.find(f => f.value === field)?.label || field;
  }

  /**
   * Safely gets numeric value from department data
   */
  function getNumericValue(dept: Department, field: keyof Department): number {
    const value = dept[field];
    // Handle both number and string types safely
    if (typeof value === 'number') {
      return value;
    } else if (typeof value === 'string') {
      const num = parseFloat(value);
      return isNaN(num) ? 0 : num;
    }
    return 0;
  }

  /**
   * Updates visualization when controls change
   */
  function updateVisualization() {
    if (showAllDepartments) {
      renderAllDepartmentsView();
    } else if (currentView === 'regions') {
      renderRegionsView();
    } else if (currentView === 'departments' && selectedRegion) {
      const regionFeature = regionsGeoJson.features.find((f: any) => 
        (f.properties.name || f.properties.nom) === selectedRegion
      );
      if (regionFeature) {
        zoomToRegion(selectedRegion, regionFeature);
      }
    }
  }

  // Function to highlight departments
  function highlightDepartments(codes: string[]) {
    highlightedDepartments = new Set(codes);
    updateDepartmentHighlighting();
  }

  /**
   * Updates the visual highlighting of departments
   */
  function updateDepartmentHighlighting() {
    g.selectAll(".department")
      .style("stroke", (d: any) => {
        const deptCode = d.properties.id || d.properties.code;
        return highlightedDepartments.has(deptCode) ? "red" : "#fff";
      })
      .style("stroke-width", (d: any) => {
        const deptCode = d.properties.id || d.properties.code;
        return highlightedDepartments.has(deptCode) ? 3 : 0.5;
      })
      .style("filter", (d: any) => {
        const deptCode = d.properties.id || d.properties.code;
        return highlightedDepartments.has(deptCode) ? "drop-shadow(0 0 8px red)" : "none";
      });
  }

  // Add click handler for manual highlighting
  function addHighlightingInteractions() {
    g.selectAll(".department")
      .on("click", function(event: MouseEvent, d: any) {
        event.stopPropagation();
        const deptCode = d.properties.id || d.properties.code;
        
        if (highlightedDepartments.has(deptCode)) {
          highlightedDepartments.delete(deptCode);
        } else {
          highlightedDepartments.add(deptCode);
        }
        
        updateDepartmentHighlighting();
        
        // Notify other visualizations
        if (sharedState && sharedState.onHighlightChange) {
          sharedState.onHighlightChange(Array.from(highlightedDepartments));
        }
      });
  }

  // ============================================================================
  // 8. GEOGRAPHIC PROJECTION AND ZOOM SETUP
  // ============================================================================

  const projection = d3.geoMercator()
    .center([2.454071, 46.279229]) // Center of France
    .scale(2000)
    .translate([width / 2, height / 2 + 50]);

  const path = d3.geoPath().projection(projection);

  const zoom = d3.zoom()
    .scaleExtent([1, 8])
    .on('zoom', (event) => {
      g.attr('transform', event.transform);
    });

  svg.call(zoom as any);

  const g = svg.append("g");

  // ============================================================================
  // 9. DATA LOADING AND INITIALIZATION
  // ============================================================================

  Promise.all([
    d3.json<any>('./data/FranceRegions.json'),
    d3.json<any>('./data/FranceDepartments.json')
  ]).then(function([regionsGeo, departmentsGeo]) {
    if (!regionsGeo || !departmentsGeo) {
      console.error('Could not load GeoJSON data');
      return;
    }

    regionsGeoJson = regionsGeo;
    departmentsGeoJson = departmentsGeo;

    // Initial render based on current settings
    if (showAllDepartments) {
      renderAllDepartmentsView();
    } else {
      renderRegionsView();
    }

  }).catch(function(error) {
    console.error('Error loading GeoJSON:', error);
  });

  // ============================================================================
  // 10. REGIONS VIEW RENDERING
  // ============================================================================

  function renderRegionsView() {
    currentView = 'regions';
    selectedRegion = null;
    
    // Clear existing content and reset zoom
    g.selectAll("*").remove();
    svg.transition().duration(500).call(zoom.transform as any, d3.zoomIdentity);

    // ============================================================================
    // 10.1 DYNAMIC COLOR SCALE SETUP
    // ============================================================================

    /**
     * Calculate average values per region for the selected data field
     */
    const regionData = new Map();
    const regionValues: number[] = [];
    const relativeRegionData = new Map();

    regionToDepartmentsMap.forEach((depts, regionName) => {
    // //   const totalValue = depts.reduce((sum, dept) => sum + getNumericValue(dept, currentDataField), 0);
    // //   const avgValue = totalValue / depts.length;
    // //   regionData.set(regionName, avgValue);
    // // });
    // if (showRelativeDistribution && supportsRelativeDistribution(currentDataField)) {
    //     // Calculate relative percentage for the region
    //     const regionValue = depts.reduce((sum, dept) => sum + getNumericValue(dept, currentDataField), 0);
    //     const totalValue = departmentData.reduce((sum, dept) => sum + getNumericValue(dept, currentDataField), 0);
    //     const relativeValue = totalValue > 0 ? (regionValue / totalValue) * 100 : 0;
    //     regionData.set(regionName, relativeValue);
    //     relativeRegionData.set(regionName, relativeValue);
    //   } else {
    //     // Original absolute value calculation
    //     const totalValue = depts.reduce((sum, dept) => sum + getNumericValue(dept, currentDataField), 0);
    //     const avgValue = totalValue / depts.length;
    //     regionData.set(regionName, avgValue);
    //   }
    if (showRelativeDistribution && supportsRelativeDistribution(currentDataField)) {
      // Calculate total value for the region (sum of all departments in the region)
      const regionTotal = depts.reduce((sum, dept) => sum + getNumericValue(dept, currentDataField), 0);
      // Calculate country total for normalization
      const countryTotal = departmentData.reduce((sum, dept) => sum + getNumericValue(dept, currentDataField), 0);
      const relativeValue = countryTotal > 0 ? (regionTotal / countryTotal) * 100 : 0;
      regionData.set(regionName, relativeValue);
      regionValues.push(relativeValue);
    } else {
      // Original absolute value calculation (average)
      const totalValue = depts.reduce((sum, dept) => sum + getNumericValue(dept, currentDataField), 0);
      const avgValue = totalValue / depts.length;
      regionData.set(regionName, avgValue);
      regionValues.push(avgValue);
    }
    });

    // const values = Array.from(regionData.values()).filter(v => !isNaN(v) && v > 0) as number[];
    const values = regionValues.filter(v => !isNaN(v) && v >= 0) as number[];

    let colorScale;
    let domain: [number, number];

    if (showRelativeDistribution && supportsRelativeDistribution(currentDataField)) {
      // For relative values, use 0-100% domain with linear scale (log doesn't make sense for percentages)
      domain = [0, Math.max(1, d3.max(values) || 1)]; // Ensure at least 1 to avoid empty scale
      colorScale = d3.scaleSequential(d3.interpolateBlues).domain(domain);
    } else if (useLogScale && shouldUseLogScale(currentDataField)) {
      // Logarithmic scaling for absolute values
      const logValues = values.map(v => Math.log10(v + 1));
      domain = [0, d3.max(logValues) || 1];
      colorScale = d3.scaleSequential(d3.interpolateBlues).domain(domain);
    } else {
      // Linear scaling for absolute values
      domain = [0, d3.max(values) || 1];
      colorScale = d3.scaleSequential(d3.interpolateBlues).domain(domain);
    }

    // if (useLogScale && shouldUseLogScale(currentDataField)) {
    //   // Logarithmic scaling: transform values using log10 with +1 to handle zeros
    //   const logValues = values.map(v => Math.log10(v + 1));
    //   domain = [0, d3.max(logValues) || 1];
    //   colorScale = d3.scaleSequential(d3.interpolateBlues).domain(domain);
    // } else {
    //   // Linear scaling: use values directly
    //   domain = [0, d3.max(values) || 1];
    //   colorScale = d3.scaleSequential(d3.interpolateBlues).domain(domain);
    // }

    // ============================================================================
    // 10.2 REGIONS VISUALIZATION
    // ============================================================================

    g.selectAll(".region")
      .data(regionsGeoJson.features)
      .enter()
      .append("path")
      .attr("class", "region")
      .attr("d", (d: any) => path(d.geometry))
      .attr("fill", (d: any) => {
        const regionName = d.properties.name || d.properties.nom;
        const value = regionData.get(regionName);
        
        if (value === undefined || isNaN(value) || value < 0) return "#ccc";
        
        if (showRelativeDistribution && supportsRelativeDistribution(currentDataField)) {
          // Direct use of percentage value for color
          return colorScale(value);
        } else if (useLogScale && shouldUseLogScale(currentDataField)) {
          return colorScale(Math.log10(value + 1));
        } else {
          return colorScale(value);
        }
      })
      .attr("stroke", "#fff")
      .attr("stroke-width", 1)
      .style("cursor", "pointer")
      .on("mouseover", function(event: MouseEvent, d: any) {
        const regionName = d.properties.name || d.properties.nom;
        const deptsInRegion = regionToDepartmentsMap.get(regionName) || [];
        const value = regionData.get(regionName);
        const fieldLabel = getFieldLabel(currentDataField);

        let tooltipContent = `
          <strong>${regionName}</strong><br/>
          Departments: ${deptsInRegion.length}<br/>
        `;

        if (showRelativeDistribution && supportsRelativeDistribution(currentDataField)) {
          tooltipContent += `Share of ${fieldLabel}: ${value !== undefined ? value.toFixed(2) + '%' : 'N/A'}<br/>`;
          // Add absolute value for context
          const regionTotal = deptsInRegion.reduce((sum, dept) => sum + getNumericValue(dept, currentDataField), 0);
          tooltipContent += `Total ${fieldLabel}: ${formatValue(regionTotal, currentDataField)}<br/>`;
        } else {
          tooltipContent += `Avg. ${fieldLabel}: ${value !== undefined ? formatValue(value, currentDataField) : 'N/A'}<br/>`;
        }
        
        tooltipContent += `<em>Click to zoom in</em>`;
        
        tooltip.style("display", "block").html(tooltipContent);
      })
      .on("mousemove", function(event: MouseEvent) {
        tooltip.style("left", (event.pageX + 10) + "px")
              .style("top", (event.pageY - 10) + "px");
      })
      .on("mouseout", function() {
        tooltip.style("display", "none");
      })
      .on("click", function(event: MouseEvent, d: any) {
        event.stopPropagation();
        const regionName = d.properties.name || d.properties.nom;
        zoomToRegion(regionName, d);
      });

    // g.selectAll(".region")
    //   .data(regionsGeoJson.features)
    //   .enter()
    //   .append("path")
    //   .attr("class", "region")
    //   .attr("d", (d: any) => path(d.geometry))
    //   .attr("fill", (d: any) => {
    //     const regionName = d.properties.name || d.properties.nom;
    //     const avgValue = regionData.get(regionName);
    //     if (!avgValue || isNaN(avgValue) || avgValue <= 0) return "#ccc";
        
    //     // Apply logarithmic transformation if enabled
    //     if (useLogScale && shouldUseLogScale(currentDataField)) {
    //       return colorScale(Math.log10(avgValue + 1));
    //     } else {
    //       return colorScale(avgValue);
    //     }
    //   })
    //   .attr("stroke", "#fff")
    //   .attr("stroke-width", 1)
    //   .style("cursor", "pointer")
    //   .on("mouseover", function(event: MouseEvent, d: any) {
    //     const regionName = d.properties.name || d.properties.nom;
    //     const deptsInRegion = regionToDepartmentsMap.get(regionName) || [];
    //     const avgValue = regionData.get(regionName);
    //     const fieldLabel = getFieldLabel(currentDataField);

    //     tooltip.style("display", "block")
    //       .html(`
    //         <strong>${regionName}</strong><br/>
    //         Departments: ${deptsInRegion.length}<br/>
    //         ${showRelativeDistribution && supportsRelativeDistribution(currentDataField) 
    //           ? `Share of ${fieldLabel}: ${avgValue ? avgValue.toFixed(2) + '%' : 'N/A'}<br/>`
    //           : `Avg. ${fieldLabel}: ${avgValue ? formatValue(avgValue, currentDataField) : 'N/A'}<br/>`
    //         }
    //         <em>Click to zoom in</em>
    //       `);
        
    //     // tooltip.style("display", "block")
    //     //   .html(`
    //     //     <strong>${regionName}</strong><br/>
    //     //     Departments: ${deptsInRegion.length}<br/>
    //     //     Avg. ${fieldLabel}: ${avgValue ? formatValue(avgValue, currentDataField) : 'N/A'}<br/>
    //     //     <em>Click to zoom in</em>
    //     //   `);
    //   })
    //   .on("mousemove", function(event: MouseEvent) {
    //     tooltip.style("left", (event.pageX + 10) + "px")
    //            .style("top", (event.pageY - 10) + "px");
    //   })
    //   .on("mouseout", function() {
    //     tooltip.style("display", "none");
    //   })
    //   .on("click", function(event: MouseEvent, d: any) {
    //     event.stopPropagation();
    //     const regionName = d.properties.name || d.properties.nom;
    //     zoomToRegion(regionName, d);
    //   });

    // ============================================================================
    // 10.3 REGION LABELS AND TITLES
    // ============================================================================

    g.selectAll(".region-label")
      .data(regionsGeoJson.features)
      .enter()
      .append("text")
      .attr("class", "region-label")
      .attr("transform", (d: any) => {
        const centroid = path.centroid(d.geometry);
        return `translate(${centroid[0]}, ${centroid[1]})`;
      })
      .attr("text-anchor", "middle")
      .attr("dy", "0.35em")
      .style("font-size", "10px")
      .style("font-weight", "bold")
      .style("fill", "#333")
      .style("pointer-events", "none")
      .style("text-shadow", "1px 1px 2px white, -1px -1px 2px white, 1px -1px 2px white, -1px 1px 2px white")
      .text((d: any) => d.properties.name || d.properties.nom);

    const fieldLabel = getFieldLabel(currentDataField);
    const scaleType = useLogScale && shouldUseLogScale(currentDataField) ? " (Log Scale)" : "";
    const relativeType = showRelativeDistribution && supportsRelativeDistribution(currentDataField) ? " (Relative %)" : "";

    g.append("text")
      .attr("x", width / 2)
      .attr("y", margin.top)
      .attr("text-anchor", "middle")
      .style("font-size", "16px")
      .style("font-weight", "bold")
      // .text(`France Regions - Click to Zoom (Avg. ${fieldLabel}${scaleType})`);
      .text(`France Regions - Click to Zoom (${showRelativeDistribution && supportsRelativeDistribution(currentDataField) ? 'Share of ' : 'Avg. '}${fieldLabel}${scaleType}${relativeType}${relativeType})`);

    addLegend(colorScale, `Avg. ${fieldLabel}${scaleType}`);

    setTimeout(() => {
      addHighlightingInteractions();
      updateDepartmentHighlighting();
    }, 100);
  }

  // ============================================================================
  // 11. ZOOMED REGION VIEW (DEPARTMENTS)
  // ============================================================================

  function zoomToRegion(regionName: string, regionFeature: any) {
    selectedRegion = regionName;
    currentView = 'departments';
    g.selectAll("*").remove();

    // ============================================================================
    // 11.1 ZOOM CALCULATION AND APPLICATION
    // ============================================================================

    const bounds = path.bounds(regionFeature.geometry);
    const dx = bounds[1][0] - bounds[0][0];
    const dy = bounds[1][1] - bounds[0][1];
    const x = (bounds[0][0] + bounds[1][0]) / 2;
    const y = (bounds[0][1] + bounds[1][1]) / 2;
    const scale = Math.max(1, Math.min(8, 0.9 / Math.max(dx / width, dy / height)));
    const translate = [width / 2 - scale * x, height / 2 - scale * y];

    svg.transition().duration(750).call(
      zoom.transform as any,
      d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale)
    );

    // ============================================================================
    // 11.2 DYNAMIC COLOR SCALE FOR DEPARTMENTS
    // ============================================================================

    const values = departmentData.map(d => getNumericValue(d, currentDataField)).filter(v => !isNaN(v) && v > 0);
    
    let colorScale;
    let domain: [number, number];

    if (useLogScale && shouldUseLogScale(currentDataField)) {
      const logValues = values.map(v => Math.log10(v + 1));
      domain = [0, d3.max(logValues) || 1];
      colorScale = d3.scaleSequential(d3.interpolateBlues).domain(domain);
    } else {
      domain = [0, d3.max(values) || 1];
      colorScale = d3.scaleSequential(d3.interpolateBlues).domain(domain);
    }

    // ============================================================================
    // 11.3 DEPARTMENTS VISUALIZATION WITH OPACITY
    // ============================================================================

    const deptsInRegion = regionToDepartmentsMap.get(regionName) || [];
    const regionDeptCodes = new Set(deptsInRegion.map(d => d.CODE.replace('-', '')));

    g.selectAll(".department")
      .data(departmentsGeoJson.features)
      .enter()
      .append("path")
      .attr("class", "department")
      .attr("d", (d: any) => path(d.geometry))
      .attr("fill", (d: any) => {
        const deptCode = d.properties.id || d.properties.code;
        const deptData = departmentMap.get(deptCode);
        if (!deptData) return "#ccc";
        
        const value = getNumericValue(deptData, currentDataField);
        if (isNaN(value) || value <= 0) return "#ccc";
        
        if (useLogScale && shouldUseLogScale(currentDataField)) {
          return colorScale(Math.log10(value + 1));
        } else {
          return colorScale(value);
        }
      })
      .attr("stroke", "#fff")
      .attr("stroke-width", 0.5)
      .style("opacity", (d: any) => {
        const deptCode = d.properties.id || d.properties.code;
        return regionDeptCodes.has(deptCode) ? 1 : 0.3;
      })
      .on("mouseover", function(event: MouseEvent, d: any) {
        const deptCode = d.properties.id || d.properties.code;
        const deptData = departmentMap.get(deptCode);
        let deptRegionName = '';

        if (deptData) {
          deptRegionName = normalizeRegionName(deptData.REGION);
        }
        
        const fieldLabel = getFieldLabel(currentDataField);
        const value = deptData ? getNumericValue(deptData, currentDataField) : 0;
        
        tooltip.style("display", "block")
          .html(`
            <strong>${d.properties.name || d.properties.nom}</strong><br/>
            ${deptData ? `
              Region: ${deptData.REGION}<br/>
              ${fieldLabel}: ${formatValue(value, currentDataField)}<br/>
              Population: ${deptData.POPULATION.toLocaleString()}<br/>
              Climbs: ${deptData.NUM_CLIMBS}
              ${deptRegionName !== selectedRegion ? '<br/><em>Click to switch to this region</em>' : ''}
            ` : 'No data available'}
          `);
      })
      .on("mousemove", function(event: MouseEvent) {
        tooltip.style("left", (event.pageX + 10) + "px")
               .style("top", (event.pageY - 10) + "px");
      })
      .on("mouseout", function() {
        tooltip.style("display", "none");
      })
      .on("click", function(event: MouseEvent, d: any) {
        event.stopPropagation();
        const deptCode = d.properties.id || d.properties.code;
        const deptData = departmentMap.get(deptCode);
        
        if (deptData) {
          const deptRegionName = normalizeRegionName(deptData.REGION);
          if (deptRegionName !== selectedRegion) {
            const regionFeature = regionsGeoJson.features.find((f: any) => 
              (f.properties.name || f.properties.nom) === deptRegionName
            );
            if (regionFeature) {
              zoomToRegion(deptRegionName, regionFeature);
              return;
            }
          }
        }    
      });

    // ============================================================================
    // 11.4 DEPARTMENT LABELS AND NAVIGATION
    // ============================================================================

    g.selectAll(".department-label")
      .data(departmentsGeoJson.features)
      .enter()
      .append("text")
      .attr("class", "department-label")
      .attr("transform", (d: any) => {
        const centroid = path.centroid(d.geometry);
        return `translate(${centroid[0]}, ${centroid[1]})`;
      })
      .attr("text-anchor", "middle")
      .attr("dy", "0.35em")
      .style("font-size", "7px")
      .style("font-weight", "bold")
      .style("fill", "#333")
      .style("pointer-events", "none")
      .style("text-shadow", "1px 1px 2px white, -1px -1px 2px white, 1px -1px 2px white, -1px 1px 2px white")
      .style("opacity", (d: any) => {
        const deptCode = d.properties.id || d.properties.code;
        return regionDeptCodes.has(deptCode) ? 1 : 0.3;
      })
      .text((d: any) => d.properties.name || d.properties.nom);

    const fieldLabel = getFieldLabel(currentDataField);
    const scaleType = useLogScale && shouldUseLogScale(currentDataField) ? " (Log Scale)" : "";

    g.append("text")
      .attr("x", width / 2)
      .attr("y", margin.top)
      .attr("text-anchor", "middle")
      .style("font-size", "16px")
      .style("font-weight", "bold")
      .style("cursor", "pointer")
      .style("text-decoration", "underline")
      .text(`Region: ${regionName} - ${fieldLabel}${scaleType} - Click background to zoom out`)
      .on("click", renderRegionsView);

    addLegend(colorScale, `${fieldLabel}${scaleType}`);
    setTimeout(() => {
      addHighlightingInteractions();
      updateDepartmentHighlighting();
    }, 100);  
  }

  // ============================================================================
  // 12. ALL DEPARTMENTS VIEW
  // ============================================================================

  function renderAllDepartmentsView() {
    currentView = 'departments';
    selectedRegion = null;
    g.selectAll("*").remove();
    svg.transition().duration(500).call(zoom.transform as any, d3.zoomIdentity);

    // ============================================================================
    // 12.1 COLOR SCALE FOR ALL DEPARTMENTS
    // ============================================================================

    const values = departmentData.map(d => getNumericValue(d, currentDataField)).filter(v => !isNaN(v) && v > 0);
    
    let colorScale;
    let domain: [number, number];

    if (useLogScale && shouldUseLogScale(currentDataField)) {
      const logValues = values.map(v => Math.log10(v + 1));
      domain = [0, d3.max(logValues) || 1];
      colorScale = d3.scaleSequential(d3.interpolateBlues).domain(domain);
    } else {
      domain = [0, d3.max(values) || 1];
      colorScale = d3.scaleSequential(d3.interpolateBlues).domain(domain);
    }

    // ============================================================================
    // 12.2 ALL DEPARTMENTS VISUALIZATION
    // ============================================================================

    g.selectAll(".department")
      .data(departmentsGeoJson.features)
      .enter()
      .append("path")
      .attr("class", "department")
      .attr("d", (d: any) => path(d.geometry))
      .attr("fill", (d: any) => {
        const deptCode = d.properties.id || d.properties.code;
        const deptData = departmentMap.get(deptCode);
        if (!deptData) return "#ccc";
        
        const value = getNumericValue(deptData, currentDataField);
        if (isNaN(value) || value <= 0) return "#ccc";
        
        if (useLogScale && shouldUseLogScale(currentDataField)) {
          return colorScale(Math.log10(value + 1));
        } else {
          return colorScale(value);
        }
      })
      .attr("stroke", "#fff")
      .attr("stroke-width", 0.5)
      .style("opacity", 1)
      .style("cursor", "pointer")
      .on("mouseover", function(event: MouseEvent, d: any) {
        const deptCode = d.properties.id || d.properties.code;
        const deptData = departmentMap.get(deptCode);
        const fieldLabel = getFieldLabel(currentDataField);
        const value = deptData ? getNumericValue(deptData, currentDataField) : 0;
        
        tooltip.style("display", "block")
          .html(`
            <strong>${d.properties.name || d.properties.nom}</strong><br/>
            ${deptData ? `
              Region: ${deptData.REGION}<br/>
              ${fieldLabel}: ${formatValue(value, currentDataField)}<br/>
              Population: ${deptData.POPULATION.toLocaleString()}<br/>
              Climbs: ${deptData.NUM_CLIMBS}<br/>
              <em>Click to zoom to region</em>
            ` : 'No data available'}
          `);
      })
      .on("mousemove", function(event: MouseEvent) {
        tooltip.style("left", (event.pageX + 10) + "px")
               .style("top", (event.pageY - 10) + "px");
      })
      .on("mouseout", function() {
        tooltip.style("display", "none");
      })
      .on("click", function(event: MouseEvent, d: any) {
        event.stopPropagation();
        const deptCode = d.properties.id || d.properties.code;
        const deptData = departmentMap.get(deptCode);
        if (deptData) {
          const regionName = normalizeRegionName(deptData.REGION);
          const regionFeature = regionsGeoJson.features.find((f: any) => 
            (f.properties.name || f.properties.nom) === regionName
          );
          if (regionFeature) {
            zoomToRegion(regionName, regionFeature);
          }
        }
        
      });

    // ============================================================================
    // 12.3 LABELS AND TITLES FOR ALL DEPARTMENTS
    // ============================================================================

    g.selectAll(".department-label")
      .data(departmentsGeoJson.features)
      .enter()
      .append("text")
      .attr("class", "department-label")
      .attr("transform", (d: any) => {
        const centroid = path.centroid(d.geometry);
        return `translate(${centroid[0]}, ${centroid[1]})`;
      })
      .attr("text-anchor", "middle")
      .attr("dy", "0.35em")
      .style("font-size", "7px")
      .style("font-weight", "bold")
      .style("fill", "#333")
      .style("pointer-events", "none")
      .style("text-shadow", "1px 1px 2px white, -1px -1px 2px white, 1px -1px 2px white, -1px 1px 2px white")
      .text((d: any) => d.properties.name || d.properties.nom);

    const fieldLabel = getFieldLabel(currentDataField);
    const scaleType = useLogScale && shouldUseLogScale(currentDataField) ? " (Log Scale)" : "";

    g.append("text")
      .attr("x", width / 2)
      .attr("y", margin.top)
      .attr("text-anchor", "middle")
      .style("font-size", "16px")
      .style("font-weight", "bold")
      .text(`All French Departments - ${fieldLabel}${scaleType} - Click any department to zoom to its region`);

    addLegend(colorScale, `${fieldLabel}${scaleType}`);

    setTimeout(() => {
      addHighlightingInteractions();
      updateDepartmentHighlighting();
    }, 100);
  }

  // ============================================================================
  // 13. DYNAMIC LEGEND FUNCTION
  // ============================================================================

  /**
   * Creates a dynamic legend that adapts to linear or logarithmic scaling
   */
  function addLegend(colorScale: d3.ScaleSequential<string, never>, title: string) {
    const legendWidth = 200;
    const legendHeight = 20;

    const legendSvg = g.append("g")
      .attr("transform", `translate(${width - legendWidth - 50}, ${height - 100})`);

    // ============================================================================
    // 13.1 DYNAMIC SCALE SELECTION
    // ============================================================================

    const legendDomain = colorScale.domain();
    const maxDomain = legendDomain[1] as number;
    let legendScale, legendAxis;
    
    if (showRelativeDistribution && supportsRelativeDistribution(currentDataField)) {
      // For relative values, use percentage scale
      legendScale = d3.scaleLinear().domain([0, maxDomain]).range([0, legendWidth]);
      legendAxis = d3.axisBottom(legendScale).ticks(5).tickFormat(d => d + '%');
    } else if (useLogScale && shouldUseLogScale(currentDataField)) {
      legendScale = d3.scaleLog().domain([1, Math.pow(10, maxDomain)]).range([0, legendWidth]);
      legendAxis = d3.axisBottom(legendScale).ticks(4, ".1s");
    } else {
      legendScale = d3.scaleLinear().domain(legendDomain).range([0, legendWidth]);
      legendAxis = d3.axisBottom(legendScale).ticks(5);
    }
    // const legendScale = useLogScale && shouldUseLogScale(currentDataField) 
    //   ? d3.scaleLog().domain([1, Math.pow(10, maxDomain)]).range([0, legendWidth])
    //   : d3.scaleLinear().domain(legendDomain).range([0, legendWidth]);

    // const legendAxis = useLogScale && shouldUseLogScale(currentDataField)
    //   ? d3.axisBottom(legendScale).ticks(4, ".1s") // Logarithmic ticks
    //   : d3.axisBottom(legendScale).ticks(5);       // Linear ticks

    // ============================================================================
    // 13.2 GRADIENT CREATION
    // ============================================================================

    const defs = svg.append("defs");
    const gradient = defs.append("linearGradient")
      .attr("id", "legend-gradient")
      .attr("x1", "0%")
      .attr("x2", "100%")
      .attr("y1", "0%")
      .attr("y2", "0%");

    const stops = d3.range(0, 1.01, 0.1);
    gradient.selectAll("stop")
      .data(stops)
      .enter()
      .append("stop")
      .attr("offset", (d: number) => `${d * 100}%`)
      .attr("stop-color", (d: number) => {
        if (useLogScale && shouldUseLogScale(currentDataField)) {
          return colorScale(d * maxDomain);
        } else {
          return colorScale(d * maxDomain);
        }
      });

    // ============================================================================
    // 13.3 LEGEND RENDERING
    // ============================================================================

    legendSvg.append("rect")
      .attr("width", legendWidth)
      .attr("height", legendHeight)
      .style("fill", "url(#legend-gradient)");

    legendSvg.append("g")
      .attr("transform", `translate(0, ${legendHeight})`)
      .call(legendAxis);

    legendSvg.append("text")
      .attr("x", legendWidth / 2)
      .attr("y", -5)
      .attr("text-anchor", "middle")
      .style("font-size", "12px")
      .style("font-weight", "bold")
      .text(title);
  }

  // ============================================================================
  // 14. INTERACTION HANDLERS
  // ============================================================================

  /**
   * Background click handler for zooming out
   */
  svg.on("click", function(event: MouseEvent) {
    if (currentView === 'departments' && event.target === this) {
      renderRegionsView();
    }
    });

  // ============================================================================
  // 14. INTERACTION HANDLERS
  // ============================================================================


    // Listen to external highlight changes
  if (sharedState) {
    sharedState.onHighlightChange = (codes: string[]) => {
      highlightDepartments(codes);
    };
  }

  // Return functions for external control
  return {
    highlightedDepartments: highlightDepartments,
    clearHighlights: () => {
      highlightedDepartments.clear();
      updateDepartmentHighlighting();
    }
  };
}