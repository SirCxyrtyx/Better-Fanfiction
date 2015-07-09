// jshint jquery: true, devel: true, browser: true
/*global Dexie*/

//stories before 50500 aren't logged

'use strict';
var start = 4001, end = 10000, fetching = true;

var db = new Dexie('UserFavs');
db.version(1).stores({users: 'userid, stories', stories: 'storyid, users'});
db.open();

function processUserFavs(userid){
    return function(data){
        var favs = [];
        $('.favstories', data).each(function(){
            const storyid = this.dataset.storyid;
            
            favs.push(parseInt(storyid));
            db.stories.get(storyid, function(val){
                if(val === undefined){
                    db.stories.put({storyid: storyid, users: [userid]});
                } else {
                    db.stories.update({users: val.users.concat(userid)});
                }
            });
        });
        if(favs.length){
            db.users.put({userid: userid, stories: favs});
        }
        localStorage.setItem('continueFetchFrom', userid);
        if(userid < end && fetching){
            $.get('https://www.fanfiction.net/u/' + (userid + 1), processUserFavs(userid + 1));
        } else {
            alert(userid);
        }
    };
}

console.time('fetching from ' + start + ' to ' + end);

start = parseInt(localStorage.getItem('continueFetchFrom')); end = start + 10000; $.get('https://www.fanfiction.net/u/' + start, processUserFavs(start));
