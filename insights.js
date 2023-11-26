

  // Fetch the CSV file
  fetch('data/song_genre_year.csv')
    .then(response => response.text())
    .then(data => {
      // Process the CSV data
      processData(data);
    });

  // Process the CSV data
  function processData(csvData) {
    // Split the CSV data into rows
    var rows = csvData.split('\n');

    // Extract headers from the first row
    var headers = rows[0].split(',');

    // Initialize arrays to store data
    var data = [];
    var genreSet = new Set();

    // Iterate through rows starting from the second row (index 1)
    for (var i = 1; i < rows.length; i++) {
      var values = rows[i].split(',');

      // Assuming 'tempo', 'loudness', 'title', 'genre', and 'year' are columns in your CSV
      var tempo = parseFloat(values[49]);  // Replace with the correct index for 'tempo'
    //   console.log(tempo)
      var loudness = parseFloat(values[45]);  // Replace with the correct index for 'loudness'
      var title = values[20];  // Replace with the correct index for 'title'
      var genre = values[2];  // Replace with the correct index for 'genre'
      var year = parseInt(values[53]);  // Replace with the correct index for 'year'
    //   console.log(year, genre)

      if (genre !== undefined) {
        data.push({ tempo, loudness, title, genre, year });
        genreSet.add(genre);
      }
    }

    // Convert genre set to an array
    var uniqueGenres = Array.from(genreSet);

    // Use D3 color scale for the genres
    var colorScale = d3.scaleOrdinal(d3.schemeCategory20c); // You can choose a different D3 color scheme

    // Create a dropdown select option for years
    var yearDropdown = document.getElementById('year-dropdown');
    var uniqueYears = [...new Set(data.map(row => row.year))];
    uniqueYears.sort((a, b) => b - a);  // Sort in descending order
    // console.log(uniqueYears)
    uniqueYears.forEach(year => {
        // console.log(year)
      var option = document.createElement('option');
      option.value = year;
      option.text = year;
      yearDropdown.add(option);
    });

    // Handle the change event of the year dropdown
    yearDropdown.addEventListener('change', function () {
      var selectedYear = this.value;
      updateChart(selectedYear);
    });

    // Initial chart with the first year
    updateChart(uniqueYears[0]);

    // Function to update the chart based on the selected year
    function updateChart(selectedYear) {
      // Filter data for the selected year
      var filteredData = data.filter(row => row.year == selectedYear);

      // Create an array to store traces for each genre
      var traces = [];

      // Iterate over unique genres and create a trace for each
      
      uniqueGenres.forEach(genre => {
        var genreData = filteredData.filter(row => row.genre === genre);

        var trace = {
          x: genreData.map(row => row.tempo),
          y: genreData.map(row => row.loudness),
          mode: 'markers',
          type: 'scatter',
          text: genreData.map(row => row.title),
          marker: {
            size: 5,
            color: colorScale(genre), // Assign color based on genre using the D3 color scale
          },
          name: genre, // This sets the legend label
        };

        traces.push(trace);
      });


      var layout = {
        title: 'Tempo vs Loudness Scatter Plot',
        xaxis: { title: 'Tempo (beats per minute)' },
        yaxis: { title: 'Loudness (dB)' },
        showlegend: true, // Display the legend
        legend: {
            x: 1,  // Adjust the x position of the legend
            y: 1,  // Adjust the y position of the legend
            font: {
              family: 'Arial, sans-serif',
              size: 16,  // Adjust the size of the legend text
              color: 'grey',
            }
          },
      };

      // Update the plot with the new traces
      Plotly.newPlot('your-plot-container', traces, layout);
    }
  }




  Plotly.d3.csv('data/genreevolution.csv', function (err, data) {

    var lookup = {};
    function getData(year, genre) {
        var byYear, trace;
        if (!(byYear = lookup[year])) {;
        byYear = lookup[year] = {};
        }

        if (!(trace = byYear[genre])) {
        trace = byYear[genre] = {
            x: [],
            y: [],
            id: [],
            text: [],
            marker: {size: []}
        };
        }
        return trace;
    }

    for (var i = 0; i < data.length; i++) {
        var datum = data[i];
        var trace = getData(datum.year, datum.genre);
        trace.text.push("Song Count: "+datum.count+"<br>"+"Genre: "+datum.genre);
        trace.id.push(datum.genre);
        trace.x.push(datum.duration);
        trace.y.push(datum.song_hotttnesss);
        trace.marker.size.push(datum.count);
    }

    var years = Object.keys(lookup);
    var refyear = lookup[years[70]];
    var genres = Object.keys(refyear);

    var traces = [];
    for (i = 0; i < genres.length; i++) {
        var data = refyear[genres[i]];

        traces.push({
        name: genres[i],
        x: data.x.slice(),
        y: data.y.slice(),
        id: data.id.slice(),
        text: data.text.slice(),
        mode: 'markers',
        marker: {
            size: data.marker.size.slice(),
            sizemode: 'area',
            sizeref: 0.1
        }
        });
    }

    var frames = [];
    for (i = 0; i < years.length; i++) {
        frames.push({
        name: years[i],
        data: genres.map(function (genre) {
            return getData(years[i], genre);
        })
        })
    }

    var sliderSteps = [];
    for (i = 0; i < years.length; i++) {
        sliderSteps.push({
        method: 'animate',
        label: years[i],
        args: [[years[i]], {
            mode: 'immediate',
            transition: {duration: 300},
            frame: {duration: 300, redraw: false},
        }]
        });
    }
    
    var layout = {
        title: 'Genre Evolution over time',
        xaxis: {
        title: 'Average Duration of songs (in seconds)',
        range: [0, 500]
        },
        yaxis: {
        title: 'Song Hotness (Normalized 0-1)',
        range: [0,1]
        },
        hovermode: 'closest',
        height: 600,
        updatemenus: [{
        x: 0,
        y: 0,
        yanchor: 'top',
        xanchor: 'left',
        showactive: false,
        direction: 'left',
        type: 'buttons',
        pad: {t: 87, r: 10},
        buttons: [{
            method: 'animate',
            args: [null, {
            mode: 'immediate',
            fromcurrent: true,
            transition: {duration: 300},
            frame: {duration: 500, redraw: false}
            }],
            label: 'Play'
        }, {
            method: 'animate',
            args: [[null], {
            mode: 'immediate',
            transition: {duration: 0},
            frame: {duration: 0, redraw: false}
            }],
            label: 'Pause'
        }]
        }],

        sliders: [{
        pad: {l: 130, t: 55},
        currentvalue: {
            visible: true,
            prefix: 'Year:',
            xanchor: 'right',
            font: {size: 20, color: '#666'}
        },
        steps: sliderSteps
        }]
    };


    Plotly.plot('myDiv', {
        data: traces,
        layout: layout,
    config: {showSendToCloud:true},
        frames: frames,
    });
    });
