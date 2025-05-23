// main.js

// global settings for dimensions and margins
const margin = {top: 50, right: 50, bottom: 70, left: 70};
const vizWidth = 500; // width for each visualization
const vizHeight = 350; // height for each visualization

const fullWidth = vizWidth + margin.left + margin.right;
const fullHeight = vizHeight + margin.top + margin.bottom;

// store our original dataset
let originalData = [];
// keep track of currently filtered data
let filteredData = [];

// scales we'll need across different views
let overviewXScale, overviewYScale;
let pcpDimensions = ['experience_numeric', 'salary_in_usd', 'remote_ratio', 'company_size_numeric'];
let pcpYScales = {}; // scales for each pcp dimension

// color scale for experience levels
const experienceLevels = ['EN', 'MI', 'SE', 'EX']; // ordered from entry to executive
const experienceColorScale = d3.scaleOrdinal()
    .domain(experienceLevels)
    .range(d3.schemeTableau10.slice(0, experienceLevels.length)); // distinct colors for each level

// size scale for company sizes
const companySizeOrder = ['S', 'M', 'L'];
const focusSizeScale = d3.scaleOrdinal()
    .domain(companySizeOrder)
    .range([4, 6, 9]); // small, medium, large point sizes

// color scale specifically for the parallel coordinates plot
const experienceColorScalePCP = d3.scaleOrdinal()
    .domain(experienceLevels)
    .range(d3.schemeTableau10.slice(0, experienceLevels.length));

// scales for our grouped bar chart (focus view)
let focusX0Scale, focusX1Scale, focusYScale;
const companySizeColorScale = d3.scaleOrdinal()
    .domain(companySizeOrder)
    .range(d3.schemePastel1.slice(0, companySizeOrder.length)); // softer colors for bars

// create a tooltip that we'll reuse across all charts
const tooltip = d3.select("body").append("div")
    .attr("class", "tooltip")
    .style("opacity", 0);

// load and process our data
d3.csv("data/ds_salaries.csv").then(data => {
    // convert string values to numbers where needed
    data.forEach((d, i) => {
        d.id = i; // unique id for each job
        d.work_year = +d.work_year;
        d.salary_in_usd = +d.salary_in_usd;
        d.remote_ratio = +d.remote_ratio;

        // map experience levels to numbers for the pcp
        const expMap = { 'EN': 0, 'MI': 1, 'SE': 2, 'EX': 3 };
        d.experience_numeric = expMap[d.experience_level];

        // map company sizes to numbers for the pcp
        const sizeMap = { 'S': 0, 'M': 1, 'L': 2 };
        d.company_size_numeric = sizeMap[d.company_size];
    });

    // clean up the data - remove any invalid entries
    originalData = data.filter(d => 
        d.salary_in_usd > 0 &&
        d.experience_numeric !== undefined &&
        d.company_size_numeric !== undefined &&
        d.company_size !== undefined && 
        d.experience_level !== undefined
    );

    // start with all data visible
    filteredData = [...originalData];

    // set up our three main views
    initOverview(originalData);
    initFocus();
    initPCP(originalData);

    // draw everything with full dataset
    updateOverview(filteredData);
    updateFocus(filteredData);
    updatePCP(filteredData);

}).catch(error => {
    console.error("oops! something went wrong loading the data:", error);
});

// --- overview: bar chart showing jobs per year ---
function initOverview(dataForScaling) {
  const svg = d3.select("#overview")
    .append("svg")
            .attr("width", fullWidth)
            .attr("height", fullHeight)
        .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

    // calculate jobs per year for scaling
    const jobsByYear = d3.rollup(dataForScaling, v => v.length, d => d.work_year);
    const years = Array.from(jobsByYear.keys()).sort(d3.ascending);

    // x scale - years
    overviewXScale = d3.scaleBand()
        .domain(years)
        .range([0, vizWidth])
        .padding(0.2);

    // y scale - count
    overviewYScale = d3.scaleLinear()
        .domain([0, d3.max(years, y => jobsByYear.get(y)) || 10]) // handle empty data
        .nice()
        .range([vizHeight, 0]);

    // x axis
  svg.append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0,${vizHeight})`)
        .call(d3.axisBottom(overviewXScale).tickFormat(d3.format("d"))); // format year as integer

    // y axis
  svg.append("g")
        .attr("class", "y-axis")
        .call(d3.axisLeft(overviewYScale));

    // x axis label
    svg.append("text")
        .attr("class", "x-axis-label")
        .attr("x", vizWidth / 2)
        .attr("y", vizHeight + margin.bottom - 10)
        .attr("text-anchor", "middle")
        .text("Work Year");

    // y axis label
    svg.append("text")
        .attr("class", "y-axis-label")
        .attr("transform", "rotate(-90)")
        .attr("x", -vizHeight / 2)
        .attr("y", -margin.left + 20)
        .attr("text-anchor", "middle")
        .text("Number of Jobs");
    
    // title
    svg.append("text")
        .attr("class", "chart-title")
        .attr("x", vizWidth / 2)
        .attr("y", -margin.top / 2)
        .attr("text-anchor", "middle")
        .text("Job Count by Year (Brush to Filter)");

    // brush
  const brush = d3.brushX()
        .extent([[0, 0], [vizWidth, vizHeight]])
        .on("end", brushed); // changed to "end" to avoid rapid updates during brushing

  svg.append("g")
    .attr("class", "brush")
    .call(brush);

    addInfoIconToChart("overview", "overview");
}

function updateOverview(data) {
    const svg = d3.select("#overview svg g");

    const jobsByYear = d3.rollup(data, v => v.length, d => d.work_year);
    const currentYearsInData = Array.from(jobsByYear.keys()).sort(d3.ascending);
    
    // ensure scales cover all possible years from original data for consistency
    const allYears = Array.from(new Set(originalData.map(d => d.work_year))).sort(d3.ascending);
    overviewXScale.domain(allYears); // update domain if it changed dynamically
    // y scale might need to be re-evaluated based on *originalData* if we want a stable max
    const maxCountOriginal = d3.max(allYears, y => d3.rollup(originalData, v=>v.length, d=>d.work_year).get(y) || 0);
    overviewYScale.domain([0, maxCountOriginal || 10]).nice();

    svg.select(".x-axis").call(d3.axisBottom(overviewXScale).tickFormat(d3.format("d")));
    svg.select(".y-axis").call(d3.axisLeft(overviewYScale));

    // bars
    const bars = svg.selectAll(".bar")
        .data(allYears, d => d); // use year as key

    bars.exit() // remove bars for years not in current 'allYears' (shouldn't happen if domain is stable)
        .transition().duration(500)
        .attr("y", vizHeight)
        .attr("height", 0)
        .remove();

    bars.enter() // add new bars
        .append("rect")
        .attr("class", "bar")
        .attr("x", d => overviewXScale(d))
        .attr("y", vizHeight) // start from bottom for animation
        .attr("width", overviewXScale.bandwidth())
        .attr("height", 0)
        .attr("fill", "steelblue")
        .on("mouseover", function(event, d_year) {
            tooltip.transition().duration(200).style("opacity", .9);
            const yearData = d3.rollup(originalData, v => v.length, d_orig => d_orig.work_year);
            const numJobs = yearData.get(d_year) || 0;
            tooltip.html(
                `Year: ${d_year}<br/>` +
                `Jobs: ${numJobs}`)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 28) + "px");
            d3.select(this).style("opacity", 0.7);
        })
        .on("mouseout", function(d) {
            tooltip.transition().duration(500).style("opacity", 0);
            d3.select(this).style("opacity", 1);
        })
      .merge(bars) // update existing bars
        .transition().duration(750)
        .attr("x", d => overviewXScale(d))
        .attr("y", d => overviewYScale(jobsByYear.get(d) || 0)) // use 0 if year not in current filtered data
        .attr("width", overviewXScale.bandwidth())
        .attr("height", d => vizHeight - overviewYScale(jobsByYear.get(d) || 0))
        .attr("fill", "steelblue");
}

  function brushed(event) {
    const overviewBars = d3.select("#overview svg g").selectAll(".bar");

    if (!event.selection) { // if brush is cleared
        filteredData = [...originalData];
        overviewBars.classed("non-brushed", false).style("fill", "steelblue");
    } else {
        const [x0, x1] = event.selection;
        const selectedYears = overviewXScale.domain().filter(year => {
            const barX = overviewXScale(year);
            const barEndX = barX + overviewXScale.bandwidth();
            return Math.max(barX, x0) < Math.min(barEndX, x1);
        });
        
        filteredData = originalData.filter(d => selectedYears.includes(d.work_year));

        // visually indicate brushed vs non-brushed bars
        overviewBars
            .classed("non-brushed", d => !selectedYears.includes(d))
            .style("fill", d => selectedYears.includes(d) ? "orange" : "steelblue");
    }
    // update other charts with the new filteredData
    updateFocus(filteredData);
    updatePCP(filteredData);
    // removed the redundant fill update line from here as it's handled above
}

// --- 2. FOCUS: GROUPED BAR CHART (Average Salary by Experience & Company Size) ---
function initFocus() { // data for scaling will be handled in updateFocus
    const svg = d3.select("#focus")
        .append("svg")
            .attr("width", fullWidth)
            .attr("height", fullHeight)
        .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

    // x0 scale - experience level (outer groups)
    focusX0Scale = d3.scaleBand()
        .domain(experienceLevels) // EN, MI, SE, EX
        .range([0, vizWidth])
        .paddingInner(0.2); // padding between experience groups

    // x1 scale - company size (inner bars within each experience group)
    focusX1Scale = d3.scaleBand()
        .domain(companySizeOrder) // S, M, L
        // range will be set in updateFocus based on focusX0Scale.bandwidth()
        .padding(0.1); // padding between S, M, L bars

    // y scale - average salary
    focusYScale = d3.scaleLinear()
        // domain will be set in updateFocus based on processed data
        .range([vizHeight, 0]);

    // x axis (for experience levels)
    svg.append("g")
        .attr("class", "x-axis focus-x0-axis")
        .attr("transform", `translate(0,${vizHeight})`);
        // call to axisBottom will be in updateFocus

    // y axis
    svg.append("g")
        .attr("class", "y-axis focus-y-axis");
        // call to axisLeft will be in updateFocus

    // x axis label
    svg.append("text")
        .attr("class", "x-axis-label")
        .attr("x", vizWidth / 2)
        .attr("y", vizHeight + margin.bottom - 15) // adjusted position
        .attr("text-anchor", "middle")
        .text("Experience Level (Grouped by Company Size)");

    // y axis label
    svg.append("text")
        .attr("class", "y-axis-label")
        .attr("transform", "rotate(-90)")
        .attr("x", -vizHeight / 2)
        .attr("y", -margin.left + 20)
        .attr("text-anchor", "middle")
        .text("Average Salary in USD");
    
    // title
    svg.append("text")
        .attr("class", "chart-title")
        .attr("x", vizWidth / 2)
        .attr("y", -margin.top / 2 + 5)
        .attr("text-anchor", "middle")
        .text("Avg. Salary by Experience & Company Size");
    
    // legend for company size (color)
    const legend = svg.selectAll(".focus-legend")
        .data(companySizeColorScale.domain()) // S, M, L
        .enter().append("g")
        .attr("class", "legend focus-legend")
        .attr("transform", (d, i) => `translate(${vizWidth - 100},${i * 20})`); // position legend

    legend.append("rect")
        .attr("x", 0)
        .attr("width", 18)
        .attr("height", 18)
        .style("fill", companySizeColorScale);

    legend.append("text")
        .attr("x", 25)
        .attr("y", 9)
        .attr("dy", ".35em")
        .style("text-anchor", "start")
        .text(d => `Size ${d}`);

    addInfoIconToChart("focus", "focus");
}

function updateFocus(data) {
    const svg = d3.select("#focus svg g");

    // 1. process data: group by experience_level, then by company_size, and calculate average salary
    const groupedData = d3.rollup(data, 
        v => ({ // for each group (e.g., EN-S, EN-M, etc.)
            averageSalary: d3.mean(v, d => d.salary_in_usd),
            count: v.length,
            // store the actual data points if needed for detailed selection later
            // jobs: v 
        }),
        d => d.experience_level, 
        d => d.company_size
    );

    // convert map to array structure suitable for D3 data binding
    // [{ experience_level: 'EN', values: [{ company_size: 'S', averageSalary: X, count: Y }, ...] }, ...]
    const processedData = Array.from(groupedData, ([expLevel, companyMap]) => ({
        experience_level: expLevel,
        values: Array.from(companyMap, ([compSize, metrics]) => ({
            company_size: compSize,
            averageSalary: metrics.averageSalary || 0, // handle cases with no data
            count: metrics.count
        })).sort((a,b) => companySizeOrder.indexOf(a.company_size) - companySizeOrder.indexOf(b.company_size)) // ensure S, M, L order
    })).sort((a,b) => experienceLevels.indexOf(a.experience_level) - experienceLevels.indexOf(b.experience_level)); // ensure EN, MI, SE, EX order

    // update scales
    focusX0Scale.domain(processedData.map(d => d.experience_level));
    focusX1Scale.rangeRound([0, focusX0Scale.bandwidth()]); // set range for inner bars
    
    let maxAvgSalary = 0;
    processedData.forEach(expGroup => {
        expGroup.values.forEach(compGroup => {
            if (compGroup.averageSalary > maxAvgSalary) {
                maxAvgSalary = compGroup.averageSalary;
            }
        });
    });
    focusYScale.domain([0, maxAvgSalary || 10000]).nice(); // ensure nice ticks, handle no data

    // update axes
    svg.select(".focus-x0-axis")
        .call(d3.axisBottom(focusX0Scale));
    svg.select(".focus-y-axis")
        .transition().duration(750) // animate y-axis change
        .call(d3.axisLeft(focusYScale).ticks(5).tickFormat(d3.format("~s")));

    // data join for the groups of bars (each experience_level)
    const experienceGroups = svg.selectAll(".experience-group")
        .data(processedData, d => d.experience_level);

    experienceGroups.exit().remove(); // remove old experience groups

    const experienceGroupsEnter = experienceGroups.enter().append("g")
        .attr("class", "experience-group")
      .merge(experienceGroups) // merge enter and update selections
        .attr("transform", d => `translate(${focusX0Scale(d.experience_level)},0)`);

    // data join for the bars within each group (company_size)
    const bars = experienceGroupsEnter.selectAll(".bar")
        // key function for bars: combination of experience and company size
        .data(d => d.values, d_val => d_val.company_size); 

    bars.exit()
        .transition().duration(500)
        .attr("y", focusYScale(0))
        .attr("height", 0)
        .remove();

    bars.enter().append("rect")
        .attr("class", "bar")
        .attr("x", d_val => focusX1Scale(d_val.company_size))
        .attr("y", focusYScale(0)) // start from bottom for animation
        .attr("width", focusX1Scale.bandwidth())
        .attr("height", 0)
        .style("fill", d_val => companySizeColorScale(d_val.company_size))
        .on("mouseover", function(event, d_val) {
            tooltip.transition()
                .duration(200)
                .style("opacity", .9);
            const parentData = d3.select(this.parentNode).datum(); // get experience level
            tooltip.html(
                `Exp: ${parentData.experience_level}, Size: ${d_val.company_size}<br/>` +
                `Avg Salary: ${d3.format("$,.0f")(d_val.averageSalary)}<br/>` +
                `Jobs: ${d_val.count}`)
                .style("left", (event.pageX + 5) + "px") // position tooltip near mouse
                .style("top", (event.pageY - 28) + "px");

            // slightly enhance the hovered bar
            d3.select(this).style('opacity', 0.7);
        })
        .on("mouseout", function(d_val) {
            tooltip.transition()
                .duration(500)
                .style("opacity", 0);
            d3.select(this).style('opacity', 1); // reset opacity
        })
        .on("click", (event, d_val) => { // d_val is {company_size, averageSalary, count}
            // highlight selected bar
            d3.select("#focus svg g").selectAll(".bar").style("stroke", null);
            d3.select(event.currentTarget)
                .style("stroke", "black")
                .style("stroke-width", 2);
            
            // optional: log to console or keep a minimal update if needed elsewhere
            // console.log("Clicked bar data:", d3.select(event.currentTarget.parentNode).datum().experience_level, d_val);
        })
      .merge(bars) // update existing bars
        .transition().duration(750)
        .attr("x", d_val => focusX1Scale(d_val.company_size))
        .attr("y", d_val => focusYScale(d_val.averageSalary))
        .attr("width", focusX1Scale.bandwidth())
        .attr("height", d_val => vizHeight - focusYScale(d_val.averageSalary))
        .style("fill", d_val => companySizeColorScale(d_val.company_size));
}


// --- 3. ADVANCED: PARALLEL COORDINATES PLOT (PCP) ---
function initPCP(dataForScaling) {
  const svg = d3.select("#advanced")
    .append("svg")
            .attr("width", fullWidth)
            .attr("height", fullHeight)
        .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

    // create x scale for dimensions
    const pcpXScale = d3.scalePoint()
        .range([0, vizWidth])
        .padding(0.2) // add padding between axes
        .domain(pcpDimensions);

    // create y scale for each dimension
    pcpDimensions.forEach(dim => {
        let domain;
        if (dim === 'experience_numeric' || dim === 'company_size_numeric') {
            // for ordinal-numeric, use unique values as domain
            const uniqueValues = Array.from(new Set(dataForScaling.map(d => d[dim]))).sort(d3.ascending);
            domain = uniqueValues;
             pcpYScales[dim] = d3.scalePoint().domain(domain).range([vizHeight, 0]);
        } else if (dim === 'remote_ratio') {
            domain = [0, 50, 100]; // specific values for remote_ratio
             pcpYScales[dim] = d3.scalePoint().domain(domain).range([vizHeight, 0]);
        }
        else { // for continuous like salary
            domain = d3.extent(dataForScaling, d => d[dim]);
            if (domain[0] === undefined) domain = [0,1]; // handle empty data case
            pcpYScales[dim] = d3.scaleLinear().domain(domain).nice().range([vizHeight, 0]);
        }
    });

    // add a group for each dimension.
    const dimensionGroups = svg.selectAll(".dimension")
        .data(pcpDimensions)
        .enter().append("g")
        .attr("class", "dimension")
        .attr("transform", d => `translate(${pcpXScale(d)})`);

    // add an axis and title.
    dimensionGroups.append("g")
        .attr("class", "pcp-axis")
        .each(function(d) { 
            let axisCall = d3.axisLeft(pcpYScales[d]);
            if (d === 'salary_in_usd') axisCall.tickFormat(d3.format("~s"));
            if (d === 'experience_numeric') axisCall.tickFormat(val => ({0:'EN',1:'MI',2:'SE',3:'EX'}[val]));
            if (d === 'company_size_numeric') axisCall.tickFormat(val => ({0:'S',1:'M',2:'L'}[val]));
            if (d === 'remote_ratio') axisCall.tickFormat(val => `${val}%`);
            d3.select(this).call(axisCall);
        })
        .append("text")
        .style("text-anchor", "middle")
        .attr("y", -9)
        .text(d => d.replace('_numeric','').replace('_',' ')); // clean up label

  // title
  svg.append("text")
        .attr("class", "chart-title")
        .attr("x", vizWidth / 2)
        .attr("y", -margin.top / 2)
    .attr("text-anchor", "middle")
        .text("Job Attributes (Parallel Coordinates)");

    // placeholder for lines (foreground)
    svg.append("g").attr("class", "pcp-lines-foreground");
    // placeholder for lines (background for context if brushing active)
    // svg.append("g").attr("class", "pcp-lines-background"); // If you add this feature

    // add PCP Color Legend for Experience Level
    const pcpColorLegend = svg.selectAll(".pcp-color-legend")
        .data(experienceColorScalePCP.domain()) // use PCP specific color scale
        .enter().append("g")
        .attr("class", "legend pcp-color-legend")
        .attr("transform", (d, i) => `translate(${i * 70}, ${vizHeight + margin.bottom - 30})`); // position below chart

    pcpColorLegend.append("rect")
        .attr("x", 0)
        .attr("width", 12)
        .attr("height", 12)
        .style("fill", experienceColorScalePCP); // use PCP specific color scale

    pcpColorLegend.append("text")
        .attr("x", 18)
        .attr("y", 6)
        .attr("dy", ".35em")
        .style("text-anchor", "start")
        .style("font-size", "9px")
        .text(d => `Exp: ${d}`);

    addInfoIconToChart("advanced", "advanced");
}

// path generator for PCP
function pcpPath(d) {
    return d3.line()(pcpDimensions.map(p => {
        // ensure pcpXScale and pcpYScales[p] are defined and d[p] is valid
        if (pcpDimensions.includes(p) && pcpYScales[p] && d[p] !== undefined) {
             const pcpXScale = d3.scalePoint().range([0, vizWidth]).padding(0.2).domain(pcpDimensions);
            return [pcpXScale(p), pcpYScales[p](d[p])];
        }
        return null; // skip if data is missing for a dimension point
    }).filter(p => p !== null)); // filter out null points to avoid line errors
}


function updatePCP(data) {
    const svg = d3.select("#advanced svg g");
    const linesForeground = svg.select(".pcp-lines-foreground");

    // draw the lines for the filtered data
    const pcpLines = linesForeground.selectAll(".pcp-line")
        .data(data, d => d.id);

    pcpLines.exit()
        .transition().duration(500)
        .style("stroke-opacity", 0)
        .remove();

    pcpLines.enter()
        .append("path")
        .attr("class", "pcp-line")
        .attr("d", pcpPath)
        .style("fill", "none")
        .style("stroke", d => experienceColorScalePCP(d.experience_level)) // use pcp specific color scale
        .style("stroke-opacity", 0) 
        .on("mouseover", function(event, d_pcp) {
            // select all PCP lines
            const allPcpLines = d3.select("#advanced svg g").selectAll(".pcp-line");
            
            // dull all other lines
            allPcpLines
                .filter(function() { return this !== event.currentTarget; }) // don't dull the current line
                .transition().duration(100)
                .style("stroke-opacity", 0.05);

            // highlight the current line
            d3.select(event.currentTarget)
              .raise() // bring to front
              .transition().duration(50)
              .style("stroke-width", "3px") // slightly thicker for more emphasis
              .style("stroke-opacity", 0.95);

            tooltip.transition().duration(200).style("opacity", .9);
            tooltip.html(
                `Job: ${d_pcp.job_title.substring(0,25)}${d_pcp.job_title.length > 25 ? "..." : ""}<br/>` +
                `Salary: ${d3.format("$,.0f")(d_pcp.salary_in_usd)} | Exp: ${d_pcp.experience_level}<br/>` +
                `Size: ${d_pcp.company_size} | Remote: ${d_pcp.remote_ratio}%`)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function(d_pcp) {
            // reset all PCP lines to default active state
            d3.select("#advanced svg g").selectAll(".pcp-line")
              .transition().duration(150)
              .style("stroke-width", "1.5px")
              .style("stroke-opacity", 0.3); // default active opacity

            tooltip.transition().duration(500).style("opacity", 0);
            // no need to .lower() explicitly if all opacities are reset, 
            // but good to keep if there were other z-index manipulations.
        })
      .merge(pcpLines)
        .transition().duration(750)
        .attr("d", pcpPath) 
        .style("stroke", d => experienceColorScalePCP(d.experience_level)) // use PCP specific color scale
        .style("stroke-opacity", 0.3); 
}

// --- Utility for Details Pane ---
// (The #details div is expected in index.html)
// Example: <div id="details">Select a point in the scatter plot for details.</div>

const chartInfo = {
    overview: {
        title: "About: Job Count by Year (Overview)",
        description: "This bar chart shows the distribution of data science jobs across different years present in the dataset.",
        interaction: "<strong>Interaction:</strong> Use the brush tool (click and drag horizontally) to select a range of years. This filters the other two charts (Focus and Advanced) to show data only for the selected period.",
        insights: [
            "Observe trends in job availability over time.",
            "Identify peak years or declines in job postings within this dataset."
        ]
    },
    focus: {
        title: "About: Avg. Salary by Experience & Company Size (Focus)",
        description: "This grouped bar chart displays the average salary (USD) for different experience levels (EN: Entry, MI: Mid, SE: Senior, EX: Executive), further categorized by company size (S: Small, M: Medium, L: Large).",
        interaction: "<strong>Interaction:</strong> Hover over individual bars to see a tooltip with the exact average salary and the number of jobs in that specific group. Clicking a bar highlights it.",
        insights: [
            "Compare average earning potentials across experience levels.",
            "See how company size generally affects average salaries within each experience tier.",
            "Identify which experience/size combination yields the highest average salary in the filtered data."
        ]
    },
    advanced: {
        title: "About: Job Attributes - Parallel Coordinates (Advanced)",
        description: "Each line represents an individual job from the filtered dataset, plotting its values across multiple dimensions: mapped experience level, salary in USD, remote work ratio, and mapped company size. Lines are colored by experience level.",
        interaction: "<strong>Interaction:</strong> Hover over lines to highlight them, dull others, and see a tooltip with specific job details (title, salary, experience, etc.).",
        insights: [
            "Look for correlations: do high salaries often correspond with specific experience levels or company sizes?",
            "Identify outliers or unusual combinations of attributes.",
            "Observe if certain experience levels (colors) tend to cluster in particular regions of the salary or remote ratio axes."
        ]
    }
};

function addInfoIconToChart(chartId, chartKey) {
    const chartContainer = d3.select(`#${chartId}`);
    if (chartContainer.empty()) return;

    chartContainer.append("div")
        .attr("class", "info-icon")
        .html("&#9432;") // HTML entity for circled 'i'
        .on("click", function(event) {
            event.stopPropagation(); // prevent any parent click events
            const info = chartInfo[chartKey];
            const detailsDiv = d3.select("#details");

            detailsDiv.transition().duration(150).style("opacity", 0)
                .on("end", function() {
                    let insightsHTML = info.insights.map(item => `<li>${item}</li>`).join("");
                    d3.select(this).html(`
                        <h4>${info.title}</h4>
                        <p>${info.description}</p>
                        <p>${info.interaction}</p>
                        <h4>Potential Insights to Look For:</h4>
                        <ul>${insightsHTML}</ul>
                    `)
                    .transition().duration(250).style("opacity", 1);
                });
        });
}
