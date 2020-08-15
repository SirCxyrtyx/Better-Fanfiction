// jshint jquery: true, undef: true,curly: true, bitwise: true, eqeqeq: true, immed: true, strict: false, unused: vars, devel: true, browser: true, newcap: false, multistr: true
/* global chrome */

'use strict';
const ffAPI = new FanFictionAPI(),
    ao3API = new ArchiveOfOurOwnAPI(),
    transitions = ['story-story'],//, 'story-user', 'user-user'],//, 'user-story'],
    reviewControls = '<div class="review_controls"><ul class="review_page_list"></ul><ul class="review_page_info"><li><span></span></li><li><button class="btn">Newest First</button></li></ul></div>',
    bookshelfBar = '<ul class="bookshelves dropdown">' +
        '<li title="Favorites" class="bookshelf unselected" data-added="0" style="background:#ffb400"><span>Fav</span></li>' +
        '<li title="Read It Later" class="bookshelf unselected" data-added="0" style="background:#318ccb"><span>RiL</span></li>' +
        '<li title="Following" class="bookshelf unselected" data-added="0" style="background:#60cf23"><span>Track</span></li>' +
        '<li title="Liked" class="bookshelf unselected" data-added="0" style="background:#FABA61"><span>Like</span></li>' +
        '<li title="More" class="bookshelf dropdown-toggle unselected" data-added="0" data-toggle="dropdown"><span>...</span></li>' +
        '<ul class="dropdown-menu"></ul>' +
        '</ul>';
let path = document.location.pathname,
    pageType = findPageType(path),
    storyid,
    chapter,
    storytextid;

//for storypage-specific css
if (pageType === 'story') {
    $('html').addClass('story-page');
}

//Fanfiction.net sign-in check
if (document.cookie.search('funn=') === -1 && path !== '/login.php' && !isAo3Page()) {
    document.addEventListener('DOMContentLoaded', function () {
        $.toast('You\'re not logged in.', 2500);
    });
} else {
    ffAPI.userid = -1;
    //Firebase Auth check
    chrome.runtime.sendMessage({authCheck : true}, response => {
        if(response.authStatus){
            document.addEventListener('DOMContentLoaded', run);
        } else {
            $.toast('Firebase status: Signed Out');
        }
    });
}

function run() {
    if (pageType === 'story') {
        storyPage();
    } else if (isAo3Page()) {
        if($('#greeting .icon a').length){
            ao3API.userName = $('#greeting .icon a')[0].href.slice(34);
        }
    } else {
        convertStoryLinks();
        //$('body > div.zmenu').affix({offset: {top: 30}});
    }

    //remove ad bar.
    $('.zmenu').has('ins').remove();

    $(window).on('popstate', function (e) {
        let state = e.originalEvent.state;
        if (state !== null) {
            route(state.url, true);
        }
    });

    $('body').click(e => {
        if (e.target.nodeName === 'A' && !e.ctrlKey && !e.metaKey && !e.target.hash) {
            let url = e.target.href;
            const urlType = findPageType(url);
            let transition = pageType + '-' + urlType;
            //seemingly redundant check is neccesary because passing control to route()
            //causes link to be followed before it returns (no idea why)
            if (transitions.includes(transition)) {
                e.preventDefault();
                route(url);
            }
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
    
    if (pageType === 'Ao3story') {
        $('#main .landmark.heading+div.wrapper').append(bookshelfBar)
        storyid = 'a' + path.match(/\d+/)[0];
        chapter = ($('#chapter_index select').length && $('#chapter_index select').get(0).selectedIndex) + 1;
        setVisited(true);
        let storyData = parseAo3StoryData($('html'), storyid)
        setUpBookshelfBar('#main .landmark.heading+div.wrapper', storyData);
        $('.title.heading').attr('data-original', storyid).click(openStoryLanding)
    }
}

function createStoryHeader(d) {
    var hasImage = !!d.storyImageLink,
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
                 '<h1 id="author-title"><b>' + d.title + '</b><span class="author">- ' + (d.authorElement || 'Anonymous') + '</span></h1>' +
                 '<div>' +
                    '<hr>' +
                    '<p class="summary">' + d.description + '</p>' +
                    '<ul class="tags"></ul>' +
                 '</div>' +
              '</div>' + bookshelfBar +
           '</div></div>');

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
        wordsEl.before('<li class="info-list-reviews">Reviews <a href="/r/' + d.storyid + '/' + d.currentChapter + '">' + d.reviews + '</a></li>');
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
    if (!d.updated) {
        el.find('.info-list-updated').remove();
    }

    el.find('#author-title > b').attr('data-original', d.storyid).click(openStoryLanding);

    return el;
}

function storyPage() {
    storyid = parseInt(path.match(/\d+/), 10);
    chapter = ($('select').length && $('select').get(0).selectedIndex) + 1;
    let storyData = parseFFnStoryData('html', storyid);
    let storyHeader = createStoryHeader(storyData);

    //remove custom fonts and sizing from story text
    $('#storytext p').css('font-family', '').css('font-size', '');

    $('#profile_top').remove();
    $('#content_parent').prepend(storyHeader);
    setUpBookshelfBar('#profile_top', storyData);
    //bring a small degree of sanity to review box structure
    $('#review > table').replaceWith($('#review > table > tbody > tr > td > div'));
    //remove strange new style element that's overriding my styles
    $('#storytextp').prev().remove();
    setVisited(true);
    setUpStoryNav();
    if (document.cookie.search('funn=') !== -1) {
        ffAPI.userid = parseInt($('form[name="myselect"] script').html().match(/userid = (\d+)/)[1], 10);
    }
    storytextid = parseInt($('form[name="myselect"] script').html().match(/storytextid=(\d+)/)[1], 10);

    //add review-loading button
    const reviewsPerPage = 50;
    $('<button id="show_reviews" class="btn">Reviews</button>').appendTo('#content_wrapper_inner').click(function () {
        if ($('#reviews').length === 0) {
            $.get('https://www.fanfiction.net/r/' + storyid + '/' + chapter, (d) => {
                d = $(d);
                d.find('thead').remove();
                let reviews = d.find('#content_wrapper tr').remove(),
                    page = 1;
                d.find('#content_wrapper').attr({id: 'reviews', style: ''}).prepend(reviewControls).append(reviewControls)
                    .insertAfter('#content_parent');
                //to force the FFnet native script to resize the reviews to fit the page
                $(window).trigger('resize');

                //set up navigation
                for (let i = Math.ceil(reviews.length / reviewsPerPage); i > 0; i--) {
                    $('<li><button class="btn" data-page =' + i + '>' + i + '</button></li>').prependTo('.review_page_list');
                }
                $('.review_page_list button[data-page="1"]').addClass('selected');
                if (reviews.length < reviewsPerPage) {
                    $('.review_page_list').hide();
                }

                $('.review_page_list').click(function (e) {
                    page = parseInt(e.target.dataset.page, 10);
                    let startIndex = (page - 1) * reviewsPerPage,
                        endIndex = reviews.length < (startIndex + reviewsPerPage) ? reviews.length : startIndex + reviewsPerPage;
                    $('html, body').animate({
                        scrollTop: $('.review_controls:first-child').offset().top,
                    });
                    $('<tbody>').append(reviews.slice(startIndex, endIndex)).replaceAll('#reviews tbody');
                    $('.review_page_info span').html(`Viewing ${startIndex + 1} - ${endIndex} of ${reviews.length}`);
                    $('img.lazy').lazyload();
                    $('span[data-xutime]').each(function (index, el) {
                        $(this).html(easydate(this.dataset.xutime));
                    });
                    $('.review_page_list .selected').removeClass('selected');
                    $('.review_page_list button[data-page="' + page + '"]').addClass('selected');
                    $(e.target).blur();
                });

                $('.review_page_info button').click(function(e) {
                    let el = $(e.target),
                        order;
                    [].reverse.apply(reviews);
                    $('.review_page_list button[data-page="' + page + '"]').first().trigger('click');
                    if (el.data('order') === 'Oldest') {
                        order = 'Newest';
                    } else {
                        order = 'Oldest';
                    }
                    $('.review_page_info button').data('order', order);
                    $('.review_page_info button').html(order + ' First');
                    chrome.storage.local.get('Settings', function (items) {
                        var settings;
                        if (items.Settings) {
                            settings = items.Settings;
                        } else {
                            settings = {};
                        }
                        settings.reviewOrder = order;
                        chrome.runtime.sendMessage({updated: 'Settings', val: settings});
                    });
                    el.blur();
                });

                chrome.storage.local.get('Settings', function (items) {
                    var order;
                    if (items.Settings && items.Settings.reviewOrder) {
                        order = items.Settings.reviewOrder;
                    } else {
                        order = 'Newest';
                    }
                    if (order === 'Oldest') {
                        [].reverse.apply(reviews);
                    }
                    $('.review_page_info button').data('order', order);
                    $('.review_page_info button').html(order + ' First');
                    $('.review_page_list button[data-page="1"]').first().trigger('click');
                });

                $(this).show();
                $('.loading-reviews').hide();
            });
            $(this).hide();
            $('.loading-reviews').show();
        } else {
            $('#reviews').remove();
        }
        $(this).blur();
    }).after(`<img class="loading-reviews" style="display: none;" width="30" height="30" title="" src="${chrome.extension.getURL('spinner.gif')}" />`);
}

function groupPage() {
    $('<button class="btn">Load All</button>').insertAfter('form[name="myform"]').click(function (event) {
        var pathParts = [],
            form = $('form[name="myform"]')[0];

        pathParts[0] = path.match(/\/community\/.+?\/\d+/) + '/' + form.censorid.value + '/' + form.s.value + '/';
        pathParts[1] = '/' + form.genreid.value + '/' + form.len.value + '/' + form.statusid.value + '/' + form.timeid.value + '/';

        $('.z-list').remove();
        $('center').remove();
        $('hr + script').after(`<img width="64" height="64" class="spinner" src="${chrome.extension.getURL('spinner.gif')}" />`);

        ffAPI.getGroupStories(pathParts, function (list) {
            //inserts stories and removes spinner
            $('img.spinner').after(list)
                            .remove();
            $('img.lazy').lazyload();
            convertStoryLinks();
            $('span[data-xutime]').each(function (index, el) {
                $(this).html(easydate(this.dataset.xutime));
            });
            //set up hover effect on story images
            $('.z-list img').hover(
                function(){
                    $(this).parent().parent().addClass('z-list_hover');
                    $(this).addClass('cimage_hover');
                },
                function() {
                    $(this).removeClass('cimage_hover');
                    $(this).parent().parent().removeClass('z-list_hover');
                }
            );
            history.pushState({pathParts}, '', 'https://www.fanfiction.net' + pathParts[0] + '1' + pathParts[1]);
            $('.badge').html($('.z-list:visible').length);
            $('.z-list').each((i,el) => {
                el.dataset.complete = /Complete/.test($(el).find('.xgray').text());
            });

            $('select[name="statusid"]').change(function(e) {
                if (e.target.selectedIndex === 1) {
                    $('.z-list').removeClass('zhide').filter(function(i, el) {
                        return $(el).data('complete');
                    }).addClass('zhide');
                } else if (e.target.selectedIndex === 2) {
                    $('.z-list').removeClass('zhide').filter(function(i, el) {
                        return !$(el).data('complete');
                    }).addClass('zhide');
                } else {
                    $('.z-list').removeClass('.zhide');
                }
                $('.badge').html($('.z-list:visible').length);
            });
        });
    });

    $('div + hr').before('Include: <input type="text" class="story-filter"> Exclude: <input type="text" class="story-filter"><span class="badge">0</span>');
    $('.story-filter').on('input', function () {
        $('.z-list').addClass('hide').filter(function () {
            var exclude;
            if ($(this).find('.xgray').html().search($('.story-filter').eq(0).val()) === -1) {
                return true;
            }
            exclude = $('.story-filter').eq(1).val();
            if (exclude) {
                return $(this).find('.xgray').html().search(exclude) !== -1;
            }
            return false;
        }).removeClass('hide');
        $('.badge').html($('.z-list:visible').length);
    });
}

function userPage() {
    //triggers image loading on tab switch
    //needs to be attribute handler to execute in the same context as the lazy loading was registered
    $('#mytab a').attr('onclick', '$(window).trigger("resize")');

    [{id:'st', class: '.mystories'}, {id:'fs', class: '.favstories'}].forEach(function (val, i) {
        $('#' + val.id + ' > div').eq(0).after('Include: <input type="text" class="' + val.id + '-filter"> Exclude: <input type="text" class="' + val.id + '-filter">');
        $('.' + val.id + '-filter').on('input', function () {
            $(val.class).removeClass('hide').filter(function () {
                var exclude;
                if ($(this).find('.xgray').html().search($('.' + val.id + '-filter').eq(0).val()) === -1) {
                    return true;
                }
                exclude = $('.' + val.id + '-filter').eq(1).val();
                if (exclude) {
                    return $(this).find('.xgray').html().search(exclude) !== -1;
                }
                return false;
            }).addClass('hide');
            $('#l_' + val.id + ' .badge').html($(val.class + ':visible').length);
        });
        $('#' + val.id + '_inside').addClass('stories-main').before('<div class="stories-side" ><div><div class="panel">' +
                                                                        '<div class="panel fandoms-list">' +
                                                                            '<div class="panel-heading">Fandoms</div>' +
                                                                            '<div class="panel-body"></div>' +
                                                                        '</div>' +
                                                                   '</div></div></div>');
        $('<button class="fandom-toggle" data-toggle="hide">Hide All</button>')
        .appendTo(`#${val.id} .panel.fandoms-list .panel-heading`)
        .click(function (event) {
            let text, checked;
            if(this.dataset.toggle === 'hide') {
                $(val.class).addClass('zhide');
                text = 'Show All';
                checked = false;
                this.dataset.toggle = 'show';
            }
            else {
                $(val.class).removeClass('zhide');
                text = 'Hide All';
                checked = true;
                this.dataset.toggle = 'hide';
            }
            $(`#${val.id} .fandom-toggle`)[0].innerText = text;
            $(`#${val.id} .fandoms-list label input`).each((i,el) => {
                el.checked = checked;
            });
            $('#l_' + val.id + ' .badge').html($(val.class + ':visible').length);
        });

        fandomsInList('#' + val.id).forEach(function (v, i) {
            $('<label class="control" data-fandom="' + v.k + '">' +
                '<input type="checkbox" checked>' +
                '<span class="control-indicator"></span>' +
                '<span class="control-label">' + v.k + ' (' + v.v + ')</span>' +
            '</label>').appendTo('#' + val.id + ' .fandoms-list .panel-body').click(function (event) {

                var s = $(val.class).filter((i,el) => JSON.parse(el.dataset.category).includes(htmlEntities(this.dataset.fandom)));
                if ($('input', this)[0].checked) {
                    s.removeClass('zhide');
                } else {
                    s.addClass('zhide');
                }
                $('#l_' + val.id + ' .badge').html($(val.class + ':visible').length);
            });
        });
    });
}

function setUpStoryNav() {
    setUpChapSelect();

    //remove original event-bindings
    $('.chap_select ~ button').addClass('nav-next').removeAttr('onclick');
    $('button[onclick^="self"]:not(.nav-next)').addClass('nav-prev').removeAttr('onclick');
    $('#content_wrapper_inner > span').replaceWith($('#content_wrapper_inner > span').clone(false));
    $('div > .chap_select').parent().replaceWith($('div > .chap_select').parent().clone(false));

    //add buttons if they aren't there
    if ($('.nav-next').length === 0) {
        $('.chap_select').after('<button class="btn nav-next" type="BUTTON" style="display:none;margin-left:5px;">Next &gt;</button>');
    }
    if ($('.nav-prev').length === 0) {
        $('.chap_select').before('<button class="btn nav-prev" type="BUTTON" style="display:none;margin-right:5px;">&lt; Prev</button>');
    }

    //add loading spinners
    $('.chap_select').after(`<img class="loading-next" style="display: none;" width="30" height="30" title="" src="${chrome.extension.getURL('spinner.gif')}" />`);
    $('.chap_select').before(`<img class="loading-prev" style="display: none;" width="30" height="30" title="" src="${chrome.extension.getURL('spinner.gif')}" />`);
    let selectWidth = $('.chap_select').outerWidth();
    $(`<img class="loading-select" style="display: none;" width="30" height="30" title="" src="${chrome.extension.getURL('spinner.gif')}" />`)
        .css('padding', '0px ' + (selectWidth - 30) / 2 + 'px').insertAfter('.chap_select');

    $('.nav-next').eq(0).click(function (e) {
        e.preventDefault();
        $(this).hide();
        $('.loading-next').eq(0).show();
        $.get('https://www.fanfiction.net/s/' + storyid + '/' + (chapter + 1), function (data) {
            loadChapterInPlace(parseFFnStoryData(data, storyid));
        });
        $(this).blur();
    });

    $('.nav-next').eq(1).click(function () {
        $(this).hide();
        $('.loading-next').eq(1).show();
        $.get('https://www.fanfiction.net/s/' + storyid + '/' + (chapter + 1), function (data) {
            loadChapterInPlace(parseFFnStoryData(data, storyid), true);
        });
        $(this).blur();
    });

    $('.nav-prev').eq(0).click(function () {
        $(this).hide();
        $('.loading-prev').eq(0).show();
        $.get('https://www.fanfiction.net/s/' + storyid + '/' + (chapter - 1), function (data) {
            loadChapterInPlace(parseFFnStoryData(data, storyid));
        });
        $(this).blur();
    });

    $('.nav-prev').eq(1).click(function () {
        $(this).hide();
        $('.loading-prev').eq(1).show();
        $.get('https://www.fanfiction.net/s/' + storyid + '/' + (chapter - 1), function (data) {
            loadChapterInPlace(parseFFnStoryData(data, storyid), true);
        });
        $(this).blur();
    });
}

function setUpChapSelect(){
    $('select[name="chapter"]').addClass('chap_select').removeAttr('onchange');

    $('.chap_select').eq(0).change(function (e) {
        var target = e.target;
        $(this).hide();
        $('.loading-select').eq(0).show();
        $.get('https://www.fanfiction.net/s/' + storyid + '/' + (target.selectedIndex + 1), function (data) {
            loadChapterInPlace(parseFFnStoryData(data, storyid));
        });
        $(this).blur();
    });

    $('.chap_select').eq(1).change(function (e) {
        var target = e.target;
        $(this).hide();
        $('.loading-select').eq(1).show();
        $.get('https://www.fanfiction.net/s/' + storyid + '/' + (target.selectedIndex + 1), function (data) {
            loadChapterInPlace(parseFFnStoryData(data, storyid), true);
        });
        $(this).blur();
    });
}

function loadChapterInPlace(d, scrollToTop = false, popState = false) {
    var chapterTitle;

    if (!popState) {
        history.replaceState({story: d.storyid, chapter: chapter, url: d.storyLink + '/' + chapter}, '', d.storyLink + '/' + chapter);
    }
    chapter = d.currentChapter;

    $('body > div[style^="position"]').remove();
    $('#storytext').replaceWith(d.data.find('#storytext'));
    
    //remove custom fonts and sizing from story text
    $('#storytext p').css('font-family', '').css('font-size', '');
    
    if (!popState) {
        history.pushState({story: d.storyid, chapter: chapter, url: d.storyLink + '/' + chapter}, '', d.storyLink + '/' + chapter);
    }

    if (scrollToTop) {
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

    if (d.chapters > $('.chap_select')[0].length) {
        $('.chap_select').replaceWith(d.data.find('select').eq(0));
        setUpChapSelect();
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
    $('.info-list-reviews a').html(d.reviews).attr('href', '/r/' + d.storyid + '/' + chapter);
    $('select').get(0).selectedIndex = chapter - 1;
    $('select').get(1).selectedIndex = chapter - 1;

    //to make reviews go to the right chapter and story
    storytextid = parseInt($('form[name="myselect"] script', d.data).html().match(/storytextid=(\d+)/)[1], 10);
    $('#review_review').attr('onclick', 'chapter=' + chapter + ',storytextid=' + storytextid + ',storyid=' + d.storyid);

    //to make abuse reports and community adds go to the right chapter and story
    $('#story_actions > div > button').attr('onclick', 'chapter=' + chapter + ',title="' + d.title.replace(/ /g, '+') + '",storyid=' + d.storyid);

    //to properly report pageviews to FF.net's stat-tracker
    $.get($('#storytextp', d.data).prev().html().match(/\/eye\/[^']+/)[0]);

    //reset review form in case a review has been left
    $('#review').show();
    $('#review_success').hide();
    $('#review_postbutton').html('Post Review as ' + document.cookie.match(/funn=([^;]+)/)[1]);
    $('#review_postbutton').prop('disabled', false);

    //clear loaded reviews
    $('#reviews').remove();

    //set the document title (tab name)
    if (d.chapters > 1) {
        chapterTitle = $('select')[0][chapter - 1].text.split(/\d+\. /)[1];
        chapterTitle = (/Chapter \d{1,2}/.test(chapterTitle) ? ' ' : (' Chapter ' + chapter + ': ')) + chapterTitle;
    } else {
        chapterTitle = '';
    }
    document.title = d.title + chapterTitle + ', a '  + $('#pre_story_links > .lc-left > a:last-child').html().toLowerCase() + ' fanfic | FanFiction';
}

function loadStoryInPlace(d, popState = false) {
    var chapterTitle,
        storyHeader = createStoryHeader(d);

    if (!popState) {
        history.replaceState({story: storyid, chapter: chapter, url: document.location.href}, '', document.location.href);
    }
    chapter = d.currentChapter;
    storyid = d.storyid;
    storytextid = parseInt($('form[name="myselect"] script', d.data).html().match(/storytextid=(\d+)/)[1], 10);

    $('body > div[style^="position"]').remove();
    $('#profile_top').replaceWith(storyHeader);
    //fandom
    $('#pre_story_links').replaceWith(d.data.find('#pre_story_links'));
    //chapter navigation
    $('#content_wrapper_inner > span').replaceWith(d.data.find('#content_wrapper_inner > span'));
    if ($('div > .chap_select').length) {
        $('div > .chap_select').parent().replaceWith(d.data.find('div > #chap_select').parent());
    } else {
        $('#storytextp').next().after(d.data.find('div > #chap_select').parent());
    }
    //chapter text
    $('#storytext').replaceWith(d.data.find('#storytext'));

    if (!popState) {
        history.pushState({story: d.storyid, chapter: chapter, url: d.storyLink + '/' + chapter}, '', d.storyLink + '/' + chapter);
    }

    setUpBookshelfBar('#profile_top', d);
    setVisited(true, chapter);
    setUpStoryNav();

    //reset alsoliked
    ffAPI.cancelOperation();
    $('#alsoliked_tab').removeClass('populated').removeClass('active');
    $('#alsoliked_tab > ul').empty();
    $('#bookshelf_tabs > li').has('a[href="#alsoliked_tab"]').removeClass('active');

    //to make reviews go to the right chapter and story
    $('#review_review').attr('onclick', 'chapter=' + chapter + ',storytextid=' + storytextid + ',storyid=' + d.storyid);

    //to make abuse reports and community adds go to the right chapter and story
    $('#story_actions > div > button').attr('onclick', 'chapter=' + chapter + ',title="' + d.title.replace(/ /g, '+') + '",storyid=' + d.storyid);

    //to properly report pageviews to FF.net's stat-tracker
    $.get($('#storytextp', d.data).prev().html().match(/\/eye\/[^']+/)[0]);

    //initialize review form
    $('#review_name').hide();
    $('#review_postbutton').html('Post Review as ' + document.cookie.match(/funn=([^;]+)/)[1]);
    $('.login_items').hide();
    $('#alert_subs').show();

    //reset review form in case a review has been left
    $('#review').show();
    $('#review_success').hide();
    $('#review_postbutton').prop('disabled', false);

    //clear loaded reviews
    $('#reviews').remove();

    //set the document title (tab name)
    if (d.chapters > 1) {
        chapterTitle = $('select')[0][chapter - 1].text.split(/\d+\. /)[1];
        chapterTitle = (/Chapter \d{1,2}/.test(chapterTitle) ? ' ' : (' Chapter ' + chapter + ': ')) + chapterTitle;
    } else {
        chapterTitle = '';
    }
    document.title = d.title + chapterTitle + ', a '  + $('#pre_story_links > .lc-left > a:last-child').html().toLowerCase() + ' fanfic | FanFiction';
}

function loadUserInPlace(data, url, popState = false) {
    data = $(data);
    $('#content_parent').replaceWith([].find.call(data, x => x.id === 'content_parent'));
    userPage();
    convertStoryLinks();
    $('[data-xutime]').each((i,el) => el.innerText = easydate($(el).data('xutime')));

    if (!popState) {
        history.pushState({url}, '', url);
    }
    $('img.lazy').lazyload();
    document.title = data.find('#content_wrapper_inner > span').html().trim() + '| FanFiction';
}

function loadStoryFromUser(data, url, popState = false) {
    data = $(data);
    $('html').addClass('story-page');
    $('#content_parent').replaceWith([].find.call($(data), x => x.id === 'content_parent'));
    if (!popState) {
        history.pushState({url}, '', url);
    }
    storyPage();
    if (!popState) {
        history.replaceState({story: storyid, chapter, url}, '', url);
    }
    //make reviews go to right chapter and story
    $('#review_review').attr('onclick', 'chapter=' + chapter + ',storytextid=' + storytextid + ',storyid=' + storyid);
    //to make abuse reports and community adds go to the right chapter and story
    $('#story_actions > div > button').attr('onclick', 'chapter=' + chapter + ',title="' + $('#profile_top > b').html().replace(/ /g, '+') + '",storyid=' + storyid);
    //to properly report pageviews to FF.net's stat-tracker
    $.get($('#storytextp', data).prev().html().match(/\/eye\/[^']+/)[0]);
    //initialize review form
    $('#review_name').hide();
    $('#review_postbutton').html('Post Review as ' + document.cookie.match(/funn=([^;]+)/)[1]);
    $('.login_items').hide();
    $('#alert_subs').show();
}

function setUpBookshelfBar(container, storyData) {
    var storyId = storyData.storyid,
        toggle = function () {
            $(this).toggleClass('selected');
            $(this).toggleClass('unselected');
        };

    if (storyData.Ao3) {
        $('li.bookshelf[title="Favorites"]', container).remove();
        ao3API.getSubscriptions(list => {
            list.forEach(v => {
                if (v === storyId) {
                    $(' li.bookshelf[title="Following"]', container).removeClass('unselected').addClass('selected');
                    return false;
                }
            });
        });
    } else {
        ffAPI.getFollowingList(function (list) {
            $.each(list, function (i,v) {
                if (v === storyId) {
                    $(' li.bookshelf[title="Following"]', container).removeClass('unselected').addClass('selected');
                    return false;
                }
            });
        });
    
        ffAPI.getFavoritedList(function (list) {
            $.each(list, function (i,v) {
                if (v === storyId) {
                    $('li.bookshelf[title="Favorites"]', container).removeClass('unselected').addClass('selected');
                    return false;
                }
            });
        });
    }

    ffAPI.getReadLater(function (list) {
        if (list.indexOf(storyId) !== -1) {
            $('li.bookshelf[title="Read It Later"]', container).removeClass('unselected').addClass('selected');
        }
    });

    ffAPI.getLiked(function (list) {
        if (list.indexOf(storyId) !== -1) {
            $('li.bookshelf[title="Liked"]', container).removeClass('unselected').addClass('selected');
        }
    });

    ffAPI.getBookshelves(instantiateDropdown);

    function instantiateDropdown(shelves) {
        $('<li title="Add" class="shelf"><input type="text" placeholder="Bookshelf Name"></input><button class="btn">Add</button></li>')
            .appendTo($('.bookshelves .dropdown-menu', container));
        shelves.forEach(function (val) {
            var shelfId = val.id;

            if (fandomsMatch(storyData.fandom, val.fandom)) {

                $('<li title="' + shelfId + '" class="shelf"><span>' + val.name + '</span><i class="icon-ok-circled"></i></li>')
                    .insertBefore($('.bookshelves .dropdown-menu li[title="Add"]', container))
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
        //Add Bookshelf Button
        $('.bookshelves .dropdown-menu button', container).click(function () {
            var shelfName = $(this).siblings('input').val();
            if (shelfName) {
                ffAPI.addBookshelf(shelfName, normalizeFandoms(storyData.fandom), function (shelfId) {
                    $('<li title="' + shelfId + '" class="shelf"><span>' + shelfName + '</span><i class="icon-ok-circled"></i></li>')
                        .insertBefore($('.bookshelves .dropdown-menu li[title="Add"]', container))
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

        //some sort of document-level click handler registered by Ao3's js causes the dropdown
        //to close if the click event is allowed to propagate
        if (storyData.Ao3) {
            $('.bookshelves .dropdown-menu', container).click(function (e) {
                e.stopPropagation();
            });
        }
    }

    $('.bookshelf', container).click(function (e) {
        switch ($(this).attr('title')) {
            case 'Favorites':
                if (!storyData.Ao3) {
                    if (!isAo3Page()) {
                        if ($(this).hasClass('selected')) {
                            ffAPI.unfav(storyId, toggle.bind(this));
                        } else {
                            ffAPI.fav(storyId, toggle.bind(this));
                        }
                    } else {
                        $.toast("Please go to Fanfiction.net to change this story's Favorite status.", 5000)
                    }
                }
                break;
            case 'Following':
                if (storyData.Ao3) {
                    if (isAo3Page()) {
                        ao3API.toggleSubscription(storyId, toggle.bind(this));
                    }
                    else {
                        $.toast("Please go to Archive of Our Own to change this story's subscription status.", 5000)
                    }
                } else {
                    if (!isAo3Page()) {
                        if ($(this).hasClass('selected')) {
                            ffAPI.unfollow(storyId, toggle.bind(this));
                        } else {
                            ffAPI.follow(storyId, toggle.bind(this));
                        }
                    } else {
                        $.toast("Please go to Fanfiction.net to change this story's Alert status.", 5000)
                    }
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
                e.preventDefault();
                break;
            default:
                toggle.apply(this);
        }
    });

    function updateShelf(title, add) {
        if (add) {
            $('.bookshelves [title="' + title + '"]', container).removeClass('unselected').addClass('selected');
        } else {
            $('.bookshelves [title="' + title + '"]', container).removeClass('selected').addClass('unselected');
        }
    }

    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        console.log("BetterFanfiction message recieved: ", request)
        switch (request.updated){
                case 'Liked':
                    ffAPI.getLiked(function (list) {
                        updateShelf('Liked', list.indexOf(storyId) !== -1);
                    });
                    break;
                case 'ReadLater':
                    ffAPI.getReadLater(function (list) {
                        updateShelf('Read It Later', list.indexOf(storyId) !== -1);
                    });
                    break;
                case 'Favorites':
                    ffAPI.getFavoritedList(function (list) {
                        updateShelf('Favorites', list.indexOf(storyId) !== -1);
                    });
                    break;
                case 'Alerts':
                    ffAPI.getFollowingList(function (list) {
                        updateShelf('Following', list.indexOf(storyId) !== -1);
                    });
                    break;
                case 'Subscriptions':
                    if (isAo3Page()) {
                        ao3API.getSubscriptions(function (list) {
                            updateShelf('Following', list.indexOf(storyId) !== -1);
                        });
                    }
                    break;
                case 'Bookshelves':
                    $('.bookshelves .dropdown-menu', container).children().remove();
                    ffAPI.getBookshelves(instantiateDropdown);
                    break;
                case 'Shelf':
                    ffAPI.bookshelf.get(request.id, function (list) {
                            updateShelf(request.id, list.indexOf(storyId) !== -1);
                    });
                    break;
                default:
                    return;
            }
    });
}

function setUpBookshelves() {
    var shelfSelectBackup;
    $('<div class="modal fade hide" id="bookshelf_display" style="display: none;">' +
        '<div class="modal-header">' +
        '<button type="button" class="close" data-dismiss="modal"><span>&times;</span></button>' +
        '<h4 class="modal-title">Bookshelves</h4></div>' +
       '<div class="modal-body"><div role="tabpanel">' +
        '<ul class="nav nav-tabs" role="tablist" id="bookshelf_tabs">' +
            '<li role="presentation"><a href="#ril_tab" role="tab" data-toggle="tab">Read It Later</a></li>' +
            '<li role="presentation"><a href="#fav_tab" role="tab">Favorites</a></li>' +
            '<li role="presentation"><a href="#track_tab" role="tab">Following</a></li>' +
            '<li role="presentation"><a href="#sub_tab" role="tab">Subscriptions</a></li>' +
            '<li role="presentation"><a href="#liked_tab" role="tab">Liked</a></li>' +
            '<li role="presentation"><a href="#alsoliked_tab" role="tab">Also Liked</a></li>' +
            '<li role="presentation"><a href="#read_tab" role="tab">Read</a></li>' +
            '<li role="presentation"><a href="#shelf_tab" role="tab">Shelves: <select id="fandom-select"></select><select id="shelf-select"><option id="default-shelf">--</option></select></a></li>' +
        '</ul><div class="tab-content">' +
            '<div role="tabpanel" class="tab-pane" id="ril_tab"><ul class="story-card-list list_boxes"></ul></div>' +
            '<div role="tabpanel" class="tab-pane" id="fav_tab"><ul class="story-card-list list_boxes"></ul></div>' +
            '<div role="tabpanel" class="tab-pane" id="track_tab"><ul class="story-card-list list_boxes"></ul></div>' +
            '<div role="tabpanel" class="tab-pane" id="sub_tab"><ul class="story-card-list list_boxes"></ul></div>' +
            '<div role="tabpanel" class="tab-pane" id="liked_tab"><ul class="story-card-list list_boxes"></ul></div>' +
            '<div role="tabpanel" class="tab-pane" id="alsoliked_tab"><ul class="story-card-list list_boxes"></ul></div>' +
            '<div role="tabpanel" class="tab-pane" id="read_tab"><ul class="story-card-list list_boxes"></ul></div>' +
        '</div></div></div><div class="modal-footer"></div></div>').appendTo('body');

    //FFnet
    $('<div class="xmenu_item"><a class="show-bookshelves-popup">Bookshelves</a></div>').appendTo('.zui tr > td:nth-child(1)');
    //Ao3
    $('<li class="dropdown"><a class="show-bookshelves-popup">Bookshelves</a></li>').appendTo('#header > ul');

    $('.show-bookshelves-popup').click(function () {
        $('#bookshelf_display').modal().css('display', 'block').addClass('in');
    });

    ffAPI.getBookshelves(function (shelves) {
        var fandoms = [];
        shelves.forEach(function (val, i) {
            $('#shelf-select')
            .append('<option class="' + val.fandom.map(s => s.replace(/[^_a-zA-Z-]/g, '')).join(' ') + '" data-id="' + val.id + '">' + val.name + '</option>');
            $('#bookshelf_display .tab-content')
            .append('<div role="tabpanel" class="tab-pane" id="shelf_tab_' + val.id + '"><ul class="story-card-list list_boxes"></ul></div>');

            val.fandom.forEach(function (item) {
                //add to the list of fandoms that have shelves
                if (fandoms.indexOf(item) === -1) {
                    fandoms.push(item);
                //if the fandom is already in the list, then there is more than one shelf, and the default(--) needs to be displayed to prevent auto-selecting a shelf
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

        shelfSelectBackup = $('#shelf-select').chainedTo('#fandom-select');

        $('#shelf-select').change(function (e) {
            var target = e.target,
                tabId = '#shelf_tab_' + target.selectedOptions[0].dataset.id;
            if (target.value !== '--') {
                if (!$(tabId).hasClass('populated')) {
                    ffAPI.bookshelf.get(target.selectedOptions[0].dataset.id, function (list) {
                        populateBookshelf(list, $(tabId));
                        $(tabId).addClass('populated');
                    });
                }
                $(this).parent().tab('show');
                $('#bookshelf_display .tab-content .active').removeClass('active');
                $(tabId).addClass('active');
            }
            $(this).blur();
        });

        $('a[href="#shelf_tab"]').click(function (e) {
            e.preventDefault();
            if ($('#shelf-select')[0].value !== '--') {
                $(this).tab('show');
                $('#bookshelf_display .tab-content .active').removeClass('active');
                $('#shelf_tab_' + $('#shelf-select')[0].selectedOptions[0].dataset.id).addClass('active');
            } else {
                $(this).blur();
            }
        });
    });

    if (pageType.endsWith('story')) {
        $('#bookshelf_tabs a[href="#alsoliked_tab"]').click(function (e) {
            e.preventDefault();
            if (!$('#alsoliked_tab').hasClass('populated')) {
                if (isAo3Page()) {
                    let firstFandomLinkElement = $('dd.fandom ul li:first-child a').get(0);
                    ao3API.getUsersBookmarks(Array.from($('p.kudos a[href^="/users"]'), e => e.href), 
                                             firstFandomLinkElement.text, firstFandomLinkElement.href,
                                             function (alObj) {
                        populateBookshelfAlt(alObj.stories, $('#alsoliked_tab'));
                    });
                } else {
                    $('#alsoliked_tab').addClass('populated')
                        .append('<img width="64" height="64" title="" alt="" src="' + chrome.extension.getURL('spinner.gif') + '" />');
                    ffAPI.getAlsoLiked(function (alObj) {
                        populateBookshelfAlt(alObj.stories, $('#alsoliked_tab'));
                    });
                }
            }
            $(this).tab('show');
        });
    } else {
        $('#bookshelf_tabs > li').has('a[href="#alsoliked_tab"]').hide();
    }

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

    $('#bookshelf_tabs a[href="#sub_tab"]').click(function (e) {
        e.preventDefault();
        if (!$('#sub_tab').hasClass('populated')) {
            ao3API.getSubscriptions(function (list) {
                populateBookshelf(list, $('#sub_tab'));
                $('#sub_tab').addClass('populated');
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
        if (request.updated) {
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
                case 'Subscriptions':
                    updateShelf('#sub_tab');
                    break;
                case 'Bookshelves':
                    if (request.added) {
                        let fandoms = request.fandom.map(s => s.replace(/[^_a-zA-Z-]/g, ''));
                        shelfSelectBackup.append('<option class="' + fandoms.join(' ') + '" data-id="' + request.id + '">' + request.name + '</option>');
                        $('#bookshelf_display .tab-content')
                        .append('<div role="tabpanel" class="tab-pane" id="shelf_tab_' + request.id + '"><ul class="story-card-list list_boxes"></ul></div>');

                        fandoms.forEach(function (item, i) {
                            //is this first shelf for this fandom?
                            if ($('#fandom-select [value="' + item + '"]').length === 0) {
                                $('#fandom-select').append('<option value="' + item + '">' + request.fandom[i] + '</option>');
                            //if the fandom is already in the list, then there is more than one shelf, and the default(--) needs to be displayed to prevent auto-selecting a shelf
                            } else {
                                if (!$('#default-shelf').hasClass(item)) {
                                    $('#default-shelf').addClass(item);
                                }
                            }
                        });
                    }
                    break;
                case 'Read':
                    let storyLanding = $('#story_landing .story_container[data-id=' + request.id + ']');
                    if (storyLanding.length) {
                        ffAPI.getReadObj(request.id, function (readObj) {
                            let readChapters = readObj.chapters;
                            $('.chapter-read-icon', storyLanding).each(function (index, element) {
                                if (readChapters.indexOf(parseInt($(this).data('chapter'), 10)) !== -1) {
                                    $(this).addClass('chapter-read');
                                } else {
                                    $(this).removeClass('chapter-read');
                                }
                            });
                        });
                    }
                    break;
                case 'Shelf':
                    //mark for refresh
                    $('#shelf_tab_' + request.id).removeClass('populated');
                    //manual refresh if currently open
                    if ($('#shelf_tab_' + request.id).hasClass('active')) {
                        $('#shelf-select').trigger('change');
                    }
                    break;
                default:
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
        el.find('.icon-chevron-right').click(openStoryLanding);
    });
}

function openStoryLanding(e) {
    let storyId = $(e.currentTarget).attr('data-original');
    if (e.ctrlKey || e.metaKey) {
        window.open(getStoryLink(storyId), '_blank');
    } else {
        let loadedStorys = $('#story_landing .story_container').hide();
        if (loadedStorys.filter('[data-id=' + storyId + ']').show().length === 0) {
            crossOriginGet(getStoryLink(storyId), function (data) {
                populateStoryLanding(parseStoryData(data, storyId));
                $('#story_landing').modal().css('display', 'block').addClass('in');

            });
        } else {
            $('#story_landing').modal();
        }
    }
}

function route(url, popState = false) {
    let transition = pageType + '-' + findPageType(url);
    if (transitions.includes(transition)) {
        $.get(url, function (data) {
            switch (transition) {
                case 'story-story':
                    let storyData = parseStoryData(data, parseInt(url.match(/\d+/), 10));
                    if (storyData.storyid === storyid) {
                        loadChapterInPlace(storyData, false, popState);
                    } else {
                        loadStoryInPlace(storyData, popState);
                    }
                    break;
                case 'story-user':
                    $('html').removeClass('story-page');
                    $('#reviews').remove();
                    pageType = 'user';
                    loadUserInPlace(data, url, popState);
                    break;
                case 'user-user':
                    loadUserInPlace(data, url, popState);
                    break;
                case 'user-story':
                    loadStoryFromUser(data, url, popState);
                    break;
                default:
                    break;
            }
            //close any modals
            $('.modal-backdrop.fade.in').trigger('click');
        });
        return true;
    }
    return false;
}

function findPageType(url) {
    if (url.search(/\/s\//) !== -1) {
        return 'story';
    } else if (url.search(/\/u\//) !== -1 || url.search(/\/~/) !== -1) {
        return 'user';
    } else if (url.search(/\/r\//) !== -1) {
        return 'review';
    } else if (url.search(/\/community\//) !== -1) {
        return 'group';
    } else if (url.search(/\/works\//) !== -1) {
        return 'Ao3story';
    } else if (url.search(/archiveofourown\.org/) !== -1){
        return 'Ao3browse';
    }
    return 'browse';
}

function isAo3Page(type = pageType) {
    return type.startsWith('Ao3');
}

function populateStoryLanding(d) {
    var m = $('#story_landing'),
        chapterTitle,
        el = $('<div class="story_container" data-id=' + d.storyid + '> <div class="story_content_box" > <div class="no_padding"> <div class="title"> <span class="content_rating"></span> <div> <a class="story_name" href=""></a> <div class="author"> <span class="by">by</span> <a href=""></a> </div> </div> </div> <div class="story"> <div class="story_data"> <div class="right" style="margin-left:0px;"> <div class="padding"> <div class="description"><img src="" class="story_image" onerror="this.style.display=\'none\'"><hr> </div> <div class="chapter_list"> <ul class="chapters"> <li class="bottom"> <span class="status"></span> <div class="word_count"> <b></b> words total </div> </li> </ul> </div> </div> </div> </div> <div class="extra_story_data"> <div class="inner_data"> <span class="date_approved"> <div> <span class="published">Published</span> <br> <span></span> </div> </span> <span class="last_modified"> <div> <span class="published">Updated</span> <br> <span></span> </div> </span> </div> </div> </div> </div> </div></div>'),
        chapterList;

    if (d.Ao3) {
        chapterList = d.data.find('#selected_id').children();
    } else {
        chapterList = d.data.find('select').first().children();
    }

    el.find('.story_name').html(d.title).attr({
        href: d.storyLink,
    });
    el.find('.author').append(d.authorElement || 'Anonymous');
    el.find('img.story_image').attr('src', d.storyImageLink);
    el.find('.description').append('<p>' + d.description + '</p>');
    el.find('.content_rating').html(d.rating);
    el.find('.word_count b').html(d.wordcount);
    el.find('.date_approved > div').children().last().html(d.published);
    if (d.updated){
        el.find('.last_modified > div').children().last().html(d.updated);
    } else {
        el.find('.last_modified').remove();
    }

    //rating
    switch (d.rating) {
        case 'N':
            el.find('.content_rating').remove();
            break;
        case 'E':
        case 'M':
            el.find('.content_rating').addClass('content_rating_mature');
            break;
        case 'T':
            el.find('.content_rating').addClass('content_rating_teen');
            break;
        default:
            el.find('.content_rating').addClass('content_rating_everyone');
    }

    //chapters
    for (let i = d.chapters; i > 0; i--) {
        chapterTitle = chapterList.length ? chapterList.eq(i - 1).html().replace(/[0-9]+\. /, '') : 'Chapter 1';
        el.find('.chapters').prepend('<div class="chapter_container ">' +
            '<li><div data-chapter="' + i + '" class="chapter-read-icon" title="(Click to toggle read status)">&#10004;</div>' +
            '<a class="chapter_link" href="' + getChapterLink(d, i) + '">' + chapterTitle + '</a></li></div>');
    }

    ffAPI.getReadObj(d.storyid, function (readObj) {
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

    setUpBookshelfBar('.story_container[data-id=' + d.storyid + ']', d);
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

function setVisited(add, chap = chapter, id = false) {
    var key,
        accessed = false;

    //actually visited the chapter, didn't just click on the read checkbox
    if (!id) {
        id = storyid;
        accessed = true;
    }
    key = 'Read:' + id;
    ffAPI.getReadObj(id, function (readObj) {
        //regular pageview
        if (accessed && add) {
            readObj.lastRead = Math.trunc(Date.now() * 0.00001);
        }
        //not already marked as read
        if (!readObj.chapters.includes(chap) && add) {
            readObj.chapters.push(chap);
        //mark as not read
        } else if (add === false) {
            readObj.chapters.splice(readObj.chapters.indexOf(chap), 1);
            if (readObj.chapters.length < 1) {
                readObj = null;
            }
        //if already marked as read and this isn't a chapter visit
        } else if (!accessed) {
            return;
        }
        chrome.runtime.sendMessage({updated: key, val: readObj});
    });
}

function populateBookshelf(storyIds, bookshelf, byComplete = true) {
    var wrapper = $('.story-card-list', bookshelf),
        count = storyIds.length,
        existing;

    //if there are already stories on the bookshelf
    if (wrapper.children().length) {
        //get existing list of storyids
        existing = Array.from(wrapper.children(), el => el.dataset.story);
        //remove from bookshelf any stories not on new list
        existing.forEach(function (val) {
            if (!storyIds.includes(val)) {
                $('li[data-story="' + val + '"]', wrapper).remove();
            }
        });
    } else {
        existing = [];
    }
    storyIds.forEach(function (val, i) {
        //add stories that aren't on bookshelf already
        if (val !== 0 && !existing.includes(val)) {
            crossOriginGet(getStoryLink(val), function (data) {
                try {
                    wrapper.append(createStoryCard(parseStoryData(data, val), i, byComplete));
                } catch (e) {
                    console.log(e);
                    console.log(`${val} did not load. It may no longer exist.`);
                }
                //since get requests are async, this ensures alignStoryCards runs after every storyCard has been made.
                count--;
                if (count === 0) {
                    setTimeout(alignStoryCards, 100, wrapper);
                }
            });
        } else {
            //re-order existing stories based on updated list
            if (existing.includes(val)) {
                let el = wrapper.find('li[data-story="' + val + '"]'),
                    index = el.find('.status-complete').length ? i : i + 10000;
                el[0].dataset.order = index;
                el.css('order', index);
            }
            count--;
            if (count === 0) {
                setTimeout(alignStoryCards, 100, wrapper);
            }
        }
    });
}

function populateBookshelfAlt(stories, bookshelf) {
    const storyCardsPerPage = 20;
    let wrapper = $('.story-card-list', bookshelf),
        part = stories.splice(0, storyCardsPerPage),
        count = part.length;
    part.forEach(function (val, i) {
        crossOriginGet(getStoryLink(val.k), function (data) {
            try {
                wrapper.append(createStoryCard(parseStoryData(data, val.k), -val.v, false));
            } catch (e) {
                console.log(e);
                console.log(`${val.k} did not load. It may no longer exist.`);
            }
            count--;
            if (count === 0) {
                setTimeout(alignStoryCards, 100, wrapper);
            }
        },
        //error
        function () {
            console.log(`${val.k} did not load.`);
        });
    });
    if (stories.length) {
        let loadBtn = $('<li data-order="100000" style="order: 100000;" class="load-more"><div class="story-card"><span class="info"></span></div></li>');
        loadBtn.children('.story-card').click(function () {
            populateBookshelfAlt(stories, bookshelf);
            loadBtn.remove();

        }).children('span').html('Load ' + (stories.length > storyCardsPerPage ? (storyCardsPerPage + ' more') : ('all ' + stories.length + ' remaining')) + ' stories');
        wrapper.append(loadBtn);
    }
}

function crossOriginGet(url, success, error) {
    chrome.runtime.sendMessage({relayGET: true, url}, (response) => {
        if (response.success && success !== undefined) {
            success(response.data);
        } else if (response.error && error !== undefined) {
            error();
        }
    });
}

function parseStoryData(data, storyid) {
    var d = $(data);

    if (typeof storyid === 'string' && storyid.match(/\D/)) {
        return parseAo3StoryData(d, storyid);
    } else {
        return parseFFnStoryData(d, storyid);
    }
}

function parseFFnStoryData(data, storyid) {
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
    that.published = easydate(d.find('#profile_top .xgray span').last().data('xutime'));
    that.updated = easydate(d.find('#profile_top .xgray span').first().data('xutime'));
    if (that.updated == that.published) {
        that.updated = undefined;
    }

    //author
    let author = d.find('#profile_top > a')[0];
    author.href = 'https://www.fanfiction.net' + author.pathname;
    that.authorElement = author.outerHTML;

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
    that.currentChapter = that.chapters > 1 ? d.find('select').get(0).selectedIndex + 1 : 1;

    that.data = d;

    return that;
}

function parseAo3StoryData(d, storyid) {
    var that = {};

    that.Ao3 = true;
    that.storyid = storyid;
    that.title = d.find('.preface h2').html().trim();
    that.rating = d.find('.rating .tag').html()[0];
    that.storyLink = 'https://archiveofourown.org/works/' + storyid.slice(1);
    that.description = d.find('.summary blockquote').html() || '';
    that.published = d.find('dd.published').html();
    that.updated = d.find('dd.status').html();
    that.wordcount = d.find('dd.words').html();
    //author
    let author = d.find('.preface > h3 > a').removeClass('author').addClass('xcontrast_txt')[0];
    if(author) {
        author.href = 'https://archiveofourown.org' + author.pathname;
        that.authorElement = author.outerHTML;
    }
    //kudos
    that.favs = d.find('dd.kudos').html();
    //comments
    that.reviews = d.find('dd.comments').html();
    //Ao3 chapters have a unique id in the url, instead of the direct indexing of FFnet
    that.chapterLookup = {};
    that.chapterNames = {};
    d.find('#selected_id option').each((i,v) => {
        that.chapterLookup[i + 1] = v.value;
        that.chapterNames[i + 1] = v.text;
    });
    that.chapters = Object.keys(that.chapterLookup).length || 1;

    //fandom(s)
    that.fandom = [];
    d.find('.fandom a').each(function(index, el) {
        that.fandom.push($(el).html());
    });

    //category(s)
    that.genres = [];
    d.find('.category a').each(function(index, el) {
        that.genres.push($(el).html());
    });

    //Completion
    that.complete = d.find('.status').length === 0 || d.find('dt.status').html() === 'Completed:';
    
    //characters
    that.chars = [];
    d.find('.character a').each(function(index, el) {
        that.chars.push($(el).html());
    });
    let rels = [];
    d.find('.relationship a').each(function(index, el) {
        rels.push($(el).html());
    });
    rels.forEach(val => val.split(/\/|(?: &amp; )/).forEach(function (val) {
        var i = that.chars.indexOf(val);
        if (i !== -1) {
            that.chars.splice(i, 1);
        }
    }));
    that.chars = rels.concat(that.chars).join(', ');

    //cover art (rare on Ao3)
    that.storyImageLink = d.find('#workskin img').attr('src');

    that.data = d;

    return that;
}

function createStoryCard(d, index, byComplete = true) {
    var infoString,
        storyCard = $('<li data-story="' + d.storyid + '"><div class="story-card-container"><div class="story-card"><h2>' +
                        '<span class="content_rating">' + d.rating + '</span><span class="status"></span>' +
                        '<span class="story_link" data-original="' + d.storyid + '">' + d.title + '</span>' +
                        '</h2><div class="story-card-content">' +
                        '<span class="short_description">' + d.description +
                        '<span class="by">&nbsp;<b>&#183;</b>&nbsp;' + (d.authorElement || 'Anonymous') +
                        '</span></span></div><span class="info"></span></div></div></li>');

    storyCard.find('.story_link').click(openStoryLanding);

    //no image
    if (d.storyImageLink && pageType !== 'popup') {
        storyCard.find('.story-card-content').prepend('<img src="' + d.storyImageLink + '" class="story_image" onerror="this.style.display=\'none\'">');
    }

    //rating
    switch (d.rating) {
        case 'N':
            storyCard.find('.content_rating').remove();
            break;
        case 'E':
        case 'M':
            storyCard.find('.content_rating').addClass('content_rating_mature');
            break;
        case 'T':
            storyCard.find('.content_rating').addClass('content_rating_teen');
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
        infoString += '<b>&#183;</b>&nbsp;' + d.favs + ' favs&nbsp';
    }
    //characters
    if (d.chars) {
        infoString += '<b>&#183;</b>&nbsp;' + d.chars;
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
        return $(a).data('order') - $(b).data('order');
    });
    for (let i = 0; i < cards.length; i += 2) {
        el1 = cards.eq(i);
        el2 = cards.eq(i + 1);

        if (el2.length) {
            diff = el1.find('.story-card').height() - el2.find('.story-card').height();
            if (diff > 0) {
                el2.find('.story-card-content').css('padding-bottom', diff + 'px');
            } else if (diff < 0) {
                el1.find('.story-card-content').css('padding-bottom', -diff + 'px');
            }
        //last one has no counterpart, remove any padding
        } else {
            el1.find('.story-card-content').css('padding-bottom', '0px');
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
    list = Object.keys(also).map(prop => ({
        k: prop,
        v: also[prop],
    }));
    return list.sort((a, b) => b.v - a.v);
}

function getStoryLink(id) {
    if (typeof id === 'string' && id.startsWith('a')) {
        return 'https://archiveofourown.org/works/' + id.slice(1);
    } else {
        return 'https://www.fanfiction.net/s/' + id;
    }
}

function getChapterLink(data, chap) {
    if (typeof data.storyid === 'string' && data.storyid.startsWith('a')) {
        return 'https://archiveofourown.org/works/' + data.storyid.slice(1) + (data.chapters > 1 ? '/chapters/' + data.chapterLookup[chap] : '');
    } else {
        return 'https://www.fanfiction.net/s/' + data.storyid + '/' + chap;
    }
}

function FanFictionAPI() {
    var userid,
        loggedIn = false,
        followingList,
        favoritedList,
        followingAccessTime = 0,
        favoritedAccessTime = 0,
        progressBar,
        cancel = false;

    chrome.storage.local.get('userid', function (items) {
        if (items.userid) {
            userid = items.userid;
        }
    });

    Object.defineProperty(this, 'userid', { set: function (x) {
            loggedIn = true;
            if (x !== -1) {
                userid = x;
                chrome.storage.local.set({ userid: x });
            }
        },
    });

    //type = 'alert' || 'favorites'
    function readFFnetList(type, callback, index = 1, list = []) {
        if (!loggedIn) {
            $.toast('Please login or signup to access this feature.');
            return;
        }

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
                        chrome.storage.local.set({ followingList })
                        followingAccessTime = Date.now();
                        if (callback) {
                            callback(followingList);
                        }
                    } else {
                        favoritedList = list;
                        chrome.storage.local.set({ favoritedList })
                        favoritedAccessTime = Date.now();
                        if (callback) {
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
                favauthor: 0,
            },
            function (data) {
                if (data.error) {
                    $.toast('We are unable to process your request due to an network error. Please try again later.');
                } else {
                    if (type === 'follow') {
                        chrome.runtime.sendMessage({updated: 'AlertsLastModified', val: Date.now()});
                    } else {
                        chrome.runtime.sendMessage({updated: 'FavoritesLastModified', val: Date.now()});
                    }
                    $.toast('We have successfully processed the following:' + data.payload_data, 3000); // jscs:ignore requireCamelCaseOrUpperCaseIdentifiers
                    if (callback) {
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

    function getReviewers(storyid, callback, index = 1, list = []) {
        if (cancel) {
            cancel = false;
            $('#alsoliked_tab > img').remove();
            return;
        }
        $.get('https://www.fanfiction.net/r/' + storyid + '/0/' + index,
            function (data) {
                var tmp = data.match(/\/u\/\d+\//g);
                if (tmp) {
                    list = list.concat(tmp);
                }
                progressBar.advance();
                if (data.search('Next &#187;') !== -1) {
                    getReviewers(storyid, callback, index + 1, list);
                } else {
                    getUserFavs(list, callback);
                }
            },
        'html').fail(function () {
            alert('getReviewers terminated early, on page ' + index);
            console.log('getReviewers terminated early, on page ' + index);
            getUserFavs(list, callback);
        });
    }

    function getReviewersByChapter(storyid, chapters, callback, index = 1, list = []) {
        if (cancel) {
            cancel = false;
            $('#alsoliked_tab > img').remove();
            return;
        }
        $.get('https://www.fanfiction.net/r/' + storyid + '/' + index,
            function (data) {
                var tmp = data.match(/\/u\/\d+\//g);
                if (tmp) {
                    list = list.concat(tmp);
                }
                progressBar.advance();
                if (index < chapters) {
                    getReviewersByChapter(storyid, chapters, callback, index + 1, list);
                } else {
                    getUserFavs(list, callback);
                }
            },
        'html').fail(function () {
            alert('getReviewersByChapter terminated early, on page ' + index + ' of ' + chapters);
            console.log('getReviewersByChapter terminated early, on page ' + index + ' of ' + chapters);
            getUserFavs(list, callback);
        });
    }

    function getUserFavs(users, callback) {
        users = users.sort().filter(function (item, pos, ary) {
            return !pos || item !== ary[pos - 1];
        });
        if (progressBar) {
            progressBar.close()
        }
        progressBar = progressDialog({tasks: users.length, parent: $('#alsoliked_tab')});
        progressBar.message('Fetching the favorites of ' + users.length + ' users.');

        let remaining = users.length;
        let list = [];
        users.forEach(user => {
            $.get('https://www.fanfiction.net' + user,
                function (data) {
                    progressBar.advance();
                    console.log(`loaded ${user}`);
                    try {
                        $('.favstories', data).each(function () {
                            list.push(parseInt(this.dataset.storyid));
                        });
                    } finally {
                        remaining--;
                        if (remaining <= 0) {
                            finish();
                        }
                    }
                },
            'html').fail(function () {
                progressBar.advance()
                console.error(`failed to load ${user}`);
                remaining--;
                if (remaining <= 0) {
                    finish();
                }
            });
        });
        
        function finish() {
            progressBar.close();
            progressBar = null;
            let also = {};
            list.forEach(function (item) {
                if (!also[item]) {
                    also[item] = 1;
                }
                else {
                    also[item] += 1;
                }
            });
            list = Object.keys(also).map(prop => ({
                k: prop,
                v: also[prop],
            }));
            console.log('Found ' + list.length + ' favorited stories.');
            list = list.filter(item => item.v > 1).sort((a, b) => b.v - a.v);
            console.log(list.length + ' of which were faved by more than one person.');
            if (list.length > 50) {
                list = list.filter((item, pos) => pos < 49 && item.v > 2);
            }
            if (list.length === 0) {
                list.push({ k: storyid + '', v: 1 });
            }
            else if (list[0].k === storyid + '') {
                list.shift();
            }
            let alsoLikedCache = { created: Date.now(), chapters: $('.info-list-chapters > b').html(), stories: list };
            chrome.storage.local.set({ ['AlsoLiked:' + storyid]: alsoLikedCache });
            callback(alsoLikedCache);
        }
    }

    this.cancelOperation = function () {
        cancel = true;
    };

    //read
    this.getBookshelves = function (callback) {
        chrome.storage.local.get('Bookshelves', function (items) {
            if (items.Bookshelves) {
                callback(items.Bookshelves);
            } else {
                callback([]);
            }
        });
    };

    this.getReadLater = function (callback) {
        chrome.storage.local.get('ReadLater', function (items) {
            if (items.ReadLater) {
                callback(items.ReadLater);
            } else {
                callback([]);
            }
        });
    };

    this.getFollowingList = function (callback) {
        chrome.storage.local.get(['AlertsLastModified', 'followingList'], function (items) {
            if (items.followingList === undefined || followingAccessTime < items.AlertsLastModified) {
                readFFnetList('alert', callback);
            } else {
                followingList = items.followingList;
                callback(followingList);
            }
        });
    };

    this.getFavoritedList = function (callback) {
        chrome.storage.local.get(['FavoritesLastModified', 'favoritedList'], function (items) {
            if (items.favoritedList === undefined || favoritedAccessTime < items.FavoritesLastModified) {
                readFFnetList('favorites', callback);
            } else {
                favoritedList = items.favoritedList;
                callback(favoritedList);
            }
        });
    };

    this.getLiked = function (callback) {
        chrome.storage.local.get('Liked', function (items) {
            if (items.Liked) {
                callback(items.Liked);
            } else {
                callback([]);
            }
        });
    };

    this.getAlsoLiked = function (callback) {
        const id = 'AlsoLiked:' + storyid;

        if (!loggedIn) {
            $.toast('Please login or signup to access this feature.');
            return;
        }
        cancel = false;
        chrome.storage.local.get(id, function (items) {
            $('#alsoliked_tab > img').remove();
            if (items[id]) {
                callback(items[id]);
                return;
            }
            const chapters = parseInt($('.info-list-chapters > b').html(), 10);
            const numReviews = parseInt($('.info-list-reviews > a').html().replace(',', ''), 10);
            if (chapters < numReviews / 15) {
                progressBar = progressDialog({tasks: chapters, parent: $('#alsoliked_tab')});
                progressBar.message('Fetching list of all users who have reviewed this story.');
                getReviewersByChapter(storyid, chapters, callback);
            } else {
                progressBar = progressDialog({tasks: numReviews / 15, parent: $('#alsoliked_tab')});
                progressBar.message('Fetching list of all users who have reviewed this story.');
                getReviewers(storyid, callback);
            }
        });
    };

    this.getRead = function (callback) {
        var readStories = [];
        chrome.storage.local.get(null, function (items) {
            for (let prop in items) {
                if (prop.startsWith('Read:')) {
                    readStories.push({k: prop.substr(5), v: items[prop].lastRead});
                }
            }
            readStories.sort(function (a, b) {
                return b.v - a.v;
            });
            callback(readStories);
        });
    };

    function getGroupStories(pathParts, callback, index = 1, list = []) {
        $.get('https://www.fanfiction.net' + pathParts[0] + index + pathParts[1],
            function (data) {
                list = list.concat($('.z-list', data).toArray());

                if (data.search('Next &#187;') !== -1) {
                    getGroupStories(pathParts, callback, index + 1, list);
                } else {
                    callback(list);
                }
            },
            'html').error(function () {
            $.toast('We are unable to process your request due to an network error. Please try again later.');
        });
    }
    this.getGroupStories = getGroupStories;

    this.getReadObj = function (storyId, callback) {
        let key = 'Read:' + storyId;
        chrome.storage.local.get(key, function (items) {
            if (items[key]) {
                callback(items[key]);
            } else {
                callback({chapters: [], lastRead: Math.trunc(Date.now() * 0.00001)});
            }
        });
    };

    //write
    this.removeFromRil = function (id, callback) {
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
                chrome.runtime.sendMessage({ updated: 'ReadLater', val: list });
            }
            if (callback) {
                callback();
            }
        });
    };

    this.unfollow = function (id, callback) {
        if (!loggedIn) {
            $.toast('Please login or signup to access this feature.');
            return;
        }

        $.post('https://www.fanfiction.net/alert/story.php?', {
            action: 'remove-multi',
            'rids[]': id,
        },
        function (data) {
            chrome.runtime.sendMessage({ updated: 'AlertsLastModified', val: Date.now()});
            //$.toast('You have succesfully unfollowed: ' + title.replace(/\+/g, ' '));
            if (callback) {
                callback();
            }
        },
        'html'
        ).error(function () {
            $.toast('We are unable to process your request due to an network error. Please try again later.');
        });
    };

    this.unfav = function (id, callback) {
        if (!loggedIn) {
            $.toast('Please login or signup to access this feature.');
            return;
        }

        $.post('https://www.fanfiction.net/favorites/story.php?', {
            action: 'remove-multi',
            'rids[]': id,
        },
        function (data) {
            chrome.runtime.sendMessage({ updated: 'FavoritesLastModified', val: Date.now() });
            //$.toast('You have succesfully unfaved: ' + title.replace(/\+/g, ' '));
            if (callback) {
                callback();
            }
        },
        'html'
        ).error(function () {
            $.toast('We are unable to process your request due to an network error. Please try again later.');
        });
    };

    this.unlike = function (id, callback) {
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
                chrome.runtime.sendMessage({ updated: 'Liked', val: list });
            }
            if (callback) {
                callback();
            }
        });
    };

    /*this.removeBookshelf = function (id, callback) {
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
                list[index] = null;
                chrome.runtime.sendMessage({ updated: 'Bookshelves', val: list });
                chrome.runtime.sendMessage({ updated: 'shelf:' + id, val: null });
            }
            if (callback) {
                callback();
            }
        });
    };*/

    this.addToRil = function (id, callback) {
        chrome.storage.local.get('ReadLater', function (items) {
            var list;
            if (items.ReadLater) {
                list = items.ReadLater;
            } else {
                list = [];
            }
            if (list.indexOf(id) === -1) {
                list.push(id);
                chrome.runtime.sendMessage({ updated: 'ReadLater', val: list});
            }
            if (callback) {
                callback();
            }
        });
    };

    this.fav = function (id, callback) {
        favOrFollow('fav', id, callback);
    };

    this.follow = function (id, callback) {
        favOrFollow('follow', id, callback);
    };

    this.like = function (id, callback) {
        chrome.storage.local.get('Liked', function (items) {
            var list;
            if (items.Liked) {
                list = items.Liked;
            } else {
                list = [];
            }
            if (list.indexOf(id) === -1) {
                list.push(id);
                chrome.runtime.sendMessage({ updated: 'Liked', val: list});
            }
            if (callback) {
                callback();
            }
        });
    };

    this.addBookshelf = function (shelfName, fandom, callback) {
        chrome.storage.local.get('Bookshelves', function (items) {
            let list,
                nextId;
            if (items.Bookshelves) {
                list = items.Bookshelves;
                nextId = list[list.length - 1].id + 1;
            } else {
                list = [];
                nextId = 0;
            }
            
            list = list.concat({id: nextId, name: shelfName, fandom: fandom});
            chrome.runtime.sendMessage({ updated: 'Bookshelves', val: list });
            if (callback) {
                callback(nextId);
            }
        });
    };

    this.bookshelf = {
        add: function (shelfId, storyId, callback) {
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
                    chrome.runtime.sendMessage({updated: shelfName, val: list});
                }
                if (callback) {
                    callback();
                }
            });
        },

        remove: function (shelfId, storyId, callback) {
            var shelfName = 'shelf:' + shelfId;
            chrome.storage.local.get(shelfName, function (items) {
                var index,
                    list;
                if (items[shelfName]) {
                    list = items[shelfName];
                    index = items[shelfName].indexOf(storyId);
                    if (index !== -1) {
                        list.splice(index, 1);
                        chrome.runtime.sendMessage({updated: shelfName, val: list});
                    }
                }
                if (callback) {
                    callback();
                }
            });
        },

        get: function (shelfId, callback) {
            var shelfName = 'shelf:' + shelfId;
            chrome.storage.local.get(shelfName, function (items) {
                if (items[shelfName]) {
                    callback(items[shelfName]);
                } else {
                    callback([]);
                }
            });
        },
    };
}

function ArchiveOfOurOwnAPI() {
    let userName,
        loggedIn = false,
        subscriptionList,
        subscriptionAccessTime;

    chrome.storage.local.get('Ao3UserName', function (items) {
        if (items.Ao3UserName) {
            userName = items.Ao3UserName;
        }
    });

    Object.defineProperty(this, 'userName', { set: function (x) {
            if (x !== -1) {
                loggedIn = true;
                userName = x;
                chrome.storage.local.set({ Ao3UserName: x });
            }
        },
    });
    async function Ao3GetSubscribeInfo(storyid, subscribe = true) {
        let data = await $.get(`https://archiveofourown.org/works/${Ao3StripStoryId(storyid)}`)
        let subForm = $(data).find('li.subscribe form');
        if(subForm.length){
            return {reqObj: Array.from(subForm.children()).reduce((obj, el) => {obj[el.name] = el.value; return obj}, {}),
                    url: subForm[0].action}
        }
        else {
            return {url: false}
        }
    }

    function readSubscriptionList(callback, index = 1, list = []) {
        if (userName) {
            $.get(`https://archiveofourown.org/users/${userName}/subscriptions?type=works&page=${index}`,
                function (data) {
                    list = list.concat(Array.from($(data).find('dl.subscription dt a:first-child'), el => 'a' + el.href.slice(el.href.lastIndexOf('/') + 1)));
                    if ($(data).find('.next a').length) {
                        readSubscriptionList(callback, index + 1, list);
                    } else {
                        subscriptionList = list;
                        subscriptionAccessTime = Date.now();
                        callback(list);
                    }
                },
            'html').fail(function () {
                subscriptionList = undefined;
                callback(list);
            });
        }
    }
    
    function getBookmarksFromUser(url, callback, index = 1, list = []) {
        $.get(url + index,
            function (data) {
                if (alsoLikedCancelled){
                    return;
                }
                data = $(data);
                try {
                    list = list.concat(Array.from(data.find('.bookmark h4.heading > a:first-child'), el => 'a' + el.href.slice(el.href.lastIndexOf('/') + 1)));
                } catch (error) {
                    console.warn("ERROR: Couldn't parse user bookmarks")
                }
                if (data.find('.next a').length && index < 10) {
                    getBookmarksFromUser(url, callback, index + 1, list);
                } else {
                    callback(list);
                }
            },
        'html').fail(function () {
            if (alsoLikedCancelled){
                return;
            }
            callback([]);
        });
    }

    let alsoLikedCancelled = false;
    this.getUsersBookmarks = async function(users, fandomName, fandomLink, callback) {
        let count = users.length,
            list = [],
            progressBar = progressDialog({tasks: count, parent: $('#alsoliked_tab'),
                                            cancelled: () => {
                                                alsoLikedCancelled = true
                                                formatAlsoLiked(list, callback);
                                            }});
        alsoLikedCancelled = false;
        progressBar.message(`Fetching the ${fandomName} bookmarks of ${count} users`);
        let fandomWorksPage = await $.get(fandomLink);
        let fandomID = $(fandomWorksPage).find('#include_fandom_tags ul li:first-child input').get(0).value;
        users.forEach(function (val, i) {
            getBookmarksFromUser(val + '/bookmarks?bookmark_search%5Bfandom_ids%5D%5B%5D=' + fandomID + '&page=', function (l) {
                list.push(...l);
                count--;
                console.log(count);
                progressBar.advance();
                if (count <= 0 && !alsoLikedCancelled) {
                    formatAlsoLiked(list, callback);
                    progressBar.close();
                }
            });
        });
    }

    function formatAlsoLiked(list, callback) {
        let also = {};
        list.forEach(function (item) {
            if (!also[item]) {
                also[item] = 1;
            }
            else {
                also[item] += 1;
            }
        });
        list = Object.keys(also).map(prop => ({
            k: prop,
            v: also[prop],
        }));
        console.log('Found ' + list.length + ' bookmarked stories.');
        list = list.filter(item => item.v > 1).sort((a, b) => b.v - a.v);
        console.log(list.length + ' of which were bookmarked by more than one person.');
        if (list.length > 50) {
            list = list.filter((item, pos) => pos < 49 && item.v > 2);
        }
        callback({ created: Date.now(), stories: list });
    }

    this.getSubscriptions = function (callback) {
        chrome.storage.local.get('SubscriptionsLastModified', function (items) {
            if (subscriptionList === undefined || subscriptionAccessTime < items.SubscriptionsLastModified) {
                readSubscriptionList(callback);
            } else {
                callback(subscriptionList);
            }
        });
    };
    
    this.toggleSubscription = async function(storyid, callback) {
        //has to get url from the form since each subscription has a subscription id that is part of the url
        let {reqObj, url} = await Ao3GetSubscribeInfo(storyid);
        if(!url) {
            $.toast('Please login or signup to access this feature.');
            return;
        }
        $.post(url,
            reqObj,
            function (data) {
                if (data.error) {
                    $.toast('We are unable to process your request due to a network error. Please try again later.');
                } else {
                    chrome.runtime.sendMessage({updated: 'SubscriptionsLastModified', val: Date.now()});
                    if (callback) {
                        callback();
                    }
                }
            },
            'json'
        ).error(function () {
            $.toast('We are unable to process your request due to a network error. Please try again later.');
        });
    }
}

/*
====================
progressDialog
    creates a dialog which displays the progress of a task
    that = {
        tasks: 3,                   //number of things that need doing
        parent: $('')               //jquery element to append to
        finish: function () {}      //a function to run after the dialog closes
        cancelled: function () {}   //a function to run upon cancellation
    }
====================
*/
function progressDialog(that = {}) {
    var tasks,
        dialog,
        progressBar,
        val = 0;

    tasks = that.tasks || 0;
    dialog = $('<div>', {
        class: 'progress-dialog',
        html: `<span id="progressMsg"></span>
               <progress value="0" max="${tasks}"></progress>
               <span class="cancel">Click to cancel</span>`,
    });

    that.parent.append(dialog);
    progressBar = dialog.find('progress');

    that.close = function () {
        dialog.remove();
        if ('finish' in that) {
            that.finish();
        }
    };

    if ('cancelled' in that) {
        dialog.find('.cancel').click(() => {
            console.log("Cancelling progress dialog");
            that.cancelled();
            that.close();
        });
    } else {
        dialog.find('.cancel').remove();
    }
    

    that.progressSet = function (progress) {
        $({value: val}).animate({value: progress}, {
            duration: 500,
            step: function () {
                progressBar.attr('value', this.value);
            },
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
            },
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
        monthShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][date.getMonth()],
        day = date.getDate();
    if (unixDiff < 60) {
        return 'secs ago';
    } else if (unixDiff <= 3600) {
        return Math.floor(unixDiff / 60) + 'm ago';
    } else if (unixDiff < 3600 * 24) {
        return Math.floor(unixDiff / 3600) + 'h ago';
    } else if ((new Date()).getFullYear() === year) {
        return monthShort + ' ' + day;
    } else {
        return monthShort + ' ' + day + ', ' + year;
    }
}

function fandomsMatch(a, b) {
    for(const fa of a) {
        for(const fb of b) {
            if(fandomEqual(fa, fb)) {
                return true;
            }
        }
    }
    return false;
}

let fandomMap = (() => {
    let temp = {
        'Star Wars' : ["Star Wars Episode VIII: The Last Jedi (2017)", "Star Wars Episode VII: The Force Awakens (2015)", 
                       "Star Wars Sequel Trilogy", "Reylo - Fandom", "Star Wars - All Media Types",
                       "Star Wars Legends: Knights of the Old Republic", "Star Wars Legends: Knights of the Old Republic II: The Sith Lords"],
        'Dragon Age': ['Dragon Age: Inquisition', 'Dragon Age - All Media Types', 'Dragon Age (Video Games)'],
        'Harry Potter': ['Harry Potter - J. K. Rowling', 'Harry Potter - Fandom'],
    };
    let map = {};
    for (const [k, v] of Object.entries(temp)){
        map[k] = k;
        for (const n of v) {
            map[n] = k;
        }
    }
    return map;
})();

function fandomEqual(a, b){
    return a === b || (fandomMap[a] && fandomMap[a] === fandomMap[b]);
}

function normalizeFandoms(fandoms) {
    return [...new Set(fandoms.map(f => fandomMap[f] || f))]
}

function htmlEntities(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function Ao3StripStoryId(storyid){
    return storyid.slice(1);
}
