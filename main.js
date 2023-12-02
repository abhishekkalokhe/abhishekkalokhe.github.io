var song_similarity_csv = 'data/song_similarity_recommendations_500k.csv';
var user_recommendations_csv = 'data/user_song_recommendations_500k.csv';
var nodes_csv = 'data/songs_details.csv';
var user_top_played_csv='data/user_top_played_songs.csv';

// SVG Dimensions
var width = 1080;
var height = 720;
var margins = {
    left: 50,
    right: 50,
    top: 50,
    bottom: 50
};
var networkGraphWidth = width - margins.left - margins.right;
var networkGraphHeight = height - margins.top - margins.bottom;
var radiusScale = d3.scaleLinear().range([5, 25]);
const colors = {
    'USER': '#E0538F',
    'DEFAULT': '#2E64A2',
    'EXPANDED': '#95D134'
};
var nodes, edges, edges1, edges2, user_topsongs, allUsersMap, allNodesMap, songEdges, newSongEdges;
var sliderValue;
var graphData, graph, selectedSong, graphDataMap, recommendationsDiv;
var recommendations = [];
var expandedSongs = [];
var force;

const slider = document.getElementById("similar_count_slider");

let tip = d3.tip().attr('class', 'd3-tip').attr("id", "tooltip");

const search = document.getElementById("search");
//console.log(search);

Promise.all([
    d3.dsv(",", song_similarity_csv, function (ssr) {
        return {
            source: ssr.source_song_id,
            target: ssr.target_song_id,
            rank: parseInt(ssr.rank)
        };
    }),
    d3.dsv(",", user_recommendations_csv, function (usr) {
        return {
            source: usr.user_id,
            target: usr.song_id,
            rank: parseInt(usr.rank)
        };
    }),
    d3.dsv(",", nodes_csv, (node) => {
        return {
            song_id: node.song_id,
            song_name: node.title,
            genre: node.genre,
            artist_name: node.artist_name,
            year: parseInt(node.year),
            song_hotness: isNaN(parseFloat(node.song_hotttnesss)) ? 0 : parseFloat(node.song_hotttnesss), //isNaN(parseFloat(row[columnIndex])) ? 0 : parseFloat(row[columnIndex])
            
            label: 0
        };
    }),
    d3.dsv(",", user_top_played_csv, function (utp) {
        return {
            user_id: utp.user_id,
            song_id: utp.song_id,
            song_name: utp.title,
            listen_count: parseInt(utp.listen_count),
            user_name: utp.fake_name,
            label: 1
        };
    })
]).then(allData => {
    edges1 = allData[0]; // all edges data from csv file
    edges2 = allData[1]; // all edges data from csv file
    nodes = allData[2]; // all node data from the csv file
    user_topsongs=allData[3]; //user top song data
    //console.log(user_topsongs)
    edges = edges1.concat(edges2);

    const uniqueUsers = Array.from(new Set(user_topsongs.map(item => JSON.stringify({ user_id: item.user_id, user_name: item.user_name, label: item.label })))).map(JSON.parse);
    //console.log(uniqueUsers);
    const users_array = uniqueUsers.map(item => {
        const newItem = { ...item, id: item.user_id };
        delete newItem.user_id;
        return newItem;
      });
    //console.log(users_array);

    allUsersMap = uniqueUsers.reduce((obj, item, idx) => {
        item['index'] = idx;
        item.children = null;
        obj[item['user_id']] = item;
        return obj;
    }, {}); // map for quick lookup of user nodes by id


    allNodesMap = nodes.reduce((obj, item, idx) => {
        item['index'] = idx;
        item.children = null;
        obj[item['song_id']] = item;
        return obj;
    }, {}); // map for quick lookup of nodes by id

    radiusScale.domain([5, 25]);

    var svg = d3.select("body").append("svg")
        .attr("width", width)
        .attr("height", height);

    graph = svg.append("g")
        .attr("width", networkGraphWidth)
        .attr("height", networkGraphHeight)
        .attr("transform", "translate( " + margins.left + ", " + margins.top + ")");

    recommendationsDiv = d3.select("body")
        .append("div")
        .attr("id", "recommendations-div")
    
    // selectedSong = nodes[152799];
    selectedSong = uniqueUsers[0];
    sliderValue = 5;

    displayTopSongs(selectedSong.user_id)
    fetchGraphData(selectedSong);
    graphDataMap = buildGraphDataMap({});
    drawGraph();

    // List of songs to display
    var selectTag = d3.select("select");

    var options = selectTag.selectAll('#select_user')
        .data(uniqueUsers.slice(0,100));

    options.enter()
        .append('option')
        .attr('value', function (d) {
            return d.user_id;
        })
        .attr('id', function (d) {
            return d.user_id;
        })
        .text(function (d) {
            return d.user_name
        });
    
    document.getElementById("search").addEventListener("click", function () {
        var e = document.getElementById("user");
        var text = e.options[e.selectedIndex].id;
        selectedSong = allUsersMap[text]; // Fix: Use text directly as the key
        recommendations = [];
        displayTopSongs(text)
        clearGraph();
        fetchGraphData(selectedSong);
        graphDataMap = buildGraphDataMap({});
        drawGraph();

        ;
    });

    // Display initial nodes of top songs to select from

    var topDiv = d3.select("#top_songs");
    var topSongList = nodes.sort((a, b) => b.song_hotness - a.song_hotness);

    var disc = topDiv
        .selectAll(".disc")
        .data(topSongList.slice(0, 9))
        .enter()
        .append("button")
        .style("padding", "5px")
        .style("margin", "5px")
        .attr("id", (d) => d.song_id)
        .attr("class", "disc")
        .on("click", function (d) {
            selectedSong = allNodesMap[d.song_id]
            recommendations = [];
            clearGraph();
            fetchGraphData(selectedSong);
            graphDataMap = buildGraphDataMap({});
            drawGraph();
        });

    disc.append("text")
        .attr("stroke", "black")
        .attr("font-size", "11px")
        .attr("text-anchor", "middle")
        .text(function (d) {
            return d['song_name'];
        });

    //   Slider 
    /*
    slider.addEventListener("input", function () {
        sliderValue = this.value;
        recommendations = [];
        clearGraph();
        fetchGraphData(selectedSong);
        graphDataMap = buildGraphDataMap({});
        drawGraph();
        // displayRecommendations();
    });
    */
    document.getElementById("similar_count_slider").addEventListener("input", function () {
        sliderValue = this.value;
        document.getElementById("slider-value").innerText = sliderValue; 
        recommendations = [];
        clearGraph();
        fetchGraphData(selectedSong);
        graphDataMap = buildGraphDataMap({});
        drawGraph();
    });


    // Dynamic color of nodes (genre/pin?)

    // Dynamic color and thickness of edges (based on collaboration?)

    // Any other styling for selected node

    // tooltip for nodes
    tip.html(function (d) {
        return getTooltipStats(d);
    });
    graph.call(tip);


}).catch(error => {
    console.log(error)
});

/**
 * Build a map of all current nodes in the network
 * The id of the nodes are the keys in the map
 * The node objects are the values
 * @param currentMap existing map to add the nodes to
 */
function buildGraphDataMap(currentMap) {
    graphData.forEach(node => {
        currentMap[node['song_id']] = node;
    });
    return currentMap;
}


/**
 * Function to get nodes and edges in the form required for force simulation
 * @param {*} selectedSong node that was selected
 */
function fetchGraphData(selectedSong) {
    selectedSong.children = [];
    graphData = [selectedSong];
    if (selectedSong.user_id){
        songEdges = getSongNetwork(selectedSong['user_id'], sliderValue);
        songEdges.forEach(edge => {
            var target = allNodesMap[edge['target']];
            graphData.push(target);
            selectedSong.children.push(target);
            recommendations.push(target);
        });
    }
    else{
        songEdges = getSongNetwork(selectedSong['song_id'], sliderValue);
        songEdges.forEach(edge => {
            var target = allNodesMap[edge['target']];
            graphData.push(target);
            selectedSong.children.push(target);
            recommendations.push(target);
        });
    }
}

/**
 * Function to get the data to show in the tooltip
 * @param {*} hoveredNode node which is currently hovered
 * @returns 
 */
function getTooltipStats(hoveredNode) {
    if (hoveredNode.user_id){
        return "User Name: " + hoveredNode['user_name'];
    }
    else{
        return "Song Name: " + hoveredNode['song_name'] + 
        "<br> Artist Name: " + hoveredNode['artist_name'] +
        "<br> Genre: " + hoveredNode['genre'] +
        "<br> Year: " + parseInt(hoveredNode['year'])+
        "<br> Hotness: " + parseFloat(hoveredNode['song_hotness']).toFixed(2);
    }
    
    // "<br> Average Hotness: " + parseFloat(hoveredNode['avg_hotness']).toFixed(2) +
    // "<br> Average Familiarity: " + parseFloat(hoveredNode['avg_familiarity']).toFixed(2) +
    // "<br> Total Tracks: " + hoveredNode['total_tracks'];
}

/**
 * To get the similar artist network from list of edges
 * @param source_id: id of the artist to find the network for
 * @param count: number of similar artists to return sorted by priority
 */
function getSongNetwork(source_id, count = 9) {
    let filtered = edges.filter(edge => edge['source'] === source_id);

    //create a deep copy of the edges because forceSimulation modifies these edges
    let neighbors = JSON.parse(JSON.stringify(filtered))
        .sort((edge1, edge2) => edge1['rank'] - edge2['rank'])
        .slice(0, count);
    return neighbors;
}

/**
 * Handle the tick event for force simulation
 */
function tick() {
    path.attr("d", function (d) {
        var dx = d.target.x - d.source.x,
            dy = d.target.y - d.source.y,
            dr = Math.sqrt(dx * dx + dy * dy);
        var test = "M" +
            d.source.x + "," +
            d.source.y + "A" +
            dr + "," + dr + " 0 0,1 " +
            d.target.x + "," +
            d.target.y;
        return test;
    });

    node.attr("transform", function (d) {
        return "translate(" + d.x + "," + d.y + ")";
    });
}


/**
 * Clear the network by removing all children elements
 * @param graph group node under SVG
 */
function clearGraph() {
    graph.selectAll("*").remove();
}

/**
 * Function to plot the nodes, add force simulation, path, etc
 */
function drawGraph() {
    // Set the colors for the links and circles for the top nodes
    var topLinkColor = "yellow";
    var topCircleColor = "orange";


    if (force != null)
        force.stop();
    force = d3.forceSimulation()
        .nodes(d3.values(graphDataMap))
        .force("link", d3.forceLink(songEdges).id((d) => {
            if (d.user_id) {
                return d['user_id'];
            }
            else{
                return d['song_id'];
            }
            }).distance(150).strength(0.1))
        .force('center', d3.forceCenter(networkGraphWidth / 2, networkGraphHeight / 2))
        .force("x", d3.forceX())
        .force("y", d3.forceY())
        .force("charge", d3.forceManyBody().strength(-700))
        .alphaTarget(0.1)
        .on("tick", tick);

    /*  path = graph.append("g")
         .selectAll("path")
         .data(songEdges)
         .enter()
         .append("path") */
    var nodes = force.nodes();
    var topNodes = nodes.sort((a, b) => b.song_hotnesss - a.song_hotnesss).slice(0, 5);

    path = graph.append("g")
        .selectAll("path")
        .data(songEdges)
        .enter()
        .append("path")
        .attr("class", (d) => {
            if (topNodes.includes(d.source) && topNodes.includes(d.target)) {
                return "default-link"; // add a class for top nodes
            } else {
                return "default-link"; // add a class for all other nodes
            }
        })
        // .attr("stroke-width", (d) => {
        //     if (topNodes.includes(d.source) && topNodes.includes(d.target)) {
        //         return 4; // set a larger stroke width for paths connecting two top nodes
        //     } else {
        //         return 2; // set the default stroke width for all other paths
        //     }
        // })
        .attr("fill", (d) => {
            if (topNodes.includes(d.source) && topNodes.includes(d.target)) {
                return "none"; // set a larger stroke width for paths connecting two top nodes
            } else {
                return "none"; // set the default stroke width for all other paths
            }
        })
        .attr("stroke", (d) => {
            if (topNodes.includes(d.source) && topNodes.includes(d.target)) {
                return "#666"; // set a larger stroke width for paths connecting two top nodes
            } else {
                return "#666"; // set the default stroke width for all other paths
            }
        });

    node = graph.selectAll(".node")
        .data(force.nodes())
        .enter().append("g")
        .attr("class", "node")
        .on("dblclick", update)
        .on('mouseover', tip.show)
        .on('mouseout', tip.hide);

    /*  node.append("circle")
         .attr("id", function (d) {
             return d.id;
         })
         .attr("r", function (d) {
             return radiusScale(d['total_tracks']);
         })
         .attr("fill", (d) => {
             if (d['artist_id'] == selectedArtist['artist_id']) return colors.SELECTED;
             else if (d['children'] != null) return colors.EXPANDED;
             return colors.DEFAULT;
         }) */

    node.append("circle")
        .attr("id", function (d) {
            return d.id;
        })
        /*
        .attr("r", function(d) {
          return radiusScale(d.song_hotness);
        })
        */
        .attr("r", 8)
        .attr("fill", (d) => {
            if (d['user_id'] == selectedSong['user_id']) {
                return colors.USER;
            } else if (d['children'] != null) {
                return colors.EXPANDED;
            } else {
                return colors.DEFAULT;
            }
        });



    node.append("text")
        .attr("stroke", "black")
        .attr("font-size", "12px")
        .attr("x", 10)
        .attr("y", -5)
        .text(function (d) {
            if (d.user_id){
                return (d.user_name);
            }
            else{
                return (d.song_name);
            }
            
        });

    force.alpha(0.1).restart()
}

/**
 * Function to display recommendations based on
 * selected and expanded nodes.
 */
/*
function displayRecommendations(){
    const topRecommendations = {};
    for (const song of recommendations) {
        if(song != selectedSong && expandedSongs.indexOf(song) == -1){
            songName = song["song_name"];
            topRecommendations[songName] = topRecommendations[songName] ? topRecommendations[songName] + 1 : 1;
        }
    }
    // Sort to get top 5 recommendations
    var items = Object.keys(topRecommendations).map(function(key) {
        return [key, topRecommendations[key]];
    });
    items.sort(function(first, second) {
        return second[1] - first[1];
    });
    recommendationsToDisplay = items.slice(0, 5);
    console.log(recommendationsToDisplay);
    // TO DO: improve the display of 'recommendationsToDisplay' in UI
    var recommendationsDiv = d3.select("#recommendations-div")
    recommendationsDiv.selectAll("*").remove();
    recommendationsDiv.append("h3")
                      .text("Top-5 Artist Recommendations");
    recommendationsDiv.append("table")
                      .selectAll("tr")
                      .data(recommendationsToDisplay)
                      .enter()
                      .append("tr")
                      .append("td")
                      .text(function(d){ return d[0]; });
    console.log("out")
}
*/

/**
 * Function to handle double click event of a node
 * @param d node that was clicked
 */
function update(d) {
    tip.hide;
    if (d.children != null) {
        var idx = expandedSongs.indexOf(d);
        if (idx !== -1) {
            expandedSongs.splice(idx, 1);
        }
        d.children.forEach(child => {
            var index = recommendations.indexOf(child);
            if (index !== -1) {
                recommendations.splice(index, 1);
            }
        });
        let childrenToDelete = d.children.map(child => child['song_id']);
        songEdges = songEdges.filter(edge => {
            return !(edge['source']['song_id'] == d['song_id'] && childrenToDelete.includes(edge['target']['song_id']))
        });
        var edgeTargets = songEdges.map(edge => edge['target']['song_id']);
        graphData = graphData.filter(node => {
            let key = node['song_id'];
            return edgeTargets.includes(key) || key == selectedSong['song_id']
        });
        graphDataMap = buildGraphDataMap({});
        d.children = null;
        clearGraph();
        drawGraph();
        // displayRecommendations();
    } else {
        // get data of similar artists
        expandedSongs.push(d);
        // console.log("update_1", expandedSongs, d);
        if (d.user_id){
            newSongEdges = getSongNetwork(d['user_id'], sliderValue);
        }
        else{
            newSongEdges = getSongNetwork(d['song_id'], sliderValue);
        }
        
        d.children = [];
        newSongEdges.forEach(edge => {
            var target = allNodesMap[edge['target']];
            if (graphData.filter(node => node['song_id'] === target['song_id']).length == 0) {
                graphData.push(target);
            }
            d.children.push(target);
            recommendations.push(target);
        });
        songEdges = songEdges.concat(newSongEdges);
        graphDataMap = buildGraphDataMap(graphDataMap);
        clearGraph();
        drawGraph();
        // displayRecommendations();
    }
}


//function to display top songs
function displayTopSongs(selectedUser) {
    // Filter user's top songs based on selectedUser
    var userTopSongs = user_topsongs.filter(function (song) {
        return song.user_id === selectedUser;
    });

    // Sort the user's top songs by listen count (descending order)
    userTopSongs.sort(function (a, b) {
        return b.listen_count - a.listen_count;
    });

    // Display top songs and their listen counts
    var topSongsList = document.getElementById("topSongsList"); // Assuming there's an element to display the list
    topSongsList.innerHTML = ""; // Clear previous content

    userTopSongs.forEach(function (song) {
        var listItem = document.createElement("li");
        listItem.textContent = song.song_name + " : Played " + song.listen_count + " times";
        topSongsList.appendChild(listItem);
    });

    topSongsList.style.textAlign = "center";
}