var responses = new Array(2);
var geometries = utils.pegasus('countries.topojson');
var countries = utils.pegasus('http://insights.cartodb.com/api/v2/sql?q=SELECT e.total_co_excluding_land_use_change_and_forestry_mtco AS total, e.year, e.country as name, c.cartodb_id FROM cait_2_0_country_co2_emissions e JOIN countries c on c.admin=e.country&format=csv');
var readyEvent = new Event('DataLoaded');

geometries.then(function(data) {
  responses[0] = JSON.parse(data);
  countries.then(function(data) {
    responses[1] = utils.csvToJSON(data);
    document.dispatchEvent(readyEvent);
  }, function(data, xhr) {
    console.error(data, xhr.status)
  });
}, function(data, xhr) {
  console.error(data, xhr.status)
});