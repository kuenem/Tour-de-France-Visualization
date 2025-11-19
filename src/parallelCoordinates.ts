// import * as d3 from "d3";
// import { Department } from "./types";

// export function createParallelCoordinates(
//   data: Department[], 
//   containerSelector: string
// ) {
//   // Available parameters
//   const allDimensions = [
//     "POPULATION_DENSITY_KM2",
//     "NUM_CLIMBS", 
//     "AVG_GRADE_PERCENT",
//     "AVG_ALTITUDE_M",
//     "NUM_HC",
//     "TOTAL_LENGTH_KM",
//     "NUM_CAT_1",
//     "NUM_STARTS",
//     "NUM_ENDS",
//     "NUM_YELLOW_JERSEY_WINNERS",
//     "TOTAL_APPEARANCES",
//     "CLIMB_DENSITY",
//     "AVG_CLIMB_LENGTH"
//   ];

//   // SINGLE SOURCE OF TRUTH - Move state outside functions
//   let state = {
//     selectedDimensions: ["POPULATION_DENSITY_KM2", 
//       "NUM_CLIMBS", 
//       "AVG_GRADE_PERCENT", 
//       "AVG_ALTITUDE_M", 
//       "NUM_HC",
//       "TOTAL_APPEARANCES",],
//     clickedDepartment: null as string | null,     // clicked department
//     hoveredDepartment: null as string | null,     // hovered department
//     highlightedDimension: null as string | null,
//     isVertical: false,
//     hiddenRegions: [] as string[],
//   };

//   // Add window resize handler
//   let resizeTimeout: number;
//   function handleResize() {
//     clearTimeout(resizeTimeout);
//     resizeTimeout = window.setTimeout(() => {
//       renderChart();
//     }, 250); // Debounce to avoid too many re-renders
//   }

//   // Add event listener
//   window.addEventListener('resize', handleResize);

//   // Clear container
//   const container = d3.select(containerSelector);
//   container.selectAll("*").remove();

//   // Create control panel FIRST
//   const controls = createControls(container);
  
//   // Initial render
//   renderChart();

//   // CONTROL CREATION - Separate function
//   function createControls(container: d3.Selection<d3.BaseType, unknown, HTMLElement, any>) {
//     const controls = container.append("div")
//       .attr("class", "controls")
//       .style("margin-bottom", "10px")
//       .style("max-height", "200px")
//       .style("overflow-y", "auto");

//     // Dimension selector
//     controls.append("h3")
//       .text("Select Parameters:")
//       .style("font-size", "14px")
//       .style("margin-bottom", "10px");

//     const dimensionList = controls.append("div")
//       .style("display", "grid")
//       .style("grid-template-columns", "repeat(3, 1fr)")
//       .style("gap", "8px")
//       .style("font-size", "11px");

//     allDimensions.forEach(dim => {
//        const label = dimensionList.append("label")
//         .style("display", "flex")
//         .style("align-items", "center");
//     //     .html(`
//     //       <input type="checkbox" ${state.selectedDimensions.includes(dim) ? "checked" : ""} value="${dim}">
//     //       ${getDisplayName(dim)}
//     //     `);
//     // });
//         label.append("input")
//           .attr("type", "checkbox")
//           .attr("value", dim)
//           .property("checked", state.selectedDimensions.includes(dim))
//           .on("change", function() {
//             // update state immediately when checkbox changes
//             state.selectedDimensions = getCurrentSelectedDimensions();
//             renderChart();
//           });

//         label.append("span")
//           .text(` ${getDisplayName(dim)}`)
//           .style("margin-left", "5px");
//     });

//     // Department selector
//     controls.append("h3")
//       .text("Highlight Department:")
//       .style("font-size", "14px")
//       .style("margin-top", "15px");

//     const departmentSelect = controls.append("select")
//       .style("margin-bottom", "10px")
//       .style("width", "200px")
//       .on("change", function() {
//         state.clickedDepartment = (this as HTMLSelectElement).value || null;
//         renderChart();
//       });

//     departmentSelect.append("option").text("None").attr("value", "");
//     data.forEach(dept => {
//       departmentSelect.append("option")
//         .text(dept.NAME)
//         .attr("value", dept.CODE);
//     });

//     // Control buttons
//     const buttonContainer = controls.append("div")
//       .style("margin-top", "10px");

//     buttonContainer.append("button")
//       .text("Rotate 90°")
//       .style("margin-right", "10px")
//       .style("padding", "5px 10px")
//       .on("click", () => {
//         state.isVertical = !state.isVertical;
//         renderChart();
//       });

//     buttonContainer.append("button")
//       .text("Update Chart")
//       .style("padding", "5px 10px")
//       .on("click", renderChart);

//     return { dimensionList, departmentSelect };
//   }

//   function getDisplayName(dimension: string): string {
//     const names: {[key: string]: string} = {
//       "POPULATION_DENSITY_KM2": "Pop. Density",
//       "NUM_CLIMBS": "Number of Climbs",
//       "AVG_GRADE_PERCENT": "Avg Grade %",
//       "AVG_ALTITUDE_M": "Avg Altitude (m)",
//       "NUM_HC": "HC Climbs",
//       "TOTAL_LENGTH_KM": "Total Climb Length",
//       "NUM_CAT_1": "Category 1 Climbs",
//       "NUM_STARTS": "Tour Starts",
//       "NUM_ENDS": "Tour Ends", 
//       "NUM_YELLOW_JERSEY_WINNERS": "Yellow Jersey Wins",
//       "TOTAL_APPEARANCES": "Total Appearances",
//       "CLIMB_DENSITY": "Climb Density",
//       "AVG_CLIMB_LENGTH": "Avg Climb Length"
//     };
//     return names[dimension] || dimension.replace(/_/g, " ");
//   }

//   function getCalculatedValue(dept: Department, dimension: string): number {
//     switch(dimension) {
//       case "TOTAL_APPEARANCES":
//         return (dept.NUM_STARTS || 0) + (dept.NUM_ENDS || 0);
//       case "CLIMB_DENSITY":
//         return dept.AREA_KM2 > 0 ? (dept.NUM_CLIMBS || 0) / dept.AREA_KM2 : 0;
//       case "AVG_CLIMB_LENGTH":
//         return dept.NUM_CLIMBS > 0 ? (dept.TOTAL_LENGTH_KM || 0) / dept.NUM_CLIMBS : 0;
//       default:
//         return Number(dept[dimension as keyof Department]) || 0;
//     }
//   }

//   function getCurrentSelectedDimensions(): string[] {
//     const currentSelectedDimensions: string[] = [];
//     container.selectAll("input:checked").each(function() {
//       if (currentSelectedDimensions.length < 10) {
//         currentSelectedDimensions.push((this as HTMLInputElement).value);
//       }
//     });
//     return currentSelectedDimensions;
//   }

//   function renderChart() {
//     console.log("Rendering chart with state:", state); // Debug log
    
//     // // GET CURRENT SELECTIONS FROM CONTROLS
//     // const currentSelectedDimensions: string[] = [];
//     // container.selectAll("input:checked").each(function() {
//     //   if (currentSelectedDimensions.length < 10) {
//     //     currentSelectedDimensions.push((this as HTMLInputElement).value);
//     //   }
//     // });
    
//     // UPDATE STATE with current control values
//     state.selectedDimensions = getCurrentSelectedDimensions();

//     // Clear previous chart
//     container.select(".chart-container").remove();

//     // Create chart container
//     const chartContainer = container.append("div")
//       .attr("class", "chart-container")
//       .style("width", "100%")
//       .style("overflow", "auto");

//     // Draw chart
//     drawParallelCoordinates(chartContainer.node()!);
//   }

//   function drawParallelCoordinates(chartContainer: Element) {
//     const { selectedDimensions, clickedDepartment, hoveredDepartment, isVertical } = state;
    
//     if (selectedDimensions.length === 0) {
//       chartContainer.appendChild(document.createTextNode("Please select at least one parameter"));
//       return;
//     }

//     // Responsive dimensions
//     const containerRect = (chartContainer as HTMLElement).getBoundingClientRect();
//     const availableWidth = Math.max(containerRect.width - 40, 500);
//     // const availableHeight = Math.min(containerRect.height - 40, 800);

//     const availableHeight = Math.min(600, window.innerHeight - 300);
    
//     const numDimensions = selectedDimensions.length;
//     const axisSpacing = Math.max(80, availableWidth / Math.max(numDimensions, 5));
    
//     const width = isVertical ? 
//       Math.min(availableHeight, numDimensions * axisSpacing) : 
//       availableWidth;
    
//     const height = isVertical ? 
//       availableWidth : 
//       Math.min(availableHeight, numDimensions * axisSpacing);

//     const marginTop = 40, marginRight = 20, marginBottom = 40, marginLeft = 80;

//     // Filter data
//     const filteredData = data.filter(d => 
//       selectedDimensions.every(dim => {
//         const value = getCalculatedValue(d, dim);
//         return !isNaN(value) && isFinite(value) && value >= 0;
//       })
//     );

//     if (filteredData.length === 0) {
//       chartContainer.appendChild(document.createTextNode("No data available for selected parameters"));
//       return;
//     }

//     // Create scales
//     const x = new Map(selectedDimensions.map(dimension => {
//       const values = filteredData.map(d => getCalculatedValue(d, dimension));
//       const extent = d3.extent(values) as [number, number];
//       const padding = (extent[1] - extent[0]) * 0.05;
//       const paddedExtent = [Math.max(0, extent[0] - padding), extent[1] + padding] as [number, number];
      
//       const range = isVertical ? 
//         [marginTop, height - marginBottom] : 
//         [marginLeft, width - marginRight];
      
//       return [dimension, d3.scaleLinear(paddedExtent, range)];
//     }));

//     const y = d3.scalePoint(selectedDimensions, 
//       isVertical ? 
//         [marginLeft, width - marginRight] : 
//         [marginTop, height - marginBottom]
//     ).padding(0.3);

//     // Color scale
//     const regions = Array.from(new Set(filteredData.map(d => d.REGION.trim()))).sort();
//     const color = d3.scaleOrdinal<string>()
//       .domain(regions)
//       .range(d3.schemeCategory10);

//     // 1. SVG CONTAINER (first - background)    
//     const svg = d3.select(chartContainer)
//       .append("svg")
//       .attr("viewBox", `0 0 ${width} ${height}`)
//       .attr("width", width)
//       .attr("height", height)
//       .attr("style", `max-width: 100%; height: auto; font: ${Math.min(12, 100/numDimensions)}px sans-serif;`);

//     // Line generator
//     const line = d3.line<[string, number]>()
//       .defined(([_, value]) => !isNaN(value) && isFinite(value))
//       .x(([dimension, value]) => {
//         const scale = x.get(dimension);
//         return scale ? scale(value) : 0;
//       })
//       .y(([dimension]) => y(dimension) || 0);

//     // 2. LINES GROUP (second - behind axes)
//     const paths = svg.append("g")
//       .attr("fill", "none")
//       .selectAll("path")
//       .data(filteredData)
//       .join("path")
//       .attr("d", d => {
//         const points: [string, number][] = selectedDimensions.map(dimension => [
//           dimension, 
//           getCalculatedValue(d, dimension)
//         ]);
//         return line(points);
//       })

//       .attr("stroke-width", d => {
//         if (state.clickedDepartment === d.CODE || state.hoveredDepartment === d.CODE) {
//           return 4;
//         }
//         return 1.5;
//       })

//       .attr("stroke-opacity", d => {
//         // Full opacity for clicked/hovered, lower for others
//         if (state.clickedDepartment === d.CODE || state.hoveredDepartment === d.CODE) {
//           return 1;
//         }
//         return 0.4;
//       })

//       .attr("stroke", d => color(d.REGION.trim()))
//       .style("cursor", "pointer")
//       .on("click", function(event: MouseEvent, d: Department) {
//         // Toggle clicked department - if same department clicked again, deselect
//         state.clickedDepartment = state.clickedDepartment === d.CODE ? null : d.CODE;
//         container.select("select").property("value", state.clickedDepartment || "");
//         renderChart();
//         event.stopPropagation(); // Prevent SVG click from triggering
//       })
//       .on("mouseover", function(event: MouseEvent, d: Department) {
//         // Just update the dropdown to maintain consistency
//         // container.select("select").property("value", d.CODE);
//         // state.hoveredDepartment = d.CODE;
//         // renderChart(); // Re-render to show highlight
//         d3.select(this)
//           .attr("stroke-width", 4)
//           .attr("stroke-opacity", 1);
//       })
//       .on("mouseout", function(event: MouseEvent, d: Department) {
//         // state.hoveredDepartment = null;
//         // renderChart();
//         if (state.clickedDepartment !== d.CODE) {
//           d3.select(this)
//             .attr("stroke-width", 1.5)
//             .attr("stroke-opacity", 0.4);
//         }
//       })

//       .append("title")
//       .text(d => {
//         const values = selectedDimensions.map(dim => 
//           `${getDisplayName(dim)}: ${getCalculatedValue(d, dim).toFixed(2)}`
//         ).join('\n');

//         let status = "";
//         if (state.clickedDepartment === d.CODE && state.hoveredDepartment === d.CODE) {
//           status = " (Clicked & Hovered)";
//         } else if (state.clickedDepartment === d.CODE) {
//           status = " (Clicked)";
//         } else if (state.hoveredDepartment === d.CODE) {
//           status = " (Hovered)";
//         }

//         return `${d.NAME} (${d.REGION})\n${values}`;
//       });

//       // Add click handler to SVG background to clear clicked department
//       // 6. SVG CLICK HANDLER (very last - doesn't affect visual order)
//       svg.on("click", function(event: MouseEvent) {
//         if (event.target === this) { // Only if clicking directly on SVG background
//           state.clickedDepartment = null;
//           container.select("select").property("value", "");
//           renderChart();
//         }
//       });

//     // 3. AXES GROUPS (third - on top of lines)
//     const axisGroups = svg.selectAll(".axis")
//       .data(selectedDimensions)
//       .enter()
//       .append("g")
//       .attr("class", "axis")
//       .attr("transform", d => 
//         isVertical ? 
//           `translate(${y(d)},0)` : 
//           `translate(0,${y(d)})`
//       )
//       .style("cursor", "pointer")
//       .on("mouseover", function(event: MouseEvent, d: string) {
//         d3.select(this)
//           .selectAll("line, path")
//           .attr("stroke", "red")
//           .attr("stroke-width", 2);
//         d3.select(this)
//           .selectAll("text")
//           .attr("fill", "red")
//           .attr("font-weight", "bold");
//       })
//       .on("mouseout", function(event: MouseEvent, d: string) {
//         d3.select(this)
//           .selectAll("line, path")
//           .attr("stroke", "currentColor")
//           .attr("stroke-width", 1);
//         d3.select(this)
//           .selectAll("text")
//           .attr("fill", "currentColor")
//           .attr("font-weight", "normal");

//       });

//     // Add axes
//     axisGroups.each(function(dimension) {
//       const scale = x.get(dimension);
//       if (!scale) return;

//       const axisGroup = d3.select(this);
//       const axis = isVertical ? d3.axisLeft(scale) : d3.axisBottom(scale);
      
//       axisGroup.call(axis as any);

//       // Highlight if this dimension is selected
//       if (state.highlightedDimension === dimension) {
//         axisGroup.selectAll("line, path").attr("stroke", "red").attr("stroke-width", 2);
//         axisGroup.selectAll("text").attr("fill", "red").attr("font-weight", "bold");
//       }
//     });

//     // 4. AXES LABELS (fourth - on top of axes)
//     axisGroups.append("text")
//       .attr("x", isVertical ? -45 : marginLeft)
//       .attr("y", isVertical ? 0 : -25)
//       .attr("text-anchor", isVertical ? "end" : "start")
//       .attr("fill", d => state.highlightedDimension === d ? "red" : "currentColor")
//       .attr("font-weight", d => state.highlightedDimension === d ? "bold" : "normal")
//       .attr("font-size", Math.min(12, 100/numDimensions))
//       .text(d => getDisplayName(d));

    

//     // 5. LEGEND (fifth - should be on top but positioned incorrectly)
//     if (numDimensions <= 8) { // Old condition based on dimension count
//     //if (regions.length <= 8 && height > 300) { // New condition based on region count and height
//       const legend = svg.append("g")
//         .attr("transform", `translate(${width - 150}, ${marginTop - marginTop + 5})`);

//       // Add background rectangle for legend
//       legend.append("rect")
//         .attr("x", -5)
//         .attr("y", -5)
//         .attr("width", 140)
//         .attr("height", regions.length * 15 + 10)
//         .attr("fill", "white")
//         .attr("opacity", 0.8)
//         .attr("stroke", "#ccc")
//         .attr("stroke-width", 1);

//       regions.forEach((region, i) => {
//         const legendItem = legend.append("g")
//           .attr("transform", `translate(0, ${i * 15})`);

//         legendItem.append("rect")
//           .attr("width", 8)
//           .attr("height", 8)
//           .attr("fill", color(region));

//         legendItem.append("text")
//           .attr("x", 12)
//           .attr("y", 4)
//           .attr("dy", "0.35em")
//           .text(region)
//           .attr("font-size", "9px");

          
//       });
//     }
//     // 6. HIGHLIGHTED DEPARTMENT INFO (last - on top of everything)
//     const highlightedDept = clickedDepartment || hoveredDepartment;
//     if (highlightedDept) {
//       const dept = filteredData.find(d => d.CODE === highlightedDept);
//       if (dept) {
//         const infoBox = svg.append("g")
//           .attr("transform", `translate(${width - 150}, ${marginTop + (regions.length * 15) + 20})`);

//         // Background
//         infoBox.append("rect")
//           .attr("x", -5)
//           .attr("y", -5)
//           .attr("width", 140)
//           .attr("height", selectedDimensions.length * 15 + 25)
//           .attr("fill", "white")
//           .attr("opacity", 0.9)
//           .attr("stroke", "#ccc")
//           .attr("stroke-width", 1);

//         // Department name
//         infoBox.append("text")
//           .attr("x", 5)
//           .attr("y", 10)
//           .attr("font-weight", "bold")
//           .attr("font-size", "10px")
//           .text(`${dept.NAME}`); // (${hoveredDepartment ? "Hovered" : "Clicked"})`);

//         // Values for each dimension
//         selectedDimensions.forEach((dim, i) => {
//           const value = getCalculatedValue(dept, dim);
//           infoBox.append("text")
//             .attr("x", 5)
//             .attr("y", 25 + i * 15)
//             .attr("font-size", "9px")
//             .text(`${getDisplayName(dim)}: ${value.toFixed(2)}`);
//         });
//       }
//     }
//   }
// }


import * as d3 from "d3";
import { Department } from "./types";

export function createParallelCoordinates(
  data: Department[], 
  containerSelector: string
) {
  // Available parameters
  const allDimensions = [
    "POPULATION_DENSITY_KM2",
    "NUM_CLIMBS", 
    "AVG_GRADE_PERCENT",
    "AVG_ALTITUDE_M",
    "NUM_HC",
    "TOTAL_LENGTH_KM",
    "NUM_CAT_1",
    "NUM_STARTS",
    "NUM_ENDS",
    "NUM_YELLOW_JERSEY_WINNERS",
    "TOTAL_APPEARANCES",
    "CLIMB_DENSITY",
    "AVG_CLIMB_LENGTH"
  ];

  // SINGLE SOURCE OF TRUTH - Move state outside functions
  let state = {
    selectedDimensions: ["POPULATION_DENSITY_KM2", 
      "NUM_CLIMBS", 
      "AVG_GRADE_PERCENT", 
      "AVG_ALTITUDE_M", 
      "NUM_HC",
      "TOTAL_APPEARANCES",],
    clickedDepartment: null as string | null,
    hoveredDepartment: null as string | null,
    highlightedDimension: null as string | null,
    isVertical: false,
    hiddenRegions: ["Martinique", "Guadeloupe", "French Guiana", "Réunion", "Mayotte"] as string[],
    regionAverages: [] as string[],
  };

  // Add window resize handler
  let resizeTimeout: number;
  function handleResize() {
    clearTimeout(resizeTimeout);
    resizeTimeout = window.setTimeout(() => {
      renderChart();
    }, 250);
  }

  // Add event listener
  window.addEventListener('resize', handleResize);

  // Clear container
  const container = d3.select(containerSelector);
  container.selectAll("*").remove();

  // Create control panel FIRST
  const controls = createControls(container);
  
  // Initial render
  renderChart();

  // CONTROL CREATION - Separate function
  function createControls(container: d3.Selection<d3.BaseType, unknown, HTMLElement, any>) {
    const controls = container.append("div")
      .attr("class", "controls")
      .style("margin-bottom", "10px")
      .style("max-height", "200px")
      .style("overflow-y", "auto");

    // Dimension selector
    controls.append("h3")
      .text("Select Parameters:")
      .style("font-size", "14px")
      .style("margin-bottom", "10px");

    const dimensionList = controls.append("div")
      .style("display", "grid")
      .style("grid-template-columns", "repeat(3, 1fr)")
      .style("gap", "8px")
      .style("font-size", "11px");

    allDimensions.forEach(dim => {
      const label = dimensionList.append("label")
        .style("display", "flex")
        .style("align-items", "center");

      label.append("input")
        .attr("type", "checkbox")
        .attr("value", dim)
        .property("checked", state.selectedDimensions.includes(dim))
        .on("change", function() {
          state.selectedDimensions = getCurrentSelectedDimensions();
          renderChart();
        });

      label.append("span")
        .text(` ${getDisplayName(dim)}`)
        .style("margin-left", "5px");
    });

    // Department selector
    controls.append("h3")
      .text("Highlight Department:")
      .style("font-size", "14px")
      .style("margin-top", "15px");

    const departmentSelect = controls.append("select")
      .style("margin-bottom", "10px")
      .style("width", "200px")
      .on("change", function() {
        state.clickedDepartment = (this as HTMLSelectElement).value || null;
        renderChart();
      });

    departmentSelect.append("option").text("None").attr("value", "");
    data.forEach(dept => {
      departmentSelect.append("option")
        .text(dept.NAME)
        .attr("value", dept.CODE);
    });

    // Control buttons
    const buttonContainer = controls.append("div")
      .style("margin-top", "10px");

    buttonContainer.append("button")
      .text("Rotate 90°")
      .style("margin-right", "10px")
      .style("padding", "5px 10px")
      .on("click", () => {
        state.isVertical = !state.isVertical;
        renderChart();
      });

    buttonContainer.append("button")
      .text("Update Chart")
      .style("padding", "5px 10px")
      .on("click", renderChart);

    return { dimensionList, departmentSelect };
  }

  function getDisplayName(dimension: string): string {
    const names: {[key: string]: string} = {
      "POPULATION_DENSITY_KM2": "Pop. Density",
      "NUM_CLIMBS": "Number of Climbs",
      "AVG_GRADE_PERCENT": "Avg Grade %",
      "AVG_ALTITUDE_M": "Avg Altitude (m)",
      "NUM_HC": "HC Climbs",
      "TOTAL_LENGTH_KM": "Total Climb Length",
      "NUM_CAT_1": "Category 1 Climbs",
      "NUM_STARTS": "Tour Starts",
      "NUM_ENDS": "Tour Ends", 
      "NUM_YELLOW_JERSEY_WINNERS": "Yellow Jersey Wins",
      "TOTAL_APPEARANCES": "Total Appearances",
      "CLIMB_DENSITY": "Climb Density",
      "AVG_CLIMB_LENGTH": "Avg Climb Length"
    };
    return names[dimension] || dimension.replace(/_/g, " ");
  }

  function getCalculatedValue(dept: Department, dimension: string): number {
    switch(dimension) {
      case "TOTAL_APPEARANCES":
        return (dept.NUM_STARTS || 0) + (dept.NUM_ENDS || 0);
      case "CLIMB_DENSITY":
        return dept.AREA_KM2 > 0 ? (dept.NUM_CLIMBS || 0) / dept.AREA_KM2 : 0;
      case "AVG_CLIMB_LENGTH":
        return dept.NUM_CLIMBS > 0 ? (dept.TOTAL_LENGTH_KM || 0) / dept.NUM_CLIMBS : 0;
      default:
        return Number(dept[dimension as keyof Department]) || 0;
    }
  }

  function getCurrentSelectedDimensions(): string[] {
    const currentSelectedDimensions: string[] = [];
    container.selectAll("input:checked").each(function() {
      if (currentSelectedDimensions.length < 10) {
        currentSelectedDimensions.push((this as HTMLInputElement).value);
      }
    });
    return currentSelectedDimensions;
  }

  function calculateRegionAverage(region: string, selectedDimensions: string[]) {
    const regionData = data.filter(dept => 
      dept.REGION.trim() === region && 
      !state.hiddenRegions.includes(region)
    );
    
    if (regionData.length === 0) return null;

    const averages: {[key: string]: number} = {};
    
    selectedDimensions.forEach(dimension => {
      const values = regionData.map(dept => getCalculatedValue(dept, dimension))
        .filter(val => !isNaN(val) && isFinite(val));
      
      if (values.length > 0) {
        const isCountDimension = dimension.includes('NUM_') || dimension.includes('TOTAL_');
        averages[dimension] = isCountDimension ? 
          d3.sum(values) :
          d3.mean(values) as number;
      }
    });
    
    return averages;
  }

  function toggleRegionAverage(region: string) {
    if (state.regionAverages.includes(region)) {
      state.regionAverages = state.regionAverages.filter(r => r !== region);
    } else {
      state.regionAverages = [...state.regionAverages, region];
    }
    renderChart();
  }

  function renderChart() {
    console.log("Rendering chart with state:", state);
    
    state.selectedDimensions = getCurrentSelectedDimensions();

    container.select(".chart-container").remove();

    const chartContainer = container.append("div")
      .attr("class", "chart-container")
      .style("width", "100%")
      .style("overflow", "auto");

    drawParallelCoordinates(chartContainer.node()!);
  }

  function drawParallelCoordinates(chartContainer: Element) {
    const { selectedDimensions, clickedDepartment, hoveredDepartment, isVertical } = state;
    
    if (selectedDimensions.length === 0) {
      chartContainer.appendChild(document.createTextNode("Please select at least one parameter"));
      return;
    }

    const containerRect = (chartContainer as HTMLElement).getBoundingClientRect();
    const availableWidth = Math.max(containerRect.width - 40, 500);
    const availableHeight = Math.min(600, window.innerHeight - 300);
    
    const numDimensions = selectedDimensions.length;
    const axisSpacing = Math.max(80, availableWidth / Math.max(numDimensions, 5));
    
    const width = isVertical ? 
      Math.min(availableHeight, numDimensions * axisSpacing) : 
      availableWidth;
    
    const height = isVertical ? 
      availableWidth : 
      Math.min(availableHeight, numDimensions * axisSpacing);

    const marginTop = 40, marginRight = 20, marginBottom = 40, marginLeft = 80;

    // Filter data - respect region blacklist
    const filteredData = data.filter(d => 
      !state.hiddenRegions.includes(d.REGION.trim()) &&
      selectedDimensions.every(dim => {
        const value = getCalculatedValue(d, dim);
        return !isNaN(value) && isFinite(value) && value >= 0;
      })
    );

    if (filteredData.length === 0) {
      chartContainer.appendChild(document.createTextNode("No data available for selected parameters"));
      return;
    }

    // Create scales
    const x = new Map(selectedDimensions.map(dimension => {
      const values = filteredData.map(d => getCalculatedValue(d, dimension));
      const extent = d3.extent(values) as [number, number];
      const padding = (extent[1] - extent[0]) * 0.05;
      const paddedExtent = [Math.max(0, extent[0] - padding), extent[1] + padding] as [number, number];
      
      const range = isVertical ? 
        [marginTop, height - marginBottom] : 
        [marginLeft, width - marginRight];
      
      return [dimension, d3.scaleLinear(paddedExtent, range)];
    }));

    const y = d3.scalePoint(selectedDimensions, 
      isVertical ? 
        [marginLeft, width - marginRight] : 
        [marginTop, height - marginBottom]
    ).padding(0.3);

    // Color scale
    const regions = Array.from(new Set(filteredData.map(d => d.REGION.trim()))).sort();
    const colorScale = d3.scaleOrdinal<string, string>()
      .domain(regions)
      .range(d3.schemeCategory10);

    // 1. SVG CONTAINER
    const svg = d3.select(chartContainer)
      .append("svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("width", width)
      .attr("height", height)
      .attr("style", `max-width: 100%; height: auto; font: ${Math.min(12, 100/numDimensions)}px sans-serif;`);

    // Line generator
    const line = d3.line<[string, number]>()
      .defined(([_, value]) => !isNaN(value) && isFinite(value))
      .x(([dimension, value]) => {
        const scale = x.get(dimension);
        return scale ? scale(value) : 0;
      })
      .y(([dimension]) => y(dimension) || 0);

    // 2. REGION AVERAGE LINES (behind individual lines)
    state.regionAverages.forEach(region => {
      const averages = calculateRegionAverage(region, selectedDimensions);
      if (!averages) return;

      const points: [string, number][] = selectedDimensions.map(dimension => [
        dimension,
        averages[dimension] || 0
      ]);

      svg.append("path")
        .datum(points)
        .attr("d", line)
        .attr("stroke", colorScale(region))
        .attr("stroke-width", 3)
        .attr("stroke-dasharray", "5,5")
        .attr("stroke-opacity", 0.8)
        .attr("fill", "none")
        .append("title")
        .text(`${region} Average\n${selectedDimensions.map(dim => 
          `${getDisplayName(dim)}: ${(averages[dim] || 0).toFixed(2)}`
        ).join('\n')}`);
    });

    // 3. INDIVIDUAL LINES
    const paths = svg.append("g")
      .attr("fill", "none")
      .selectAll("path")
      .data(filteredData)
      .join("path")
      .attr("d", d => {
        const points: [string, number][] = selectedDimensions.map(dimension => [
          dimension, 
          getCalculatedValue(d, dimension)
        ]);
        return line(points);
      })
      .attr("stroke-width", d => {
        if (state.clickedDepartment === d.CODE || state.hoveredDepartment === d.CODE) {
          return 4;
        }
        return 1.5;
      })
      .attr("stroke-opacity", d => {
        if (state.clickedDepartment === d.CODE || state.hoveredDepartment === d.CODE) {
          return 1;
        }
        return 0.4;
      })
      .attr("stroke", d => colorScale(d.REGION.trim()))
      .style("cursor", "pointer")
      .on("click", function(event: MouseEvent, d: Department) {
        state.clickedDepartment = state.clickedDepartment === d.CODE ? null : d.CODE;
        container.select("select").property("value", state.clickedDepartment || "");
        renderChart();
        event.stopPropagation();
      })
      .on("mouseover", function(event: MouseEvent, d: Department) {
        d3.select(this)
          .attr("stroke-width", 4)
          .attr("stroke-opacity", 1);
      })
      .on("mouseout", function(event: MouseEvent, d: Department) {
        if (state.clickedDepartment !== d.CODE) {
          d3.select(this)
            .attr("stroke-width", 1.5)
            .attr("stroke-opacity", 0.4);
        }
      })
      .append("title")
      .text(d => {
        const values = selectedDimensions.map(dim => 
          `${getDisplayName(dim)}: ${getCalculatedValue(d, dim).toFixed(2)}`
        ).join('\n');

        let status = "";
        if (state.clickedDepartment === d.CODE && state.hoveredDepartment === d.CODE) {
          status = " (Clicked & Hovered)";
        } else if (state.clickedDepartment === d.CODE) {
          status = " (Clicked)";
        } else if (state.hoveredDepartment === d.CODE) {
          status = " (Hovered)";
        }

        return `${d.NAME} (${d.REGION})\n${values}`;
      });

    // 4. SVG CLICK HANDLER
    svg.on("click", function(event: MouseEvent) {
      if (event.target === this) {
        state.clickedDepartment = null;
        container.select("select").property("value", "");
        renderChart();
      }
    });

    // 5. AXES GROUPS
    const axisGroups = svg.selectAll(".axis")
      .data(selectedDimensions)
      .enter()
      .append("g")
      .attr("class", "axis")
      .attr("transform", d => 
        isVertical ? 
          `translate(${y(d)},0)` : 
          `translate(0,${y(d)})`
      )
      .style("cursor", "pointer")
      .on("mouseover", function(event: MouseEvent, d: string) {
        d3.select(this)
          .selectAll("line, path")
          .attr("stroke", "red")
          .attr("stroke-width", 2);
        d3.select(this)
          .selectAll("text")
          .attr("fill", "red")
          .attr("font-weight", "bold");
      })
      .on("mouseout", function(event: MouseEvent, d: string) {
        d3.select(this)
          .selectAll("line, path")
          .attr("stroke", "currentColor")
          .attr("stroke-width", 1);
        d3.select(this)
          .selectAll("text")
          .attr("fill", "currentColor")
          .attr("font-weight", "normal");
      });

    // Add axes
    axisGroups.each(function(dimension) {
      const scale = x.get(dimension);
      if (!scale) return;

      const axisGroup = d3.select(this);
      const axis = isVertical ? d3.axisLeft(scale) : d3.axisBottom(scale);
      
      axisGroup.call(axis as any);

      if (state.highlightedDimension === dimension) {
        axisGroup.selectAll("line, path").attr("stroke", "red").attr("stroke-width", 2);
        axisGroup.selectAll("text").attr("fill", "red").attr("font-weight", "bold");
      }
    });

    // 6. AXES LABELS
    axisGroups.append("text")
      .attr("x", isVertical ? -45 : marginLeft)
      .attr("y", isVertical ? 0 : -25)
      .attr("text-anchor", isVertical ? "end" : "start")
      .attr("fill", d => state.highlightedDimension === d ? "red" : "currentColor")
      .attr("font-weight", d => state.highlightedDimension === d ? "bold" : "normal")
      .attr("font-size", Math.min(12, 100/numDimensions))
      .text(d => getDisplayName(d));

    // 7. INTERACTIVE LEGEND
    if (regions.length > 0) {
      const legend = svg.append("g")
        .attr("transform", `translate(${width - 180}, ${marginTop})`);

      // Add background rectangle for legend
      const legendHeight = regions.length * 20 + 30;
      legend.append("rect")
        .attr("x", -10)
        .attr("y", -10)
        .attr("width", 170)
        .attr("height", legendHeight)
        .attr("fill", "white")
        .attr("opacity", 0.9)
        .attr("stroke", "#ccc")
        .attr("stroke-width", 1);

      // Legend title
      legend.append("text")
        .attr("x", 5)
        .attr("y", 5)
        .attr("font-weight", "bold")
        .attr("font-size", "10px")
        .text("Regions (click for averages)");

      regions.forEach((region, i) => {
        const legendItem = legend.append("g")
          .attr("transform", `translate(0, ${i * 20 + 20})`)
          .style("cursor", "pointer");

        // Color indicator (always visible, even if region is hidden)
        legendItem.append("rect")
          .attr("x", 5)
          .attr("y", -6)
          .attr("width", 12)
          .attr("height", 12)
          .attr("fill", colorScale(region))
          .attr("opacity", state.hiddenRegions.includes(region) ? 0.3 : 1);

        // Region name
        legendItem.append("text")
          .attr("x", 22)
          .attr("y", 2)
          .attr("dy", "0.35em")
          .text(region)
          .attr("font-size", "9px")
          .attr("fill", state.hiddenRegions.includes(region) ? "#999" : "#000");

        // Show average checkbox
        const averageCheckbox = legendItem.append("g")
          .attr("transform", `translate(120, -8)`)
          .style("cursor", "pointer")
          .on("click", function(event) {
            event.stopPropagation();
            toggleRegionAverage(region);
          });

        // Checkbox background
        averageCheckbox.append("rect")
          .attr("width", 12)
          .attr("height", 12)
          .attr("fill", state.regionAverages.includes(region) ? "#4CAF50" : "white")
          .attr("stroke", "#333")
          .attr("stroke-width", 1)
          .attr("rx", 2);

        // Checkmark
        if (state.regionAverages.includes(region)) {
          averageCheckbox.append("text")
            .attr("x", 6)
            .attr("y", 6)
            .attr("text-anchor", "middle")
            .attr("dy", "0.35em")
            .attr("font-size", "10px")
            .attr("font-weight", "bold")
            .attr("fill", "white")
            .text("✓");
        }

        // Add tooltip to explain what the checkbox does
        legendItem.append("title")
          .text(`Click to ${state.regionAverages.includes(region) ? "hide" : "show"} average line for ${region}`);
      });
    }

    // 8. HIGHLIGHTED DEPARTMENT INFO
    const highlightedDept = clickedDepartment || hoveredDepartment;
    if (highlightedDept) {
      const dept = filteredData.find(d => d.CODE === highlightedDept);
      if (dept) {
        const infoBox = svg.append("g")
          .attr("transform", `translate(${width - 150}, ${marginTop + (regions.length * 20) + 40})`);

        // Background
        infoBox.append("rect")
          .attr("x", -5)
          .attr("y", -5)
          .attr("width", 140)
          .attr("height", selectedDimensions.length * 15 + 25)
          .attr("fill", "white")
          .attr("opacity", 0.9)
          .attr("stroke", "#ccc")
          .attr("stroke-width", 1);

        // Department name
        infoBox.append("text")
          .attr("x", 5)
          .attr("y", 10)
          .attr("font-weight", "bold")
          .attr("font-size", "10px")
          .text(`${dept.NAME}`);

        // Values for each dimension
        selectedDimensions.forEach((dim, i) => {
          const value = getCalculatedValue(dept, dim);
          infoBox.append("text")
            .attr("x", 5)
            .attr("y", 25 + i * 15)
            .attr("font-size", "9px")
            .text(`${getDisplayName(dim)}: ${value.toFixed(2)}`);
        });
      }
    }
  }
}