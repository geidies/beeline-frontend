import {NetworkError} from '../shared/errors';
import {formatDate, formatTime, formatUTCDate, formatHHMM_ampm} from '../shared/format';

export default [
  '$rootScope',
  '$scope',
  '$interpolate',
  '$state',
  '$stateParams',
  '$ionicModal',
  '$http',
  '$cordovaGeolocation',
  'BookingService',
  'RoutesService',
  'LiteRoutesService',
  'uiGmapGoogleMapApi',
  'MapOptions',
  'loadingSpinner',
  function(
    $rootScope,
    $scope,
    $interpolate,
    $state,
    $stateParams,
    $ionicModal,
    $http,
    $cordovaGeolocation,
    BookingService,
    RoutesService,
    LiteRoutesService,
    uiGmapGoogleMapApi,
    MapOptions,
    loadingSpinner
  ) {
    // Gmap default settings
    $scope.map = MapOptions.defaultMapOptions();
    $scope.routePath = [];

    // Default settings for various info used in the page
    $scope.book = {
      label: null,
      route: null,
      boardStops: [], // all board stops for this route
      alightStops: [], // all alight stops for this route
      boardStop: null,
      alightStop: null,
      changes: {},
    };
    $scope.disp = {
      popupStop: null,
      popupStopType: null,
      parentScope: $scope,
    }

    // Resolved when the map is initialized
    var gmapIsReady = new Promise((resolve, reject) => {
      var resolved = false;
      $scope.$watch('map.control.getGMap', function() {
        if ($scope.map.control.getGMap) {
          if (!resolved) {
            resolved = true;
            resolve();
          }
        }
      });
    });

    var routePromise;

    $scope.book.label = $stateParams.label;

    routePromise = LiteRoutesService.getLiteRoute($scope.book.label);

    var stopOptions = {
      initialBoardStopId: $stateParams.boardStop ? parseInt($stateParams.boardStop) : undefined,
      initialAlightStopId: $stateParams.alightStop ? parseInt($stateParams.alightStop) : undefined,
    };
    routePromise.then((route) => {
      $scope.book.route = route[$scope.book.label];
      // computeStops(stopOptions);
      console.log("RouteObject", route)
    });

    $scope.$on('$ionicView.afterEnter', () => {
      loadingSpinner(Promise.all([gmapIsReady, routePromise])
      .then(() => {
        var gmap = $scope.map.control.getGMap();
        google.maps.event.trigger(gmap, 'resize');
        panToStops();
      }));
    });

    gmapIsReady.then(function() {
      MapOptions.disableMapLinks();
    });

    $scope.$watch('book.route.path', (path) => {
      if (!path) {
        $scope.routePath = [];
      }
      else {
        RoutesService.decodeRoutePath(path)
        .then((decodedPath) => $scope.routePath = decodedPath)
        .catch(() => $scope.routePath = []);
      }
    })


    $scope.setStop = function (stop, type) {
      if (type === 'pickup') {
        $scope.book.boardStop = stop;
      }
      else {
        $scope.book.alightStop = stop;
      }
      $scope.disp.popupStop = null;
    }

    /* Pans to the stops on the screen */
    function panToStops() {
      var stops = [];
      stops = $scope.book.boardStops.concat($scope.book.alightStops);

      if (stops.length == 0) {
        return;
      }
      var bounds = new google.maps.LatLngBounds();
      for (let s of stops) {
        bounds.extend(new google.maps.LatLng(
          s.coordinates.coordinates[1],
          s.coordinates.coordinates[0]
        ));
      }
      $scope.map.control.getGMap().fitBounds(bounds);
    }

    /** Summarizes the stops from trips by comparing their stop location and time */
    // function computeStops({initialBoardStopId, initialAlightStopId}) {
    //   var trips = $scope.book.route.trips;
    //   var [boardStops, alightStops] = BookingService.computeStops(trips);
    //   $scope.book.boardStops = boardStops;
    //   $scope.book.alightStops = alightStops;
    //
    //   // Check that the boardStopIds are still valid
    //   if (typeof(initialBoardStopId) === 'number') {
    //     $scope.book.boardStop = boardStops.find(ts =>
    //         ts.id === initialBoardStopId);
    //   }
    //   // Check that the boardStopIds are still valid
    //   if (typeof(initialAlightStopId) === 'number') {
    //     $scope.book.alightStop = alightStops.find(ts =>
    //         ts.id === initialAlightStopId);
    //   }
    // }
  }
];
