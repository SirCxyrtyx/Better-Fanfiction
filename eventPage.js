// jshint jquery: true, undef: true,curly: true, bitwise: true, eqeqeq: true, immed: true, strict: true, unused: vars, devel: true, browser: true, newcap: false, multistr: true
/* global chrome */
'use strict';

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    chrome.tabs.query({url: 'https://www.fanfiction.net/*'}, function (tabs) {
        tabs.forEach(t => chrome.tabs.sendMessage(t.id, request));
    });
});
