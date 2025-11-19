import * as d3 from 'd3';
import { Department } from './types';

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

export function createInteractiveMap(departmentData: Department[], containerSelector: string): void {
  const container = d3.select(containerSelector);
  container.html("");

  const containerNode = container.node() as HTMLElement;
  const width = containerNode ? containerNode.clientWidth : 800;
  const height = 600;
  const margin = { top: 20, right: 20, bottom: 30, left: 40 };

  // Create SVG with zoom capability
  const svg = container.append("svg")
    .attr("width", width)
    .attr("height", height);

    // Create control panel
    const controls = container.append("div")
    .attr("class", "map-controls")
    .style("margin-bottom", "10px")
    .style("display", "flex")
    .style("gap", "10px")
    .style("align-items", "center");

    // Add toggle switch for department view
    controls.append("label")
    .style("display", "flex")
    .style("align-items", "center")
    .style("font-size", "14px")
    .html(`
        <input type="checkbox" id="departmentToggle">
        Show All Departments
    `);

    // Add event listener for the toggle
    controls.select("input")
    .on("change", function() {
        showAllDepartments = (this as HTMLInputElement).checked;
        if (showAllDepartments) {
        renderAllDepartmentsView();
        } else {
        renderRegionsView();
        }
    });

  // Create tooltip
  const tooltip = d3.select("#tooltip");

  // State management
  let currentView: 'regions' | 'departments' = 'regions';
  let selectedRegion: string | null = null;
  let departmentsGeoJson: any = null;
  let regionsGeoJson: any = null;
  let showAllDepartments: boolean = false;

  // Create a map from department code to department data
  const departmentMap = new Map();
  const regionToDepartmentsMap = new Map<string, Department[]>();
  
  // Organize departments by region
  departmentData.forEach(dept => {
    const cleanCode = dept.CODE.replace('-', '');
    departmentMap.set(cleanCode, dept);
    
    const normalizedRegionName = normalizeRegionName(dept.REGION.trim());
    if (!regionToDepartmentsMap.has(normalizedRegionName)) {
      regionToDepartmentsMap.set(normalizedRegionName, []);
    }
    regionToDepartmentsMap.get(normalizedRegionName)!.push(dept);
  });

  function normalizeRegionName(regionName: string): string {
    const normalizationMap: { [key: string]: string } = {
        'Provence - Alpes - Côte d\'Azur': 'Provence Alpes Côte d\'Azur',
        'Île-de-France': 'Île de France', 
        'Nouvelle-Aquitaine': 'Nouvelle Aquitaine',
        'Auvergne - Rhône - Alpes': 'Auvergne Rhône Alpes',
        'Bourgogne - Franche-Comté [Burgund]': 'Bourgogne Franche Comté',
        'Hauts-de-France': 'Hauts de France',
        'Centre - Val de Loire': 'Centre Val de Loire',
        'Grand Est': 'Grand Est', // Keep same if no change
        'Occitanie': 'Occitanie', // Keep same if no change
        'Bretagne': 'Bretagne',   // Keep same if no change
        'Normandie': 'Normandie', // Keep same if no change
        'Pays de la Loire': 'Pays de la Loire', // Keep same if no change
        'Corse [Korsika]': 'Corse' // Handle Corse specially
    };
    
    // Return normalized name or original if no mapping found
    return normalizationMap[regionName] || regionName;
  }

  // Create projection for France
  const projection = d3.geoMercator()
    .center([2.454071, 46.279229])
    .scale(2500)
    .translate([width / 2, height / 2]);

  const path = d3.geoPath().projection(projection);

  // Zoom behavior
  const zoom = d3.zoom()
    .scaleExtent([1, 8])
    .on('zoom', (event) => {
      g.attr('transform', event.transform);
    });

  svg.call(zoom as any);

  // Main group for all map elements
  const g = svg.append("g");

  // Load both GeoJSON files
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

    // Initial render - show regions
    if (showAllDepartments) {
        renderAllDepartmentsView();
    } else {
        renderRegionsView();
    }

  }).catch(function(error) {
    console.error('Error loading GeoJSON:', error);
  });

  function renderRegionsView() {
    currentView = 'regions';
    selectedRegion = null;
    
    // Clear existing content
    g.selectAll("*").remove();

    // Reset zoom
    svg.transition().duration(500).call(
      zoom.transform as any,
      d3.zoomIdentity
    );

    const dataField: keyof Department = 'POPULATION_DENSITY_KM2';
    
    // Calculate average density per region
    const regionData = new Map();
    regionToDepartmentsMap.forEach((depts, regionName) => {
      const avgDensity = depts.reduce((sum, dept) => sum + dept[dataField], 0) / depts.length;
      regionData.set(regionName, avgDensity);
    });

    const values = Array.from(regionData.values()).filter(v => !isNaN(v)) as number[];
    const colorScale = d3.scaleSequential(d3.interpolateBlues)
      .domain([0, d3.max(values) || 1]);

    // Draw regions
    g.selectAll(".region")
      .data(regionsGeoJson.features)
      .enter()
      .append("path")
      .attr("class", "region")
      .attr("d", (d: any) => path(d.geometry))
      .attr("fill", (d: any) => {
        const regionName = d.properties.name || d.properties.nom;
        const avgDensity = regionData.get(regionName);
        return avgDensity && !isNaN(avgDensity) ? colorScale(avgDensity) : "#ccc";
      })
      .attr("stroke", "#fff")
      .attr("stroke-width", 1)
      .style("cursor", "pointer")
      .on("mouseover", function(event: MouseEvent, d: any) {
        const regionName = d.properties.name || d.properties.nom;
        const deptsInRegion = regionToDepartmentsMap.get(regionName) || [];
        const avgDensity = regionData.get(regionName);
        
        tooltip.style("display", "block")
          .html(`
            <strong>${regionName}</strong><br/>
            Departments: ${deptsInRegion.length}<br/>
            Avg. Density: ${avgDensity ? avgDensity.toFixed(1) + '/km²' : 'N/A'}<br/>
            <em>Click to zoom in</em>
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
        const regionName = d.properties.name || d.properties.nom;
        zoomToRegion(regionName, d);
      });

    // Add region labels
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

    // Add title
    g.append("text")
      .attr("x", width / 2)
      .attr("y", margin.top)
      .attr("text-anchor", "middle")
      .style("font-size", "16px")
      .style("font-weight", "bold")
      .text("France Regions - Click to Zoom (Avg. Population Density)");

    addLegend(colorScale, "Avg. Population Density (/km²)");
  }

  function zoomToRegion(regionName: string, regionFeature: any) {
    selectedRegion = regionName;
    currentView = 'departments';

    // Clear existing content
    g.selectAll("*").remove();

    // Calculate bounds for the selected region
    const bounds = path.bounds(regionFeature.geometry);
    const dx = bounds[1][0] - bounds[0][0];
    const dy = bounds[1][1] - bounds[0][1];
    const x = (bounds[0][0] + bounds[1][0]) / 2;
    const y = (bounds[0][1] + bounds[1][1]) / 2;
    const scale = Math.max(1, Math.min(8, 0.9 / Math.max(dx / width, dy / height)));
    const translate = [width / 2 - scale * x, height / 2 - scale * y];

    // Apply zoom transformation
    svg.transition().duration(750).call(
      zoom.transform as any,
      d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale)
    );

    const dataField: keyof Department = 'POPULATION_DENSITY_KM2';
    const values = departmentData.map(d => d[dataField]).filter(v => !isNaN(v)) as number[];
    const colorScale = d3.scaleSequential(d3.interpolateBlues)
      .domain([0, d3.max(values) || 1]);

    // Get departments in this region
    const deptsInRegion = regionToDepartmentsMap.get(regionName) || [];
    const regionDeptCodes = new Set(deptsInRegion.map(d => d.CODE.replace('-', '')));

    // Draw all departments with different opacity based on region
    g.selectAll(".department")
      .data(departmentsGeoJson.features)
      .enter()
      .append("path")
      .attr("class", "department")
      .attr("d", (d: any) => path(d.geometry))
      .attr("fill", (d: any) => {
        const deptCode = d.properties.id || d.properties.code;
        const deptData = departmentMap.get(deptCode);
        return deptData && !isNaN(deptData[dataField]) ? colorScale(deptData[dataField]) : "#ccc";
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
        
        tooltip.style("display", "block")
          .html(`
            <strong>${d.properties.name || d.properties.nom}</strong><br/>
            ${deptData ? `
              Region: ${deptData.REGION}<br/>
              Population: ${deptData.POPULATION.toLocaleString()}<br/>
              Density: ${deptData.POPULATION_DENSITY_KM2.toFixed(1)}/km²<br/>
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
        event.stopPropagation(); // Prevent triggering background click
        
        const deptCode = d.properties.id || d.properties.code;
        const deptData = departmentMap.get(deptCode);
        
        if (deptData) {
        const deptRegionName = normalizeRegionName(deptData.REGION);
        
        // If clicking a department from a different region, zoom to that region
        if (deptRegionName !== selectedRegion) {
            const regionFeature = regionsGeoJson.features.find((f: any) => 
            (f.properties.name || f.properties.nom) === deptRegionName
            );
            if (regionFeature) {
            zoomToRegion(deptRegionName, regionFeature);
            return; // Exit early since we're changing views
            }
        }
        }
     });

    // Add department labels (only for selected region)
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

    // Add back button and title
    g.append("text")
      .attr("x", width / 2)
      .attr("y", margin.top)
      .attr("text-anchor", "middle")
      .style("font-size", "16px")
      .style("font-weight", "bold")
      .style("cursor", "pointer")
      .style("text-decoration", "underline")
      .text(`Region: ${regionName} - Click map background to zoom out`)
      .on("click", renderRegionsView);

    addLegend(colorScale, "Population Density (/km²)");
  }

  function renderAllDepartmentsView() {
    currentView = 'departments';
    selectedRegion = null;
    
    // Clear existing content
    g.selectAll("*").remove();

    // Reset zoom to show all of France
    svg.transition().duration(500).call(
        zoom.transform as any,
        d3.zoomIdentity
    );

    const dataField: keyof Department = 'POPULATION_DENSITY_KM2';
    const values = departmentData.map(d => d[dataField]).filter(v => !isNaN(v)) as number[];
    const colorScale = d3.scaleSequential(d3.interpolateBlues)
        .domain([0, d3.max(values) || 1]);

    // Draw all departments with full opacity
    g.selectAll(".department")
        .data(departmentsGeoJson.features)
        .enter()
        .append("path")
        .attr("class", "department")
        .attr("d", (d: any) => path(d.geometry))
        .attr("fill", (d: any) => {
        const deptCode = d.properties.id || d.properties.code;
        const deptData = departmentMap.get(deptCode);
        return deptData && !isNaN(deptData[dataField]) ? colorScale(deptData[dataField]) : "#ccc";
        })
        .attr("stroke", "#fff")
        .attr("stroke-width", 0.5)
        .style("opacity", 1) // All departments fully visible
        .style("cursor", "pointer")
        .on("mouseover", function(event: MouseEvent, d: any) {
        const deptCode = d.properties.id || d.properties.code;
        const deptData = departmentMap.get(deptCode);
        
        tooltip.style("display", "block")
            .html(`
            <strong>${d.properties.name || d.properties.nom}</strong><br/>
            ${deptData ? `
                Region: ${deptData.REGION}<br/>
                Population: ${deptData.POPULATION.toLocaleString()}<br/>
                Density: ${deptData.POPULATION_DENSITY_KM2.toFixed(1)}/km²<br/>
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
            // Find the region feature for this department
            const regionName = normalizeRegionName(deptData.REGION);
            const regionFeature = regionsGeoJson.features.find((f: any) => 
            (f.properties.name || f.properties.nom) === regionName
            );
            if (regionFeature) {
            zoomToRegion(regionName, regionFeature);
            }
        }
        });

    // Add department labels
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

    // Add title
    g.append("text")
        .attr("x", width / 2)
        .attr("y", margin.top)
        .attr("text-anchor", "middle")
        .style("font-size", "16px")
        .style("font-weight", "bold")
        .text("All French Departments - Click any department to zoom to its region");

    addLegend(colorScale, "Population Density (/km²)");
    }

  function addLegend(colorScale: d3.ScaleSequential<string, never>, title: string) {
    const legendWidth = 200;
    const legendHeight = 20;

    const legendSvg = g.append("g")
      .attr("transform", `translate(${width - legendWidth - 50}, ${height - 100})`);

    const legendScale = d3.scaleLinear()
      .domain(colorScale.domain())
      .range([0, legendWidth]);

    const legendAxis = d3.axisBottom(legendScale)
      .ticks(5)
      .tickFormat(d => typeof d === 'number' ? d.toLocaleString() : '');

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
      .attr("stop-color", (d: number) => colorScale(d * (colorScale.domain()[1] as number)));

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

  // Click on background to zoom out
  svg.on("click", function(event: MouseEvent) {
    if (currentView === 'departments' && event.target === this) {
      renderRegionsView();
    }
  });
}