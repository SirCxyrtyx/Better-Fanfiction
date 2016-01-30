//jshint jquery: true, strict: false, quotmark: false, expr: true, asi: true
/* global*/ 

//$.toast(message [, displaytime = 2500])
//modified from Fanfiction.net source code.
jQuery.fn.fixed_center = function() {
    'use strict';
    var b = ($(window).height() / 2) - (this.outerHeight() / 2),
        e = ($(window).width() / 2) - (this.outerWidth() / 2);
    this.css({position: 'fixed',margin: 0,top: b + 'px',left: e + 'px'});
    return this;
};
(function(b) {
    var a = null;
    window.toasting = false;
    window.toastQue = [];
    b.toast = function(a, b) {
        return new d({message: a, displayTime: b ? b : 2500});
    };
    var d = function(f) {
        if (window.toasting) {
            window.toastQue.unshift(f);
            return;
        }
        window.toasting = true;
        var e = b('<div class="toast" style="position:fixed;max-width:400px">' + f.message + '</div>');
        b('body').append(e);
        e.fixed_center();
        e.fadeIn(300);
        a = setTimeout(function() {
            e.fadeOut(200, function() {
                e.remove();
                window.toasting = false;
                if (window.toastQue.length > 0) {
                    var next = window.toastQue.pop();
                    b.toast(next.message, next.displayTime);
                }
            });
        }, f.displayTime);
    };
})(jQuery);

/*
 * Lazy Load - jQuery plugin for lazy loading images
 *
 * Copyright (c) 2007-2013 Mika Tuupola
 *
 * Licensed under the MIT license:
 *   http://www.opensource.org/licenses/mit-license.php
 *
 * Project home:
 *   http://www.appelsiini.net/projects/lazyload
 *
 * Version:  1.9.3
 *
 */
(function($, window, document, undefined) {
    var $window = $(window);

    $.fn.lazyload = function(options) {
        var elements = this;
        var $container;
        var settings = {
            threshold       : 0,
            failure_limit   : 0,
            event           : 'scroll',
            effect          : 'show',
            container       : window,
            data_attribute  : 'original',
            skip_invisible  : true,
            appear          : null,
            load            : null,
            placeholder     : 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsQAAA7EAZUrDhsAAAANSURBVBhXYzh8+PB/AAffA0nNPuCLAAAAAElFTkSuQmCC'
        };

        function update() {
            var counter = 0;

            elements.each(function() {
                var $this = $(this);
                if (settings.skip_invisible && !$this.is(':visible')) {
                    return;
                }
                if ($.abovethetop(this, settings) ||
                    $.leftofbegin(this, settings)) {
                        /* Nothing. */
                } else if (!$.belowthefold(this, settings) &&
                    !$.rightoffold(this, settings)) {
                        $this.trigger('appear');
                        /* if we found an image we'll load, reset the counter */
                        counter = 0;
                } else {
                    if (++counter > settings.failure_limit) {
                        return false;
                    }
                }
            });

        }

        if(options) {
            /* Maintain BC for a couple of versions. */
            if (undefined !== options.failurelimit) {
                options.failure_limit = options.failurelimit;
                delete options.failurelimit;
            }
            if (undefined !== options.effectspeed) {
                options.effect_speed = options.effectspeed;
                delete options.effectspeed;
            }

            $.extend(settings, options);
        }

        /* Cache container as jQuery as object. */
        $container = (settings.container === undefined ||
                      settings.container === window) ? $window : $(settings.container);

        /* Fire one scroll event per scroll. Not one scroll event per image. */
        if (0 === settings.event.indexOf('scroll')) {
            $container.bind(settings.event, function() {
                return update();
            });
        }

        this.each(function() {
            var self = this;
            var $self = $(self);

            self.loaded = false;

            /* If no src attribute given use data:uri. */
            if ($self.attr('src') === undefined || $self.attr('src') === false) {
                if ($self.is('img')) {
                    $self.attr('src', settings.placeholder);
                }
            }

            /* When appear is triggered load original image. */
            $self.one('appear', function() {
                if (!this.loaded) {
                    if (settings.appear) {
                        var elements_left = elements.length;
                        settings.appear.call(self, elements_left, settings);
                    }
                    $('<img />')
                        .bind('load', function() {

                            var original = $self.attr('data-' + settings.data_attribute);
                            $self.hide();
                            if ($self.is('img')) {
                                $self.attr('src', original);
                            } else {
                                $self.css('background-image', 'url("' + original + '")');
                            }
                            $self[settings.effect](settings.effect_speed);

                            self.loaded = true;

                            /* Remove image from array so it is not looped next time. */
                            var temp = $.grep(elements, function(element) {
                                return !element.loaded;
                            });
                            elements = $(temp);

                            if (settings.load) {
                                var elements_left = elements.length;
                                settings.load.call(self, elements_left, settings);
                            }
                        })
                        .attr('src', $self.attr('data-' + settings.data_attribute));
                }
            });

            /* When wanted event is triggered load original image */
            /* by triggering appear.                              */
            if (0 !== settings.event.indexOf('scroll')) {
                $self.bind(settings.event, function() {
                    if (!self.loaded) {
                        $self.trigger('appear');
                    }
                });
            }
        });

        /* Check if something appears when window is resized. */
        $window.bind('resize', function() {
            update();
        });

        /* With IOS5 force loading images when navigating with back button. */
        /* Non optimal workaround. */
        if ((/(?:iphone|ipod|ipad).*os 5/gi).test(navigator.appVersion)) {
            $window.bind('pageshow', function(event) {
                if (event.originalEvent && event.originalEvent.persisted) {
                    elements.each(function() {
                        $(this).trigger('appear');
                    });
                }
            });
        }

        /* Force initial check if images should appear. */
        $(document).ready(function() {
            update();
        });

        return this;
    };

    /* Convenience methods in jQuery namespace.           */
    /* Use as  $.belowthefold(element, {threshold : 100, container : window}) */

    $.belowthefold = function(element, settings) {
        var fold;

        if (settings.container === undefined || settings.container === window) {
            fold = (window.innerHeight ? window.innerHeight : $window.height()) + $window.scrollTop();
        } else {
            fold = $(settings.container).offset().top + $(settings.container).height();
        }

        return fold <= $(element).offset().top - settings.threshold;
    };

    $.rightoffold = function(element, settings) {
        var fold;

        if (settings.container === undefined || settings.container === window) {
            fold = $window.width() + $window.scrollLeft();
        } else {
            fold = $(settings.container).offset().left + $(settings.container).width();
        }

        return fold <= $(element).offset().left - settings.threshold;
    };

    $.abovethetop = function(element, settings) {
        var fold;

        if (settings.container === undefined || settings.container === window) {
            fold = $window.scrollTop();
        } else {
            fold = $(settings.container).offset().top;
        }

        return fold >= $(element).offset().top + settings.threshold  + $(element).height();
    };

    $.leftofbegin = function(element, settings) {
        var fold;

        if (settings.container === undefined || settings.container === window) {
            fold = $window.scrollLeft();
        } else {
            fold = $(settings.container).offset().left;
        }

        return fold >= $(element).offset().left + settings.threshold + $(element).width();
    };

    $.inviewport = function(element, settings) {
         return !$.rightoffold(element, settings) && !$.leftofbegin(element, settings) &&
                !$.belowthefold(element, settings) && !$.abovethetop(element, settings);
     };

})(jQuery, window, document);


/*
 * Chained - jQuery / Zepto chained selects plugin
 *
 * Copyright (c) 2010-2014 Mika Tuupola
 *
 * Licensed under the MIT license:
 *   http://www.opensource.org/licenses/mit-license.php
 *
 * Project home:
 *   http://www.appelsiini.net/projects/chained
 *
 * Version: 0.9.10
 *
 */
(function($, window, document, undefined) {
    'use strict';

    $.fn.chained = function(parent_selector, options) {

        return this.each(function() {

            /* Save this to child because this changes when scope changes. */
            var child   = this;
            var backup = $(child).clone();

            /* Handles maximum two parents now. */
            $(parent_selector).each(function() {
                $(this).bind('change', function() {
                    updateChildren();
                });

                /* Force updating the children. */
                updateChildren();
            });

            function updateChildren() {
                var trigger_change = true;
                var currently_selected_value = $('option:selected', child).val();

                $(child).html(backup.html());

                /* If multiple parents build classname like foo\bar. */
                var selected = '';
                $(parent_selector).each(function() {
                    var selectedClass = $('option:selected', this).val();
                    if (selectedClass) {
                        if (selected.length > 0) {
                            selected += '\\';
                        }
                        selected += selectedClass;
                    }
                });

                /* Also check for first parent without subclassing. */
                /* TODO: This should be dynamic and check for each parent */
                /*       without subclassing. */
                var first;
                if ($.isArray(parent_selector)) {
                    first = $(parent_selector[0]).first();
                } else {
                    first = $(parent_selector).first();
                }
                var selected_first = $('option:selected', first).val();

                $('option', child).each(function() {
                    /* Remove unneeded items but save the default value. */
                    if ($(this).hasClass(selected) && $(this).val() === currently_selected_value) {
                        $(this).prop('selected', true);
                        trigger_change = false;
                    } else if (!$(this).hasClass(selected) && !$(this).hasClass(selected_first) && $(this).val() !== '') {
                        $(this).remove();
                    }
                });

                /* If we have only the default value disable select. */
                if (1 === $('option', child).size() && $(child).val() === '') {
                    $(child).prop('disabled', true);
                } else {
                    $(child).prop('disabled', false);
                }
                if (trigger_change) {
                    $(child).trigger('change');
                }
            }
        });
    };

    /* Alias for those who like to use more English like syntax. */
    $.fn.chainedTo = $.fn.chained;

    /* Default settings for plugin. */
    $.fn.chained.defaults = {};

})(window.jQuery, window, document);


/* =========================================================
 * bootstrap-modal.js v2.2.1
 * http://twitter.github.com/bootstrap/javascript.html#modals
 * =========================================================
 */
!function(b) {
    var a = function(e, d) {
        this.options = d;
        this.$element = b(e).delegate('[data-dismiss="modal"]', "click.dismiss.modal", b.proxy(this.hide, this));
        this.options.remote && this.$element.find(".modal-body").load(this.options.remote)
    };
    a.prototype = {constructor: a,toggle: function() {
            return this[!this.isShown ? "show" : "hide"]()
        },show: function() {
            var d = this, f = b.Event("show");
            if (this.isShown || f.isDefaultPrevented()) {
                return
            }
            this.isShown = true;
            this.escape();
            if (this.options.dynamic) {
                this.$elementWrapper = b('<div class="modal-wrapper" />').insertBefore(this.$element);
                this.$element.prependTo(this.$elementWrapper)
            }
            this.backdrop(function() {
                var e = b.support.transition && d.$element.hasClass("fade");
                if (!d.$element.parent().length) {
                    d.$element.appendTo(document.body)
                }
                d.$element.show();
                if (e) {
                    d.$element[0].offsetWidth
                }
                d.$element.addClass("in").attr("aria-hidden", false);
                d.enforceFocus();
                e ? d.$element.one(b.support.transition.end, function() {
                    d.$element.trigger("shown")
                }) : d.$element.focus().trigger("shown")
            })
        },hide: function(f) {
            f && f.preventDefault();
            var d = this;
            f = b.Event("hide");
            this.$element.trigger(f);
            if (!this.isShown || f.isDefaultPrevented()) {
                return
            }
            this.isShown = false;
            this.escape();
            b(document).off("focusin.modal");
            this.$element.removeClass("in").attr("aria-hidden", true);
            b.support.transition && this.$element.hasClass("fade") ? this.hideWithTransition() : this.hideModal()
        },enforceFocus: function() {
            var d = this;
            b(document).on("focusin.modal", function(f) {
                if (d.$element[0] !== f.target && !d.$element.has(f.target).length) {
                    d.$element.focus()
                }
            })
        },escape: function() {
            var d = this;
            if (this.isShown && this.options.keyboard) {
                this.$element.on("keyup.dismiss.modal", function(f) {
                    f.which == 27 && d.hide()
                })
            } else {
                if (!this.isShown) {
                    this.$element.off("keyup.dismiss.modal")
                }
            }
        },hideWithTransition: function() {
            var d = this, e = setTimeout(function() {
                d.$element.off(b.support.transition.end);
                d.hideModal()
            }, 500);
            this.$element.one(b.support.transition.end, function() {
                clearTimeout(e);
                d.hideModal()
            })
        },hideModal: function(d) {
            this.$element.hide().trigger("hidden");
            if (this.options.dynamic) {
                this.$element.insertAfter(this.$elementWrapper);
                this.$elementWrapper.remove();
                this.$elementWrapper = null
            }
            this.backdrop()
        },removeBackdrop: function() {
            this.$element.insertAfter(this.$backdrop);
            this.$backdrop.remove();
            this.$backdrop = null;
            b("body").css({overflow: ""})
            b('html').css({'overflow-y': ''});
        },backdrop: function(g) {
            var f = this, e = this.$element.hasClass("fade") ? "fade" : "";
            if (this.isShown && this.options.backdrop) {
                var d = b.support.transition && e;
                this.$backdrop = b('<div class="modal-backdrop ' + e + '" />').appendTo(document.body);
                if (!f.$element.parent().length) {
                    this.$backdrop.appendTo(document.body)
                } else {
                    if (this.options.dynamic) {
                        this.$backdrop.insertBefore(this.$elementWrapper)
                    } else {
                        this.$backdrop.insertBefore(this.$element)
                    }
                }
                if (this.options.dynamic) {
                    this.$elementWrapper.prependTo(this.$backdrop).delegate('[data-dismiss="modal"]', "click.dismiss.modal", b.proxy(this.hide, this))
                } else {
                    this.$element.prependTo(this.$backdrop).delegate('[data-dismiss="modal"]', "click.dismiss.modal", b.proxy(this.hide, this))
                }
                b("body").css({overflow: "hidden"});
                b('html').css({'overflow-y': 'hidden'});
                this.$backdrop.on("click", function(h) {
                    if (f.options.backdrop == "static") {
                        b.proxy(f.$element[0].focus, f.$element[0])
                    } else {
                        if (h.target == h.delegateTarget) {
                            f.hide(h)
                        }
                    }
                });
                if (d) {
                    this.$backdrop[0].offsetWidth
                }
                this.$backdrop.addClass("in");
                d ? this.$backdrop.one(b.support.transition.end, g) : g()
            } else {
                if (!this.isShown && this.$backdrop) {
                    this.$backdrop.removeClass("in");
                    b.support.transition && this.$element.hasClass("fade") ? this.$backdrop.one(b.support.transition.end, b.proxy(this.removeBackdrop, this)) : this.removeBackdrop()
                } else {
                    if (g) {
                        g()
                    }
                }
            }
        }};
    b.fn.modal = function(d) {
        return this.each(function() {
            var g = b(this), f = g.data("modal"), e = b.extend({}, b.fn.modal.defaults, g.data(), typeof d == "object" && d);
            if (!f) {
                g.data("modal", (f = new a(this, e)))
            }
            if (typeof d == "string") {
                f[d]()
            } else {
                if (e.show) {
                    f.show()
                }
            }
        })
    };
    b.fn.modal.defaults = {backdrop: true,keyboard: true,show: true};
    b.fn.modal.Constructor = a;
    b(document).on("click.modal.data-api", '[data-toggle="modal"]', function(j) {
        var h = b(this), f = h.attr("href"), d = b(h.attr("data-target") || (f && f.replace(/.*(?=#[^\s]+$)/, ""))), g = d.data("modal") ? "toggle" : b.extend({remote: !/#/.test(f) && f}, d.data(), h.data());
        j.preventDefault();
        d.modal(g).one("hide", function() {
            h.focus()
        })
    })
}(window.jQuery);

//bootstrap tabs
!function(d) {
    var b = function(e) {
        this.element = d(e)
    };
    b.prototype = {constructor: b,show: function() {
            var l = this.element, h = l.closest("ul:not(.dropdown-menu)"), g = l.attr("data-target"), j, f, k;
            if (!g) {
                g = l.attr("href");
                g = g && g.replace(/.*(?=#[^\s]*$)/, "")
            }
            if (l.parent("li").hasClass("active")) {
                return
            }
            j = h.find(".active:last a")[0];
            k = d.Event("show", {relatedTarget: j});
            l.trigger(k);
            if (k.isDefaultPrevented()) {
                return
            }
            f = d(g);
            this.activate(l.parent("li"), h);
            this.activate(f, f.parent(), function() {
                l.trigger({type: "shown",relatedTarget: j})
            })
        },activate: function(g, f, k) {
            var e = f.find("> .active"), j = k && d.support.transition && e.hasClass("fade") && !isMobile;
            function h() {
                e.removeClass("active").find("> .dropdown-menu > .active").removeClass("active");
                g.addClass("active");
                if (j) {
                    g[0].offsetWidth;
                    g.addClass("in")
                } else {
                    g.removeClass("fade")
                }
                if (g.parent(".dropdown-menu")) {
                    g.closest("li.dropdown").addClass("active")
                }
                k && k()
            }
            j ? e.one(d.support.transition.end, h) : h();
            e.removeClass("in")
        }};
    var a = d.fn.tab;
    d.fn.tab = function(e) {
        return this.each(function() {
            var g = d(this), f = g.data("tab");
            if (!f) {
                g.data("tab", (f = new b(this)))
            }
            if (typeof e == "string") {
                f[e]()
            }
        })
    };
    d.fn.tab.Constructor = b;
    d.fn.tab.noConflict = function() {
        d.fn.tab = a;
        return this
    };
    d(document).on("click.tab.data-api", '[data-toggle="tab"], [data-toggle="pill"]', function(f) {
        f.preventDefault();
        d(this).tab("show")
    })
}(window.jQuery);

/* ========================================================================
 * Bootstrap: affix.js v3.3.5
 * http://getbootstrap.com/javascript/#affix
 * ========================================================================
 * Copyright 2011-2015 Twitter, Inc.
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 * ======================================================================== 
 */
+function ($) {
  'use strict';

  // AFFIX CLASS DEFINITION
  // ======================

  var Affix = function (element, options) {
    this.options = $.extend({}, Affix.DEFAULTS, options)

    this.$target = $(this.options.target)
      .on('scroll.bs.affix.data-api', $.proxy(this.checkPosition, this))
      .on('click.bs.affix.data-api',  $.proxy(this.checkPositionWithEventLoop, this))

    this.$element     = $(element)
    this.affixed      = null
    this.unpin        = null
    this.pinnedOffset = null

    this.checkPosition()
  }

  Affix.VERSION  = '3.3.5'

  Affix.RESET    = 'affix affix-top affix-bottom'

  Affix.DEFAULTS = {
    offset: 0,
    target: window
  }

  Affix.prototype.getState = function (scrollHeight, height, offsetTop, offsetBottom) {
    var scrollTop    = this.$target.scrollTop()
    var position     = this.$element.offset()
    var targetHeight = this.$target.height()

    if (offsetTop != null && this.affixed == 'top') return scrollTop < offsetTop ? 'top' : false

    if (this.affixed == 'bottom') {
      if (offsetTop != null) return (scrollTop + this.unpin <= position.top) ? false : 'bottom'
      return (scrollTop + targetHeight <= scrollHeight - offsetBottom) ? false : 'bottom'
    }

    var initializing   = this.affixed == null
    var colliderTop    = initializing ? scrollTop : position.top
    var colliderHeight = initializing ? targetHeight : height

    if (offsetTop != null && scrollTop <= offsetTop) return 'top'
    if (offsetBottom != null && (colliderTop + colliderHeight >= scrollHeight - offsetBottom)) return 'bottom'

    return false
  }

  Affix.prototype.getPinnedOffset = function () {
    if (this.pinnedOffset) return this.pinnedOffset
    this.$element.removeClass(Affix.RESET).addClass('affix')
    var scrollTop = this.$target.scrollTop()
    var position  = this.$element.offset()
    return (this.pinnedOffset = position.top - scrollTop)
  }

  Affix.prototype.checkPositionWithEventLoop = function () {
    setTimeout($.proxy(this.checkPosition, this), 1)
  }

  Affix.prototype.checkPosition = function () {
    if (!this.$element.is(':visible')) return

    var height       = this.$element.height()
    var offset       = this.options.offset
    var offsetTop    = offset.top
    var offsetBottom = offset.bottom
    var scrollHeight = Math.max($(document).height(), $(document.body).height())

    if (typeof offset != 'object')         offsetBottom = offsetTop = offset
    if (typeof offsetTop == 'function')    offsetTop    = offset.top(this.$element)
    if (typeof offsetBottom == 'function') offsetBottom = offset.bottom(this.$element)

    var affix = this.getState(scrollHeight, height, offsetTop, offsetBottom)

    if (this.affixed != affix) {
      if (this.unpin != null) this.$element.css('top', '')

      var affixType = 'affix' + (affix ? '-' + affix : '')
      var e         = $.Event(affixType + '.bs.affix')

      this.$element.trigger(e)

      if (e.isDefaultPrevented()) return

      this.affixed = affix
      this.unpin = affix == 'bottom' ? this.getPinnedOffset() : null

      this.$element
        .removeClass(Affix.RESET)
        .addClass(affixType)
        .trigger(affixType.replace('affix', 'affixed') + '.bs.affix')
    }

    if (affix == 'bottom') {
      this.$element.offset({
        top: scrollHeight - height - offsetBottom
      })
    }
  }


  // AFFIX PLUGIN DEFINITION
  // =======================

  function Plugin(option) {
    return this.each(function () {
      var $this   = $(this)
      var data    = $this.data('bs.affix')
      var options = typeof option == 'object' && option

      if (!data) $this.data('bs.affix', (data = new Affix(this, options)))
      if (typeof option == 'string') data[option]()
    })
  }

  var old = $.fn.affix

  $.fn.affix             = Plugin
  $.fn.affix.Constructor = Affix


  // AFFIX NO CONFLICT
  // =================

  $.fn.affix.noConflict = function () {
    $.fn.affix = old
    return this
  }


  // AFFIX DATA-API
  // ==============

  $(window).on('load', function () {
    $('[data-spy="affix"]').each(function () {
      var $spy = $(this)
      var data = $spy.data()

      data.offset = data.offset || {}

      if (data.offsetBottom != null) data.offset.bottom = data.offsetBottom
      if (data.offsetTop    != null) data.offset.top    = data.offsetTop

      Plugin.call($spy, data)
    })
  })

}(jQuery);
