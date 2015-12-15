// jshint jquery: true, undef: true,curly: true, bitwise: true, eqeqeq: true, immed: true, strict: true, unused: vars, devel: true, browser: true, newcap: false, multistr: true
/* global chrome */

(function () {
'use strict';
var ffAPI = FanFictionAPI(),
    pageType = 'browse',
    storyid,
    chapter,
    storytextid,
    path = document.location.pathname,
    bookshelfBar = '<ul class="bookshelves dropdown">' +
        '<li title="Favorites" class="bookshelf unselected" data-added="0" style="background:#ffb400"><span>Fav</span></li>' +
        '<li title="Read It Later" class="bookshelf unselected" data-added="0" style="background:#318ccb"><span>RiL</span></li>' +
        '<li title="Following" class="bookshelf unselected" data-added="0" style="background:#60cf23"><span>Track</span></li>' +
        '<li title="Liked" class="bookshelf unselected" data-added="0" style="background:#FABA61"><span>Like</span></li>' +
        '<li title="More" class="bookshelf dropdown-toggle unselected" data-added="0" data-toggle="dropdown"><span>...</span></li>' +
        '<ul class="dropdown-menu"></ul>' +
        '</ul>';

if (path.search(/\/s\//) !== -1) {
    pageType = 'story';
    storyid = parseInt(path.match(/\d+/), 10);
} else if (path.search(/\/u\//) !== -1 || path.search(/\/~/) !== -1) {
    pageType = 'user';
} else if (path.search(/\/r\//) !== -1) {
    pageType = 'review';
} else if (path.search(/\/community\//) !== -1) {
    pageType = 'group';
}

//Signed-in check
if (document.cookie.search('funn=') === -1 && path !== '/login.php') {
    document.addEventListener('DOMContentLoaded', function () {
        $.toast('You\'re not logged in.', 2500);
    });
} else {
    ffAPI.userid = -1;
}
document.addEventListener('DOMContentLoaded', run);

function run() {
    if (pageType === 'story') {
        chapter = ($('select').length && $('select').get(0).selectedIndex) + 1;
        storyPage();
        setVisited(true);
        setUpStoryNav();
        if (document.cookie.search('funn=') !== -1) {
            ffAPI.userid = parseInt($('form[name="myselect"] script').html().match(/userid = (\d+)/)[1], 10);
        }
        storytextid = parseInt($('form[name="myselect"] script').html().match(/storytextid=(\d+)/)[1], 10);
    } else {
        convertStoryLinks();
    }
    //remove ad bar.
    $('.zmenu').has('ins').remove();

    $(window).on('popstate', function (e) {
        if (e.originalEvent.state !== null) {
            $.get('https://www.fanfiction.net/s/' + storyid + '/' + e.originalEvent.state.chapter, function (data) {
                loadChapterInPlace(parseStoryData(data, storyid), e.originalEvent.state.chapter, false, true);
                $('body').scrollTop(e.originalEvent.state.scrollPos);
            });
        }
    });

    setUpBookshelves();

    if (pageType === 'user') {
        userPage();
    } else if (pageType === 'review') {
        //place a chapter select at the bottom of the page
        $('.thead > select').clone(true).appendTo('.table-striped tbody')
            .wrap('<tr><td style="background-color: inherit;"></td></tr>').before($('center'));
    } else if (pageType === 'group') {
        groupPage();
    }

    $('<div class="modal fade hide" id="story_landing" style="display: none;"><div class="modal-body"></div></div>')
        .appendTo('body');
}

function storyPage(data) {
    var d = data || parseStoryData($('html'), storyid),
        hasImage = !!d.storyImageLink,
        imageSource = hasImage ? d.storyImageLink.substr(0, d.storyImageLink.length - 3) + '180/' : '',
        el,
        tags,
        wordsEl;

    el = $('<div id="profile_top">' +
           '<div class="inner">' +
              '<div class="image-container"><img src="' + imageSource + '"></div>' +
              '<div class="info-container">' +
                 '<ol class="info-list">' +
                    '<li class="info-list-updated">Updated <b>' + d.updated + '</b></li>' +
                    '<li class="info-list-published">Published <b>' + d.published + '</b></li>' +
                    '<li class="info-list-words">Words <b>' + d.wordcount + '</b></li>' +
                    '<li class="info-list-status">Status <b>' + (d.complete ? 'Complete' : 'In Progress') + '</b></li>' +
                 '</ol>' +
                 '<h1 id="author-title"><b>' + d.title + '</b><span class="author">- ' + d.authorElement + '</span></h1>' +
                 '<div>' +
                    '<hr>' +
                    '<p class="summary">' + d.description + '</p>' +
                    '<ul class="tags"></ul>' +
                 '</div>' +
              '</div>' +
           '</div>' + bookshelfBar + '</div>');

    tags = el.find('.tags');

    if (!hasImage) {
        el.find('.image-container').remove();
        tags.addClass('top-margin-40');
    } else {
        el.find('.bookshelves').addClass('up14');
    }

    //Rating tag
    tags.append(createTag(d.rating, 'rating'));

    //Genre tags
    if (d.genres) {
        for (let i = 0; i < d.genres.length; i++) {
            tags.append(createTag(d.genres[i], 'genre'));
        }
    }

    //Character Tags
    if (d.chars) {
        let chars = d.chars.split(']'),
            pair;

        for (let i = 0; i < chars.length; i++) {
            pair = false;
            chars[i] = chars[i].trim();
            if (chars[i][0] === '[') {
                pair = true;
                chars[i] = chars[i].substr(1);
                tags.append('<span>[</span>');
            }
            chars[i] = chars[i].split(',');
            for (let j = 0; j < chars[i].length; j++) {
                if (chars[i][j] !== '') {
                    tags.append(createTag(chars[i][j], 'character'));
                }
            }
            if (pair) {
                tags.append('<span class="right-bracket">]</span>');
            }
        }
    }

    //Info list
    wordsEl = el.find('.info-list-words');
    if (d.reviews) {
        wordsEl.before('<li class="info-list-reviews">Reviews <a href="/r/' + storyid + '/' + chapter + '">' + d.reviews + '</a></li>');
    }
    if (d.chapters) {
        wordsEl.before('<li class="info-list-chapters">Chapters <b>' + d.chapters + '</b></li>');
    }
    if (d.follows) {
        wordsEl.after('<li class="info-list-follows">Follows <b>' + d.follows + '</b></li>');
    }
    if (d.favs) {
        wordsEl.after('<li class="info-list-favs">Favs <b>' + d.favs + '</b></li>');
    }

    $('#profile_top').remove();
    $('#content_parent').prepend(el);

    $('#author-title > b').attr('data-original', storyid).click(storyLinkClick);

    setUpBookshelfBar('#profile_top ', d);
}

function groupPage() {
    $('<button class="btn">Load All</button>').insertAfter('form[name="myform"]').click(function (event) {
        var pathMatch;

        if (path.search(/\d\d\d+\/\d/) !== -1) {
            pathMatch = path.match(/(.+\d\d\d+\/\d+\/\d+\/)\d+(\/\d+\/\d+\/\d+\/\d+\/)/);
        } else {
            pathMatch = [path];
            pathMatch[1] = path + '99/0/';
            pathMatch[2] = '/0/0/0/0/';
        }

        $('.z-list').remove();
        $('center').remove();
        $('hr + script').after('<img width="64" height="64" class="spinner" src="' + chrome.extension.getURL('spinner.gif') + '" />');

        ffAPI.getGroupStories(pathMatch, function (list) {
            $('img.spinner').after(list).remove();
            $('img.lazy').lazyload();
            convertStoryLinks();
            $('span[data-xutime]').each(function (index, el) {
                $(this).html(easydate(this.dataset.xutime));
            });
        });
    });

    $('div + hr').before('Include: <input type="text" class="story-filter"> Exclude: <input type="text" class="story-filter"><span class="badge">0</span>');
    $('.story-filter').on('input', function () {
        $('.z-list').show().filter(function () {
            var exclude;
            if ($(this).find('.xgray').html().search($('.story-filter').eq(0).val()) === -1) {
                return true;
            }
            exclude = $('.story-filter').eq(1).val();
            if (exclude) {
                return $(this).find('.xgray').html().search(exclude) !== -1;
            }
            return false;
        }).hide();
        $('.badge').html($('.z-list:visible').length);
    });
}

function userPage() {
    //triggers image loading on tab switch
    //$('#mytab a').click(() => setTimeout($(window).trigger(), 100, 'resize'));

    $('#st > div').eq(0).after('Include: <input type="text" class="my-filter"> Exclude: <input type="text" class="my-filter">');
    $('.my-filter').on('input', function () {
        $('.mystories').show().filter(function () {
            var exclude;
            if ($(this).find('.xgray').html().search($('.my-filter').eq(0).val()) === -1) {
                return true;
            }
            exclude = $('.my-filter').eq(1).val();
            if (exclude) {
                return $(this).find('.xgray').html().search(exclude) !== -1;
            }
            return false;
        }).hide();
        $('#l_st .badge').html($('.mystories:visible').length);
    });

    $('#fs > div').eq(0).after('Include: <input type="text" class="fav-filter"> Exclude: <input type="text" class="fav-filter">');
    $('.fav-filter').on('input', function () {
        $('.favstories').show().filter(function () {
            var exclude;
            if ($(this).find('.xgray').html().search($('.fav-filter').eq(0).val()) === -1) {
                return true;
            }
            exclude = $('.fav-filter').eq(1).val();
            if (exclude) {
                return $(this).find('.xgray').html().search(exclude) !== -1;
            }
            return false;
        }).hide();
        $('#l_fs .badge').html($('.favstories:visible').length);
    });

    $('#st_inside').addClass('stories-main').before('<div class="stories-side" ><div><div class="panel">' +
                                                        '<div class="panel fandoms-list">' +
                                                            '<div class="panel-heading">Fandoms</div>' +
                                                            '<div class="panel-body"></div>' +
                                                        '</div>' +
                                                   '</div></div></div>');
    fandomsInList('#st').forEach(function (v, i) {
        $('<label class="control" data-fandom="' + v.k + '">' +
            '<input type="checkbox" checked>' +
            '<span class="control-indicator"></span>' +
            '<span class="control-label">' + v.k + ' (' + v.v + ')</span>' +
        '</label>').appendTo('#st .fandoms-list .panel-body').click(function (event) {

            var s = $('.mystories').filter((i,el) => JSON.parse(el.dataset.category).indexOf(this.dataset.fandom) !== -1);
            if ($('input', this)[0].checked) {
                s.show();
            } else {
                s.hide();
            }
            $('#l_st .badge').html($('.favstories:visible').length);
        });
    });
}

function setUpStoryNav() {
    var selectWidth;
    //remove original event-bindings
    $('#chap_select ~ button').addClass('nav-next').removeAttr('onclick');
    $('button[onclick^="self"]:not(.nav-next)').addClass('nav-prev').removeAttr('onclick');
    $('select').removeAttr('onchange');
    $('#content_wrapper_inner > span').replaceWith($('#content_wrapper_inner > span').clone(false));
    $('div > select').parent().replaceWith($('div > select').parent().clone(false));

    //add buttons if they aren't there
    if ($('.nav-next').length === 0) {
        $('select').after('<button class="btn nav-next" type="BUTTON" style="display:none;margin-left:5px;">Next &gt;</button>');
    }
    if ($('.nav-prev').length === 0) {
        $('select').before('<button class="btn nav-prev" type="BUTTON" style="display:none;margin-right:5px;">&lt; Prev</button>');
    }

    //add loading spinners
    $('select').after('<img class="loading-next" style="display: none;" width="30" height="30" title="" src="' + chrome.extension.getURL('spinner.gif') + '" />');
    $('select').before('<img class="loading-prev" style="display: none;" width="30" height="30" title="" src="' + chrome.extension.getURL('spinner.gif') + '" />');
    selectWidth = $('select').outerWidth();
    $('<img class="loading-select" style="display: none;" width="30" height="30" title="" src="' + chrome.extension.getURL('spinner.gif') + '" />')
        .css('padding', '0px ' + (selectWidth - 30) / 2 + 'px').insertAfter('select');

    $('.nav-next').eq(0).click(function (e) {
        e.preventDefault();
        $(this).hide();
        $('.loading-next').eq(0).show();
        $.get('https://www.fanfiction.net/s/' + storyid + '/' + (chapter + 1), function (data) {
            loadChapterInPlace(parseStoryData(data, storyid), chapter + 1, false);
        });
        $(this).blur();
    });

    $('.nav-next').eq(1).click(function () {
        $(this).hide();
        $('.loading-next').eq(1).show();
        $.get('https://www.fanfiction.net/s/' + storyid + '/' + (chapter + 1), function (data) {
            loadChapterInPlace(parseStoryData(data, storyid), chapter + 1);
        });
        $(this).blur();
    });

    $('.nav-prev').eq(0).click(function () {
        $(this).hide();
        $('.loading-prev').eq(0).show();
        $.get('https://www.fanfiction.net/s/' + storyid + '/' + (chapter - 1), function (data) {
            loadChapterInPlace(parseStoryData(data, storyid), chapter - 1, false);
        });
        $(this).blur();
    });

    $('.nav-prev').eq(1).click(function () {
        $(this).hide();
        $('.loading-prev').eq(1).show();
        $.get('https://www.fanfiction.net/s/' + storyid + '/' + (chapter - 1), function (data) {
            loadChapterInPlace(parseStoryData(data, storyid), chapter - 1);
        });
        $(this).blur();
    });

    $('select').eq(0).change(function (e) {
        var target = e.target;
        $(this).hide();
        $('.loading-select').eq(0).show();
        $.get('https://www.fanfiction.net/s/' + storyid + '/' + (target.selectedIndex + 1), function (data) {
            loadChapterInPlace(parseStoryData(data, storyid), target.selectedIndex + 1, false);
        });
        $(this).blur();
    });

    $('select').eq(1).change(function (e) {
        var target = e.target;
        $(this).hide();
        $('.loading-select').eq(1).show();
        $.get('https://www.fanfiction.net/s/' + storyid + '/' + (target.selectedIndex + 1), function (data) {
            loadChapterInPlace(parseStoryData(data, storyid), target.selectedIndex + 1);
        });
        $(this).blur();
    });
}

function loadChapterInPlace(d, chap, scrollToTop, back) {
    var chapterTitle;

    if (!back) {
        history.replaceState({chapter: chapter, scrollPos: $('body').scrollTop()}, '', d.storyLink + '/' + chapter);
    }
    chapter = chap;

    $('body > div[style^="position"]').remove();
    $('#storytext').replaceWith(d.data.find('#storytext'));
    if (!back) {
        history.pushState({chapter: chapter}, '', d.storyLink + '/' + chapter);
    }

    if (scrollToTop !== false) {
        $('select').get(0).scrollIntoView();
    }

    setVisited(true, chapter);

    if (d.chapters > 1) {
        if (chapter === 1) {
            $('.nav-prev').hide();
            $('.nav-next').show();
        } else if (chapter === d.chapters) {
            $('.nav-prev').show();
            $('.nav-next').hide();
        } else {
            $('.nav-prev').show();
            $('.nav-next').show();
        }
    }
    $('select').show();
    $('.loading-next').hide();
    $('.loading-prev').hide();
    $('.loading-select').hide();

    if (d.chapters > $('select')[0].length) {
        $('select').replaceWith(d.data.find('select').eq(0));
        $('.summary').html(d.description);
        $('ol.info-list li').each(function () {
            switch (this.className) {
                case 'info-list-chapters':
                    $('b', this).html(d.chapters);
                    break;
                case 'info-list-words':
                    $('b', this).html(d.wordcount);
                    break;
                case 'info-list-status':
                    $('b', this).html(d.complete ? 'Complete' : 'In Progress');
                    break;
                default:
                    break;
            }
        });
    }
    $('.info-list-updated b').html(d.updated);
    $('.info-list-favs b').html(d.favs);
    $('.info-list-follows b').html(d.follows);
    $('.info-list-reviews a').html(d.reviews).attr('href', '/r/' + storyid + '/' + chapter);
    $('select').get(0).selectedIndex = chapter - 1;
    $('select').get(1).selectedIndex = chapter - 1;

    //set the document title (tab name)
    chapterTitle = $('select')[0][chapter - 1].text.split(/\d+\. /)[1];
    chapterTitle = (/Chapter \d{1,2}/.test(chapterTitle) ? ' ' : (' Chapter ' + chapter + ': ')) + chapterTitle;
    document.title = d.title + chapterTitle + ', a '  + $('#pre_story_links > .lc-left > a:nth-child(3)').html().toLowerCase() + ' fanfic | FanFiction';

    //to make reviews go to the right chapter and story
    storytextid = parseInt($('form[name="myselect"] script', d.data).html().match(/storytextid=(\d+)/)[1], 10);
    $('#review_review').attr('onclick', 'chapter=' + chapter + ',storytextid=' + storytextid + ',storyid=' + storyid);

    //to make abuse reports and community adds go to the right chapter and story
    $('#story_actions > div > button').attr('onclick', 'chapter=' + chapter + ',title="' + d.title.replace(/ /g, '+') + '",storyid=' + storyid);

    //to properly report pageviews to FF.net's stat-tracker
    $.get($('#storytextp', d.data).prev().html().match(/\/eye\/[^']+/)[0]);

    //reset review form in case a review has been left
    $('#review').show();
    $('#review_success').hide();
    $('#review_postbutton').html('Post Review as '+ document.cookie.match(/funn=([^;]+)/)[1]);
    $('#review_postbutton').prop('disabled', false);
}

function setUpBookshelfBar(container, storyData) {
    var storyId = storyData.storyid,
        toggle = function () {
            $(this).toggleClass('selected');
            $(this).toggleClass('unselected');
        };
    if (container === undefined) {
        container = '';
    }

    ffAPI.getFollowingList(function (list) {
        $.each(list, function (i,v) {
            if (v === storyId) {
                $(container + ' li.bookshelf[title="Following"]').removeClass('unselected').addClass('selected');
                return false;
            }
        });
    });

    ffAPI.getFavoritedList(function (list) {
        $.each(list, function (i,v) {
            if (v === storyId) {
                $(container + 'li.bookshelf[title="Favorites"]').removeClass('unselected').addClass('selected');
                return false;
            }
        });
    });

    ffAPI.getReadLater(function (list) {
        if (list.indexOf(storyId) !== -1) {
            $(container + 'li.bookshelf[title="Read It Later"]').removeClass('unselected').addClass('selected');
        }
    });

    ffAPI.getLiked(function (list) {
        if (list.indexOf(storyId) !== -1) {
            $(container + 'li.bookshelf[title="Liked"]').removeClass('unselected').addClass('selected');
        }
    });

    ffAPI.getBookshelves(function (shelves) {
        $('<li title="Add" class="shelf"><input type="text" placeholder="Bookshelf Name"></input><button class="btn">Add</button></li>')
            .appendTo(container + '.bookshelves .dropdown-menu');
        shelves.forEach(function (val) {
            var shelfId = val.id;

            if (storyData.fandom[0] === val.fandom[0] ||
              (storyData.fandom.length > 1 && storyData.fandom[1] === val.fandom[0]) ||
              (val.fandom.length > 1 && storyData.fandom[0] === val.fandom[1]) ||
              (val.fandom.length > 1 && storyData.fandom.length > 1 && storyData.fandom[1] === val.fandom[1])) {

                $('<li title="' + shelfId + '" class="shelf"><span>' + val.name + '</span><i class="icon-ok-circled"></i></li>')
                    .insertBefore(container + '.bookshelves .dropdown-menu li[title="Add"]')
                    .click(function () {
                        if ($(this).hasClass('selected')) {
                            ffAPI.bookshelf.remove(shelfId, storyId, toggle.bind(this));
                        } else {
                            ffAPI.bookshelf.add(shelfId, storyId, toggle.bind(this));
                        }
                    });

                ffAPI.bookshelf.get(shelfId, function (list) {
                    if (list.indexOf(storyId) !== -1) {
                        $('.bookshelves .dropdown-menu .shelf[title="' + shelfId + '"]', container).addClass('selected');
                    }
                });
            }
        });
        $(container + '.bookshelves .dropdown-menu button').click(function () {
            var shelfName = $(this).siblings('input').val();
            if (shelfName) {
                ffAPI.addBookshelf(shelfName, storyData.fandom, function (shelfId) {
                    $('<li title="' + shelfId + '" class="shelf"><span>' + shelfName + '</span><i class="icon-ok-circled"></i></li>')
                        .insertBefore(container + '.bookshelves .dropdown-menu li[title="Add"]')
                        .click(function () {
                            if ($(this).hasClass('selected')) {
                                ffAPI.bookshelf.remove(shelfId, storyId, toggle.bind(this));
                            } else {
                                ffAPI.bookshelf.add(shelfId, storyId, toggle.bind(this));
                            }
                        });
                });
            }
            $(this).siblings('input').val('');
        });
    });

    $(container + '.bookshelf').click(function () {
        switch ($(this).attr('title')) {
            case 'Favorites':
                if ($(this).hasClass('selected')) {
                    ffAPI.unfav(storyId, toggle.bind(this));
                } else {
                    ffAPI.fav(storyId, toggle.bind(this));
                }
                break;
            case 'Following':
                if ($(this).hasClass('selected')) {
                    ffAPI.unfollow(storyId, toggle.bind(this));
                } else {
                    ffAPI.follow(storyId, toggle.bind(this));
                }
                break;
            case 'Read It Later':
                if ($(this).hasClass('selected')) {
                    ffAPI.removeFromRil(storyId, toggle.bind(this));
                } else {
                    ffAPI.addToRil(storyId, toggle.bind(this));
                }
                break;
            case 'Liked':
                if ($(this).hasClass('selected')) {
                    ffAPI.unlike(storyId, toggle.bind(this));
                } else {
                    ffAPI.like(storyId, toggle.bind(this));
                }
                break;
            case 'More':
                break;
            default:
                toggle(this);
        }
    });

    function updateShelf(title, add) {
        if (add) {
            $(container + '.bookshelves [title="' + title + '"]').removeClass('unselected').addClass('selected');
        } else {
            $(container + '.bookshelves [title="' + title + '"]').removeClass('selected').addClass('unselected');
        }
    }

    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        if (request.updated && request.id === storyId){
            switch (request.updated){
                case 'Liked':
                    updateShelf('Liked', request.add);
                    break;
                case 'ReadLater':
                    updateShelf('Read It Later', request.add);
                    break;
                case 'Favorites':
                    updateShelf('Favorites', request.add);
                    break;
                case 'Alerts':
                    updateShelf('Following', request.add);
                    break;
                case 'Bookshelves':
                    break;
                default:
                    if (request.updated.startsWith('shelf:')){
                        updateShelf(request.updated.substr(6), request.add);
                    }
                    break;
            }
        }
    });
}

function setUpBookshelves() {
    $('<div class="modal fade hide" id="bookshelf_display" style="display: none;">' +
        '<div class="modal-header">' +
        '<button type="button" class="close" data-dismiss="modal"><span>&times;</span></button>' +
        '<h4 class="modal-title">Bookshelves</h4></div>' +
       '<div class="modal-body"><div role="tabpanel">' +
        '<ul class="nav nav-tabs" role="tablist" id="bookshelf_tabs">' +
            '<li role="presentation"><a href="#ril_tab" role="tab" data-toggle="tab">Read It Later</a></li>' +
            '<li role="presentation"><a href="#fav_tab" role="tab">Favorites</a></li>' +
            '<li role="presentation"><a href="#track_tab" role="tab">Following</a></li>' +
            '<li role="presentation"><a href="#liked_tab" role="tab">Liked</a></li>' +
            '<li role="presentation"><a href="#alsoliked_tab" role="tab">Also Liked</a></li>' +
            '<li role="presentation"><a href="#read_tab" role="tab">Read</a></li>' +
            '<li role="presentation"><a href="#" role="tab">Shelves: <select id="fandom-select"></select><select id="shelf-select"><option id="default-shelf">--</option></select></a></li>' +
        '</ul><div class="tab-content">' +
            '<div role="tabpanel" class="tab-pane" id="ril_tab"><ul class="story-card-list list_boxes"></ul></div>' +
            '<div role="tabpanel" class="tab-pane" id="fav_tab"><ul class="story-card-list list_boxes"></ul></div>' +
            '<div role="tabpanel" class="tab-pane" id="track_tab"><ul class="story-card-list list_boxes"></ul></div>' +
            '<div role="tabpanel" class="tab-pane" id="liked_tab"><ul class="story-card-list list_boxes"></ul></div>' +
            '<div role="tabpanel" class="tab-pane" id="alsoliked_tab"><ul class="story-card-list list_boxes"></ul></div>' +
            '<div role="tabpanel" class="tab-pane" id="read_tab"><ul class="story-card-list list_boxes"></ul></div>' +
        '</div></div></div><div class="modal-footer"></div></div>').appendTo('body');


    $('<div class="xmenu_item"><a class="show-bookshelves-popup">Bookshelves</a></div>').appendTo('.zui tr > td:nth-child(1)');

    ffAPI.getBookshelves(function (shelves) {
        var fandoms = [];
        shelves.forEach(function (val, i) {
            $('#shelf-select')
            .append('<option class="' + val.fandom.map(s => s.replace(/[^_a-zA-Z-]/g, '')).join(' ') + '" data-id="' + val.id + '">' + val.name + '</option>');
            $('#bookshelf_display .tab-content')
            .append('<div role="tabpanel" class="tab-pane" id="shelf_tab_' + val.id + '"><ul class="story-card-list list_boxes"></ul></div>');

            val.fandom.forEach(function (item) {
                if (fandoms.indexOf(item) === -1) {
                    fandoms.push(item);
                } else {
                    if (!$('#default-shelf').hasClass(item.replace(/[^_a-zA-Z-]/g, ''))) {
                        $('#default-shelf').addClass(item.replace(/[^_a-zA-Z-]/g, ''));
                    }
                }
            });
        });

        fandoms.forEach(function (val) {
            $('#fandom-select')
            .append('<option value="' + val.replace(/[^_a-zA-Z-]/g, '') + '">' + val + '</option>');
        });

        $('#shelf-select').chainedTo('#fandom-select');

        $('#shelf-select').change(function (e) {
            var target = e.target,
                tabId = '#shelf_tab_' + target.selectedOptions[0].dataset.id;
            if (!$(tabId).hasClass('populated')) {
                ffAPI.bookshelf.get(target.selectedOptions[0].dataset.id, function (list) {
                    populateBookshelf(list, $(tabId));
                    $(tabId).addClass('populated');
                });
            }
            $(this).parent().tab('show');
            $('#bookshelf_display .tab-content .active').removeClass('active');
            $(tabId).addClass('active');
            $(this).blur();
        });
    });

    if (pageType === 'story') {
        $('#bookshelf_tabs a[href="#alsoliked_tab"]').click(function (e) {
            e.preventDefault();
            if (!$('#alsoliked_tab').hasClass('populated')) {
                $('#alsoliked_tab').addClass('populated')
                    .append('<img width="64" height="64" title="" alt="" src="' + chrome.extension.getURL('spinner.gif') + '" />');
                ffAPI.getAlsoLiked(function (alObj) {
                    populateBookshelfAlt(alObj.stories, $('#alsoliked_tab'));
                });
            }
            $(this).tab('show');
        });
    } else {
        $('#bookshelf_tabs > li').has('a[href="#alsoliked_tab"]').hide();
    }

    $('.show-bookshelves-popup').click(function () {
        $('#bookshelf_display').modal().css('display', 'block').addClass('in');
    });

    $('#bookshelf_tabs a[href="#ril_tab"]').click(function (e) {
        e.preventDefault();
        if (!$('#ril_tab').hasClass('populated')) {
            ffAPI.getReadLater(function (list) {
                populateBookshelf(list, $('#ril_tab'));
                $('#ril_tab').addClass('populated');
            });
        }
        $(this).tab('show');
    });

    $('#bookshelf_tabs a[href="#fav_tab"]').click(function (e) {
        e.preventDefault();
        if (!$('#fav_tab').hasClass('populated')) {
            ffAPI.getFavoritedList(function (list) {
                populateBookshelf(list, $('#fav_tab'), false);
                $('#fav_tab').addClass('populated');
            });
        }
        $(this).tab('show');
    });

    $('#bookshelf_tabs a[href="#track_tab"]').click(function (e) {
        e.preventDefault();
        if (!$('#track_tab').hasClass('populated')) {
            ffAPI.getFollowingList(function (list) {
                populateBookshelf(list, $('#track_tab'));
                $('#track_tab').addClass('populated');
            });
        }
        $(this).tab('show');
    });

    $('#bookshelf_tabs a[href="#liked_tab"]').click(function (e) {
        e.preventDefault();
        if (!$('#liked_tab').hasClass('populated')) {
            ffAPI.getLiked(function (list) {
                populateBookshelf(list, $('#liked_tab'), false);
                $('#liked_tab').addClass('populated');
            });
        }
        $(this).tab('show');
    });

    $('#bookshelf_tabs a[href="#read_tab"]').click(function (e) {
        e.preventDefault();
        if (!$('#read_tab').hasClass('populated')) {
            ffAPI.getRead(function (list) {
                populateBookshelfAlt(list, $('#read_tab'));
                $('#read_tab').addClass('populated');
            });
        }
        $(this).tab('show');
    });

    function updateShelf(id) {
        $(id).removeClass('populated');
        if ($(id).hasClass('active')) {
            $('#bookshelf_tabs a[href="' + id + '"]').trigger('click');
        }
    }
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        if (request.updated){
            switch (request.updated){
                case 'Liked':
                    updateShelf('#liked_tab');
                    break;
                case 'ReadLater':
                    updateShelf('#ril_tab');
                    break;
                case 'Favorites':
                    updateShelf('#fav_tab');
                    break;
                case 'Alerts':
                    updateShelf('#track_tab');
                    break;
                case 'Bookshelves':

                    break;
                default:
                    if (request.updated.startsWith('shelf:')){
                        $('#shelf_tab_' + request.updated.substr(6)).removeClass('populated');
                        if ($('#shelf_tab_' + request.updated.substr(6)).hasClass('active')) {
                            $('#shelf-select').trigger('change');
                        }
                    }
                    break;
            }
        }
    });
}

function convertStoryLinks() {
    var id,
        el;
    $('.z-list').each(function (index, val) {
        el = $(val);
        if (el.find('.novtitle').length) {
            return;
        }
        id = el.attr('data-storyid') || el.find('.stitle').attr('href').match(/\/s\/([0-9]+)/)[1];
        if (el.has('.icon-chevron-right').length !== 0) {
            el.find('.icon-chevron-right').unwrap().attr('data-original', id);
        } else {
            $('<span class="icon-chevron-right xicon-section-arrow" data-original="' + id + '" style="margin-left:5px;"></span>').insertAfter(el.find('.stitle'));
        }
        el.find('.icon-chevron-right').click(storyLinkClick);
    });
}

function storyLinkClick(e) {
    var storyId = $(e.currentTarget).attr('data-original'),
        loadedStorys = $('#story_landing .story_container').hide();
    if (loadedStorys.filter('[data-id=' + storyId + ']').show().length === 0) {
        $.get('https://www.fanfiction.net/s/' + storyId, function (data) {
            populateStoryLanding(parseStoryData(data, storyId));
            $('#story_landing').modal().css('display', 'block').addClass('in');

        });
    } else {
        $('#story_landing').modal();
    }
}

function populateStoryLanding(d) {
    var m = $('#story_landing'),
        chapterTitle,
        el = $('<div class="story_container" data-id=' + d.storyid + '> <div class="story_content_box" > <div class="no_padding"> <div class="title"> <span class="content_rating"></span> <div> <a class="story_name" href=""></a> <div class="author"> <span class="by">by</span> <a href=""></a> </div> </div> </div> <div class="story"> <div class="story_data"> <div class="right" style="margin-left:0px;"> <div class="padding"> <div class="description"><img src="" class="story_image"><hr> </div> <div class="chapter_list"> <ul class="chapters"> <li class="bottom"> <span class="status"></span> <div class="word_count"> <b></b> words total </div> </li> </ul> </div> </div> </div> </div> <div class="extra_story_data"> <div class="inner_data"> <span class="date_approved"> <div> <span class="published">Published</span> <br> <span></span> </div> </span> <span class="last_modified"> <div> <span class="published">Updated</span> <br> <span></span> </div> </span> </div> </div> </div> </div> </div></div>'),
        chapterList = d.data.find('select').first().children();

    el.find('.story_name').html(d.title).attr('href', d.storyLink);
    el.find('.author').append(d.authorElement);
    el.find('img.story_image').attr('src', d.storyImageLink);
    el.find('.description').append('<p>' + d.description + '</p>');
    el.find('.content_rating').html(d.rating);
    el.find('.word_count b').html(d.wordcount);
    el.find('.date_approved > div').children().last().html(d.published);
    el.find('.last_modified > div').children().last().html(d.updated);

    //rating
    switch (d.rating) {
        case 'M':
            el.find('.content_rating').addClass('content_rating_mature');
            break;
        case 'T':
            el.find('.content_rating').addClass('content_rating_teen');
            break;
        case 'K+':
            el.find('.content_rating').addClass('content_rating_everyone');
            break;
        default:
            el.find('.content_rating').addClass('content_rating_everyone');
    }

    //chapters
    for (let i = d.chapters; i > 0; i--) {
        chapterTitle = chapterList.length ? chapterList.eq(i - 1).html().replace(/[0-9]+\. /, '') : 'Chapter 1';
        el.find('.chapters').prepend('<div class="chapter_container ">' +
            '<li><div data-chapter="' + i + '" class="chapter-read-icon" title="(Click to toggle read status)">✔</div>' +
            '<a class="chapter_link" href="' + d.storyLink + '/' + i + '">' + chapterTitle + '</a></li></div>');
    }
    getReadObj('Read:' + d.storyid, function (readObj) {
        var readChapters = readObj.chapters;
        $('.chapter-read-icon', el).each(function (index, element) {
            if (readChapters.indexOf(parseInt($(this).data('chapter'), 10)) !== -1) {
                $(this).addClass('chapter-read');
            }
        });
    });
    el.find('.chapter-read-icon').click(function () {
        if ($(this).hasClass('chapter-read')) {
            setVisited(false, $(this).data('chapter'), d.storyid);
            $(this).removeClass('chapter-read');
        } else {
            setVisited(true, $(this).data('chapter'), d.storyid);
            $(this).addClass('chapter-read');
        }
    });

    //Completion
    if (d.complete) {
        el.find('.status').addClass('status-complete').html('Complete');
    } else {
        el.find('.status').addClass('status-in-progress').html('In Progress');
    }

    //Genre tags
    if (d.genres) {
        for (let j = d.genres.length - 1; j >= 0; j--) {
            createTag(d.genres[j], 'character').insertAfter(el.find('img.story_image'));
        }
    }

    el.find('.title').append(bookshelfBar);

    m.children('.modal-body').append(el);

    setUpBookshelfBar('.story_container[data-id=' + d.storyid + '] ', d);
}

function getReadObj(key, callback) {
    chrome.storage.local.get(key, function (items) {
        if (items[key]) {
            callback(items[key]);
        } else {
            callback({chapters: [], lastRead: Math.trunc(Date.now() * 0.00001)});
        }
    });
}

function createTag(name, type) {
    if (type === 'rating') {
        switch (name) {
            case 'M':
                name = 'Mature';
                break;
            case 'T':
                name = 'Teen';
                break;
            case 'K+':
                name = 'Everyone+';
                break;
            default:
                name = 'Everyone';
        }
    }
    return $('<div class="tag-' + type + '">' + name + '</div>');
}

function setVisited(add, chap, id) {
    var key,
        accessed = false;

    //actually visited the chapter, didn't just click on the read checkbox
    if (!id) {
        id = storyid;
        accessed = true;
    }
    chap = chap || chapter;
    key = 'Read:' + id;
    getReadObj(key, function (readObj) {
        var storeObj = {};
        //regular pageview
        if (accessed && add) {
            readObj.lastRead = Math.trunc(Date.now() * 0.00001);
        }
        //not already marked as read
        if (readObj.chapters.indexOf(chap) === -1 && add) {
            readObj.chapters.push(chap);
        //mark as not read
        } else if (add === false) {
            readObj.chapters.splice(readObj.chapters.indexOf(chap), 1);
            if (readObj.chapters.length < 1) {
                chrome.storage.local.remove(key);
                return;
            }
        //if already marked as read but this isn't a chapter visit
        } else if (!accessed) {
            return;
        }
        storeObj[key] = readObj;
        chrome.storage.local.set(storeObj);
    });
}

function populateBookshelf(storyIds, bookshelf, byComplete) {
    var wrapper = $('.story-card-list', bookshelf),
        count = storyIds.length,
        existing;
    byComplete = typeof byComplete !== 'undefined' ? byComplete : true;

    //if there are already stories on the bookshelf
    if (wrapper.children().length) {
        //get existing list of storyids
        existing = Array.from(wrapper.children(), el => parseInt(el.dataset.story, 10));
        //remove from bookshelf any stories not on new list
        existing.forEach(function (val) {
            if (storyIds.indexOf(val) === -1) {
                $('li[data-story="' + val + '"]', wrapper).remove();
            }
        });
    } else {
        existing = [];
    }
    storyIds.forEach(function (val, i) {
        //add stories that aren't on bookshelf already
        if (val !== 0 && existing.indexOf(val) === -1) {
            $.get('https://www.fanfiction.net/s/' + val, function (data) {
                wrapper.append(createStoryCard(data, val, i, byComplete));
                //since get requests are async, this ensures alignSoryCards runs after every storyCard has been made.
                count--;
                if (count === 0) {
                    setTimeout(alignStoryCards, 100, wrapper);
                }
            });
        } else {
            count--;
        }
    });
}

function populateBookshelfAlt(stories, bookshelf) {
    var wrapper = $('.story-card-list', bookshelf),
        part = stories.splice(0, 50),
        count = part.length,
        loadBtn;
    part.forEach(function (val, i) {
        $.get('https://www.fanfiction.net/s/' + val.k, function (data) {
            wrapper.append(createStoryCard(data, val.k, -val.v, false));
            count--;
            if (count === 0) {
                setTimeout(alignStoryCards, 100, wrapper);
            }
        });
    });
    if (stories.length) {
        loadBtn = $('<li data-order="100000" style="order: 100000;" class="load-more"><div class="story-card"><span class="info"></span></div></li>');
        loadBtn.children('.story-card').click(function () {
            populateBookshelfAlt(stories, bookshelf);
            loadBtn.remove();

        }).children('span').html('Load ' + (stories.length > 50 ? (50 + ' more') : ('all ' + stories.length + ' remaining')) + ' stories');
        wrapper.append(loadBtn);
    }
}

function parseStoryData(data, storyid) {
    var that = {},
        d = $(data),
        storyInfo = d.find('#profile_top .xgray').html(),
        //charRegex = /> - \w+ - ([A-Za-z\.,\[\] \/()'°0-9á]+)/;
        charRegex = /> - \w+ - (.+?) - /;

    that.storyid = parseInt(storyid);
    that.title = d.find('#profile_top > b').html();
    that.rating = d.find('.xgray > .xcontrast_txt').html().slice(9);
    that.storyLink = 'https://www.fanfiction.net/s/' + storyid;
    that.storyImageLink = d.find('.cimage').eq(1).attr('src');
    that.description = d.find('#profile_top > div').html();
    that.authorElement = d.find('#profile_top > a')[0].outerHTML;
    that.published = easydate(d.find('#profile_top .xgray span').last().data('xutime'));
    that.updated = easydate(d.find('#profile_top .xgray span').first().data('xutime'));
    //that.chapter = d.find('#storytext');

    //fandom(s)
    if (d.find('.lc-left').has('img').length) {
        that.fandom = d.find('.lc-left a').html().replace(/ Crossover$/, '').split(' + ');
    } else {
        that.fandom = [d.find('.lc-left a:last-child').html()];
    }

    //genres
    if (storyInfo.search(/> - \w+ - ([A-Za-z\/\-]+)/) !== -1) {
        that.genres = storyInfo.match(/> - \w+ - ([A-Za-z\/\-]+)/)[1].split('/');
        if (that.genres[0] === 'Chapters') {
            delete that.genres;
        }
        charRegex = /> - \w+ - [A-Za-z\/\-]+ - (.+?) - /;
    }

    //Completion
    if (storyInfo.search(/Complete/) !== -1) {
        that.complete = true;
    } else {
        that.complete = false;
    }

    //wordcount
    if (storyInfo.search(/Words: ([0-9,]+)/) !== -1) {
        that.wordcount = storyInfo.match(/Words: ([0-9,]+)/)[1];
    }
    //favs
    if (storyInfo.search(/Favs: ([0-9,]+)/) !== -1) {
        that.favs = storyInfo.match(/Favs: ([0-9,]+)/)[1];
    }
    //follows
    if (storyInfo.search(/Follows: ([0-9,]+)/) !== -1) {
        that.follows = storyInfo.match(/Follows: ([0-9,]+)/)[1];
    }
    //reviews
    if (storyInfo.search(/Reviews: <a href="\/r\/[0-9]+\/">([0-9,]+)/) !== -1) {
        that.reviews = storyInfo.match(/Reviews: <a href="\/r\/[0-9]+\/">([0-9,]+)/)[1];
    }
    //characters
    if (storyInfo.search(charRegex) !== -1) {
        that.chars = storyInfo.match(charRegex)[1].trim();
        if (that.chars.includes('Chapters:')) {
            delete that.chars;
        }
    }
    //chapters
    if (storyInfo.search(/Chapters: ([0-9,]+)/) !== -1) {
        that.chapters = parseInt(storyInfo.match(/Chapters: ([0-9]+)/)[1]);
    } else {
        that.chapters = 1;
    }

    that.data = d;

    return that;
}

function createStoryCard(data, storyid, index, byComplete) {
    var d = parseStoryData(data, storyid),
        infoString,
        storyCard = $('<li data-story="' + d.storyid + '"><div class="story-card-container"><div class="story-card"><h2>' +
                        '<span class="content_rating">' + d.rating + '</span>' +
                        '<a class="story_link" data-original="' + d.storyid + '">' + d.title + '</a>' +
                        '<span class="status"></span></h2><div class="story-card-content">' +
                        '<span class="short_description">' + d.description +
                        '<span class="by">&nbsp;<b>·</b>&nbsp;' + d.authorElement +
                        '</span></span></div><span class="info"></span></div></div></li>');

    byComplete = typeof byComplete !== 'undefined' ? byComplete : true;
    storyCard.find('.story_link').click(storyLinkClick);

    //no image
    if (d.storyImageLink && pageType !== 'popup') {
        storyCard.find('.story-card-content').prepend('<img src="https:' + d.storyImageLink + '" class="story_image">');
    }

    //rating
    switch (d.rating) {
        case 'M':
            storyCard.find('.content_rating').addClass('content_rating_mature');
            break;
        case 'T':
            storyCard.find('.content_rating').addClass('content_rating_teen');
            break;
        case 'K+':
            storyCard.find('.content_rating').addClass('content_rating_everyone');
            break;
        default:
            storyCard.find('.content_rating').addClass('content_rating_everyone');
    }

    //genres
    if (d.genres) {
        for (let j = d.genres.length - 1; j >= 0; j--) {
            $('<span class="story_category story_category_' + d.genres[j].toLowerCase() + '">' + d.genres[j] + '</span>')
                .prependTo(storyCard.find('.short_description'));
        }
    }

    //Completion
    if (!d.complete) {
        storyCard.find('.status').addClass('status-in-progress').html('In Progress');
        if (byComplete) {
            index += 10000;
        }
    } else {
        storyCard.find('.status').addClass('status-complete').html('Complete');
    }
    storyCard.css('order', index);
    storyCard.attr('data-order', index);

    //wordcount
    if (d.wordcount) {
        infoString = d.wordcount + ' words&nbsp;';
    }
    //favs
    if (d.favs) {
        infoString += '<b>·</b>&nbsp;' + d.favs + ' favs&nbsp';
    }
    //characters
    if (d.chars) {
        infoString += '<b>·</b>&nbsp;' + d.chars;
    }
    storyCard.find('.info').html(infoString);
    return storyCard;
}

function alignStoryCards(cardList) {
    var cards = cardList.children(),
        el1,
        el2,
        diff;

    cards.sort(function (a, b) {
        return $(a).attr('data-order') - $(b).attr('data-order');
    });
    for (let i = 1; i < cards.length; i += 2) {
        el1 = cards.eq(i - 1);
        el2 = cards.eq(i);

        diff = Math.abs(el1.find('.story-card').height() - el2.find('.story-card').height());
        if (el1.find('.story-card').height() > el2.find('.story-card').height()) {
            el2.find('.story-card-content').css('padding-bottom', diff + 'px');
        } else {
            el1.find('.story-card-content').css('padding-bottom', diff + 'px');
        }

    }
}

function fandomsInList(listClass) {
    var also = {},
        list = [];
    $(listClass + ' .z-list').each(function () {
        var item = $('.xgray', this).html().match(/^(.+?) - /)[1],
            item2;
        if (item === 'Crossover') {
            item = $('.xgray', this).html().match(/Crossover - (.+?) &amp; (.+?) - /);
            this.dataset.category = JSON.stringify(item.slice(1));
            item2 = item[2];
            item = item[1];
            if (!also[item2]) {
                also[item2] = 1;
            } else {
                also[item2] += 1;
            }
        } else {
            this.dataset.category = JSON.stringify([item]);
        }
        if (!also[item]) {
            also[item] = 1;
        } else {
            also[item] += 1;
        }

    });
    for (let prop in also) {
        if (also.hasOwnProperty(prop)) {
            list.push({
                'k': prop,
                'v': also[prop]
            });
        }
    }
    return list.sort((a, b) => b.v - a.v);
}

function FanFictionAPI() {
    var that = {},
        userid,
        loggedIn = false,
        followingList,
        favoritedList,
        followingAccessTime,
        favoritedAccessTime,
        progressBar;

    chrome.storage.local.get('userid', function (items) {
        if (items.userid) {
            userid = items.userid;
        }
    });

    Object.defineProperty(that, 'userid', { set: function (x) {
        loggedIn = true;
        if(x !== -1){
            userid = x;
            chrome.storage.local.set({'userid': x});
        }
    } });

    //type = 'alert' || 'favorites'
    function readFFnetList(type, callback, index, list) {
        if (!loggedIn) {
            $.toast('Please login or signup to access this feature.');
            return;
        }

        list = typeof list !== 'undefined' ? list : [];
        index = typeof index !== 'undefined' ? index : 1;

        $.post('https://www.fanfiction.net/' + type + '/story.php?' + (type === 'favorites' ? 'sort=added&' : '') + 'p=' + index,
            function (data) {
                list = list.concat($.map(data.match(/rids\[\]\ value\=[0-9]+/g), function (s) {
                    return parseInt(s.match(/[0-9]+/));
                }));

                if (data.search('Next &#187;') !== -1) {
                    readFFnetList(type, callback, index + 1, list);
                } else {
                    if (type === 'alert') {
                        followingList = list;
                        followingAccessTime = Date.now();
                        if (callback !== undefined) {
                            callback(followingList);
                        }
                    } else {
                        favoritedList = list;
                        favoritedAccessTime = Date.now();
                        if (callback !== undefined) {
                            callback(favoritedList);
                        }
                    }
                }
            },
            'html').error(function () {
            $.toast('We are unable to process your request due to an network error. Please try again later.');
        });
    }

    //type = 'follow' || 'fav'
    function favOrFollow(type, id, callback) {
        if (!loggedIn) {
            $.toast('Please login or signup to access this feature.');
            return;
        } else {
            $.post('/api/ajax_subs.php', {
                storyid: id,
                userid: userid,

                authoralert: 0,
                storyalert: type === 'follow' ? 1 : 0,
                favstory: type === 'fav' ? 1 : 0,
                favauthor: 0
            },
            function (data) {
                if (data.error) {
                    $.toast('We are unable to process your request due to an network error. Please try again later.');
                } else {
                    if (type === 'follow') {
                        chrome.storage.local.set({'AlertsLastModified': Date.now()});
                        chrome.runtime.sendMessage({updated: 'Alerts', id, add: true});
                    } else {
                        chrome.storage.local.set({'FavoritesLastModified': Date.now()});
                        chrome.runtime.sendMessage({updated: 'Favorites', id, add: true});
                    }
                    $.toast('We have successfully processed the following:' + data.payload_data, 3000);
                    if (callback !== undefined) {
                        callback();
                    }
                }
            },
            'json'
            ).error(function () {
                $.toast('We are unable to process your request due to an network error. Please try again later.');
            });
        }
    }

    function getReviewers(storyid, callback, index, list) {
        list = typeof list !== 'undefined' ? list : [];
        index = typeof index === 'number' ? index : 1;

        $.get('https://www.fanfiction.net/r/' + storyid + '/0/' + index,
            function (data) {
                var tmp = data.match(/\/u\/\d+\//g);
                if (tmp) {
                    list = list.concat(tmp);
                }

                if (data.search('Next &#187;') !== -1) {
                    getReviewers(storyid, callback, index + 1, list);
                } else {
                    list = list.sort().filter(function (item, pos, ary) {
                        return !pos || item !== ary[pos - 1];
                    });
                    progressBar = progressDialog({tasks: list.length, parent: $('#alsoliked_tab')});
                    progressBar.message('Fetching the favorites of ' + list.length + ' users.');
                    getUserFavs(list, callback);
                    $('#alsoliked_tab > img').remove();
                }
            },
        'html').fail(function () {
            alert('getReviewers terminated early, on page ' + index);
            console.log('getReviewers terminated early, on page ' + index);
            list = list.sort().filter(function (item, pos, ary) {
                return !pos || item !== ary[pos - 1];
            });
            progressBar = progressDialog({tasks: list.length, parent: $('#alsoliked_tab')});
            progressBar.message('Fetching the favorites of ' + list.length + ' users.');
            getUserFavs(list, callback);
            $('#alsoliked_tab > img').remove();
        });
    }

    function getReviewersByChapter(storyid, chapters, callback, index, list) {
        list = typeof list !== 'undefined' ? list : [];
        index = typeof index !== 'undefined' ? index : 1;

        $.get('https://www.fanfiction.net/r/' + storyid + '/' + index,
            function (data) {
                var tmp = data.match(/\/u\/\d+\//g);
                if (tmp) {
                    list = list.concat(tmp);
                }

                if (index < chapters) {
                    getReviewersByChapter(storyid, chapters, callback, index + 1, list);
                } else {
                    list = list.sort().filter(function (item, pos, ary) {
                        return !pos || item !== ary[pos - 1];
                    });
                    progressBar = progressDialog({tasks: list.length, parent: $('#alsoliked_tab')});
                    progressBar.message('Fetching the favorites of ' + list.length + ' users.');
                    getUserFavs(list, callback);
                    $('#alsoliked_tab > img').remove();
                }
            },
        'html').fail(function () {
            alert('getReviewersByChapter terminated early, on page ' + index + ' of ' + chapters);
            console.log('getReviewersByChapter terminated early, on page ' + index + ' of ' + chapters);
            list = list.sort().filter(function (item, pos, ary) {
                return !pos || item !== ary[pos - 1];
            });
            progressBar = progressDialog({tasks: list.length, parent: $('#alsoliked_tab')});
            progressBar.message('Fetching the favorites of ' + list.length + ' users.');
            getUserFavs(list, callback);
            $('#alsoliked_tab > img').remove();
        });
    }

    function getUserFavs(users, callback, index, list) {
        list = typeof list !== 'undefined' ? list : [];
        index = typeof index !== 'undefined' ? index : 0;

        $.get('https://www.fanfiction.net' + users[index],
            function (data) {
                progressBar.advance();
                $('.favstories', data).each(function () {
                    list.push(parseInt(this.dataset.storyid));
                });
                if (index + 1 < users.length) {
                    getUserFavs(users, callback, index + 1, list);
                } else {
                    progressBar.close();
                    let also = {};
                    list.forEach(function (item) {
                        if (!also[item]) {
                            also[item] = 1;
                        } else {
                            also[item] += 1;
                        }

                    });
                    list = [];
                    for (let prop in also) {
                        if (also.hasOwnProperty(prop)) {
                            list.push({
                                'k': prop,
                                'v': also[prop]
                            });
                        }
                    }
                    console.log('Found ' + list.length + ' favorited stories.');
                    list = list.filter(item => item.v > 1).sort((a, b) => b.v - a.v);
                    console.log(list.length + ' of which were faved by more than one person.');
                    if (list.length > 50) {
                        list = list.filter((item, pos) => pos < 49 && item.v > 2);
                    }
                    if (list.length === 0) {
                        list.push({k: storyid + '', v: 1});
                    }else if (list[0].k === storyid + '') {
                        list.shift();
                    }
                    let alsoLikedCache = {created: Date.now(), chapters: $('.info-list-chapters > b').html(), stories: list};
                    chrome.storage.local.set({['AlsoLiked:' + storyid]: alsoLikedCache});
                    callback(alsoLikedCache);
                }
            },
        'html').fail(function () {
            var also = {};
            alert('getUserFavs terminated early, on user ' + index + ' of ' + users.length);
            console.log('getUserFavs terminated early, on user ' + index + ' of ' + users.length);
            progressBar.close();
            list.forEach(function (item) {
                if (!also[item]) {
                    also[item] = 1;
                } else {
                    also[item] += 1;
                }

            });
            list = [];
            for (let prop in also) {
                if (also.hasOwnProperty(prop)) {
                    list.push({
                        'k': prop,
                        'v': also[prop]
                    });
                }
            }
            console.log('Found ' + list.length + ' favorited stories.');
            list = list.filter(item => item.v > 1).sort((a, b) => b.v - a.v);
            console.log(list.length + ' of which were faved by more than one person.');
            if (list.length > 50) {
                list = list.filter((item, pos) => pos < 49 && item.v > 2);
            }
            if (list.length === 0) {
                list.push({k: storyid + '', v: 1});
            }else if (list.length > 1 && list[0].k === storyid + '') {
                list.shift();
            }
            callback({created: Date.now(), chapters: $('.info-list-chapters > b').html(), stories: list});
        });
    }

    //public
    that.getBookshelves = function (callback) {
        chrome.storage.local.get('Bookshelves', function (items) {
            if (items.Bookshelves) {
                callback(items.Bookshelves);
            } else {
                callback([]);
            }
        });
    };

    that.getReadLater = function (callback) {
        chrome.storage.local.get('ReadLater', function (items) {
            if (items.ReadLater) {
                callback(items.ReadLater);
            } else {
                callback([]);
            }
        });
    };

    that.getFollowingList = function (callback) {
        chrome.storage.local.get('AlertsLastModified', function (items) {
            if (followingList === undefined || followingAccessTime < items.AlertsLastModified) {
                readFFnetList('alert', callback);
            } else {
                callback(followingList);
            }
        });
    };

    that.getFavoritedList = function (callback) {
        chrome.storage.local.get('FavoritesLastModified', function (items) {
            if (favoritedList === undefined || favoritedAccessTime < items.FavoritesLastModified) {
                readFFnetList('favorites', callback);
            } else {
                callback(favoritedList);
            }
        });
    };

    that.getLiked = function (callback) {
        chrome.storage.local.get('Liked', function (items) {
            if (items.Liked) {
                callback(items.Liked);
            } else {
                callback([]);
            }
        });
    };

    that.getAlsoLiked = function (callback) {
        var chapters,
            id = 'AlsoLiked:' + storyid;

        if (!loggedIn) {
            $.toast('Please login or signup to access this feature.');
            return;
        }

        chrome.storage.local.get(id, function (items) {
            if (items[id]) {
                callback(items[id]);
                return;
            }
            chapters = parseInt($('.info-list-chapters > b').html(), 10);
            if (chapters < parseInt($('.info-list-reviews > a').html().replace(',', ''), 10) / 15) {
                getReviewersByChapter(storyid, chapters, callback);
            } else {
                getReviewers(storyid, callback);
            }
        });
    };

    that.getRead = function (callback) {
        var readStories = [];
        chrome.storage.local.get(null, function (items) {
            for (let prop in items) {
                if (prop.startsWith('Read:')) {
                    readStories.push({k: parseInt(prop.substr(5), 10), v: items[prop].lastRead});
                }
            }
            readStories.sort(function (a, b) {
                return b.v - a.v;
            });
            callback(readStories);
        });
    };

    that.getGroupStories = function (pathMatch, callback, index, list) {
        list = typeof list !== 'undefined' ? list : [];
        index = typeof index !== 'undefined' ? index : 1;

        $.get('https://www.fanfiction.net' + pathMatch[1] + index + pathMatch[2],
            function (data) {
                list = list.concat($('.z-list', data).toArray());

                if (data.search('Next &#187;') !== -1) {
                    that.getGroupStories(pathMatch, callback, index + 1, list);
                } else {
                    callback(list);
                }
            },
            'html').error(function () {
            $.toast('We are unable to process your request due to an network error. Please try again later.');
        });
    };

    that.removeFromRil = function (id, callback) {
        chrome.storage.local.get('ReadLater', function (items) {
            var index,
                list;
            if (items.ReadLater) {
                list = items.ReadLater;
            } else {
                list = [];
            }
            index = items.ReadLater.indexOf(id);
            if (index !== -1) {
                list.splice(index, 1);
                chrome.storage.local.set({'ReadLater': list});
                chrome.runtime.sendMessage({updated: 'ReadLater', id, add: false});
            }
            if (callback !== undefined) {
                callback();
            }
        });
    };

    that.unfollow = function (id, callback) {
        if (!loggedIn) {
            $.toast('Please login or signup to access this feature.');
            return;
        }

        $.post('https://www.fanfiction.net/alert/story.php?', {
            action: 'remove-multi',
            'rids[]': id
        },
        function (data) {
            chrome.storage.local.set({'AlertsLastModified': Date.now()});
            chrome.runtime.sendMessage({updated: 'Alerts', id, add: false});
            //$.toast('You have succesfully unfollowed: ' + title.replace(/\+/g, ' '));
            if (callback !== undefined) {
                callback();
            }
        },
        'html'
        ).error(function () {
            $.toast('We are unable to process your request due to an network error. Please try again later.');
        });
    };

    that.unfav = function (id, callback) {
        if (!loggedIn) {
            $.toast('Please login or signup to access this feature.');
            return;
        }

        $.post('https://www.fanfiction.net/favorites/story.php?', {
            action: 'remove-multi',
            'rids[]': id
        },
        function (data) {
            chrome.storage.local.set({'FavoritesLastModified': Date.now()});
            chrome.runtime.sendMessage({updated: 'Favorites', id, add: false});
            //$.toast('You have succesfully unfaved: ' + title.replace(/\+/g, ' '));
            if (callback !== undefined) {
                callback();
            }
        },
        'html'
        ).error(function () {
            $.toast('We are unable to process your request due to an network error. Please try again later.');
        });
    };

    that.unlike = function (id, callback) {
        chrome.storage.local.get('Liked', function (items) {
            var index,
                list;
            if (items.Liked) {
                list = items.Liked;
            } else {
                list = [];
            }
            index = items.Liked.indexOf(id);
            if (index !== -1) {
                list.splice(index, 1);
                chrome.storage.local.set({'Liked': list});
                chrome.runtime.sendMessage({updated: 'Liked', id, add: false});
            }
            if (callback !== undefined) {
                callback();
            }
        });
    };

    that.removeBookshelf = function (id, callback) {
        chrome.storage.local.get('Bookshelves', function (items) {
            var index,
                list;
            if (items.Bookshelves) {
                list = items.Bookshelves;
            } else {
                list = [];
            }
            index = items.Bookshelves.findIndex(el => el.id === id);
            if (index !== -1) {
                list.splice(index, 1);
                chrome.storage.local.set({'Bookshelves': list});
                chrome.storage.local.remove('shelf:' + id);
                chrome.runtime.sendMessage({updated: 'Bookshelves'});
            }
            if (callback !== undefined) {
                callback();
            }
        });
    };

    that.addToRil = function (id, callback) {
        chrome.storage.local.get('ReadLater', function (items) {
            var list;
            if (items.ReadLater) {
                list = items.ReadLater;
            } else {
                list = [];
            }
            if (list.indexOf(id) === -1) {
                list.push(id);
                chrome.storage.local.set({'ReadLater': list});
                chrome.runtime.sendMessage({updated: 'ReadLater', id, add: true});
            }
            if (callback !== undefined) {
                callback();
            }
        });
    };

    that.fav = function (id, callback) {
        favOrFollow('fav', id, callback);
    };

    that.follow = function (id, callback) {
        favOrFollow('follow', id, callback);
    };

    that.like = function (id, callback) {
        chrome.storage.local.get('Liked', function (items) {
            var list;
            if (items.Liked) {
                list = items.Liked;
            } else {
                list = [];
            }
            if (list.indexOf(id) === -1) {
                list.push(id);
                chrome.storage.local.set({'Liked': list});
                chrome.runtime.sendMessage({updated: 'Liked', id, add: true});
            }
            if (callback !== undefined) {
                callback();
            }
        });
    };

    that.addBookshelf = function (shelfName, fandom, callback) {
        chrome.storage.local.get('Bookshelves', function (items) {
            var list,
                nextId;
            if (items.Bookshelves) {
                list = items.Bookshelves;
                nextId = list[list.length - 1].id + 1;
            } else {
                list = [];
                nextId = 0;
            }

            list.push({id: nextId, name: shelfName, fandom: fandom});
            chrome.storage.local.set({'Bookshelves': list});
            chrome.runtime.sendMessage({updated: 'Bookshelves'});
            if (callback !== undefined) {
                callback(nextId);
            }
        });
    };

    that.bookshelf = {
        add : function (shelfId, storyId, callback) {
            var shelfName = 'shelf:' + shelfId;
            chrome.storage.local.get(shelfName, function (items) {
                var list;
                if (items[shelfName]) {
                    list = items[shelfName];
                } else {
                    list = [];
                }
                if (list.indexOf(storyId) === -1) {
                    list.push(storyId);
                    chrome.storage.local.set({[shelfName]: list});
                    chrome.runtime.sendMessage({updated: shelfName, id: storyId, add: true});
                }
                if (callback !== undefined) {
                    callback();
                }
            });
        },

        remove : function (shelfId, storyId, callback) {
            var shelfName = 'shelf:' + shelfId;
            chrome.storage.local.get(shelfName, function (items) {
                var index,
                    list;
                if (items[shelfName]) {
                    list = items[shelfName];
                    index = items[shelfName].indexOf(storyId);
                    if (index !== -1) {
                        list.splice(index, 1);
                        chrome.storage.local.set({[shelfName]: list});
                        chrome.runtime.sendMessage({updated: shelfName, id: storyId, add: false});
                    }
                }
                if (callback !== undefined) {
                    callback();
                }
            });
        },

        get : function (shelfId, callback) {
            var shelfName = 'shelf:' + shelfId;
            chrome.storage.local.get(shelfName, function (items) {
                if (items[shelfName]) {
                    callback(items[shelfName]);
                } else {
                    callback([]);
                }
            });
        }
    };
    return that;
}

/*
====================
progressDialog
    creates a dialog which displays the progress of a task
    that = {
        tasks: 3,                   //number of things that need doing
        parent: $('')               //jquery element to append to
        finish: function () {}        //a function to run after the dialog closes
    }
====================
*/
function progressDialog(that) {
    var tasks,
        dialog,
        progressBar,
        val = 0;

    that = that || {};
    tasks = that.tasks || 0;
    dialog = $('<div>', {
        class: 'progress-dialog',
        html: '<span id="progressMsg"></span><progress value="0" max="' + tasks + '"></progress>'
    });

    that.parent.append(dialog);
    progressBar = dialog.find('progress');

    that.close = function () {
        dialog.remove();
        if ('finish' in that) {
            that.finish();
        }
    };

    that.progressSet = function (progress) {
        $({value: val}).animate({value: progress}, {
            duration: 500,
            step: function () {
                progressBar.attr('value', this.value);
            }
        });
        val = progress;
        if (val >= tasks) {
            setTimeout(that.close, 700);
        }
    };

    that.advance = function (num) {
        num = num || 1;
        $({value: val}).animate({value: (val + num)}, {
            duration: 500,
            step: function () {
                progressBar.attr('value', this.value);
            }
        });
        val = val + num;
        if (val >= tasks) {
            setTimeout(that.close, 700);
        }
    };

    that.message = function (newmsg) {
        dialog.find('#progressMsg').html(newmsg);
    };

    return that;
}

//modified from Fanfiction.net source
function easydate(unix) {
    var unixDiff = Math.round(Date.now() / 1000) - unix,
        date = new Date(unix * 1000),
        year = date.getFullYear(),
        month_short = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][date.getMonth()],
        day = date.getDate();
    if (unixDiff < 60) {
        return 'secs ago';
    } else if (unixDiff <= 3600) {
        return Math.floor(unixDiff / 60) + 'm ago';
    } else if (unixDiff < 3600 * 24) {
        return Math.floor(unixDiff / 3600) + 'h ago';
    } else if ((new Date()).getFullYear() === year) {
        return month_short + ' ' + day;
    } else {
        return month_short + ' ' + day + ', ' + year;
    }
}

})();
