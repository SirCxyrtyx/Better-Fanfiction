//jshint strict: false

//$.toast(message [, displaytime = 2500])
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

//bootsrap tabs
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