// jshint jquery: true, undef: true,curly: true, bitwise: true, eqeqeq: true, immed: true, strict: false, unused: vars, devel: true, browser: true, newcap: false, multistr: true
/* global chrome, firebase */
'use strict';

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.updated) {
        let user = firebase.auth().currentUser;
        if (user) {
            firebase.database().ref('users/' + user.uid + '/' + request.updated).set(request.val);
        }
    } else if (request.authCheck) {
        if (firebase.auth().currentUser) {
            sendResponse({authStatus: true});
        } else {
            sendResponse({authStatus: false});
            startAuth(true);
        }
    }
});

let config = {
    apiKey: "AIzaSyCisxFC0G30N0Yh8meI3eSCl6BZOD5CF-I",
    authDomain: "better-fanfiction.firebaseapp.com",
    databaseURL: "https://better-fanfiction.firebaseio.com",
    projectId: "better-fanfiction",
    storageBucket: "better-fanfiction.appspot.com",
    messagingSenderId: "658655686523"
};
firebase.initializeApp(config);
startAuth(false);

firebase.auth().onAuthStateChanged(function(user) {
    if (user) {
      // User is signed in.
      setUpDBListeners(user.uid);
    } else {
    }
});

function setUpDBListeners(uid) {
    let dbRef = firebase.database().ref('users/' + uid);
    dbRef.on('child_added', onDBUpdate);
    dbRef.on('child_changed', onDBUpdate);
    dbRef.on('child_removed', snap => {
        let key = snap.key;
        let msgObj = {};
        if (key.startsWith('Read:')) {
            msgObj.updated = 'Read';
            msgObj.id = parseInt(key.substr(5), 10);
        } else if(key.startsWith('shelf:')) {
            msgObj.updated = 'Shelf';
            msgObj.id = parseInt(key.substr(6), 10);
        } else {
            msgObj = undefined;
        }
        chrome.storage.local.remove(key, () => tabUpdate(msgObj));
    });
}

function onDBUpdate (snap) {
    let key = snap.key;
        chrome.storage.local.get(key, x => {
            if (!jsonEqual(x[key], snap.val())) {
                let storeObj = {[key]: snap.val()};
                let msgObj = {};
                if (key.startsWith('Read:')) {
                    msgObj.updated = 'Read';
                    msgObj.id = parseInt(key.substr(5), 10);
                } else if(key.startsWith('shelf:')) {
                    msgObj.updated = 'Shelf';
                    msgObj.id = parseInt(key.substr(6), 10);
                } else if (key === 'ReadLater') {
                    msgObj.updated = 'ReadLater';
                } else if (key === 'Liked') {
                    msgObj.updated = 'Liked';
                } else if (key === 'FavoritesLastModified') {
                    msgObj.updated = 'Favorites';
                } else if (key === 'AlertsLastModified') {
                    msgObj.updated = 'Alerts';
                } else if (key === 'Bookshelves') {
                    let oldData = x[key],
                        newData = snap.val();
                    newData.forEach((shelf, i) => {
                        if(!jsonEqual(shelf, oldData[i])) {
                            if(shelf === undefined || shelf === null) {
                                shelf = oldData[i];
                            } else if (oldData[i] === undefined || oldData[i] === null){
                                msgObj.added = true;
                            }
                            msgObj.updated = 'Bookshelves';
                            msgObj.fandoms = shelf.fandoms;
                            msgObj.id = shelf.id;
                            msgObj.name = shelf.name;
                            //break
                            return false;
                        }
                    });
                } else {
                    msgObj = undefined;
                }
                chrome.storage.local.set(storeObj, () => tabUpdate(msgObj));
            }
        });
}

function tabUpdate(data){
    if (data !== undefined) {
        chrome.tabs.query({url: 'https://www.fanfiction.net/*'}, function (tabs) {
            tabs.forEach(t => chrome.tabs.sendMessage(t.id, data));
        });
    }
}

//from Google Firebase Auth Example: https://github.com/firebase/quickstart-js/blob/master/auth/chromextension/credentials.js
/**
 * Start the auth flow and authorizes to Firebase.
 * @param{boolean} interactive True if the OAuth flow should request with an interactive mode.
 */
function startAuth(interactive) {
  // Request an OAuth token from the Chrome Identity API.
  chrome.identity.getAuthToken({interactive: !!interactive}, function(token) {
    if (chrome.runtime.lastError && !interactive) {
      console.log('It was not possible to get a token programmatically.');
    } else if(chrome.runtime.lastError) {
      console.error(chrome.runtime.lastError);
    } else if (token) {
      // Authorize Firebase with the OAuth Access Token.
      var credential = firebase.auth.GoogleAuthProvider.credential(null, token);
      firebase.auth().signInWithCredential(credential).catch(function(error) {
        // The OAuth token might have been invalidated. Lets' remove it from cache.
        if (error.code === 'auth/invalid-credential') {
          chrome.identity.removeCachedAuthToken({token: token}, function() {
            startAuth(interactive);
          });
        }
      });
    } else {
      console.error('The OAuth Token was null');
    }
  });
}

function jsonEqual(a,b) {
    return JSON.stringify(a) === JSON.stringify(b);
}
