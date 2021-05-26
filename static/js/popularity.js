// set the dimensions and margins of the graph
var margin = {top: 10, right: 30, bottom: 30, left: 60},
    //width = d3.select("#my_dataviz").parent().width(),
    width = 960 - margin.left - margin.right,
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
	.call(d3.axisLeft(y).ticks(5));




// -------------------------------------------------------------------
//                    == MODEL + UNCERTAINTY ==
// -------------------------------------------------------------------
d3.csv("https://raw.githubusercontent.com/pollsposition/dashboards/main/exports/predictions_popularity.csv", 
  function(d){ // Let us format the data variable
    return { 
			date : d3.timeParse("%Y-%m-%d")(d.date),
			mean : Number.parseFloat(100 * d.mean).toFixed(1),
			hdi_50_right : Number.parseFloat(100 * d.hdi_50_right).toFixed(1),
			hdi_50_left : Number.parseFloat(100 * d.hdi_50_left).toFixed(1),
			hdi_90_right : Number.parseFloat(100 * d.hdi_90_right).toFixed(1),
			hdi_90_left : Number.parseFloat(100 * d.hdi_90_left).toFixed(1),
    }
  },
  function(data){

		// This allows to find the closest X index of the mouse:
		var bisect = d3.bisector(function(d) { return d.date; }).left;

		// Show the average popularity
		svg
			.append("path")
			.datum(data)
			.attr("id", "popularity")
			.attr("fill", "none")
			.attr("stroke", "steelblue")
			.attr("stroke-width", 4)
			.attr("d", d3.line()
				.x(function(d) { return x(d.date) })
				.y(function(d) { return y(d.mean) })
				)
	
		// Create the text that travels along the curve of chart
		lastItem = data[data.length-1]

		var percentText = svg
			.append('g')
			.append('text')
				.attr("id", "popularity")
				.style("opacity", 1)
				.attr("text-anchor", "left")
				.attr("alignment-baseline", "middle")
				.style("font-size", "34px")
				.style("color", "black")
				.html(lastItem.mean + " %")
				.attr("x", x(lastItem.date)+15)
				.attr("y", y(lastItem.mean)-50)

		var approveText = svg
			.append('g')
			.append('text')
				.attr("id", "popularity")
				.style("opacity", 1)
				.attr("text-anchor", "left")
				.attr("alignment-baseline", "middle")
				.style("font-size", "14px")
				.style("color", "black")
				.html("Approuvent")
				.attr("x", x(lastItem.date)+15)
				.attr("y", y(lastItem.mean)-25)

		var display_first_month = new Date( // in front of May we display popularity for Month of April
				lastItem.date.getFullYear(),
				lastItem.date.getMonth() - 1, 
				lastItem.date.getDate()
		)
		var focusDate = svg
			.append('g')
			.append('text')
				.attr("id", "popularity")
				.attr("class", "popularity-date")
				.style("opacity", 1)
				.attr("text-anchor", "left")
				.attr("alignment-baseline", "middle")
				.style("font-size", "20px")
				.style("color", "black")
				.text(d3.timeFormat("%b %Y")(display_first_month))
				.attr("x", x(lastItem.date)-40)
				.attr("y", 5 * margin.top)

		// Create the vertical line that follows the popularity
		//arrow
		var verticalLine = svg
			.append("g")
			.append("line")
				.attr("id", "popularity")
				.style("stroke", "black")
				.style('stroke-width', 1)
				.style('stroke-dasharray', ('5,1'))
				.attr("y2", 7 * margin.top)
				.attr("y1", height)
				.attr("x1", x(lastItem.date))
				.attr("x2", x(lastItem.date))


			// Create a rect on top of the svg area: this rectangle recovers mouse position
		svg
			.append('rect')
			.style("fill", "none")
			.style("pointer-events", "all")
			.attr('width', width+20)
			.attr('height', height)
			.on('mouseover', rect_mouseover)
			.on('mousemove', rect_mousemove)
			.on('mouseout', rect_mouseout);


		// What happens when the mouse move -> show the annotations at the right positions.
		function rect_mouseover() {
			percentText.style("opacity", 1)
			approveText.style("opacity", 1)
			focusDate.style("opacity", 1)
		}

		function rect_mousemove() {
			// recover coordinate we need
			var x0 = x.invert(d3.mouse(this)[0]);
			var i = bisect(data, x0, 1);

			selectedData = data[i]
			month = selectedData.date
			var display_month = new Date( // in front of May we display popularity for Month of April
					month.getFullYear(),
					month.getMonth() - 1, 
					month.getDate()
			)

			percentText
				.html(selectedData.mean + "%")
				.attr("x", x(selectedData.date)+15)
				.attr("y", y(selectedData.mean)-90)
			approveText
				.html("approuvent")
				.attr("x", x(selectedData.date)+15)
				.attr("y", y(selectedData.mean)-70)
			focusDate
				.text(d3.timeFormat("%b %Y")(display_month))
				.attr("x", x(selectedData.date)-40)
				.attr("y", 5 * margin.top)
			verticalLine
				.attr("x1", x(selectedData.date))
				.attr("x2", x(selectedData.date))
			}

		function rect_mouseout() {
			focus.style("opacity", 0)
			percentText.style("opacity", 0)
			approveText.style("opacity", 0)
			focusDate.style("opacity", 0)
			percentText.raise()
			approveText.raise()
		}

		// Show HDI 90
		svg
			.append("path")
			.datum(data)
				.attr("class", "hdi90")
				.attr("fill", "#81A1C1")
				.attr("opacity", .1)
				.attr("stroke", "none")
				.attr("d", d3.area()
					.x(function(d) { return x(d.date) })
					.y0(function(d) { return y(d.hdi_90_left) })
					.y1(function(d) { return y(d.hdi_90_right) })
					)

}
)

// -------------------------------------------------------------------
//                        == POLL DATA ==
// -------------------------------------------------------------------
d3.csv("https://raw.githubusercontent.com/pollsposition/dashboards/main/exports/polls_popularity.csv",
  function(d){ // Let us format the data variable
    return { 
      field_date : d3.timeParse("%Y-%m-%d")(d.field_date),
      sondage : d.sondage,
      method: d.method,
      p_approve: Number.parseFloat(100 * d.p_approve).toFixed(1),
      p_disapprove: Number.parseFloat(100 * d.p_disapprove).toFixed(1),
      samplesize: d.samplesize
  	}
  },
  function(data) {


  // Add a tooltip div. Here I define the general feature of the tooltip: stuff that do not depend on the data point.
  // Its opacity is set to 0: we don't see it by default.
  var tooltip = d3.select("#my_dataviz")
    .append("div")
    .style("opacity", 0)
    .attr("class", "tooltip")
    .style("padding-bottom", 30)


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
      .duration(100)
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
		highlight(d)
		d3.select(this).lower()
  }

  var mousemove = function(d) {
    tooltip
      .html(
				d.sondage + " - "
				+ d.samplesize + " interrogés"
				+ " (" + d.method + ")<br>"
				+ "<span style='color:#A3BE8C; font-weight:bold'>" + d.p_approve + "%</span> d'opinions positives<br>"
				+ "<span style='color:#BF616A; font-weight: bold'>" + d.p_disapprove + "%</span> d'opinions négatives<br>"
				+ "<span style='font-style: italic'>(" + d3.timeFormat("%d %B %Y")(d.field_date) + ")</span>"
			)
  }
	
  // A function that change this tooltip when the leaves a point: just need to set opacity to 0 again
  var mouseleave = function(d) {
    tooltip
      .transition()
      .duration(200)
      .style("opacity", 0)
		remove_highlight(d)
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
      .style("fill", "#d8dee9")
      .style("opacity", 1)
      .style("stroke", "white")
    .on("mouseover", mouseover)
    .on("mousemove", mousemove)
    .on("mouseleave", mouseleave)

})

d3.selectAll(".popularity").raise()

