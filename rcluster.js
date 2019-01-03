//
// This is a modified version of hcluster.js from https://github.com/cmpolis/hcluster.js/
//

//
function linfDistance(a, b, accessor) {
  var x = accessor ? a.map(accessor) : a,
      y = accessor ? b.map(accessor) : b,
      distance = Math.abs(x[0] - y[0]);
  for(var ndx = 1; ndx < x.length; ndx++) {
    distance = Math.max(distance, Math.abs(x[ndx] - y[ndx]));
  }
  return distance;
}

//
function cosineSimilarity(a, b, accessor) {
  var x = accessor ? a.map(accessor) : a,
      y = accessor ? b.map(accessor) : b,
      dotProduct = 0,
      xMagnitude = 0,
      yMagnitude = 0;

  for(var ndx = 0; ndx < x.length; ndx++) {
    xMagnitude += x[ndx] * x[ndx];
    yMagnitude += y[ndx] * y[ndx];
    dotProduct += x[ndx] * y[ndx];
  }
  return dotProduct / ( Math.sqrt(xMagnitude) * Math.sqrt(yMagnitude) );
}

//
function euclideanDistance(a, b, accessor) {
  var x = accessor ? a.map(accessor) : a,
      y = accessor ? b.map(accessor) : b,
      distance = 0;
  for(var ndx = 0; ndx < x.length; ndx++) {
    distance += (x[ndx] - y[ndx]) * (x[ndx] - y[ndx]);
  }
  return Math.sqrt(distance);
}

//
function manhattanDistance(a, b, accessor) {
  var x = accessor ? a.map(accessor) : a,
      y = accessor ? b.map(accessor) : b,
      distance = 0;
  for(var ndx = 0; ndx < x.length; ndx++) {
    distance += Math.abs(x[ndx] - y[ndx]);
  }
  return distance;
}

//
var rcluster = function() {
  var data,
      clusters,
      clustersGivenK,
      treeRoot,
      posKey = 'position',
      distanceName = 'angular',
      distanceFn = euclideanDistance,
      linkage = 'avg',
	  threshold = 1,
      verbose = false;

  //
  // simple constructor
  function clust() { }

  //
  // getters, setters a la D3s

  // return data or set data and build tree
  clust.data = function(value) {
    if(!arguments.length) return data;

    // dataset will be mutated
    data = value;
    clust._findClusters();
    return clust;
  };
  clust.threshold = function(value) {
    if(!arguments.length) return threshold;
    threshold = value;
    return clust;
  };
  clust.posKey = function(value) {
    if(!arguments.length) return posKey;
    posKey = value;
    return clust;
  };
  clust.linkage = function(value) {
    if(!arguments.length) return linkage;
    linkage = value;
    return clust;
  };
  clust.verbose = function(value) {
    if(!arguments.length) return verbose;
    verbose = value;
    return clust;
  };
  clust.distance = function(value) {
    if(!arguments.length) return distanceName;
    distanceName = value;
    distanceFn = {
      angular: cosineSimilarity,
      euclidean: euclideanDistance
    }[value] || euclideanDistance;
    return clust;
  }

  //
  // get tree properties

  clust.orderedNodes = function() {
    if(!treeRoot) throw new Error('Need to passin data and build tree first.');

    return treeRoot.indexes.map(function(ndx) {
      return data[ndx];
    });
  };
  clust.tree = function() {
    if(!treeRoot) throw new Error('Need to passin data and build tree first.');
    return treeRoot;
  };
  clust.getClusters = function() {
    if(!clusters) throw new Error('Need to pass in data and build tree first.');
    return clusters.map(function(indexes) {
            return indexes.map(function(ndx) { return data[ndx]; });
        });
  };

  //
  // tree construction
  //
  clust._findClusters = function() {
    if(!data || !data.length) throw new Error('Need `data` to build tree');

	clusters = [];
	
	// Adapted from clusterfck repo	
	var neighbours = [],
		degree = [],
		active = [];
	
    // Initialise variables
	
    // Calculate distances and build graph
	console.log("Calculating distances");
	console.time();
    for (var i = 0; i < data.length; i++) {
	   active[i] = 1, // dists[i] = [],
	   degree[i] = 0, neighbours[i] = [];
       for (var j = 0; j <= i; j++) {
          var dist = (i == j) ? Infinity : 
			 distanceFn(data[i][posKey], data[j][posKey]);
          //dists[i][j] = dist;
          //dists[j][i] = dist;

          if (dist < threshold) {
			 neighbours[i].push(j);
			 neighbours[j].push(i);
			 degree[i] += 1;
			 degree[j] += 1;
          }
       }
    }
	console.log("Done!");
	console.timeEnd();
	
    // Iteratively remove maximal cliques
	console.log("Computing covering...");
	console.time();
	while (active.includes(1)) {
				
		//
		// Calculate approx maximum clique covering according to
		//    http://ryanrossi.com/pubs/www14-pmc-rossi.pdf
		//
		
		// Calculate core numbers by iteratively removing nodes of degree < k
		var coreNum = Array(data.length).fill(-1),
			k = 0,
			activeCopy = [...active],
			degreeCopy = [...degree],
			lastRemoved = 0;
			
		while (activeCopy.includes(1)) {	
			// loop through nodes and remove all with deg < keep
			for (var i = 0; i < data.length; i++) {
				if (i == lastRemoved) k++; // increment k if we didn't find any to remove
				if (activeCopy[i] == 0) continue; // skip if already removed
				if (degreeCopy[i] < k) {
					// remove node
					coreNum[i] = k-1; // set core num
					activeCopy[i] = 0; // set inactive
					for (var j = 0; j < neighbours[i].length; j++) {
						degreeCopy[neighbours[i][j]] -= 1 //decrement degree of connected nodes
					}
					lastRemoved = i; // reset last_removed
				}				
			}	
		}
		
		
		// Sort nodes in decreasing core num
		vertexIndices = [...coreNum]
			.map((item, index) => [ item, index ])
			.sort((a, b) => b[0] - a[0])
			.map((item) => item[1])
			
		// Apply routine
		// -> Sort(V) by coreNum
		// -> set H = {}, max = 0
		// -> for each v in V:
		// ->   if coreNum(v) >= max:
		// ->     S = neighbours(v) where coreNum >= max
		// ->     Sort(S) by coreNum
		// ->     C = {}
		// ->     for each u in S:   	
		// ->       if C + u is clique:
		// ->         C.append(u)
		// ->     if |C| > max:
		// ->       H = C
		// ->       max = |C|
		var maxCluster = [],
			maxClusterSize = 0,
			magicBreakNum = 1;
			
		for (var i = 0; i < vertexIndices.length; i++) {
			
			// Fast
			// 1224, 737, 366, ()161, 58, 23, 10, 3, 1

			// Full
			// 1225, 733, 366, ()158, 60, ...
			if (i >= magicBreakNum ) { break; }
			
			var v = vertexIndices[i];
			if (coreNum[v] < maxClusterSize) { break; }
			
			var cluster = [v];
			var S = neighbours[v]
				.map((item) => [coreNum[item], item])
				.sort((a, b) => b[0] - a[0])
				.map((item) => item[1]);
			for (var j = 0; j < S.length; j++) {
				var u = S[j];
				if (coreNum[u] < maxClusterSize) { break; } // only use u with coreNum >= max
				if (!active[u]) { continue; } // skip if node inactive
				// check all elements of the cluster are neighbours of u
				var clique = true;
				if (false) {
					// this method should be faster, but it isn't
					var isNeighbour = Array(vertexIndices.length).fill(0);
					for (var k = 0; k < neighbours[u].length; k++)
						isNeighbour[neighbours[u][k]] = 1;
					for (var k = 0; k < cluster.length; k++) {
						if (!isNeighbour[cluster[k]]) {
							clique = false;
							break;
						}
					}
				} else {
					for (var k = 0; k < cluster.length; k++) {
						if (!neighbours[u].includes(cluster[k])) {
							clique = false;
							break;
						}
					}
				}
				if (clique) { cluster.push(u); }
			}
			if (cluster.length > maxClusterSize) {
				maxCluster = cluster;
				maxClusterSize = cluster.length;
				//console.log("Max beaten (" + i + "th element with size " + maxClusterSize + ")");
			}
		}
			
		
		// Remove max cluster and append to list
		for (var i = 0; i < maxClusterSize; i++) {
			var v = maxCluster[i];
			active[v] = 0;
			for (var j = 0; j < neighbours[v].length; j++) {
				degree[neighbours[v][j]] -= 1;
			}
		}
		clusters.push(maxCluster);
		
		/*console.log("Core nums");
		console.log(coreNum);
		
		console.log("Active");
		console.log(active);
		
		console.log("Degrees");
		console.log(degree);
		
		console.log(maxCluster);*/
    }
	console.log("Done!");
	console.timeEnd();
	console.log(clusters);
  }
  
  return clust;
}
