var degreeMap = d3.map();
var nodes = {};
var width = window.innerWidth - 400,
  height = window.innerHeight;
var graphFrozen = false;
var comm_color = d3.scaleOrdinal(d3.schemeCategory10)
var keys = []
var force = null;
var path = null;
var node = null;
var tickCount = 0;

//Helper function to set the widths of the lines based on the title similiarites
function scaleWidth(d, spline) {
  similarity = d.value;
  switch (spline) {
    case "linear":
      r = ((similarity - minEdgeWeight) * (12 - 2)) / maxEdgeWeight + 2;
      return Math.round(r);
    case "sqrt":
      r = ((similarity - minEdgeWeight) * 2) / maxEdgeWeight;
      r = Math.round(Math.sqrt(r) + 2);
      return r;
    case "reverseL": 
      //Since our range is only 2-6, just return 2 if < .85, else 4.5
      r = similarity / maxEdgeWeight;
      if (r < 0.8) return 2;
      else {
        return 4.5;
      }
  }
}

function BuildGraph(append_mode) {
  graphFrozen = false
  //If appendFlag is false, we redraw a new graph:
  if (!append_mode) {
    d3.select("#status").text("System Status: Remove old graph");
    //Remove all child elements of the svg elements on the page
    //There should only by one, the canvas
    d3.selectAll("svg > *").remove();
    //Reset the nodes
    nodes = {};
    //Set links to the updated variable:
    links = currentEdgeListofDicts;
  }
  //If appendFlag is true, we are adding links and nodes to the existing graph
  //Do NOT reset any of the variables.  Instead, append the incoming links
  //to those already present
  else {
    links = links.concat(currentEdgeListofDicts);
  }

  d3.select("#status").text("System Status: Build Graph()");

  let ranks = rankQuestions(currentEdgeListofDicts);

  //Build the list of all nodes
  allIDs.forEach(function(id) {
    nodes[id] = { name: id };
  });

  //Now build the links.
  links.forEach(function(link) {
    link.source = nodes[link.source];
    link.target = nodes[link.target];
  });

  keys = Object.keys(nodes)
  community_function = jLouvain().nodes(keys).edges(edge_data)
  communities = community_function()
  
  force = d3
    .forceSimulation()
    .nodes(d3.values(nodes))
    .force("link", d3.forceLink(links).distance(50))
    .force(
      "center",
      d3.forceCenter(canvas_size.width / 2, canvas_size.height / 2)
    )
    .force("x", d3.forceX())
    .force("y", d3.forceY())
    .force("charge", d3.forceManyBody().strength(-250))
    .alphaTarget(1)
    .on("tick", tick);

  path = canvas
    .append("g")
    .attr("id", "force-directed")
    .selectAll("path")
    .data(links)
    .enter()
    .append("path")
    .style("stroke", "black")

    .style("stroke-width", function(d) {
      return scaleWidth(d, "reverseL");
    });

  // define the nodes
  node = canvas
    .selectAll(".node")
    .data(force.nodes())
    .enter()
    .append("g")
    .attr("class", "node")
    .on("click", click)
    .on("dblclick", dblclick)
    .on("mouseover", mouseover)
    .on("mouseout", mouseout)

    .call(
      d3
        .drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended)
    );

  d3.select("#status").text("System Status: append circles");

  // add the nodes
  node
    .append("circle")
    .attr("r", function(d) {
      var degree = 0;
      let varRadius = 0;
      for (var i = 0; i < links.length; i++) {
        if (links[i].source.name == d.name) {
          degree++;
        }
      }
      if (!varRadius) return 14;

      return 14 + varRadius;
    })

    .style("fill", function(d,i) {
     if(communities !== undefined) return comm_color(communities[d.name])
     else return comm_color(i)

    });

  // add node rank
  node
    .append("text")
    .attr("class", "rank")
    .attr("dx", -5)
    .attr("dy", 4)
    .text(function(d) {
      return ranks[d.name];
    })
    .style("fill", "white")
    .style("font-weight", "bold");

  // add the labels
  node
    .append("text")
    .attr("class", "node-title")
    .attr("dx", 7)
    .attr("dy", -7)
    .text(function(d) {
      if (levelOneIds.has(d.name)) return questionsDB.get(d.name).title;
      else return " ";
    });

}

// add the straight black lines
function tick() {
  path.attr("d", function(d) {

    return (
      "M" +
      d.source.x +
      "," +
      d.source.y +
      "L" + //
      d.target.x +
      "," +
      d.target.y
    );
  });
  node.attr("transform", function(d) {
    return "translate(" + d.x + "," + d.y + ")";
  });
}


function dragstarted(d) {
  if (!d3.event.active) force.alphaTarget(0.3).restart();
  d.fx = d.x;
  d.fy = d.y;
}

function dragged(d) {
  d.fx = d3.event.x;
  d.fy = d3.event.y;
}

function dragended(d) {
  if (!d3.event.active) force.alphaTarget(0);
  if (d.fixed == true) {
    d.fx = d.x;
    d.fy = d.y;
  } else {
    d.fx = null;
    d.fy = null;
  }
}

function mouseover(d) {
  currentLabel = d3.select(this).select(".node-title");
  if (!d.fixed) {
    currentLabel.text(function(d) {
      return questionsDB.get(d.name).title;
    });
  }
}

function mouseout(d) {
  currentLabel = d3.select(this).select(".node-title");
  //Only hide this label if the node is not frozen AND this is not a central node
  if (!d.fixed && !levelOneIds.has(d.name)) currentLabel.text(" ");
}

//REF: http://bl.ocks.org/d3noob/8043434
function click(d) {
  currentElement = d3.select(this).select("circle");
  currentLabel = d3.select(this).select(".node-title");

  if (keyboard[17]) {
    keyboard[17] = false;
    var win = window.open("https://stackoverflow.com/questions/" + d.name);
    win.focus();
    d3.select("#status").text(
      "System Status: Opened question '" +
        questionsDB.get(d.name).title +
        "' in a new tab."
    );

    return;
  }

  d.fixed = !d.fixed;
  if (d.fixed) {
    d.fx = d.x;
    d.fy = d.y;

    currentLabel.style("font", "14px sans-serif").text(function(d) {
      return "*" + questionsDB.get(d.name).title;
    });
  } else {
    d.fx = null;
    d.fy = null;
    currentLabel
      .style("font", "14px  sans-serif")
      .text(function(d) {
        return questionsDB.get(d.name).title;
      });
  }
}

function dblclick(d) {
  SearchForQuestionsLinkedTo(d.name, false, (matchLimit = 5));
}

var myButton = document.getElementById("freezeMe");
myButton.addEventListener("click", function(event) {
  if(force === null) return;
  graphFrozen = !graphFrozen;
  if (graphFrozen) {
    force.stop();
    d3.select("#status").text("System Status: Graph frozen.");

  } else {
    d3.select("#status").text("System Status: Graph unfrozen.");
    force.restart();
  }
});
