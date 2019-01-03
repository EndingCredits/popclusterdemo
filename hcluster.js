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


var hasOwn = Object.prototype.hasOwnProperty;
var toStr = Object.prototype.toString;

var isArray = function isArray(arr) {
	if (typeof Array.isArray === 'function') {
		return Array.isArray(arr);
	}

	return toStr.call(arr) === '[object Array]';
};

function isPlainObject(obj) {
	if (!obj || toStr.call(obj) !== '[object Object]') {
		return false;
	}

	var hasOwnConstructor = hasOwn.call(obj, 'constructor');
	var hasIsPrototypeOf = obj.constructor && obj.constructor.prototype && hasOwn.call(obj.constructor.prototype, 'isPrototypeOf');
	// Not own constructor property must be Object
	if (obj.constructor && !hasOwnConstructor && !hasIsPrototypeOf) {
		return false;
	}

	// Own properties are enumerated firstly, so to speed up,
	// if last one is own, then all properties are own.
	var key;
	for (key in obj) {/**/}

	return typeof key === 'undefined' || hasOwn.call(obj, key);
};

function extend() {
	var options, name, src, copy, copyIsArray, clone,
		target = arguments[0],
		i = 1,
		length = arguments.length,
		deep = false;

	// Handle a deep copy situation
	if (typeof target === 'boolean') {
		deep = target;
		target = arguments[1] || {};
		// skip the boolean and the target
		i = 2;
	} else if ((typeof target !== 'object' && typeof target !== 'function') || target == null) {
		target = {};
	}

	for (; i < length; ++i) {
		options = arguments[i];
		// Only deal with non-null/undefined values
		if (options != null) {
			// Extend the base object
			for (name in options) {
				src = target[name];
				copy = options[name];

				// Prevent never-ending loop
				if (target !== copy) {
					// Recurse if we're merging plain objects or arrays
					if (deep && copy && (isPlainObject(copy) || (copyIsArray = isArray(copy)))) {
						if (copyIsArray) {
							copyIsArray = false;
							clone = src && isArray(src) ? src : [];
						} else {
							clone = src && isPlainObject(src) ? src : {};
						}

						// Never move original objects, clone them
						target[name] = extend(deep, clone, copy);

					// Don't bring in undefined values
					} else if (typeof copy !== 'undefined') {
						target[name] = copy;
					}
				}
			}
		}
	}

	// Return the modified object
	return target;
};

//
var hcluster = function() {
  var data,
      dists,
      clusters,
      clustersGivenK,
      treeRoot,
	  accessor = (d) => d['position'],
      distanceName = 'angular',
      distanceFn = euclideanDistance,
      linkage = 'avg',
	  threshold = Infinity,
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
	clust._calcDists();
    clust._buildTree();
    return clust;
  };
  // rebuilds tree without recalculating distance matrix
  clust.rebuild = function() {
    clust._buildTree();
	return clust;
  };
  clust.posKey = function(value) {
    if(!arguments.length) return posKey;
    posKey = value;
    return clust;
  };
  clust.accessor = function(value) {
    accessor = value;
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
  clust.getClusters = function(n) {
    if(!treeRoot) throw new Error('Need to passin data and build tree first.');
    if(n > data.length) throw new Error('n must be less than the size of the dataset');
    return clustersGivenK[clustersGivenK.length - n]
             .map(function(indexes) {
               return indexes.map(function(ndx) { return data[ndx]; });
             });
  };

  //
  // calculate distances
  //
  clust._calcDists = function() {
    if(!data || !data.length) throw new Error('Need `data` to build tree');
		
    // Calculate distances
	console.log("Calculating distances");
	console.time();
	dists = Array(data.length);
    for (var i = 0; i < data.length; i++) {
       dists[i] = Array(data.length);
       for (var j = 0; j <= i; j++) {
          var dist = (i == j) ? Infinity : 
			 distanceFn(accessor(data[i]), accessor(data[j]));
          dists[i][j] = dist;
          dists[j][i] = dist;
       }
    }
	console.log("Done!");
	console.timeEnd();
  }
  
  //
  // tree construction
  //	
  clust._buildTree = function() {
	if(!data || !data.length) throw new Error('Need `data` to build tree');
    if(!dists || !dists.length) throw new Error('Need to calculate dists first');
	
	clusters = [];
	clustersGivenK = [];
	
	// Adapted from clusterfck repo	
    var mins = Array(data.length),   // closest cluster for each cluster
        index = Array(data.length);  // keep a hash of all clusters by key
	
    // Initialise variables
	for (var i = 0; i < data.length; i++) {
       var cluster = extend(data[i], {
          key: i,
          index: i,
		  indexes: [i],
		  height: 0,
          size: 1
		});
       clusters[i] = cluster;
       index[i] = cluster;
       mins[i] = 0;
	   for (var j = 0; j < data.length; j++) {
	      if (dists[i][j] < dists[i][mins[i]]) {
             mins[i] = j;               
          }
	   }
    }
	
	// Main loop
	console.log("Performing heirarchical clustering");
	console.time();
	for(var iter = 0; iter < data.length - 1; iter++) {
		
      // find two closest clusters from cached mins
      var minKey = 0, min = Infinity;
      for (var i = 0; i < clusters.length; i++) {
         var key = clusters[i].key,
             dist = dists[key][mins[key]];
         if (dist < min) {
            minKey = key;
            min = dist;
		 }
      }
	  var c1 = index[minKey],
          c2 = index[mins[minKey]];
		  
	  // Halt if above threshold
      if (min >= threshold) {
         return false;         
      }

      // merge two closest clusters
	  var merged = {
        name: 'Node ' + iter,
        height: min, //distance between them
        children: [ c1, c2 ],
		indexes: c1.indexes.concat(c2.indexes),
		key: c1.key,
		size: c1.size + c2.size
      };
      clusters[c1.index] = merged;
      clusters.splice(c2.index, 1);
      index[c1.key] = merged;

      // update distances with new merged cluster
      for (var i = 0; i < clusters.length; i++) {
         var ci = clusters[i];
         var dist;
         if (c1.key == ci.key) {
            dist = Infinity;            
         }
         else if (linkage == "min") {
            dist = dists[c1.key][ci.key];
            if (dists[c1.key][ci.key] > dists[c2.key][ci.key]) {
               dist = dists[c2.key][ci.key];
            }
         }
         else if (linkage == "max") {
            dist = dists[c1.key][ci.key];
            if (dists[c1.key][ci.key] < dists[c2.key][ci.key]) {
               dist = dists[c2.key][ci.key];              
            }
         }
         else if (linkage == "avg") {
            dist = (dists[c1.key][ci.key] * c1.size
                   + dists[c2.key][ci.key] * c2.size) / (c1.size + c2.size);
         }
         else {
            dist = distanceFn(ci, c1);            
         }

         dists[c1.key][ci.key] = dists[ci.key][c1.key] = dist;
      }

    
      // update cached mins
      for (var i = 0; i < clusters.length; i++) {
         var key1 = clusters[i].key;        
         if (mins[key1] == c1.key || mins[key1] == c2.key) {
            var min = key1;
            for (var j = 0; j < clusters.length; j++) {
               var key2 = clusters[j].key;
               if (dists[key1][key2] < dists[key1][min]) {
                  min = key2;                  
               }
            }
            mins[key1] = min;
         }
         clusters[i].index = i;
      }
    
      // clean up metadata used for clustering
      delete c1.key; delete c2.key;
      delete c1.index; delete c2.index;
      
	  // keep track of clusters
	  clustersGivenK.push(clusters.map(function(c) { return c.indexes; }));
    }
	
	console.log("Done!");
	console.timeEnd();

    treeRoot = clusters[0];
	
	// clean up metadata used for clustering
	delete treeRoot.key; delete treeRoot.key;
    delete treeRoot.index; delete treeRoot.index;
  };

  // TODO: better rebalancing algo? ... this is just for presentation
  // rebalance after tree is built (b/c it is top down operation)
  // clust._rebalanceTree = function(node) {
  //   if(node.parent && node.parent.children && node.parent.children.length &&
  //      node.children && node.children.length) {
  //     var rightDistance = clust['_'+linkage+'Distance'](
  //       node.parent.children[1].indexes,
  //       node.children[0].indexes);
  //     var leftDistance = clust['_'+linkage+'Distance'](
  //       node.parent.children[1].indexes,
  //       node.children[1].indexes);

  //     // switch order of node.children
  //     if(leftDistance > rightDistance) {
  //       node.children = [ node.children[1], node.children[0] ];
  //       node.indexes = node.children[0].indexes.concat(node.children[1].indexes);
  //     }
  //   }
  //   if(node.children) {
  //     clust._rebalanceTree(node.children[0]);
  //     clust._rebalanceTree(node.children[1]);
  //   }
  // };

  return clust;
}
