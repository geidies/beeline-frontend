import {NetworkError} from '../shared/errors'
import {formatDate, formatDateMMMdd, formatTime, formatUTCDate} from '../shared/format'
import _ from 'lodash'

export default function (UserService, CompanyService, RoutesService, $http) {
  var rv = {};

  rv.prepareTrips = function(booking) {
    // create a list of trips
    var trips = [];

    // Cache trip by dates
    if (!booking.route.tripsByDate) {
      booking.route.tripsByDate =
        _.keyBy(booking.route.trips,
          trip => trip.date.getTime());
    }

    console.log(booking);
    for (let dt of booking.selectedDates) {
      trips.push({
        tripId: booking.route.tripsByDate[dt].id,
        boardStopId: booking.route.tripsByDate[dt]
                .tripStops
                .filter(ts => booking.boardStop == ts.stop.id)
                [0].id,
        alightStopId: booking.route.tripsByDate[dt]
                .tripStops
                .filter(ts => booking.alightStop == ts.stop.id)
                [0].id,
        qty: booking.qty,
      });
    }
    return trips;
  };

  /* If a booking has selectedDates array, then it
    checks the prices.
  */
  rv.computePriceInfo = function(booking) {
    if (!booking.selectedDates ||
          booking.selectedDates.length == 0) {
      return Promise.resolve({
        total: 0,
      });
    }
    else {
      var trips = this.prepareTrips(booking);

      var rv = UserService.beeline({
        method: 'POST',
        url: '/transactions/ticket_sale',
        data: {
          trips: trips,
          dryRun: true,
        },
      })
      .then((resp) => {
        // Find the 'payment' entry in the list of transaction itemss
        var txItems = _.groupBy(resp.data.transactionItems, 'itemType');

        // FIXME: include discounts, vouchers
        return {
          totalDue: txItems.payment[0].debit,
          tripCount: trips.length,
          pricesPerTrip: this.summarizePrices(booking),
        };
      })
      .then(null, (err) => {
        console.log(err.stack);
        throw err;
      });

      return rv;
    }
  };

  rv.summarizePrices = function(booking) {
    console.log(booking);
    if (!booking.selectedDates) {
      return [];
    }

    var dates = _.sortBy(booking.selectedDates);

    if (dates.length == 0) return [];

    var current = {}
    var rv = [];

    for (let dt of dates) {
      current = {
        startDate: dt,
        price: booking.route.tripsByDate[dt].price,
      };
      rv.push(current);
    }
    console.log(rv);
    return rv;
  };

  rv.computeChanges = function(route) {
      // convert dates (should be in ISO format therefore sortable)
      route.trips = _.sortBy(route.trips, trip => trip.date);

      for (let trip of route.trips) {
        trip.date = new Date(trip.date);
        for (let tripStop of trip.tripStops) {
          tripStop.time = new Date(tripStop.time);
        }
      }

      // summarize trips by date
      route.tripsByDate = {};
      for (let trip of route.trips) {
        route.tripsByDate[trip.date.getTime()] = trip;
      }

      var changes = {
        timeChanges: [],
        priceChanges: [],
        stopChanges: [],
      }

      /**
        Produce an array of changes.

        @param trips
        @param comparable : function (trip : Trip) : T, where T can be compared for changes
        @param humanReadable : function (before : Trip, after : Trip) : string,
            A human-readable message telling the user what has changed

        @returns An array, Each entry consists of an object with
        the following properties:
          startDate : Date,
          endDate: Date,
          comparable: Result of comparable(trip),
          humanReadable: Result of humanReadable(before, after)

      */
      function summarizeChanges(trips, comparable, humanReadable) {
        var changes = [];
        // var current = {};
        var lastComparable = undefined;
        var lastTrip = undefined;

        for (let trip of trips) {
          // if (current.startDate == undefined) {
          //   current.startDate = trip.date;
          //   current.endDate = trip.date;
          // }

          let valueComparable = comparable(trip);
          if (lastComparable == undefined)
            lastComparable = valueComparable;

          if (lastComparable != valueComparable) {
            let hr = humanReadable(lastTrip, trip);

            changes.push({
              startDate: trip.date,
              humanReadable: hr,
              comparable: valueComparable,
            });
            // current = {
            //   startDate: trip.date,
            //   endDate: trip.date,
            // };
          }

          // current.endDate = trip.date;
          lastTrip = trip;
          lastComparable = valueComparable;
        }
        // if (changes.length != 0) {
        //   changes.push(current);
        // }
        return changes;
      }

      // summarize price/stop/time
      changes.priceChanges = summarizeChanges(route.trips,
        (trip) => trip.price,
        (bef, aft) => [`Price change from ${bef.price} to ${aft.price}`]);

      changes.stopChanges = summarizeChanges(route.trips,
        trip => trip.tripStops.map(ts => ts.stop.id).join(','),
        (bef, aft) => {
          var stopInfo = {};

          for (let ts of bef.tripStops) {
            stopInfo[ts.stop.id] = ts.stop;
          }
          for (let ts of aft.tripStops) {
            stopInfo[ts.stop.id] = ts.stop;
          }

          var beforeStops = bef.tripStops.map(ts => ts.stop.id);
          var afterStops = aft.tripStops.map(ts => ts.stop.id);

          var droppedStops = _.subtract(beforeStops, afterStops);
          var newStops = _.subtract(afterStops, beforeStops);

          var messages = [];
          if (droppedStops.length > 0) {
            messages.push('Stops '
              + droppedStops.map(sid => stopInfo[sid].description).join(', ')
              + ' no longer serviced');
          }
          if (newStops.length > 0) {
            messages.push('New stops '
              + newStops.map(sid => stopInfo[sid].description).join(', ')
              + ' added to route');
          }
          return messages;
        });

      changes.timeChanges = summarizeChanges(route.trips,
        trip => trip.tripStops
              .map(ts => (ts.time.getTime() % (24*60*60*1000)) + ':' + ts.stop.id)
              .join(','),
        (bef, aft) => {
          var messages = [];

          var befStopInfo = {};
          var aftStopInfo = {};

          for (let ts of aft.tripStops) {
            aftStopInfo[ts.stop.id] = ts;
          }

          for (let ts of bef.tripStops) {
            let befTime = formatTime(new Date(ts.time));
            let aftTime = formatTime(new Date(aftStopInfo[ts.stop.id].time));

            messages.push(`Arrival time at stop ${ts.stop.description} changed to ${aftTime}`);
          }
          return messages;
        });
      return changes;
  };

  rv.computeStops = function(trips){
    var tripStops = _.flatten(trips.map(trip => trip.tripStops));
    var uniqueStops = _.uniqBy(tripStops, ts => ts.stop.id)
    var stopData = _.keyBy(uniqueStops, ts => ts.stop.id);

    var boardStops = uniqueStops.filter(ts => ts.canBoard)
      .map(ts => {
        return _.extend({time: ts.time}, ts.stop);
      })
    var alightStops = uniqueStops.filter(ts => ts.canAlight)
      .map(ts => {
        return _.extend({time: ts.time}, ts.stop);
      })
    return [boardStops,alightStops];
  }

  return rv;
}
