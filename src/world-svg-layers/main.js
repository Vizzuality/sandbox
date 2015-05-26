(function() {

  // Creating application
  var app = {};

  var parseData = function(data) {
    var result = {};
    // TODO: Get better performance here
    var years = _.groupBy(data, 'year');
    for (var key in years) {
      result[key] = _.groupBy(years[key], 'cartodb_id');
    }
    return result;
  };

  var MapView = function() {

    this.options = {
      map: {
        center: [0, 0],
        zoom: 2,
        minZoom: 2,
        maxZoom: 16
      },
      tiles: {
        url: 'http://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
        options: {
          attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
          maxZoom: 16
        }
      },
      featureStyle: {
        fillColor: '#999',
        color: '#060',
        weight: 1,
        opacity: 1,
        fillOpacity: 0.7
      }
    };
    
    this.createMap = function() {
      this.map = L.map(this.el, this.options.map);
      // Adding tiles
      // L.tileLayer(this.options.tiles.url, this.options.tiles.options)
      //  .addTo(this.map);
    };

    this.createLayer = function(topojson) {
      // The problem is here
      var geojson = omnivore.topojson.parse(topojson); // it takes 500ms
      var style = this.options.featureStyle;
      this.layer = L.geoJson(geojson, {
        style: function() { return style; }
      }); // it takes 750ms
      this.map.addLayer(this.layer); // it takes 600ms
    };

    this.setYear = function(year) {
      var self = this;
      var data = app.groupedData[year];
      var style = _.clone(this.options.featureStyle);
      if (!this.getColor) {
        console.error('first set colors');
      } else {
        this.layer.setStyle(function(feature) {
          var cartodbId = feature.properties.cartodb_id;
          var country = data[cartodbId];
          if (country && country[0].total) {
            style.fillColor = self.getColor(country[0].total);
          } else {
            style.fillColor = self.options.featureStyle.fillColor;
          }
          return style;
        });
      }
    };

    this.setColors = function(min, max, buckets) {
      this.getColor = d3.scale.quantize()
        .domain([min, max])
        .range(colorbrewer.GnBu[buckets]);
    };
    
    this.init = (function() {
      this.el = document.getElementById('map');
      this.createMap();
    }).bind(this)();

    return this;
  };

  var SliderView = function() {

    this.options = { velocity: 100 };

    this.setEvents = function() {
      var self = this;
      var changeYearEvent = new Event('ChangeYear');
      this.input.oninput = function() {
        self.setText(self.input.value);
        self.el.dispatchEvent(changeYearEvent);
      };
      this.startBtn.onclick = this.start.bind(this);
      this.stopBtn.onclick = this.stop.bind(this);
    };

    this.start = function() {
      this.timer = setInterval((function() {
        var value = parseInt(this.input.value);
        var current = value + 1;
        if (this.max === current) {
          this.stop();
        }
        this.setValue(current);
      }).bind(this), this.options.velocity)
    };

    this.stop = function() {
      if (this.timer) {
        clearInterval(this.timer);
      }
    };

    this.show = function() {
      this.el.className = '';
    };

    this.hide = function() {
      this.el.className = 'is-hidden';
    };

    this.setRange = function(min, max) {
      this.min = min;
      this.max = max;
      this.input.setAttribute('min', min);
      this.input.setAttribute('max', max);
    };

    this.setValue = function(value) {
      this.input.value = value;
      this.input.oninput();
    };

    this.setText = function(text) {
      this.label.textContent = text;
    };

    this.init = (function() {
      this.timer = null;
      this.el = document.getElementById('slider');
      this.input = document.getElementById('sliderRange');
      this.label = document.getElementById('sliderLabel');
      this.startBtn = document.getElementById('sliderPlay');
      this.stopBtn = document.getElementById('sliderStop');
      this.setEvents();
    }).bind(this)();

    return this;

  };

  // Document ready
  document.addEventListener('DOMContentLoaded', function() {
    
    app.loader = document.getElementById('loader');
    app.map = new MapView();
    app.slider = new SliderView();

    // When all data is loaded
    document.addEventListener('DataLoaded', function() {

      var data = responses[1];
      var years = utils.getMinMax(data, 'year');
      var totals = utils.getMinMax(data, 'total');

      var minData = totals[0];
      var maxData = totals[1];
      var minYear = years[0];
      var maxYear = years[1];

      app.map.createLayer(responses[0]);
      app.groupedData = parseData(data);

      app.map.setColors(minData, maxData, 9);

      app.slider.el.addEventListener('ChangeYear', function() {
        app.map.setYear(parseInt(app.slider.input.value));
      });

      app.slider.setRange(minYear, maxYear);
      app.slider.setValue(minYear);
      app.slider.show();

      app.loader.className = 'loader is-hidden';

    });

  });

})();