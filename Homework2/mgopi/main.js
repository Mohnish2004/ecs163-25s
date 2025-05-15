// Global layout settings
const width = window.innerWidth;
const height = window.innerHeight;

// Donut chart settings - positioned on the left side
let donutLeft = width * 0.05, donutTop = height * 0.1;
let donutMargin = {top: 40, right: 30, bottom: 60, left: 60},
    donutWidth = width * 0.25 - donutMargin.left - donutMargin.right,
    donutHeight = height * 0.4 - donutMargin.top - donutMargin.bottom;
let donutRadius = Math.min(donutWidth, donutHeight) / 2;

// Stacked bar chart settings - positioned on the right side
let barLeft = width * 0.35, barTop = height * 0.1;
let barMargin = {top: 40, right: 40, bottom: 130, left: 80},
    barWidth = width * 0.55 - barMargin.left - barMargin.right,
    barHeight = height * 0.4 - barMargin.top - barMargin.bottom;

// Parallel Coordinates settings - positioned on the bottom with more space from title
let pcLeft = width * 0.05, pcTop = height * 0.6;
let pcMargin = {top: 70, right: 60, bottom: 40, left: 80},
    pcWidth = width * 0.9 - pcMargin.left - pcMargin.right,
    pcHeight = height * 0.35 - pcMargin.top - pcMargin.bottom;

// Load and process data
d3.csv("data/mental.csv").then(rawData => {
    console.log("rawData", rawData);

    // Data preprocessing
    rawData.forEach(function(d) {
        // Clean gender data
        d.gender = d["Choose your gender"];
        
        // Convert string responses to boolean for easier processing
        d.depression = d["Do you have Depression?"] === "Yes";
        d.anxiety = d["Do you have Anxiety?"] === "Yes";
        d.panicAttack = d["Do you have Panic attack?"] === "Yes";
        d.seekSpecialist = d["Did you seek any specialist for a treatment?"] === "Yes";
        
        // Extract CGPA as numeric value
        let cgpaMatch = d["What is your CGPA?"].match(/(\d+\.\d+) - (\d+\.\d+)/);
        if (cgpaMatch) {
            // Use the middle of the range
            d.cgpa = (parseFloat(cgpaMatch[1]) + parseFloat(cgpaMatch[2])) / 2;
        } else if (d["What is your CGPA?"] === "0 - 1.99") {
            d.cgpa = 1.0; // Use 1.0 as representative for the lowest range
        } else {
            d.cgpa = null;
        }
        
        // Convert age to number
        d.age = parseInt(d["Age"]);
        
        // Clean year of study
        let yearMatch = d["Your current year of Study"].match(/[yY]ear (\d+)/);
        if (yearMatch) {
            d.yearOfStudy = parseInt(yearMatch[1]);
        } else {
            d.yearOfStudy = null;
        }
    });

    const svg = d3.select("svg");
    
    // Create dashboard title with better styling
    svg.append("text")
       .attr("x", width / 2)
       .attr("y", 40)
       .attr("text-anchor", "middle")
       .attr("font-size", "28px")
       .attr("font-weight", "bold")
       .attr("class", "title")
    

    // 1. Donut Chart for Depression Overview (Context View)
    createDonutChart(svg, rawData);
    
    // 2. Stacked Bar Chart for Anxiety & Panic Attack by Gender (Focus View)
    createStackedBarChart(svg, rawData);
    
    // 3. Parallel Coordinates Plot (Advanced Visualization - Focus View)
    createParallelCoordinates(svg, rawData);
    
    // Add data source attribution
    svg.append("text")
       .attr("x", width - 20)
       .attr("y", height - 10)
       .attr("text-anchor", "end")
       .attr("font-size", "12px")
       .attr("fill", "#999")
       .text("Data source: Student Mental Health Survey");
    
}).catch(function(error){
    console.log(error);
});

// Function to create donut chart (Context View - Overview)
function createDonutChart(svg, data) {
    // Filter out rows with missing depression data
    const validData = data.filter(d => d["Do you have Depression?"] !== "");
    
    // Count depression cases
    const depressionCount = validData.filter(d => d.depression).length;
    const nonDepressionCount = validData.length - depressionCount;
    
    const donutData = [
        { label: "Depression", value: depressionCount },
        { label: "No Depression", value: nonDepressionCount }
    ];
    
    const g = svg.append("g")
        .attr("transform", `translate(${donutLeft + donutWidth/2 + donutMargin.left}, ${donutTop + donutHeight/2 + donutMargin.top})`);
    
    // Add section title with more space
    svg.append("text")
       .attr("x", donutLeft + donutWidth/2 + donutMargin.left)
       .attr("y", donutTop + donutMargin.top - 25)
       .attr("text-anchor", "middle")
       .attr("font-size", "20px")
       .attr("font-weight", "bold")
       .attr("class", "title")
       .text("Depression Overview");
    
    // Create color scale with better contrasting colors
    const color = d3.scaleOrdinal()
        .domain(donutData.map(d => d.label))
        .range(["#d8365d", "#4a6fe3"]);
    
    // Create the pie layout
    const pie = d3.pie()
        .value(d => d.value)
        .sort(null);
    
    // Create the arc generator for the donut
    const arc = d3.arc()
        .innerRadius(donutRadius * 0.6) // This creates the donut hole
        .outerRadius(donutRadius);
    
    // Create the donut segments
    const arcs = g.selectAll("arc")
        .data(pie(donutData))
        .enter()
        .append("g")
        .attr("class", "arc");
    
    // Draw the segments with stroke for better separation
    arcs.append("path")
        .attr("d", arc)
        .attr("fill", d => color(d.data.label))
        .attr("stroke", "white")
        .style("stroke-width", "2px")
        .style("transition", "opacity 0.3s")
        .on("mouseover", function() {
            d3.select(this).style("opacity", 0.8);
        })
        .on("mouseout", function() {
            d3.select(this).style("opacity", 1);
        });
    
    // Add percentage labels with better positioning and styling
    arcs.append("text")
        .attr("transform", d => `translate(${arc.centroid(d)})`)
        .attr("text-anchor", "middle")
        .attr("font-size", "16px")
        .attr("font-weight", "bold")
        .attr("fill", "white")
        .text(d => {
            const percentage = Math.round((d.data.value / validData.length) * 100);
            return percentage + "%";
        });
    
    // Add total count in the center with better styling
    g.append("text")
        .attr("text-anchor", "middle")
        .attr("font-size", "14px")
        .attr("fill", "#666")
        .text(`Total: ${validData.length} students`);
    
    // Add legend with much better spacing
    const legend = g.selectAll(".legend")
        .data(donutData)
        .enter()
        .append("g")
        .attr("class", "legend")
        .attr("transform", (d, i) => `translate(-100, ${donutRadius + 60 + i * 35})`);
    
    legend.append("rect")
        .attr("width", 18)
        .attr("height", 18)
        .attr("rx", 2)
        .attr("ry", 2)
        .attr("fill", d => color(d.label));
    
    legend.append("text")
        .attr("x", 25)
        .attr("y", 13)
        .attr("fill", "#333")
        .style("font-size", "14px")
        .text(d => `${d.label} (${d.value} students)`);
}

// Function to create stacked bar chart (Focus View)
function createStackedBarChart(svg, data) {
    // Filter out rows with missing gender data
    const validData = data.filter(d => d.gender && (d.gender === "Male" || d.gender === "Female"));
    
    // Group data by gender and count anxiety and panic attack cases
    const genderGroups = d3.nest()
        .key(d => d.gender)
        .rollup(leaves => {
            return {
                total: leaves.length,
                anxiety: leaves.filter(d => d.anxiety).length,
                noAnxiety: leaves.filter(d => !d.anxiety).length,
                panicAttack: leaves.filter(d => d.panicAttack).length,
                noPanicAttack: leaves.filter(d => !d.panicAttack).length
            };
        })
        .entries(validData);
    
    const g = svg.append("g")
        .attr("transform", `translate(${barLeft + barMargin.left}, ${barTop + barMargin.top})`);
    
    // Add section title with more space
    svg.append("text")
       .attr("x", barLeft + barWidth/2 + barMargin.left)
       .attr("y", barTop + barMargin.top - 25)
       .attr("text-anchor", "middle")
       .attr("font-size", "20px")
       .attr("font-weight", "bold")
       .attr("class", "title")
       .text("Mental Health Issues by Gender");
    
    // X axis (gender) with better styling
    const x = d3.scaleBand()
        .domain(genderGroups.map(d => d.key))
        .range([0, barWidth])
        .paddingInner(0.4)
        .paddingOuter(0.2);
    
    g.append("g")
        .attr("transform", `translate(0, ${barHeight})`)
        .call(d3.axisBottom(x))
        .selectAll("text")
        .style("font-size", "14px")
        .style("font-weight", "bold");
    
    // X label with better styling
    g.append("text")
        .attr("x", barWidth / 2)
        .attr("y", barHeight + 45)
        .attr("text-anchor", "middle")
        .attr("font-size", "16px")
        .attr("fill", "#333")
        .text("Gender");
    
    // Y axis (count) with better styling
    const maxCount = d3.max(genderGroups, d => d.value.total);
    const y = d3.scaleLinear()
        .domain([0, maxCount])
        .range([barHeight, 0])
        .nice();
    
    g.append("g")
        .call(d3.axisLeft(y).ticks(5))
        .selectAll("text")
        .style("font-size", "12px");
    
    // Y label with better spacing
    g.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", -60)
        .attr("x", -barHeight / 2)
        .attr("text-anchor", "middle")
        .attr("font-size", "16px")
        .attr("fill", "#333")
        .text("Number of Students");
    
    // Color scale for stacked bars with improved color palette
    const color = d3.scaleOrdinal()
        .domain(["Anxiety", "No Anxiety", "Panic Attack", "No Panic Attack"])
        .range(["#d8365d", "#4a6fe3", "#ff8c38", "#45bdb0"]);
    
    // Create tooltip for hover information
    const tooltip = d3.select("body").append("div")
        .attr("class", "tooltip")
        .style("opacity", 0);
    
    // Draw bars for Anxiety with hover effects
    const anxietyBars = g.selectAll(".anxiety-bar")
        .data(genderGroups)
        .enter()
        .append("g")
        .attr("class", "anxiety-bars");
    
    // Anxiety - Yes
    anxietyBars.append("rect")
        .attr("x", d => x(d.key))
        .attr("y", d => y(d.value.anxiety))
        .attr("width", x.bandwidth() / 2 - 5)
        .attr("height", d => barHeight - y(d.value.anxiety))
        .attr("fill", color("Anxiety"))
        .on("mouseover", function(d) {
            d3.select(this).attr("opacity", 0.8);
            tooltip.transition()
                .duration(200)
                .style("opacity", .9);
            tooltip.html(`<strong>${d.key}</strong><br>Anxiety: ${d.value.anxiety} (${Math.round(d.value.anxiety/d.value.total*100)}%)`)
                .style("left", (d3.event.pageX + 10) + "px")
                .style("top", (d3.event.pageY - 28) + "px");
        })
        .on("mouseout", function() {
            d3.select(this).attr("opacity", 1);
            tooltip.transition()
                .duration(500)
                .style("opacity", 0);
        });
    
    // Anxiety - No
    anxietyBars.append("rect")
        .attr("x", d => x(d.key))
        .attr("y", d => y(d.value.noAnxiety))
        .attr("width", x.bandwidth() / 2 - 5)
        .attr("height", d => barHeight - y(d.value.noAnxiety))
        .attr("fill", color("No Anxiety"))
        .attr("opacity", 0.7)
        .on("mouseover", function(d) {
            d3.select(this).attr("opacity", 0.9);
            tooltip.transition()
                .duration(200)
                .style("opacity", .9);
            tooltip.html(`<strong>${d.key}</strong><br>No Anxiety: ${d.value.noAnxiety} (${Math.round(d.value.noAnxiety/d.value.total*100)}%)`)
                .style("left", (d3.event.pageX + 10) + "px")
                .style("top", (d3.event.pageY - 28) + "px");
        })
        .on("mouseout", function() {
            d3.select(this).attr("opacity", 0.7);
            tooltip.transition()
                .duration(500)
                .style("opacity", 0);
        });
    
    // Draw bars for Panic Attack with hover effects
    const panicBars = g.selectAll(".panic-bar")
        .data(genderGroups)
        .enter()
        .append("g")
        .attr("class", "panic-bars");
    
    // Panic Attack - Yes
    panicBars.append("rect")
        .attr("x", d => x(d.key) + x.bandwidth() / 2)
        .attr("y", d => y(d.value.panicAttack))
        .attr("width", x.bandwidth() / 2 - 5)
        .attr("height", d => barHeight - y(d.value.panicAttack))
        .attr("fill", color("Panic Attack"))
        .on("mouseover", function(d) {
            d3.select(this).attr("opacity", 0.8);
            tooltip.transition()
                .duration(200)
                .style("opacity", .9);
            tooltip.html(`<strong>${d.key}</strong><br>Panic Attack: ${d.value.panicAttack} (${Math.round(d.value.panicAttack/d.value.total*100)}%)`)
                .style("left", (d3.event.pageX + 10) + "px")
                .style("top", (d3.event.pageY - 28) + "px");
        })
        .on("mouseout", function() {
            d3.select(this).attr("opacity", 1);
            tooltip.transition()
                .duration(500)
                .style("opacity", 0);
        });
    
    // Panic Attack - No
    panicBars.append("rect")
        .attr("x", d => x(d.key) + x.bandwidth() / 2)
        .attr("y", d => y(d.value.noPanicAttack))
        .attr("width", x.bandwidth() / 2 - 5)
        .attr("height", d => barHeight - y(d.value.noPanicAttack))
        .attr("fill", color("No Panic Attack"))
        .attr("opacity", 0.7)
        .on("mouseover", function(d) {
            d3.select(this).attr("opacity", 0.9);
            tooltip.transition()
                .duration(200)
                .style("opacity", .9);
            tooltip.html(`<strong>${d.key}</strong><br>No Panic Attack: ${d.value.noPanicAttack} (${Math.round(d.value.noPanicAttack/d.value.total*100)}%)`)
                .style("left", (d3.event.pageX + 10) + "px")
                .style("top", (d3.event.pageY - 28) + "px");
        })
        .on("mouseout", function() {
            d3.select(this).attr("opacity", 0.7);
            tooltip.transition()
                .duration(500)
                .style("opacity", 0);
        });
    
    // Add legend with better spacing and organization
    const legendItems = ["Anxiety", "No Anxiety", "Panic Attack", "No Panic Attack"];
    const legend = g.selectAll(".legend")
        .data(legendItems)
        .enter()
        .append("g")
        .attr("class", "legend")
        .attr("transform", (d, i) => `translate(${i < 2 ? 0 : barWidth/2 + 20}, ${barHeight + 70 + (i%2) * 30})`);
    
    legend.append("rect")
        .attr("width", 18)
        .attr("height", 18)
        .attr("rx", 2)
        .attr("ry", 2)
        .attr("fill", d => color(d))
        .attr("opacity", d => d.includes("No") ? 0.7 : 1);
    
    legend.append("text")
        .attr("x", 25)
        .attr("y", 13)
        .style("font-size", "14px")
        .attr("fill", "#333")
        .text(d => d);
}

// Function to create parallel coordinates plot (Advanced Visualization)
function createParallelCoordinates(svg, data) {
    // Filter out rows with missing data
    const validData = data.filter(d => 
        !isNaN(d.age) && 
        d.cgpa !== null && 
        d.yearOfStudy !== null &&
        d["Do you have Depression?"] !== "" &&
        d["Do you have Anxiety?"] !== "" &&
        d["Do you have Panic attack?"] !== ""
    );
    
    // Keep the title position fixed
    svg.append("text")
       .attr("x", pcLeft + pcWidth/2 + pcMargin.left)
       .attr("y", pcTop - 20) // Position the title well above the plot
       .attr("text-anchor", "middle")
       .attr("font-size", "20px")
       .attr("font-weight", "bold")
       .attr("class", "title")
       .text("Parallel Coordinates: Relationships Between Variables");
    
    // The visualization group is now positioned lower due to increased pcTop value
    const g = svg.append("g")
        .attr("transform", `translate(${pcLeft + pcMargin.left}, ${pcTop + pcMargin.top})`);
    
    // Define dimensions for parallel coordinates with better domain ranges
    const dimensions = [
        { name: "Age", scale: d3.scaleLinear().domain([d3.min(validData, d => d.age) - 1, d3.max(validData, d => d.age) + 1]).range([pcHeight, 0]) },
        { name: "CGPA", scale: d3.scaleLinear().domain([0, 4]).range([pcHeight, 0]) },
        { name: "Year of Study", scale: d3.scaleLinear().domain([1, 4]).range([pcHeight, 0]) },
        { name: "Depression", scale: d3.scalePoint().domain(["No", "Yes"]).range([pcHeight, 0]) },
        { name: "Anxiety", scale: d3.scalePoint().domain(["No", "Yes"]).range([pcHeight, 0]) },
        { name: "Panic Attack", scale: d3.scalePoint().domain(["No", "Yes"]).range([pcHeight, 0]) }
    ];
    
    // Create position scales for each dimension
    const x = d3.scalePoint()
        .domain(dimensions.map(d => d.name))
        .range([0, pcWidth]);
    
    // Add background lines for easier viewing
    g.append("g")
        .attr("class", "background")
        .selectAll("path")
        .data(validData)
        .enter()
        .append("path")
        .attr("d", d => {
            const points = dimensions.map(dimension => {
                if (dimension.name === "Age") return dimension.scale(d.age);
                if (dimension.name === "CGPA") return dimension.scale(d.cgpa);
                if (dimension.name === "Year of Study") return dimension.scale(d.yearOfStudy);
                if (dimension.name === "Depression") return dimension.scale(d["Do you have Depression?"]);
                if (dimension.name === "Anxiety") return dimension.scale(d["Do you have Anxiety?"]);
                if (dimension.name === "Panic Attack") return dimension.scale(d["Do you have Panic attack?"]);
                return null;
            });
            return d3.line()(points.map((p, i) => [x(dimensions[i].name), p]));
        })
        .attr("fill", "none")
        .attr("stroke", "#ddd")
        .attr("stroke-width", 1)
        .attr("opacity", 0.3);
    
    // Add axis for each dimension with more space from the title
    dimensions.forEach(dimension => {
        const axis = g.append("g")
            .attr("transform", `translate(${x(dimension.name)}, 0)`)
            .call(d3.axisLeft(dimension.scale));
        
        // Style axis lines
        axis.selectAll("path")
            .style("stroke", "#666");
            
        // Style axis ticks
        axis.selectAll("line")
            .style("stroke", "#666");
            
        // Style axis text
        axis.selectAll("text")
            .style("font-size", "12px")
            .style("fill", "#666");
            
        // Add dimension title with increased vertical space
        axis.append("text")
            .attr("y", -35) // Increased top margin for axis labels
            .attr("text-anchor", "middle")
            .attr("fill", "#333")
            .style("font-size", "14px")
            .style("font-weight", "bold")
            .text(dimension.name);
    });
    
    // Create tooltip for more detailed information
    const tooltip = d3.select("body").append("div")
        .attr("class", "tooltip")
        .style("opacity", 0);
    
    // Color scale based on depression status with better colors
    const color = d3.scaleOrdinal()
        .domain(["Yes", "No"])
        .range(["#d8365d", "#4a6fe3"]);
    
    // Create the path generator for smoother lines
    const line = d3.line()
        .defined(d => d !== null)
        .x((d, i) => d[0])
        .y(d => d[1])
        .curve(d3.curveMonotoneX);
    
    // Add the lines with improved styling and interactivity
    g.selectAll(".parallel-line")
        .data(validData)
        .enter()
        .append("path")
        .attr("class", "parallel-line")
        .attr("d", d => {
            const points = dimensions.map(dimension => {
                if (dimension.name === "Age") return [x(dimension.name), dimension.scale(d.age)];
                if (dimension.name === "CGPA") return [x(dimension.name), dimension.scale(d.cgpa)];
                if (dimension.name === "Year of Study") return [x(dimension.name), dimension.scale(d.yearOfStudy)];
                if (dimension.name === "Depression") return [x(dimension.name), dimension.scale(d["Do you have Depression?"])];
                if (dimension.name === "Anxiety") return [x(dimension.name), dimension.scale(d["Do you have Anxiety?"])];
                if (dimension.name === "Panic Attack") return [x(dimension.name), dimension.scale(d["Do you have Panic attack?"])];
                return null;
            });
            return line(points);
        })
        .attr("fill", "none")
        .attr("stroke", d => color(d["Do you have Depression?"]))
        .attr("stroke-width", 1.5)
        .attr("opacity", 0.6)
        .on("mouseover", function(d) {
            d3.select(this)
                .attr("stroke-width", 4)
                .attr("opacity", 1)
                .raise();
            
            tooltip.transition()
                .duration(200)
                .style("opacity", .9);
            
            tooltip.html(`
                <strong>Student Profile</strong><br>
                Age: ${d.age}<br>
                Gender: ${d.gender}<br>
                CGPA: ${d.cgpa.toFixed(2)}<br>
                Year: ${d.yearOfStudy}<br>
                Depression: ${d["Do you have Depression?"]}<br>
                Anxiety: ${d["Do you have Anxiety?"]}<br>
                Panic Attack: ${d["Do you have Panic attack?"]}<br>
                Sought Help: ${d["Did you seek any specialist for a treatment?"]}
            `)
                .style("left", (d3.event.pageX + 10) + "px")
                .style("top", (d3.event.pageY - 28) + "px");
        })
        .on("mouseout", function() {
            d3.select(this)
                .attr("stroke-width", 1.5)
                .attr("opacity", 0.6);
            
            tooltip.transition()
                .duration(500)
                .style("opacity", 0);
        });
    
    // Add legend with better positioning
    const legend = g.append("g")
        .attr("class", "legend-container")
        .attr("transform", `translate(${pcWidth - 180}, 15)`);
    
    // Add legend title
    legend.append("text")
        .attr("x", 0)
        .attr("y", -5)
        .attr("font-size", "14px")
        .attr("font-weight", "bold")
        .attr("fill", "#333")
        .text("Depression Status");
    
    // Add legend items with increased spacing
    const legendItems = legend.selectAll(".legend-item")
        .data(["Yes", "No"])
        .enter()
        .append("g")
        .attr("class", "legend-item")
        .attr("transform", (d, i) => `translate(0, ${i * 30 + 15})`);
    
    legendItems.append("rect")
        .attr("width", 18)
        .attr("height", 18)
        .attr("rx", 2)
        .attr("ry", 2)
        .attr("fill", d => color(d));
    
    legendItems.append("text")
        .attr("x", 25)
        .attr("y", 13)
        .attr("fill", "#333")
        .style("font-size", "14px")
        .text(d => `${d}`);
} 