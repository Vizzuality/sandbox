(function() {

  var helpers = {};

  helpers.choropleth = function(min, max, buckets) {
    return d3.scale.quantize().range(colorbrewer.Greens[buckets]);
  };

  var CountriesCollection = Backbone.Collection.extend({

    query: 'SELECT e.total_co_excluding_land_use_change_and_forestry_mtco AS total, e.year, e.country, c.cartodb_id FROM cait_2_0_country_co2_emissions e JOIN countries c on c.admin=e.country',

    url: function() {
      return 'http://insights.cartodb.com/api/v1/sql/';
    },

    parse: function(data) {
      return data.rows;
    },

    fetchData: function(callback) {
      return this.fetch({
        data: {
          q: this.query,
          format: 'json'
        },
        success: function(collection) {
          if (callback && typeof callback === 'function') {
            callback(undefined, collection);
          }
        },
        error: function(xhr, err) {
          if (callback && typeof callback === 'function') {
            callback(JSON.parse(err.responseText).error);
          }
        }
      });
    },

    getGroups: function() {
      if (!this.groupedData) {
        var result = {};
        // TODO: Get better performance here
        var years = _.groupBy(this.toJSON(), 'year');
        for (var key in years) {
          result[key] = _.groupBy(years[key], 'cartodb_id');
        }
        this.groupedData = result;
      }
      return this.groupedData;
    },

    getByYear: function(year) {
      return _.where(this.toJSON(), { year: year });
    },

    getMinYear: function() {
      return _.min(this.toJSON(), function(d) {
        return d.year;
      });
    },

    getMaxYear: function() {
      return _.max(this.toJSON(), function(d) {
        return d.year;
      });
    },

    getMinTotal: function() {
      return _.min(this.toJSON(), function(d) {
        return d.total;
      });
    },

    getMaxTotal: function() {
      return _.max(this.toJSON(), function(d) {
        return d.total;
      });
    }

  });

  var MapView = Backbone.View.extend({

    el: '#map',

    options: {
      map: {
        center: [0, 0],
        zoom: 2
      },
      tiles: {
        url: 'http://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
        options: {
          attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
          maxZoom: 16
        }
      },
      featureStyle: {
        fillColor: '#ddd',
        color: '#060',
        weight: 1,
        opacity: 1,
        fillOpacity: 0.7
      }
    },

    initialize: function() {
      this.countries = new CountriesCollection();
      // Creating map
      this.createMap();
    },

    createMap: function() {
      this.map = L.map(this.el, this.options.map);
      // Adding tiles
      L.tileLayer(this.options.tiles.url, this.options.tiles.options).addTo(this.map);
    },

    setCountriesLayer: function(topojson) {
      var geojson = omnivore.topojson.parse(topojson);
      var style = this.options.featureStyle;
      var data = this.countries.toJSON();
      this.countriesLayer = L.geoJson(geojson, {
        style: function() { return style; },
      });
      this.map.addLayer(this.countriesLayer);
    },

    setYear: function(year) {
      var self = this;
      var data = this.countries.getGroups()[year];
      var style = _.clone(this.options.featureStyle);

      this.countriesLayer.setStyle(function(feature) {
        var cartodbId = feature.properties.cartodb_id;
        var country = data[cartodbId];
        if (country && country[0].total) {
          style.fillColor = self.colors(country[0].total);
        } else {
          style.fillColor = self.options.featureStyle.fillColor;
        }
        return style;
      });

      // this.countriesLayer.eachLayer(function(layer) {
      //   var cartodbId = layer.feature.properties.cartodb_id;
      //   var country = _.findWhere(data, { cartodb_id: cartodbId });
      //   if (country && country.total) {
      //     layer.bindPopup('<p><strong>' + country.country +'</strong>' +
      //       '<br> ' + country.total + ' tCO<sub>2</sub></p>');
      //   } else {
      //     layer.bindPopup('No data');
      //   }
      // });
    },

    setColors: function(min, max, buckets) {
      this.colors = helpers.choropleth(min, max, buckets);
    }

  });

  var SliderView = Backbone.View.extend({

    el: '#slider',

    options: {
      velocity: 100
    },

    events: {
      'change input': 'setLabel',
      'click #sliderPlay': 'start',
      'click #sliderStop': 'stop'
    },

    initialize: function() {
      this.timer = null;
      this.$label = $('#sliderLabel');
      this.$range = this.$el.find('input[type="range"]');
    },

    show: function() {
      this.$el.show();
    },

    start: function() {
      this.timer = setInterval((function() {
        var value = parseInt(this.$range.val());
        var current = value + 1;
        if (this.max === current) {
          this.stop();
        }
        this.$range.val(current).trigger('change');
      }).bind(this), this.options.velocity)
    },

    stop: function() {
      if (this.timer) {
        clearInterval(this.timer);
      }
    },

    setMin: function(min) {
      this.min = min;
      this.$range.attr('min', min);
    },

    setMax: function(max) {
      this.max = max;
      this.$range.attr('max', max);
    },

    setLabel: function(e) {
      this.$label.text(e.currentTarget.value);
    }

  });

  var App = Backbone.View.extend({

    el: 'body',

    initialize: function() {
      this.map = new MapView();
      this.slider = new SliderView();

      this.slider.$range.on('change', (function(e) {
        this.map.setYear(parseInt(e.currentTarget.value));
      }).bind(this));

      $.when(
        $.get('countries.topojson'),
        this.map.countries.fetchData()
      ).done((function(topojson) {

        var minTotal = this.map.countries.getMinTotal().total;
        var maxTotal = this.map.countries.getMaxTotal().total;
        var minYear = this.map.countries.getMinYear().year;
        var maxYear = this.map.countries.getMaxYear().year;

        this.map.setColors(minTotal, maxTotal, 7);
        this.map.setCountriesLayer(topojson[0]);

        this.slider.setMin(minYear);
        this.slider.setMax(maxYear);
        this.slider.show();

        this.slider.$range.val(minYear).trigger('change');

      }).bind(this));
    }

  });

  // Document ready
  document.addEventListener('DOMContentLoaded', function() {
    new App();
  });

})();