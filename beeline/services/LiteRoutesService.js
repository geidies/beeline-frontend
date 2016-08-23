// get lite routes
// format lite routes with starting time, ending time, no. of timings/trips per day
// retrieve lists of trips running for certain lite route on certain date
// driver pings for list of trips running for this route
// subscriptions for certain lite route ( this may go to tickets service)
import querystring from 'querystring';
import _ from 'lodash';
import assert from 'assert';

export default function LiteRoutesService($http, UserService, $q) {

  var liteRoutesCache;
  var liteRoutesPromise;

  // For single lite route
  var lastLiteRouteId = null;
  var lastLiteRoutePromise = null;

  function transformLiteRouteData(data) {
    console.log(data);
    var liteRoutesByLabel = _.reduce(data, function(result,value, key){
      var label = value.label;
      if (result[label]) {
        result[label].trips = result[label].trips.concat(value.trips);
      }
      else {
        result[label] = value;
        //to display schedule in notes JSON
        result[label].schedule = value.notes.schedule;
      }
      return result;
    },{});
    //ignor the startingTime and endTime for now
    return liteRoutesByLabel;
  }

  var instance = {
    // Retrive the data on all lite routes
    // But limits the amount of data retrieved
    // getRoutes() now returns a list of routes, but with very limited
    // trip data (limited to 5 trips, no path)
    getLiteRoutes: function(ignoreCache, options) {
      if (liteRoutesCache && !ignoreCache && !options) return liteRoutesCache;

      var url = '/routes?';

      // Start at midnight to avoid cut trips in the middle
      // FIXME: use date-based search instead
      var startDate = new Date();
      startDate.setHours(3,0,0,0,0)

      var finalOptions = _.assign({
        start_date: startDate.getTime(),
        include_trips: true,
        limit_trips: 1,
        include_path: false,
        tags: JSON.stringify(['lite']),
      }, options)

      url += querystring.stringify(finalOptions)

      var liteRoutesPromise = UserService.beeline({
        method: 'GET',
        url: url,
      })
      .then(function(response) {
        // Checking that we have trips, so that users of it don't choke
        // on trips[0]
        var liteRoutes = response.data.filter(r => r.trips && r.trips.length);
        liteRoutes = transformLiteRouteData(liteRoutes)
        return liteRoutes;
      });

      // Cache the promise -- prevents two requests from being
      // in flight together
      if (!options)
        liteRoutesCache = liteRoutesPromise;

      return liteRoutesPromise;
    },

    getLiteRoute: function(liteRouteLabel, ignoreCache, options) {
      assert.equal(typeof liteRouteLabel, 'string');

      if (!ignoreCache && !options && lastLiteRouteLabel=== liteRouteLabel) {
        console.log(`Using lite route ${liteRouteLabel} from cache`)
        return lastLiteRoutePromise;
      }

      var startDate = new Date();
      startDate.setHours(3,0,0,0,0)

      var finalOptions = _.assign({
        start_date: startDate.getTime(),
        include_trips: true,
        include_availability: false,
      }, options)

      lastLiteRouteLabel = liteRouteLabel;
      return lastLiteRoutePromise = UserService.beeline({
        method: 'GET',
        url: `/routes/${liteRouteLabel}?${querystring.stringify(finalOptions)}`,
      })
      .then(function(response) {
        var liteRouteData =  transformLiteRouteData([response.data]);
        return liteRouteData;
      })
      .catch((err) => {
        console.error(err);
      });
    },


    subscribeLiteRoute: function(liteRouteLabel) {
      var subscribePromise = UserService.beeline({
        method: 'POST',
        url: '/liteRoutes/subscription',
        data: {
          routeLabel: liteRouteLabel,
        }
      })
      .then(function(response) {
        console.log(response.data);
        if (response.data) {
          return true;
        }
        else{
          console.log("Fails");
          return false;
        }
      });
      return subscribePromise;
    }


  };

  return instance;
}
