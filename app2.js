var data = [];
var clusters;
var zoom_level = 1.0;
var num_points = 30;
var clust_type = 'heirarchical';
var dist_type = 'avg';

var loadDataLink = document.getElementById("loadDataLink");
loadDataLink.onclick = function () { loadData(10000); return false; }

var typeDropdown = document.getElementById("typeSelector");
var heirarchicalControls = document.getElementById("heirarchicalControls");
var radialControls = document.getElementById("radialControls");
typeDropdown.oninput = function() {
  clust_type = this.value;
  buildClusters(dist_type, clust_type);
  
  if (clust_type == 'radial') {
	  heirarchicalControls.style.display = 'none';
	  radialControls.style.display = 'block';
  } else {
	  heirarchicalControls.style.display = 'block';
	  radialControls.style.display = 'none';
  }
};

var distDropdown = document.getElementById("distSelector");
distDropdown.oninput = function() {
  if (dist_type != this.value) {
    dist_type = this.value;
	clusters.linkage(dist_type);
    rebuildClusters();
    redraw(zoom_level, num_points);
  }
};

// points slider
var slider = document.getElementById("pointsControl");
var sliderDisp = document.getElementById("pointsIndicator");
slider.value = num_points;
sliderDisp.innerHTML = num_points;
slider.oninput = function() {
  num_points = this.value;
  sliderDisp.innerHTML = num_points;
  redraw(zoom_level, num_points);
};

// init map
var mapContainer = document.getElementById("map");
var data = [{
	type: 'scattergeo',
	locationmode: 'USA-states',
	lat: [],
	lon: [],
	text: [],
	hoverinfo: 'text',
	marker: {
		size: [],
		line: {
		  color: 'black',
		  width: 2
		},

	}
}];

var layout = {
	showlegend: false,
	margin: {
	  t: 0, l: 0, r: 0, b: 0
	},
	geo: {
	  margin: {
		l: 0, r: 0, b: 0
	  },
	  scope: 'usa',
	  projection: {
		type: 'albers usa'
	  },
	  showland: true,
	  landcolor: 'rgb(217, 217, 217)',
	  subunitwidth: 1,
	  countrywidth: 1,
	  subunitcolor: 'rgb(255,255,255)',
	  countrycolor: 'rgb(255,255,255)'
	},
};

Plotly.newPlot(mapContainer, data, layout, {showLink: true, showSendToCloud: true});

// This is for automatically rescaling clster sizes when zooming in
mapContainer.on('plotly_relayout',
   function(eventdata){
	  var scale = eventdata['geo.projection.scale'];
	  console.log(scale);
	  if (! isNaN(scale)) {
		zoom_level = scale;
		if (clust_type == 'radial') {
			clusters.threshold(2.5/zoom_level);
			rebuildClusters();
		} else {
		    redraw(zoom_level, num_points);
	    }
	  }
   });


// Redraw map
function redraw(zoom, num_points = 30) {
	
	// Get cluster at num_points level
	var k_cluster = clusters.getClusters(num_points);
	
	function get_means(clusters, key) {
	  return clusters.map( function(cluster) {
	    var size = cluster.length
	    sum = cluster.reduce(function(a, b) { return a + b[key]*1; }, 0.0);
	    return sum / size
	   })
	}
	
	function get_sums(clusters, key) {
	  return clusters.map( function(cluster) {
	    return cluster.reduce(function(a, b) { return a + b[key]*1; }, 0.0);
	   })
	}
	
	var cityPop = get_sums(k_cluster, 'pop'),
		cityLat = get_means(k_cluster, 'lat'),
		cityLon = get_means(k_cluster, 'lon'),
		color = [,"rgb(255,65,54)","rgb(133,20,75)","rgb(255,133,27)","lightgrey"],
		citySize = [],
		hoverText = [],
		scale = 0.01;

	for ( var i = 0 ; i < cityPop.length; i++) {
	  var currentSize = Math.sqrt(cityPop[i]) * scale * zoom;
	  var currentText = "<br>Population: " + cityPop[i];
	  citySize.push(currentSize);
	  hoverText.push(currentText);
	}
	
	var update = {
		type: 'scattergeo',
	    locationmode: 'USA-states',
	    hoverinfo: 'text',
		lat: [cityLat],
	    lon: [cityLon],
	    text: [hoverText],
	    marker: [{
		    size: citySize,
			line: {
		      color: 'black',
		      width: 2
		    },
	    }]
	};
	
	Plotly.restyle(mapContainer, update);

}


// Build clusters
var loadingIndicator = document.getElementById("loadingIndicator");
var loadingBlackout = document.getElementById("loadingBlackout");
function buildClusters(dist_type, clust_method) {
	loadingIndicator.innerHTML = "Building cluster trees...";
    loadingBlackout.style.display = 'block';
    setTimeout( function() {
	  var t = performance.now();
	  if (clust_method == 'radial') {  
	    clusters = rcluster()
		  .threshold(2.5/zoom_level)
		  .data(data);
	  } else {
	    clusters = hcluster()
	      .distance('euclidean')
	      .linkage(dist_type)
	      // .verbose(true)
	      .data(data);
	  }
	  t = performance.now() - t;
	  loadingIndicator.innerHTML = "Done! (" + t/1000 + " seconds)";
	  loadingBlackout.style.display = 'none';
	  
	  redraw(zoom_level, num_points);
	  }, 50 );
}

function rebuildClusters() {
	loadingIndicator.innerHTML = "Building cluster trees...";
    loadingBlackout.style.display = 'block';
    setTimeout( function() {
	  var t = performance.now();
	  clusters.rebuild();
	  t = performance.now() - t;
	  loadingIndicator.innerHTML = "Done! (" + t/1000 + " seconds)";
	  loadingBlackout.style.display = 'none';
	  
	  redraw(zoom_level, num_points);
	  }, 10 );
}




// Load data
function loadData(n) {
  Plotly.d3.csv('https://raw.githubusercontent.com/plotly/datasets/master/2014_us_cities.csv', function(err, rows){
    
	data = rows.map(function(row) { return {
		'name': row['name'],
		'pop': row['pop'],
		'lat': row['lat'],
		'lon': row['lon'],
		'position': [ row['lat'], row['lon'] ]
	} })
	.sort((a,b) => b.pop - a.pop)
	.slice(0,n);
	
    
    buildClusters(dist_type);
	
  });
}

loadData(1000);
