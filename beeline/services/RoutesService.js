import qs from 'querystring';
import _ from 'lodash';

// Adapter function to convert what we get from the server into what we want
// Ideally shouldn't need this if the server stays up to date
// Transforms the data in place rather than making a new array
// This is to save time since its a deep copy and you wont need the original array anyway
function transformRouteData(data){
  _(data).each(function(route){
    var firstTripStops = route.trips[0].tripStops;
    route.startTime = firstTripStops[0].time;
    route.startRoad = firstTripStops[0].stop.description;
    route.endTime = firstTripStops[firstTripStops.length - 1].time;
    route.endRoad = firstTripStops[firstTripStops.length - 1].stop.description;
  });
  return data;
}

export default function($http, SERVER_URL, UserService) {
  return {
    getRoute: function (routeId) {
      return $http.get(SERVER_URL + `/routes/${routeId}?include_trips=true`)
        .then(function(response){
          return response.data;
        })
        .then((route) => { /* Convert date values to date object */
          for (let trip of route.trips) {
            trip.date = new Date(trip.date);
            for (let tripStop of trip.tripStops) {
              tripStop.time = new Date(tripStop.time);
            }
          }
          return route;
        });
    },

    getRoutes: function(){
      return $http.get(SERVER_URL + '/routes?include_trips=true')
      .then(function(response){
        return transformRouteData(response.data);
      });
    },

    //Old Search Service stuff
    data: {
      startName: '',
      endName: '',
      startLat: '',
      startLng: '',
      endLat: '',
      endLng: '',
      arrivalTime: '2016-02-26 01:00:00+00',
      startTime: new Date().getTime(),
      endTime: new Date().getTime() + 30*24*60*60*1000,
      lastresults: [],
      lastkickstart: [],
      isSubmitting: false
    },
    addReqData: function(sname, ename, slat, slng, elat, elng) {
      this.data.startName = sname;
      this.data.endName = ename;
      this.data.startLat = slat;
      this.data.startLng = slng;
      this.data.endLat = elat;
      this.data.endLng = elng;
    },
    searchRoutes: function(search) {
      //return Promise object
      return UserService.beeline({
        method: 'GET',
        url: '/routes/search_by_latlon?' + qs.stringify({
          startLat: search.startLat,
          startLng: search.startLng,
          endLat: search.endLat,
          endLng: search.endLng,
          arrivalTime: search.arrivalTime,
          startTime:  search.startTime,
          endTime: search.endTime
        }),
      }).then(function(response) {
        transformRouteData(response.data);
        return response.data;
      });
    },
    setresults: function(searchresults){
      this.data.lastresults = searchresults;
    },
    setkickstart: function(searchkickstart){
      this.data.lastkickstart = searchkickstart;
    },
    setArrivalTime: function(arrtime) {
      arrtime = arrtime.split(':').map(x => parseInt(x))
      var arrivalTime = new (
        Date.bind.apply(Date, [{}, 2015, 1, 1].concat(arrtime)));

      this.data.arrivalTime = arrivalTime.toISOString();
    }
    //End Old Search Service stuff

  };
}
