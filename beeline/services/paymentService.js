import assert from 'assert'
import processingPaymentsTemplate from '../templates/processing-payments.html';

angular.module('beeline')
.factory('PaymentService', function paymentService(UserService, RoutesService,
  $ionicPopup, $ionicLoading, BookingService, CreditsService, StripeService,
  loadingSpinner, TicketService, $state) {
  var isPaymentProcessing = false
  /** After you have settled the payment mode **/
  // book is booking Object
  async function completePayment(paymentOptions, book) {
    try {
      $ionicLoading.show({
        template: processingPaymentsTemplate
      })
      var result = await UserService.beeline({
        method: 'POST',
        url: '/transactions/tickets/payment',
        data: _.defaults(paymentOptions, {
          trips: BookingService.prepareTrips(book),
          promoCode: book.promoCode ? { code: book.promoCode } : { code: '' },
          applyRoutePass: book.applyRoutePass ? true : false,
          applyCredits: book.applyCredits ? true : false,
          applyReferralCredits: book.applyReferralCredits ? true : false,
          expectedPrice: book.price
        }),
      });

      assert(result.status == 200);

      $ionicLoading.hide();

      TicketService.setShouldRefreshTickets();
      $state.go('tabs.route-confirmation');

    } catch (err) {
      $ionicLoading.hide();
      await $ionicPopup.alert({
        title: 'Error processing payment',
        template: err.data.message,
      })
    } finally {
      RoutesService.fetchRoutePasses(true)
      RoutesService.fetchRoutePassCount()
      RoutesService.fetchRoutesWithRoutePass()

      CreditsService.fetchReferralCredits(true);
      CreditsService.fetchUserCredits(true);
    }
  }

  async function payZeroDollar(book) {
    if (await $ionicPopup.confirm({
      title: 'Complete Purchase',
      template: 'Are you sure you want to complete the purchase?'
    })) {
      try {
        isPaymentProcessing = true;
        await completePayment({
          stripeToken: 'this-will-not-be-used'
        }, book)
      } finally {
        isPaymentProcessing = false;
      }
    }
  }

  // Prompts for card and processes payment with one time stripe token.
  async function payWithoutSavingCard(book) {
    try {
      // disable the button
      isPaymentProcessing = true;

      var stripeToken = await loadingSpinner(StripeService.promptForToken(
        null,
        isFinite(book.price) ? book.price * 100 : '',
        null));

      if (!stripeToken) {
        return;
      }

      await completePayment({
        stripeToken: stripeToken.id,
      }, book);
    } catch (err) {
      await $ionicPopup.alert({
        title: 'Error contacting the payment gateway',
        template: err.data && err.data.message || err,
      })
    } finally {
      isPaymentProcessing = false;
    }
  }

  // Processes payment with customer object. If customer object does not exist,
  // prompts for card, creates customer object, and proceeds as usual.
  async function payWithSavedInfo(book) {
    try {
      // disable the button
      isPaymentProcessing = true;

      if (!book.hasSavedPaymentInfo) {
        var stripeToken = await StripeService.promptForToken(
          null,
          isFinite(book.price) ? book.price * 100 : '',
          null);

        if (!stripeToken) {
          isPaymentProcessing = false; // re-enable button
          return;
        }

        await loadingSpinner(UserService.savePaymentInfo(stripeToken.id))
      }

      var user = await UserService.getUser()

      await completePayment({
        customerId: user.savedPaymentInfo.id,
        sourceId: _.head(user.savedPaymentInfo.sources.data).id,
      }, book);
    } catch (err) {
      isPaymentProcessing = false; // re-enable button
      await $ionicPopup.alert({
        title: 'Error saving payment method',
        template: err.data.message,
      })
    } finally {
      isPaymentProcessing = false;
    }
  }


  var instance = {
    payForRoutePass: async function(route, expectedPrice, passValue, paymentOptions) {
      var paymentPromise
      try {
        let routePassTagList = route.tags.filter((tag) => {
          return tag.includes('rp-')
        })
        // assert there is no more than 1 rp- tag
        assert(routePassTagList.length === 1)
        await loadingSpinner(UserService.beeline({
          method: 'POST',
          url: '/transactions/route_passes/payment',
          data: _.defaults(paymentOptions, {
            creditTag: routePassTagList[0],
            promoCode: { code: '' },
            companyId: route.transportCompanyId,
            expectedPrice: expectedPrice,
            value: passValue
          }),
        }))
        paymentPromise = new Promise((resolve, reject) => {return resolve('routePassPurchaseDone')})
      } catch (err) {
        paymentPromise = new Promise((resolve, reject) => {return resolve('routePassError')})
      } finally {
        RoutesService.fetchRoutePasses(true)
        RoutesService.fetchRoutePassCount()
        RoutesService.fetchRoutesWithRoutePass()
        return paymentPromise
      }
    },

    payHandler : function (book, savePaymentChecked) {
      if (book.price === 0) {
        payZeroDollar(book);
      }
      else if (book.hasSavedPaymentInfo || savePaymentChecked) {
        payWithSavedInfo(book);
      }
      else {
        payWithoutSavingCard(book);
      }
    }

  }
  return instance;
})
