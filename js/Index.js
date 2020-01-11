
var words = [];
var KEY_CODE = { "ARROW_DOWN" : 40, "ARROW_UP" : 38, "ENTER" : 13 , "TAB" : 9}
var margin = {right : 0, top : 50 };
var graphSize = {};
var canvas_size = {};
var canvas;
var nodesMap;
var keyboard = [];

function set_canvas() {
    canvas = d3.select('body').append('svg')
            .attr('id', 'svg-canvas')
            .attr('width', width)
            .attr('height', height)
            .attr("transform", "translate(0, " + margin.top + ")");
    canvas_size.width = width
    canvas_size.height = height
    graphSize.width = width*.75;
    graphSize.height = height*.75;
}
window.addEventListener("keydown", keysPressed, false);
window.addEventListener("keyup", keysReleased, false);

function keysPressed(e) {
	// store an entry for every key pressed
    keyboard[e.keyCode] = true;
	
}

function keysReleased(e) {
	// mark keys that were released
	keyboard[e.keyCode] = false;
}

function init() {
    set_canvas()
    autocomplete(document.getElementById("searchbar"), words);
}

var prom = loadAllTags()
    .then(init);