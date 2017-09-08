
angular.module('beeline')
.factory('SharedVariableService',  (RoutesService) => {

  var sharedData = {
    stops: [],
    boardStops: [],
    alightStops: [],
    routePath: [],
    actualPath: [],
    boardStop: null,
    alightStop: null,
  };

  var instance = {
    get: function() {
      return sharedData
    },

    set: function(mapObject) {
      sharedData = _.assign(sharedData, mapObject)
    },

    setStops: function(stops) {
      sharedData.stops = stops
    },

    setBoardStops: function(boardStops) {
      sharedData.boardStops = boardStops
    },

    setAlightStops: function(alightStops) {
      sharedData.alightStops = alightStops
    },

    setRoutePath: function(routePath) {
      sharedData.routePath = routePath
    },

    setBoardStop: function(boardStop) {
      sharedData.boardStop = boardStop
    },

    setAlightStop: function(alightStop) {
      sharedData.alightStop = alightStop
    },

  }

  return instance;

})
