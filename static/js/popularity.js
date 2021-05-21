// set the dimensions and margins of the graph
var margin = {top: 10, right: 30, bottom: 30, left: 60},
    //width = d3.select("#my_dataviz").parent().width(),
    width = 800 - margin.left - margin.right,
    height = 500 - margin.top - margin.bottom;

//var width = d3.select("#my_dataviz").style('width');

// append the svg object to the body of the page
var svg = d3.select("#my_dataviz")
  .append("svg")
    .attr("width", "100%")
    .attr("width", 100 + width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
  .append("g")
    .attr("transform",
          "translate(" + margin.left + "," + margin.top + ")");


// -------------------------------------------------------------------
//                        == POLL DATA ==
// -------------------------------------------------------------------
d3.csv("https://raw.githubusercontent.com/AlexAndorra/pollsposition_dashboards/main/exports/polls_popularity.csv", 
  function(d){ // Let us format the data variable
    return { 
			field_date : d3.timeParse("%Y-%m-%d")(d.field_date),
			sondage : d.sondage,
		  method: d.method,
		  p_approve: 100 * d.p_approve,
		  samplesize: d.samplesize
		}
  },
	function(data) {

	var x = d3.scaleTime()
		.domain([new Date("2017-05-01"), new Date("2022-05-01")]) 
		.range([ 0, width ]);
	svg.append("g")
		.attr("transform", "translate(0," + height + ")")
		.call(d3.axisBottom(x));

	var y = d3.scaleLinear()
		.domain([0, 100])
		.range([ height, 0]);
	svg.append("g")
		.call(d3.axisLeft(y));

  // Add a tooltip div. Here I define the general feature of the tooltip: stuff that do not depend on the data point.
  // Its opacity is set to 0: we don't see it by default.
  var tooltip = d3.select("#my_dataviz")
    .append("div")
    .style("opacity", 0)
    .attr("class", "tooltip")
    .style("background-color", "white")
    .style("border", "solid")
    .style("border-width", "1px")
    .style("border-radius", "5px")
    .style("padding", "10px")


	var highlight = function(d) {
    selected_pollster = d.sondage

    d3.selectAll(".dot")
      .transition()
      .duration(200)
      .style("fill", "white")
      .attr("r", 0)

    d3.selectAll("." + selected_pollster)
      .transition()
      .duration(200)
      .style("fill", "#2E3440")
      .attr("r", 4)
      .style("opacity", 1)
      .style("stroke", "white")
	}

	var remove_highlight = function(){
    d3.selectAll(".dot")
      .transition()
      .duration(200)
      .attr("r", 4)
      .style("fill", "#d8dee9")
      .style("opacity", 1)
      .style("stroke", "white")
  }

  // A function that change this tooltip when the user hover a point.
  // Its opacity is set to 1: we can now see it. Plus it set the text and position of tooltip depending on the datapoint (d)
  var mouseover = function(d) {
    tooltip
      .style("opacity", 1)
		//jhighlight(d);
  }

  var mousemove = function(d) {
    tooltip
			.html("Institut: " + d.sondage + "<br>Méthode: " + d.method + "<br>Approuvent: " + d.p_approve + "%<br>Échantillon: " + d.samplesize)
      .style("left", (d3.mouse(this)[0]+90) + "px") // It is important to put the +90: other wise the tooltip is exactly where the point is an it creates a weird effect
      .style("top", (d3.mouse(this)[1]) + "px")
  }
	
  // A function that change this tooltip when the leaves a point: just need to set opacity to 0 again
  var mouseleave = function(d) {
    tooltip
      .transition()
      .duration(200)
      .style("opacity", 0)
		remove_highlight(d);
  }
	
	var click = function(d) {
		highlight(d)
	}

  // Add dots
  svg.append('g')
    .selectAll("dot")
		.data(data)
    .enter()
    .append("circle")
		  .attr("class", function (d) { return "dot " + d.sondage } )
      .attr("cx", function (d) { return x(d.field_date); } )
      .attr("cy", function (d) { return y(d.p_approve); } )
      .attr("r", 4)
      .style("fill", "#81A1C1")
      .style("opacity", .5)
      .style("stroke", "white")
    .on("mouseover", mouseover)
    .on("mousemove", mousemove)
    .on("mouseleave", mouseleave)
    .on("click", click)
})

// -------------------------------------------------------------------
//                    == MODEL + UNCERTAINTY ==
// -------------------------------------------------------------------
d3.csv("https://raw.githubusercontent.com/AlexAndorra/pollsposition_dashboards/main/exports/predictions_popularity.csv", 
	function(d){ // Let us format the data variable
		return { 
			date : d3.timeParse("%Y-%m-%d")(d.date),
			mean : Number.parseFloat(100 * d.mean).toFixed(1),
			hdi_50_right : 100 * d.hdi_50_right,
			hdi_50_left : 100 * d.hdi_50_left,
			hdi_95_right : 100 * d.hdi_95_right,
			hdi_95_left : 100 * d.hdi_95_left,
		}
	},
	function(data){

		var x = d3.scaleTime()
			.domain([new Date("2017-05-01"), new Date("2022-05-01")])
			.range([ 0, width ]);
		svg.append("g")
			.attr("transform", "translate(0," + height + ")")
			.call(d3.axisBottom(x));

		var y = d3.scaleLinear()
			.domain([0, 100])
			.range([ height, 0]);
		svg.append("g")
			.call(d3.axisLeft(y));

		// This allows to find the closest X index of the mouse:
		var bisect = d3.bisector(function(d) { return d.date; }).left;

		// Create the text that travels along the curve of chart
		var focusText = svg
			.append('g')
			.append('text')
				.attr("class", "popularity-text")
				.style("opacity", 0)
				.attr("text-anchor", "left")
				.attr("alignment-baseline", "middle")
		    .style("font-size", "34px")
		    .style("color", "black")

		var focusDate = svg
			.append('g')
			.append('text')
				.attr("class", "popularity-date")
				.style("opacity", 0)
				.attr("text-anchor", "left")
				.attr("alignment-baseline", "middle")
		    .style("font-size", "34px")
		    .style("color", "black")

		// Create the vertical line that follows the popularity
		var verticalLine = svg
		  .append("g")
			.append("line")
				.style("stroke", "black")
				.style('stroke-width', 1)
				.style('stroke-dasharray', ('5,1'))
				.attr("y1", 0)
		    .attr("y2", height - margin.top - margin.bottom)

		// Show the average popularity
		svg
			.append("path")
			.datum(data)
			.attr("fill", "none")
			.attr("stroke", "steelblue")
			.attr("stroke-width", 4)
			.attr("d", d3.line()
				.x(function(d) { return x(d.date) })
				.y(function(d) { return y(d.mean) })
				)

			// Create a rect on top of the svg area: this rectangle recovers mouse position
		svg
			.append('rect')
			.style("fill", "none")
			.style("pointer-events", "all")
			.attr('width', width)
			.attr('height', height)
			.on('mouseover', mouseover)
			.on('mousemove', mousemove)
			.on('mouseout', mouseout);

		// What happens when the mouse move -> show the annotations at the right positions.
		function mouseover() {
			focusText.style("opacity",1)
			focusDate.style("opacity",1)
		}

		function mousemove() {
			// recover coordinate we need
			var x0 = x.invert(d3.mouse(this)[0]);
			var i = bisect(data, x0, 1);
			selectedData = data[i]
			focusText
				.html(selectedData.mean + "% Approuvent")
				.attr("x", x(selectedData.date)+15)
				.attr("y", y(selectedData.mean)-25)
			focusDate
				.html(selectedData.date)
				.attr("x", x(selectedData.date))
				.attr("y", height)
			verticalLine
				.attr("x1", x(selectedData.date))
				.attr("x2", x(selectedData.date))
			}

		function mouseout() {
			focus.style("opacity", 0)
			focusText.style("opacity", 0)
			focusDate.style("opacity", 0)
		}

		// Show HDI 95%
		svg
			.append("path")
			.datum(data)
				.attr("class", "hdi95")
				.attr("fill", "#81A1C1")
				.attr("opacity", .2)
				.attr("stroke", "none")
				.attr("d", d3.area()
					.x(function(d) { return x(d.date) })
					.y0(function(d) { return y(d.hdi_95_left) })
					.y1(function(d) { return y(d.hdi_95_right) })
					)

	}
)


