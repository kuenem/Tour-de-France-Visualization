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

export function createMapVisualization(departmentData: Department[], containerSelector: string): void {
  const container = d3.select(containerSelector);
  container.html(""); // Clear existing content

  // Set up dimensions - use fixed size or get from parent element
  const containerNode = container.node() as HTMLElement;
  const width = containerNode ? containerNode.clientWidth : 800;
  const height = 600;
  const margin = { top: 20, right: 20, bottom: 30, left: 40 };

  // Create SVG
  const svg = container.append("svg")
    .attr("width", width)
    .attr("height", height);

  // Create tooltip
  const tooltip = d3.select("#tooltip");

  // Load GeoJSON and create the map
  d3.json<any>('./data/FranceDepartments.json').then(function(geojson) {
    if (!geojson) {
      console.error('Could not load GeoJSON data');
      return;
    }

    // DEBUG: Check the actual structure of your GeoJSON
    console.log('GeoJSON structure:', geojson.features[0]);
    console.log('Properties available:', Object.keys(geojson.features[0].properties));

    // Create a map from department code to department data
    const dataMap = new Map();
    departmentData.forEach(dept => {
      dataMap.set(dept.CODE.replace('-', ''), dept);
    });

    // Create projection for France
    const projection = d3.geoMercator()
      .center([2.454071, 46.279229]) // Center of France
      .scale(2500)
      .translate([width / 2, height / 2]);

    const path = d3.geoPath().projection(projection);

    // Determine the data field to visualize
    const dataField: keyof Department = 'POPULATION_DENSITY_KM2';
    
    // Create color scale
    const values = departmentData.map(d => d[dataField]).filter(v => !isNaN(v)) as number[];
    const colorScale = d3.scaleSequential(d3.interpolateBlues)
      .domain([0, d3.max(values) || 1]);

    // Draw departments - FIXED VERSION
    svg.selectAll(".department")
      .data(geojson.features)
      .enter()
      .append("path")
      .attr("class", "department")
      .attr("d", (d: any) => path(d.geometry))
      .attr("fill", (d: any) => {
        // Flexible property access - try different possible property names
        const deptCode = d.properties.nom || d.properties.id || d.properties.code;
        const deptData = dataMap.get(deptCode);
        return deptData && !isNaN(deptData[dataField]) ? colorScale(deptData[dataField]) : "#ccc";
      })
      .attr("stroke", "#fff")
      .attr("stroke-width", 0.5)
      .on("mouseover", function(event: MouseEvent, d: any) {
        const deptCode = d.properties.id || d.properties.code || d.properties.nom;
        const deptData = dataMap.get(deptCode);
        
        tooltip.style("display", "block")
          .html(`
            <strong>${d.properties.name || d.properties.nom}</strong><br/>
            ID: ${deptCode}<br/>
            ${deptData ? `
              Region: ${deptData.REGION}<br/>
              Population: ${deptData.POPULATION.toLocaleString()}<br/>
              Density: ${deptData.POPULATION_DENSITY_KM2.toFixed(1)}/km²<br/>
              Climbs: ${deptData.NUM_CLIMBS}<br/>
              Tour Starts: ${deptData.NUM_STARTS}<br/>
              Tour Ends: ${deptData.NUM_ENDS}
            ` : 'No Tour de France data available'}
          `);
      })
      .on("mousemove", function(event: MouseEvent) {
        tooltip.style("left", (event.pageX + 10) + "px")
               .style("top", (event.pageY - 10) + "px");
      })
      .on("mouseout", function() {
        tooltip.style("display", "none");
      });

    // Add department labels
    svg.selectAll(".department-label")
      .data(geojson.features)
      .enter()
      .append("text")
      .attr("class", "department-label")
      .attr("transform", (d: any) => {
        const centroid = path.centroid(d.geometry);
        return `translate(${centroid[0]}, ${centroid[1]})`;
      })
      .attr("text-anchor", "middle")
      .attr("dy", "0.35em")
      .style("font-size", "8px")
      .style("font-weight", "bold")
      .style("fill", "#333")
      .style("pointer-events", "none")
      .style("text-shadow", "1px 1px 2px white, -1px -1px 2px white, 1px -1px 2px white, -1px 1px 2px white")
      .text((d: any) => {
        const name = d.properties.name || d.properties.nom;
        // if (name && name.length > 8) {
        //   const code = d.properties.id || d.properties.code;
        //   return code ? code.replace('FR', '') : name.substring(0, 3);
        // }
        return name || '?';
      });

    // Add legend
    const legendWidth = 200;
    const legendHeight = 20;

    const legendSvg = svg.append("g")
      .attr("transform", `translate(${width - legendWidth - 50}, ${height - 100})`);

    const legendScale = d3.scaleLinear()
      .domain(colorScale.domain())
      .range([0, legendWidth]);

    const legendAxis = d3.axisBottom(legendScale)
      .ticks(5)
      .tickFormat(d => typeof d === 'number' ? d.toLocaleString() : '');

    // Create gradient for legend
    const defs = svg.append("defs");
    const gradient = defs.append("linearGradient")
      .attr("id", "legend-gradient")
      .attr("x1", "0%")
      .attr("x2", "100%")
      .attr("y1", "0%")
      .attr("y2", "0%");

    // Add gradient stops
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

    // Add legend title
    legendSvg.append("text")
      .attr("x", legendWidth / 2)
      .attr("y", -5)
      .attr("text-anchor", "middle")
      .style("font-size", "12px")
      .style("font-weight", "bold")
      .text("Population Density (/km²)");

    // Add title
    svg.append("text")
      .attr("x", width / 2)
      .attr("y", margin.top)
      .attr("text-anchor", "middle")
      .style("font-size", "16px")
      .style("font-weight", "bold")
      .text("France Department Map - Population Density");

  }).catch(function(error) {
    console.error('Error loading or processing GeoJSON:', error);
  });
}