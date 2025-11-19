import * as d3 from "d3";


const toolTip = d3.select("#tooltip");

export function showTooltip(x: number, y: number, text: string) {
    toolTip
        .style("left", `${x+2}px`) // Adjusted to show next to the cursor
        .style("top", `${y-30}px`) // Adjusted to show above the cursor
        .style("display", "block")
        .text(text);
}

export function hideTooltip() {
    toolTip.style("display", "none");
}