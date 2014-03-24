/* -*- Mode: js; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- /
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

'use strict';

var debug = false;
var initialized = false;
var subscribeButton;
var unsubscribeButton;
var channelText;

window.addEventListener('localized', function localized() {
  debug && console.log('We have l10n working!');
  if (initialized) {
    return;
  }

  channelText = document.getElementById('channel');

  unsubscribeButton = document.getElementById('unsubscribe');
  unsubscribeButton.addEventListener('click', function() {
    delete localStorage.endPoint;

    updateUI();
  });

  subscribeButton = document.getElementById('subscribe')
  subscribeButton.addEventListener('click', function() {
    // Subscribe
    if (!navigator.push) {
      return;
    }

    subscribeButton.disabled = true;

    var req = navigator.push.register();
    req.onerror = function onError(evt) {
      alert(navigator.mozL10n.get('error_register'));
      updateUI();
    };
    req.onsuccess = function onSuccess(evt) {
      // Save the end point locally
      var endPoint = req.result;
      localStorage.endPoint = endPoint;

      updateUI();

      // Send it to the server to store
      var data = new FormData();
      data.append('client', endPoint);
      doRequest('POST',
        '/api/v1/register',
        data,
        function onRequest(err, res) {
          if (err) {
            console.error('Error sending our channel ::: ' + err.target.status);
          } else {
            updateUI();
          }
        });
    };
  });

  updateUI();

  initialized = true;
});

// Updates the UI depending if we have a push channel or not, disabling/enabling
// buttons and visibility of the UI components
function updateUI() {
  var subscribed = localStorage.endPoint && localStorage.endPoint.length > 0;

  subscribeButton.disabled = subscribed;
  unsubscribeButton.disabled = !subscribed;

  if (subscribed) {
    subscribeButton.classList.add('hidden');
    navigator.mozL10n.localize(channelText, 'channel',
      {channel: localStorage.endPoint});
    channelText.classList.remove('hidden');
  } else {
    subscribeButton.classList.remove('hidden');
    channelText.classList.add('hidden');
  }
}

// Listen to any desktop notification event
window.navigator.mozSetMessageHandler(
  'notification',
  function onNotification() {
    navigator.mozApps.getSelf().onsuccess = function (evt) {
      var app = evt.target.result;
      app.launch();
    };
  }
);

// Listen to Simple Push events sents from the server
window.navigator.mozSetMessageHandler('push', function onPush(evt) {
  var channel = evt.pushEndpoint;
  var version = evt.version;

  getMessageFromServer(version, channel);
});

// Create a desktop notification that will bring our application
// to the foreground when clicked.
function createDesktopNotification(title, body) {
  navigator.mozApps.getSelf().onsuccess = function (evt) {
    var app = evt.target.result;
    var options = {
      icon: app.installOrigin + app.manifest.icons['60'],
      body: body
    };
    var notification = new Notification(title, options);
    notification.addEventListener('click', function () {
      app.launch();
    });
  };
}

// This will fetch what does mean message version 'version'? from your server.
// As you can imagine is pretty server side specific.
// In our case we will create a desktop notification
function getMessageFromServer(version, channel) {
  doRequest('GET', '/api/v1/' + version + '?client=' + channel, null,
    function onRequest(err, data) {
      if (err) {
        console.error(err);
        return;
      }

      createDesktopNotification('Simple Push', data);
  });
}

// Perform a request against the simplepushclient server
var doRequest = function doPost(type, endPoint, data, cb) {
  var uri = 'http://simplepushclient.eu01.aws.af.cm' + endPoint;
  var xhr = new XMLHttpRequest({mozSystem: true});

  xhr.onload = function onLoad(evt) {
    if (xhr.status === 200 || xhr.status === 0) {
      cb(null, xhr.response);
    } else {
      cb(xhr.status);
    }
  };
  xhr.open(type, uri, true);
  xhr.onerror = function onError(e) {
    console.error('onerror en xhr ' + xhr.status);
    cb(e);
  }
  xhr.send(data);
};
